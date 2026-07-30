(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};

  // The data package permits calculated ASME 2021 reference-preview values,
  // but it does not approve construction or final mechanical design.
  const library = {
    id: "VESSELM_EXTERNAL_PRESSURE_CALCULATION_LOGIC",
    version: "1.1.0",
    designRule: "ASME BPVC Section VIII Division 1, 2023",
    chartSource: "ASME BPVC Section II Part D, Subpart 3, 2021 Metric",
    previewMode: "asme_2021_reference_preview"
  };

  const finite = value => Number.isFinite(value);
  const sameText = (a, b) => String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
  const interpolateLinear = (x, x1, y1, x2, y2) => y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  const interpolateLogLog = (x, x1, y1, x2, y2) => Math.exp(interpolateLinear(Math.log(x), Math.log(x1), Math.log(y1), Math.log(x2), Math.log(y2)));

  function bracket(points, value, key) {
    const ordered = [...points].filter(point => finite(point[key])).sort((a, b) => a[key] - b[key]);
    if (!ordered.length || value < ordered[0][key] || value > ordered[ordered.length - 1][key]) return null;
    const upperIndex = ordered.findIndex(point => value <= point[key]);
    return { lower: ordered[upperIndex - 1] || ordered[upperIndex], upper: ordered[upperIndex] };
  }

  function figureGFactorA(data, lengthOverDiameter, diameterOverThickness) {
    const curvePair = bracket(data.figure_G?.curves || [], diameterOverThickness, "Do_over_t");
    if (!curvePair) return null;
    const valueOnCurve = curve => {
      const pointPair = bracket(curve.points || [], lengthOverDiameter, "L_over_Do");
      if (!pointPair) return null;
      const { lower, upper } = pointPair;
      return lower === upper ? lower.factor_A : interpolateLogLog(lengthOverDiameter, lower.L_over_Do, lower.factor_A, upper.L_over_Do, upper.factor_A);
    };
    const lowerA = valueOnCurve(curvePair.lower);
    const upperA = valueOnCurve(curvePair.upper);
    if (!finite(lowerA) || !finite(upperA)) return null;
    return curvePair.lower === curvePair.upper ? lowerA : interpolateLogLog(diameterOverThickness, curvePair.lower.Do_over_t, lowerA, curvePair.upper.Do_over_t, upperA);
  }

  function factorBAtCurve(curve, factorA) {
    const points = curve.points || [];
    if (!points.length || factorA > points[points.length - 1].factor_A) return { status: "outside" };
    if (factorA < points[0].factor_A) return { status: "elastic" };
    const pair = bracket(points, factorA, "factor_A");
    if (!pair) return { status: "outside" };
    return {
      status: "value",
      value: pair.lower === pair.upper ? pair.lower.factor_B_mpa : interpolateLinear(Math.log(factorA), Math.log(pair.lower.factor_A), pair.lower.factor_B_mpa, Math.log(pair.upper.factor_A), pair.upper.factor_B_mpa)
    };
  }

  function resolveMaterialFactorB(data, chartId, designTemperatureC, factorA) {
    const chart = (data.material_charts || []).find(item => item.chart_id === chartId);
    const temperatureCurves = (chart?.curves || []).filter(item => finite(item.key?.value)).map(curve => ({ curve, temperature: curve.key.value }));
    const temperaturePair = bracket(temperatureCurves, designTemperatureC, "temperature");
    if (!temperaturePair) return { status: "outside_temperature" };
    const lower = factorBAtCurve(temperaturePair.lower.curve, factorA);
    const upper = factorBAtCurve(temperaturePair.upper.curve, factorA);
    if (lower.status === "outside" || upper.status === "outside") return { status: "outside_chart" };
    if (lower.status !== upper.status) return { status: "transition_requires_review" };
    if (lower.status === "elastic") return { status: "elastic" };
    return {
      status: "value",
      value: temperaturePair.lower === temperaturePair.upper ? lower.value : interpolateLinear(designTemperatureC, temperaturePair.lower.temperature, lower.value, temperaturePair.upper.temperature, upper.value)
    };
  }

  function modulusAtTemperature(data, curveId, designTemperatureC) {
    const curve = (data.modulus?.tables || []).flatMap(table => table.curves || []).find(item => item.curve_id === curveId);
    const pair = bracket((curve?.points || []).filter(point => finite(point.modulus_mpa)), designTemperatureC, "temperature_c");
    if (!pair) return null;
    return pair.lower === pair.upper ? pair.lower.modulus_mpa : interpolateLinear(designTemperatureC, pair.lower.temperature_c, pair.lower.modulus_mpa, pair.upper.temperature_c, pair.upper.modulus_mpa);
  }

  function resolveMaterialAssignment(data, input) {
    const matches = (data.material_assignments || []).filter(item =>
      sameText(item.specification, input.material_specification) && sameText(item.grade, input.material_grade) && item.product_form === "plate_sheet_strip"
    );
    return matches.length === 1 ? matches[0] : null;
  }

  function blocked(errors) { return { status: "blocked", errors, library }; }

  function assess(input) {
    if (!input.external_pressure_check_enabled) return { status: "not_requested", library };
    const data = window.VESSELM_EXTERNAL_PRESSURE_DATA_2021;
    if (!data?.execution_policy?.execution_modes?.asme_2021_reference_preview?.allowed) {
      return blocked(["The controlled ASME 2021 external-pressure reference dataset is unavailable."]);
    }
    const errors = [];
    if (!(finite(input.external_design_pressure_mpa) && input.external_design_pressure_mpa > 0)) errors.push("Enter a positive external design pressure difference.");
    if (!(finite(input.available_nominal_thickness) && input.available_nominal_thickness > 0)) errors.push("Enter the available nominal thickness for the external-pressure screen.");
    if (!(finite(input.external_unsupported_length_mm) && input.external_unsupported_length_mm > 0)) errors.push("Enter the unsupported length between code-defined lines of support.");
    if (!(finite(input.diameter) && input.diameter > 0)) errors.push("Enter the vessel diameter.");
    if (!finite(input.design_temperature)) errors.push("Enter the design temperature for the material-chart lookup.");
    if (!input.material_specification || !input.material_grade) errors.push("Select the plate material specification and grade used for the external-pressure chart lookup.");
    if (errors.length) return blocked(errors);

    const effectiveThicknessMm = input.available_nominal_thickness - (input.corrosion_allowance || 0);
    if (!(effectiveThicknessMm > 0)) return blocked(["Nominal thickness must be greater than corrosion allowance for the external-pressure screen."]);
    const outsideDiameterMm = input.diameter_basis === "outside" ? input.diameter : input.diameter + (2 * input.available_nominal_thickness);
    const lengthOverDiameter = input.external_unsupported_length_mm / outsideDiameterMm;
    const diameterOverThickness = outsideDiameterMm / effectiveThicknessMm;
    if (diameterOverThickness < 10) return blocked(["Do/t is below 10. This route needs Table Y-1 yield strength at design temperature, which is not in the supplied reference dataset."]);

    const materialAssignment = resolveMaterialAssignment(data, input);
    if (!materialAssignment) return blocked([`No unique plate external-pressure assignment was found for ${input.material_specification} Grade ${input.material_grade}. Confirm a controlled material chart assignment before screening.`]);
    const factorA = figureGFactorA(data, lengthOverDiameter, diameterOverThickness);
    if (!finite(factorA)) return blocked(["The L/Do or Do/t value is outside the supplied ASME 2021 Figure G chart limits. The app will not extrapolate chart data."]);
    const materialResponse = resolveMaterialFactorB(data, materialAssignment.external_pressure_chart_id, input.design_temperature, factorA);
    if (materialResponse.status === "outside_temperature") return blocked(["The design temperature is outside the supplied material external-pressure chart range. The app will not extrapolate."]);
    if (materialResponse.status === "outside_chart") return blocked(["Factor A is outside the supplied material-chart range. The app will not extrapolate."]);
    if (materialResponse.status === "transition_requires_review") return blocked(["The material-chart result crosses between elastic and inelastic regions. Resolve this boundary from the controlled chart before using a value."]);
    const modulusOfElasticityMpa = materialResponse.status === "elastic" ? modulusAtTemperature(data, materialAssignment.modulus_curve_id, input.design_temperature) : null;
    if (materialResponse.status === "elastic" && !finite(modulusOfElasticityMpa)) return blocked(["No modulus-of-elasticity value is available for the assigned Table TM curve at the design temperature."]);
    const allowableExternalPressureMpa = materialResponse.status === "elastic" ?
      (2 * factorA * modulusOfElasticityMpa) / (3 * diameterOverThickness) :
      (4 * materialResponse.value) / (3 * diameterOverThickness);
    const utilizationRatio = input.external_design_pressure_mpa / allowableExternalPressureMpa;
    return {
      status: allowableExternalPressureMpa >= input.external_design_pressure_mpa ? "preliminary_pass_demonstration_only" : "candidate_thickness_inadequate",
      library,
      banner: data.execution_policy.execution_modes.asme_2021_reference_preview.required_banner,
      effectiveThicknessMm,
      outsideDiameterMm,
      unsupportedLengthMm: input.external_unsupported_length_mm,
      externalDesignPressureMpa: input.external_design_pressure_mpa,
      geometryRatios: { lengthOverDiameter, diameterOverThickness },
      factorA,
      factorBMpa: materialResponse.status === "value" ? materialResponse.value : null,
      modulusOfElasticityMpa,
      allowableExternalPressureMpa,
      utilizationRatio,
      governingFormulaId: materialResponse.status === "elastic" ? "UG28_CYLINDER_ELASTIC" : "UG28_CYLINDER_INELASTIC",
      materialAssignment
    };
  }

  root.ExternalPressureEngine = { library, assess };
})();
