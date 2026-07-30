(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;

  const formulaTests = U.getPath("phase_06_preliminary_pressure_design/formula_test_cases.json")?.test_cases || [];
  const designWarnings = U.getPath("phase_06_preliminary_pressure_design/design_warning_catalog.json")?.messages || [];
  const warningMap = new Map(designWarnings.map(item => [item.code, {
    code: item.code,
    severity: item.severity,
    title: item.code.replaceAll("_", " "),
    message: item.message
  }]));

  const componentCatalog = {
    cylindrical_shell: {
      label: "Cylindrical shell",
      fields: []
    },
    ellipsoidal_2_to_1_head: {
      label: "2:1 ellipsoidal head",
      fields: []
    },
    ellipsoidal_generic_head: {
      label: "General ellipsoidal head",
      fields: ["head_depth"]
    },
    torispherical_100_6_head: {
      // Plain language in the user interface; the 100-6 proportions are fixed internally.
      label: "Torispherical head (standard size)",
      fields: []
    },
    torispherical_generic_head: {
      label: "General torispherical head",
      fields: ["crown_radius", "knuckle_radius"]
    },
    hemispherical_head: {
      label: "Hemispherical head",
      fields: []
    },
    conical_section: {
      label: "Conical section",
      fields: ["cone_half_apex_angle"]
    }
  };

  const formedHeadTypes = new Set([
    "ellipsoidal_2_to_1_head",
    "ellipsoidal_generic_head",
    "torispherical_100_6_head",
    "torispherical_generic_head",
    "hemispherical_head"
  ]);

  function issue(code, severity = "blocking", message = "Calculation cannot proceed.") {
    return warningMap.get(code) || {
      code,
      severity,
      title: code.replaceAll("_", " "),
      message
    };
  }

  function denominator(value, errors, label = "formula denominator") {
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(issue("E_NONPOSITIVE_DENOMINATOR"));
      return null;
    }
    return value;
  }

  function formulaResult(formulaId, equation, value, basis, inputs, label) {
    return {
      formula_id: formulaId,
      equation,
      value,
      basis,
      inputs,
      label
    };
  }

  function normalize(raw) {
    const pressureMPa = U.convertPressure(raw.design_pressure, raw.pressure_unit, "MPa");
    const staticHeadMPa = U.convertPressure(raw.static_head_pressure || 0, raw.pressure_unit, "MPa") || 0;
    const totalPressureMPa = pressureMPa === null ? null : pressureMPa + staticHeadMPa;
    const designStressMPa = U.convertPressure(raw.allowable_stress_design, raw.stress_unit, "MPa");
    const ambientStressMPa = U.convertPressure(raw.allowable_stress_ambient, raw.stress_unit, "MPa");
    const diameterMM = U.convertLength(raw.diameter, raw.length_unit, "mm");
    const headDepthMM = U.convertLength(raw.head_depth, raw.length_unit, "mm");
    const crownRadiusMM = U.convertLength(raw.crown_radius, raw.length_unit, "mm");
    const knuckleRadiusMM = U.convertLength(raw.knuckle_radius, raw.length_unit, "mm");
    const caMM = U.convertLength(raw.corrosion_allowance || 0, raw.length_unit, "mm") || 0;
    const formingMM = U.convertLength(raw.forming_allowance || 0, raw.length_unit, "mm") || 0;
    const otherMM = U.convertLength(raw.other_allowance || 0, raw.length_unit, "mm") || 0;
    const nominalMM = U.convertLength(raw.available_nominal_thickness, raw.length_unit, "mm");

    return {
      ...raw,
      P_design: pressureMPa,
      P_static: staticHeadMPa,
      P: totalPressureMPa,
      S: designStressMPa,
      Sa: ambientStressMPa,
      D: diameterMM,
      h: headDepthMM,
      L: crownRadiusMM,
      r: knuckleRadiusMM,
      CA: caMM,
      forming: formingMM,
      other: otherMM,
      nominal: nominalMM,
      head_forming_thinning_percent: Number(raw.head_forming_thinning_percent || 0),
      E: Number(raw.joint_efficiency),
      alpha_deg: Number(raw.cone_half_apex_angle)
    };
  }

  function validate(n) {
    const errors = [];
    if (!String(n.controlled_code_edition || "").trim()) {
      errors.push(issue("E_CONTROLLED_CODE_BASIS_REQUIRED"));
    }
    if (!(Number.isFinite(n.P) && n.P > 0)) {
      errors.push(issue("E_PRESSURE_POSITIVE", "blocking", "Design pressure including static head must be greater than zero."));
    }
    if (!(Number.isFinite(n.S) && n.S > 0)) {
      errors.push(issue("E_ALLOWABLE_STRESS_POSITIVE", "blocking", "Design-temperature allowable stress must be greater than zero."));
    }
    if (!(Number.isFinite(n.E) && n.E > 0 && n.E <= 1)) {
      errors.push(issue("E_JOINT_EFFICIENCY_RANGE", "blocking", "Joint efficiency must be greater than zero and not greater than 1.0."));
    }
    if (!(Number.isFinite(n.D) && n.D > 0)) {
      errors.push(issue("E_GEOMETRY_POSITIVE", "blocking", "Diameter must be greater than zero."));
    }
    if (!String(n.allowable_stress_source_reference || "").trim()) {
      errors.push(issue("E_STRESS_SOURCE_REQUIRED"));
    }
    if (!(n.CA >= 0 && n.forming >= 0 && n.other >= 0)) {
      errors.push(issue("E_CORROSION_ALLOWANCE_NONNEGATIVE", "blocking", "All thickness additions must be zero or positive."));
    }
    if (!(n.head_forming_thinning_percent >= 0 && n.head_forming_thinning_percent < 100)) {
      errors.push(issue("E_HEAD_FORMING_THINNING_RANGE", "blocking", "Head forming thinning must be at least 0% and less than 100%."));
    }
    if (!componentCatalog[n.component_type]) {
      errors.push(issue("E_COMPONENT_TYPE", "blocking", "Select a supported component type."));
    }
    if (!["inside", "outside"].includes(n.diameter_basis)) {
      errors.push(issue("E_DIAMETER_BASIS", "blocking", "Select inside or outside diameter basis."));
    }
    if (n.component_type === "ellipsoidal_generic_head" && !(Number.isFinite(n.h) && n.h > 0)) {
      errors.push(issue("E_HEAD_DEPTH", "blocking", "Enter a positive head depth for a general ellipsoidal head."));
    }
    if (n.component_type === "torispherical_generic_head") {
      if (!(Number.isFinite(n.L) && n.L > 0 && Number.isFinite(n.r) && n.r > 0)) {
        errors.push(issue("E_TORI_GEOMETRY", "blocking", "Enter positive crown and knuckle radii."));
      }
    }
    if (n.component_type === "conical_section" &&
        !(Number.isFinite(n.alpha_deg) && n.alpha_deg >= 0 && n.alpha_deg < 90)) {
      errors.push(issue("E_CONE_ANGLE_INVALID", "blocking", "Cone half-apex angle must be at least 0° and less than 90°."));
    }
    if ((n.enable_map_mawp || n.enable_hydrotest) && !(Number.isFinite(n.nominal) && n.nominal > 0)) {
      errors.push(issue("E_AVAILABLE_THICKNESS", "blocking", "Enter the available nominal thickness to calculate MAP and MAWP."));
    }
    if ((n.enable_map_mawp || n.enable_hydrotest) && !(Number.isFinite(n.Sa) && n.Sa > 0)) {
      errors.push(issue("E_AMBIENT_STRESS", "blocking", "Enter a positive ambient-temperature allowable stress for MAP or hydrotest screening."));
    }
    if (Number.isFinite(n.nominal) && n.nominal <= n.CA + n.forming + n.other) {
      errors.push(issue("E_AVAILABLE_THICKNESS_NOT_ABOVE_CA", "blocking", "Available nominal thickness must exceed all deducted allowances."));
    }
    return errors;
  }

  function geometry(n, pressureThicknessEstimate = 0) {
    const basis = n.diameter_basis;
    const Di = basis === "inside" ? n.D : n.D - 2 * pressureThicknessEstimate;
    const Do = basis === "outside" ? n.D : n.D + 2 * pressureThicknessEstimate;
    const Ri = Di / 2;
    const Ro = Do / 2;
    return { basis, Di, Do, Ri, Ro };
  }

  function calculateThickness(n, errors) {
    const P = n.P, S = n.S, E = n.E;
    const basis = n.diameter_basis;
    const g0 = geometry(n, 0);
    const results = [];
    let governing = null;
    let factors = {};

    if (n.component_type === "cylindrical_shell") {
      if (basis === "inside") {
        const dLong = denominator(2 * S * E + 0.4 * P, errors);
        const dCirc = denominator(S * E - 0.6 * P, errors);
        if (!dLong || !dCirc) return null;
        results.push(formulaResult(
          "SH_LONG_T_ID",
          "t = (P × Ri) / (2 × S × E + 0.4 × P)",
          P * g0.Ri / dLong,
          "inside_radius",
          { P, Ri: g0.Ri, S, E },
          "Longitudinal stress basis"
        ));
        results.push(formulaResult(
          "SH_CIRC_T_ID",
          "t = (P × Ri) / (S × E − 0.6 × P)",
          P * g0.Ri / dCirc,
          "inside_radius",
          { P, Ri: g0.Ri, S, E },
          "Circumferential stress basis"
        ));
      } else {
        const dLong = denominator(2 * S * E + 1.4 * P, errors);
        const dCirc = denominator(S * E + 0.4 * P, errors);
        if (!dLong || !dCirc) return null;
        results.push(formulaResult(
          "SH_LONG_T_OD",
          "t = (P × Ro) / (2 × S × E + 1.4 × P)",
          P * g0.Ro / dLong,
          "outside_radius",
          { P, Ro: g0.Ro, S, E },
          "Longitudinal stress basis"
        ));
        results.push(formulaResult(
          "SH_CIRC_T_OD",
          "t = (P × Ro) / (S × E + 0.4 × P)",
          P * g0.Ro / dCirc,
          "outside_radius",
          { P, Ro: g0.Ro, S, E },
          "Circumferential stress basis"
        ));
      }
      governing = results.reduce((a, b) => a.value >= b.value ? a : b);
    }

    if (n.component_type === "hemispherical_head") {
      if (basis === "inside") {
        const d = denominator(2 * S * E - 0.2 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "HEMI_T_ID",
          "t = (P × Ri) / (2 × S × E − 0.2 × P)",
          P * g0.Ri / d,
          "inside_radius",
          { P, Ri: g0.Ri, S, E },
          "Hemispherical head"
        );
      } else {
        const d = denominator(2 * S * E + 0.8 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "HEMI_T_OD",
          "t = (P × Ro) / (2 × S × E + 0.8 × P)",
          P * g0.Ro / d,
          "outside_radius",
          { P, Ro: g0.Ro, S, E },
          "Hemispherical head"
        );
      }
      results.push(governing);
    }

    if (n.component_type === "ellipsoidal_2_to_1_head") {
      if (basis === "inside") {
        const d = denominator(2 * S * E - 0.2 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "ELLIP_2_1_T_ID",
          "t = (P × Di) / (2 × S × E − 0.2 × P)",
          P * g0.Di / d,
          "inside_diameter",
          { P, Di: g0.Di, S, E },
          "2:1 ellipsoidal head"
        );
      } else {
        const d = denominator(2 * S * E + 1.8 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "ELLIP_2_1_T_OD",
          "t = (P × Do) / (2 × S × E + 1.8 × P)",
          P * g0.Do / d,
          "outside_diameter",
          { P, Do: g0.Do, S, E },
          "2:1 ellipsoidal head"
        );
      }
      results.push(governing);
    }

    if (n.component_type === "ellipsoidal_generic_head") {
      const K = 0.167 * (2 + (g0.Di / (2 * n.h)) ** 2);
      factors.K = K;
      if (basis === "inside") {
        const d = denominator(2 * S * E - 0.2 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "ELLIP_GENERIC_T_ID",
          "t = (P × Di × K) / (2 × S × E − 0.2 × P)",
          P * g0.Di * K / d,
          "inside_diameter",
          { P, Di: g0.Di, K, S, E },
          "General ellipsoidal head"
        );
      } else {
        const d = denominator(2 * S * E + 2 * P * (K - 0.1), errors);
        if (!d) return null;
        governing = formulaResult(
          "ELLIP_GENERIC_T_OD",
          "t = (P × Do × K) / (2 × S × E + 2 × P × (K − 0.1))",
          P * g0.Do * K / d,
          "outside_diameter",
          { P, Do: g0.Do, K, S, E },
          "General ellipsoidal head"
        );
      }
      results.push(governing);
    }

    if (n.component_type === "torispherical_100_6_head") {
      const L = n.D;
      factors.L = L;
      factors.r = 0.06 * n.D;
      if (basis === "inside") {
        const d = denominator(S * E - 0.1 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "TORI_100_6_T_ID",
          "t = (0.885 × P × Li) / (S × E − 0.1 × P)",
          0.885 * P * L / d,
          "inside_crown_radius",
          { P, Li: L, S, E },
          "Standard torispherical head"
        );
      } else {
        const d = denominator(S * E + 0.8 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "TORI_100_6_T_OD",
          "t = (0.885 × P × Lo) / (S × E + 0.8 × P)",
          0.885 * P * L / d,
          "outside_crown_radius",
          { P, Lo: L, S, E },
          "Standard torispherical head"
        );
      }
      results.push(governing);
    }

    if (n.component_type === "torispherical_generic_head") {
      const M = 0.25 * (3 + Math.sqrt(n.L / n.r));
      factors.M = M;
      factors.L_over_r = n.L / n.r;
      if (basis === "inside") {
        const d = denominator(2 * S * E - 0.2 * P, errors);
        if (!d) return null;
        governing = formulaResult(
          "TORI_GENERIC_T_ID",
          "t = (P × Li × M) / (2 × S × E − 0.2 × P)",
          P * n.L * M / d,
          "inside_crown_radius",
          { P, Li: n.L, M, S, E },
          "General torispherical head"
        );
      } else {
        const d = denominator(2 * S * E + P * (M - 0.2), errors);
        if (!d) return null;
        governing = formulaResult(
          "TORI_GENERIC_T_OD",
          "t = (P × Lo × M) / (2 × S × E + P × (M − 0.2))",
          P * n.L * M / d,
          "outside_crown_radius",
          { P, Lo: n.L, M, S, E },
          "General torispherical head"
        );
      }
      results.push(governing);
    }

    if (n.component_type === "conical_section") {
      const alpha = n.alpha_deg * Math.PI / 180;
      const c = Math.cos(alpha);
      factors.cos_alpha = c;
      if (basis === "inside") {
        const dLong = denominator(4 * c * (S * E + 0.4 * P), errors);
        const dCirc = denominator(2 * c * (S * E - 0.6 * P), errors);
        if (!dLong || !dCirc) return null;
        results.push(formulaResult(
          "CONE_LONG_T_ID",
          "t = (P × Di) / (4 × cos α × (S × E + 0.4 × P))",
          P * g0.Di / dLong,
          "inside_diameter",
          { P, Di: g0.Di, alpha: n.alpha_deg, S, E },
          "Cone longitudinal basis"
        ));
        results.push(formulaResult(
          "CONE_CIRC_T_ID",
          "t = (P × Di) / (2 × cos α × (S × E − 0.6 × P))",
          P * g0.Di / dCirc,
          "inside_diameter",
          { P, Di: g0.Di, alpha: n.alpha_deg, S, E },
          "Cone circumferential basis"
        ));
      } else {
        const dLong = denominator(4 * c * (S * E + 1.4 * P), errors);
        const dCirc = denominator(2 * c * (S * E + 0.4 * P), errors);
        if (!dLong || !dCirc) return null;
        results.push(formulaResult(
          "CONE_LONG_T_OD",
          "t = (P × Do) / (4 × cos α × (S × E + 1.4 × P))",
          P * g0.Do / dLong,
          "outside_diameter",
          { P, Do: g0.Do, alpha: n.alpha_deg, S, E },
          "Cone longitudinal basis"
        ));
        results.push(formulaResult(
          "CONE_CIRC_T_OD",
          "t = (P × Do) / (2 × cos α × (S × E + 0.4 × P))",
          P * g0.Do / dCirc,
          "outside_diameter",
          { P, Do: g0.Do, alpha: n.alpha_deg, S, E },
          "Cone circumferential basis"
        ));
      }
      governing = results.reduce((a, b) => a.value >= b.value ? a : b);
    }

    return {
      candidates: results,
      governing,
      factors,
      geometry: geometry(n, governing?.value || 0)
    };
  }

  function pressureCapacity(n, t, stress) {
    if (!(Number.isFinite(t) && t > 0 && Number.isFinite(stress) && stress > 0)) return null;
    const errors = [];
    const basis = n.diameter_basis;
    const g = geometry(n, t);
    const E = n.E;
    const candidates = [];

    function add(id, equation, denomValue, numerator, label, inputs) {
      const d = denominator(denomValue, errors);
      if (!d) return;
      candidates.push(formulaResult(id, equation, numerator / d, basis, inputs, label));
    }

    if (n.component_type === "cylindrical_shell") {
      if (basis === "inside") {
        add("SH_LONG_P_ID", "P = (2 × S × E × t) / (Ri − 0.4 × t)",
          g.Ri - 0.4 * t, 2 * stress * E * t, "Longitudinal capacity", { S: stress, E, t, Ri: g.Ri });
        add("SH_CIRC_P_ID", "P = (S × E × t) / (Ri + 0.6 × t)",
          g.Ri + 0.6 * t, stress * E * t, "Circumferential capacity", { S: stress, E, t, Ri: g.Ri });
      } else {
        add("SH_LONG_P_OD", "P = (2 × S × E × t) / (Ro − 1.4 × t)",
          g.Ro - 1.4 * t, 2 * stress * E * t, "Longitudinal capacity", { S: stress, E, t, Ro: g.Ro });
        add("SH_CIRC_P_OD", "P = (S × E × t) / (Ro − 0.4 × t)",
          g.Ro - 0.4 * t, stress * E * t, "Circumferential capacity", { S: stress, E, t, Ro: g.Ro });
      }
    }

    if (n.component_type === "hemispherical_head") {
      if (basis === "inside") {
        add("HEMI_P_ID", "P = (2 × S × E × t) / (Ri + 0.2 × t)",
          g.Ri + 0.2 * t, 2 * stress * E * t, "Hemispherical capacity", { S: stress, E, t, Ri: g.Ri });
      } else {
        add("HEMI_P_OD", "P = (2 × S × E × t) / (Ro − 0.8 × t)",
          g.Ro - 0.8 * t, 2 * stress * E * t, "Hemispherical capacity", { S: stress, E, t, Ro: g.Ro });
      }
    }

    if (n.component_type === "ellipsoidal_2_to_1_head") {
      if (basis === "inside") {
        add("ELLIP_2_1_P_ID", "P = (2 × S × E × t) / (Di + 0.2 × t)",
          g.Di + 0.2 * t, 2 * stress * E * t, "2:1 ellipsoidal capacity", { S: stress, E, t, Di: g.Di });
      } else {
        add("ELLIP_2_1_P_OD", "P = (2 × S × E × t) / (Do − 1.8 × t)",
          g.Do - 1.8 * t, 2 * stress * E * t, "2:1 ellipsoidal capacity", { S: stress, E, t, Do: g.Do });
      }
    }

    if (n.component_type === "ellipsoidal_generic_head") {
      const K = 0.167 * (2 + (g.Di / (2 * n.h)) ** 2);
      if (basis === "inside") {
        add("ELLIP_GENERIC_P_ID", "P = (2 × S × E × t) / (K × Di + 0.2 × t)",
          K * g.Di + 0.2 * t, 2 * stress * E * t, "General ellipsoidal capacity",
          { S: stress, E, t, K, Di: g.Di });
      } else {
        add("ELLIP_GENERIC_P_OD", "P = (2 × S × E × t) / (K × Do − 2 × t × (K − 0.1))",
          K * g.Do - 2 * t * (K - 0.1), 2 * stress * E * t, "General ellipsoidal capacity",
          { S: stress, E, t, K, Do: g.Do });
      }
    }

    if (n.component_type === "torispherical_100_6_head") {
      const L = n.D;
      if (basis === "inside") {
        add("TORI_100_6_P_ID", "P = (S × E × t) / (0.885 × Li + 0.1 × t)",
          0.885 * L + 0.1 * t, stress * E * t, "Standard torispherical head capacity",
          { S: stress, E, t, Li: L });
      } else {
        add("TORI_100_6_P_OD", "P = (S × E × t) / (0.885 × Lo − 0.8 × t)",
          0.885 * L - 0.8 * t, stress * E * t, "Standard torispherical head capacity",
          { S: stress, E, t, Lo: L });
      }
    }

    if (n.component_type === "torispherical_generic_head") {
      const M = 0.25 * (3 + Math.sqrt(n.L / n.r));
      if (basis === "inside") {
        add("TORI_GENERIC_P_ID", "P = (2 × S × E × t) / (Li × M + 0.2 × t)",
          n.L * M + 0.2 * t, 2 * stress * E * t, "General torispherical capacity",
          { S: stress, E, t, Li: n.L, M });
      } else {
        add("TORI_GENERIC_P_OD", "P = (2 × S × E × t) / (Lo × M − t × (M − 0.2))",
          n.L * M - t * (M - 0.2), 2 * stress * E * t, "General torispherical capacity",
          { S: stress, E, t, Lo: n.L, M });
      }
    }

    if (n.component_type === "conical_section") {
      const c = Math.cos(n.alpha_deg * Math.PI / 180);
      if (basis === "inside") {
        add("CONE_LONG_P_ID", "P = (4 × S × E × t × cos α) / (Di − 0.8 × t × cos α)",
          g.Di - 0.8 * t * c, 4 * stress * E * t * c, "Cone longitudinal capacity",
          { S: stress, E, t, alpha: n.alpha_deg, Di: g.Di });
        add("CONE_CIRC_P_ID", "P = (2 × S × E × t × cos α) / (Di + 1.2 × t × cos α)",
          g.Di + 1.2 * t * c, 2 * stress * E * t * c, "Cone circumferential capacity",
          { S: stress, E, t, alpha: n.alpha_deg, Di: g.Di });
      } else {
        add("CONE_LONG_P_OD", "P = (4 × S × E × t × cos α) / (Do − 2.8 × t × cos α)",
          g.Do - 2.8 * t * c, 4 * stress * E * t * c, "Cone longitudinal capacity",
          { S: stress, E, t, alpha: n.alpha_deg, Do: g.Do });
        add("CONE_CIRC_P_OD", "P = (2 × S × E × t × cos α) / (Do − 0.8 × t × cos α)",
          g.Do - 0.8 * t * c, 2 * stress * E * t * c, "Cone circumferential capacity",
          { S: stress, E, t, alpha: n.alpha_deg, Do: g.Do });
      }
    }

    if (!candidates.length) return { errors, candidates: [], governing: null };
    return {
      errors,
      candidates,
      governing: candidates.reduce((a, b) => a.value <= b.value ? a : b)
    };
  }

  function applicability(n, calc) {
    const checks = [];
    const Ppsi = U.convertPressure(n.P, "MPa", "psi");
    const pressureKgfCm2 = U.convertPressure(n.P, "MPa", "kgf_per_cm2");
    const limitKgfCm2 = U.convertPressure(3000, "psi", "kgf_per_cm2");
    checks.push({
      id: "APP_PRESSURE_MAX_3000_PSI",
      label: "Source pressure range",
      pass: Ppsi < 3000,
      actual: `${U.formatNumber(pressureKgfCm2, 3)} kgf/cm²`,
      limit: `< ${U.formatNumber(limitKgfCm2, 3)} kgf/cm²`
    });

    const t = calc.governing.value;
    const g = calc.geometry;
    if (n.component_type === "cylindrical_shell") {
      const pass = (t <= 0.5 * g.Ri) || (n.P <= 0.385 * n.S * n.E);
      checks.push({
        id: "APP_SHELL_THICKNESS_OR_PRESSURE_RATIO",
        label: "Shell source formula range",
        pass,
        actual: `t/Ri ${U.formatNumber(t / g.Ri, 4)}; P/(SE) ${U.formatNumber(n.P / (n.S * n.E), 4)}`,
        limit: "t ≤ 0.5Ri OR P ≤ 0.385SE"
      });
    }

    if (n.component_type === "hemispherical_head") {
      const pass = (t <= 0.356 * g.Ri) || (n.P <= 0.665 * n.S * n.E);
      checks.push({
        id: "APP_SPHERE_THICKNESS_OR_PRESSURE_RATIO",
        label: "Spherical source formula range",
        pass,
        actual: `t/Ri ${U.formatNumber(t / g.Ri, 4)}; P/(SE) ${U.formatNumber(n.P / (n.S * n.E), 4)}`,
        limit: "t ≤ 0.356Ri OR P ≤ 0.665SE"
      });
    }

    if (n.component_type === "torispherical_generic_head") {
      const ratio = n.L / n.r;
      checks.push({
        id: "APP_TORI_L_OVER_R_LT_16_66",
        label: "Torispherical geometry range",
        pass: ratio < 16.66,
        actual: `L/r = ${U.formatNumber(ratio, 3)}`,
        limit: "L/r < 16.66"
      });
    }

    if (n.component_type === "conical_section") {
      checks.push({
        id: "APP_CONE_ANGLE",
        label: "Cone half-apex angle",
        pass: n.alpha_deg >= 0 && n.alpha_deg < 90,
        actual: `${U.formatNumber(n.alpha_deg, 2)}°`,
        limit: "0° ≤ α < 90°"
      });
    }
    return checks;
  }

  function calculate(raw) {
    const n = normalize(raw);
    const errors = validate(n);
    const warnings = [
      issue("W_HISTORICAL_JOINT_EFFICIENCY"),
      issue("W_OTHER_LOADS_NOT_CHECKED")
    ];
    if (!n.external_pressure_check_enabled) warnings.push(issue("W_EXTERNAL_PRESSURE_NOT_CHECKED"));
    if (n.agitator_required && n.include_agitator_warning !== false) {
      warnings.push(issue("W_AGITATOR_MIXER_REVIEW"));
    }

    if (errors.length) {
      return {
        module_id: "preliminary_pressure_design",
        status: "blocked",
        severity: "blocking",
        input: raw,
        normalized_input: n,
        errors,
        warnings,
        generated_at: U.timestamp()
      };
    }

    const thickness = calculateThickness(n, errors);
    if (!thickness || errors.length) {
      return {
        module_id: "preliminary_pressure_design",
        status: "blocked",
        severity: "blocking",
        input: raw,
        normalized_input: n,
        errors,
        warnings,
        generated_at: U.timestamp()
      };
    }

    const checks = applicability(n, thickness);
    const failedChecks = checks.filter(check => !check.pass);
    if (failedChecks.length) errors.push(issue("E_FORMULA_OUTSIDE_APPLICABILITY"));

    const pressureThickness = thickness.governing.value;
    const usesHeadFormingThinning = formedHeadTypes.has(n.component_type) && n.head_forming_thinning_percent > 0;
    const retainedFormedThicknessFraction = usesHeadFormingThinning ? 1 - (n.head_forming_thinning_percent / 100) : 1;
    const pressureAndAllowancesBeforeThinning = pressureThickness + n.CA + n.other;
    const thicknessAfterPercentageAllowance = pressureAndAllowancesBeforeThinning / retainedFormedThicknessFraction;
    const headFormingThinningAllowance = thicknessAfterPercentageAllowance - pressureAndAllowancesBeforeThinning;
    const requiredNew = thicknessAfterPercentageAllowance + n.forming;
    const formedNominalThickness = Number.isFinite(n.nominal) ? (n.nominal * retainedFormedThicknessFraction) - n.forming : null;
    const available = Number.isFinite(n.nominal) ? {
      nominal: n.nominal,
      effective_corroded: formedNominalThickness - n.CA - n.other,
      effective_new_cold: formedNominalThickness - n.other,
      thickness_margin: n.nominal - requiredNew,
      adequate: n.nominal >= requiredNew
    } : null;

    let mawp = null;
    let map = null;
    if ((n.enable_map_mawp || n.enable_hydrotest) && available) {
      mawp = pressureCapacity(n, available.effective_corroded, n.S);
      map = pressureCapacity(n, available.effective_new_cold, n.Sa);
      if (mawp?.errors?.length || map?.errors?.length) {
        errors.push(...(mawp?.errors || []), ...(map?.errors || []));
      }
    }

    let hydrotest = null;
    if (n.enable_hydrotest) {
      if (mawp?.governing && map?.governing) {
        hydrotest = {
          shop_from_map_mpa: 1.3 * map.governing.value,
          shop_from_mawp_ratio_mpa: 1.3 * mawp.governing.value * (n.Sa / n.S),
          field_from_design_pressure_mpa: 1.3 * n.P_design,
          status: "historical_reference_review_required"
        };
      }
    }

    const severity = errors.length ? "blocking" :
      available && !available.adequate ? "fail" : "review";
    const status = errors.length ? "blocked" :
      available && !available.adequate ? "nominal_thickness_inadequate" :
      "preliminary_result_review_required";

    return {
      module_id: "preliminary_pressure_design",
      status,
      severity,
      input: raw,
      normalized_input: n,
      formula_results: thickness.candidates,
      governing_formula: thickness.governing,
      geometry: thickness.geometry,
      geometry_factors: thickness.factors,
      pressure_thickness_mm: pressureThickness,
      additions_mm: {
        corrosion_allowance: n.CA,
        forming_allowance: n.forming,
        head_forming_thinning_percent: usesHeadFormingThinning ? n.head_forming_thinning_percent : 0,
        head_forming_thinning_allowance: headFormingThinningAllowance,
        retained_formed_thickness_fraction: retainedFormedThicknessFraction,
        other_allowance: n.other,
        total: requiredNew - pressureThickness
      },
      minimum_required_new_thickness_mm: requiredNew,
      available_thickness: available,
      mawp: mawp?.governing ? {
        value_mpa: mawp.governing.value,
        formula: mawp.governing,
        candidates: mawp.candidates
      } : null,
      map: map?.governing ? {
        value_mpa: map.governing.value,
        formula: map.governing,
        candidates: map.candidates
      } : null,
      hydrotest,
      applicability_checks: checks,
      errors,
      warnings,
      source: {
        title: "Pressure Vessel Design Manual, Third Edition",
        procedures: ["Procedure 2-1", "Procedure 2-3"],
        status: "historical_reference"
      },
      generated_at: U.timestamp(),
      final_engineering_approval: false
    };
  }

  function evaluateFormula(formulaId, i) {
    switch (formulaId) {
      case "SH_CIRC_T_ID": return (i.P * i.Ri) / (i.S * i.E - 0.6 * i.P);
      case "SH_LONG_T_ID": return (i.P * i.Ri) / (2 * i.S * i.E + 0.4 * i.P);
      case "HEMI_T_ID": return (i.P * i.Ri) / (2 * i.S * i.E - 0.2 * i.P);
      case "ELLIP_2_1_T_ID": return (i.P * i.Di) / (2 * i.S * i.E - 0.2 * i.P);
      case "TORI_100_6_T_ID": return (0.885 * i.P * i.Li) / (i.S * i.E - 0.1 * i.P);
      case "GF_K_ELLIPSOIDAL": return 0.167 * (2 + (i.D / (2 * i.h)) ** 2);
      case "GF_M_TORISPHERICAL": return 0.25 * (3 + Math.sqrt(i.L / i.r));
      case "MAWP_SHELL_ID": return (i.SDT * i.E * i.t_sc) / (i.R_c + 0.6 * i.t_sc);
      case "MAP_ELLIP_2_1_ID": return (2 * i.Sa * i.E * i.t_hn) / (i.D_n + 0.2 * i.t_hn);
      case "SHOP_TEST_FROM_MAWP_STRESS_RATIO": return 1.3 * i.PW * (i.Sa / i.SDT);
      default: return null;
    }
  }

  root.DesignEngine = {
    componentCatalog,
    formulaTests,
    normalize,
    validate,
    calculate,
    pressureCapacity,
    evaluateFormula
  };
})();
