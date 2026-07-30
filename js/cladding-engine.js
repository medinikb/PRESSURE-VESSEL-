(() => {
  "use strict";
  const root = window.VesselM = window.VesselM || {};

  // Source: VesselM_cladding_weight_cost_FEED_logic_v1.0.0.json.
  // The app's controlled raw-material rate library is used with the same
  // P50/P90 conversion factors as the base-vessel supply estimate.
  const options = [
    ["integral_roll_bonded_clad_plate", "Integral roll-bonded clad plate", "integral_cladding"],
    ["integral_explosion_bonded_clad_plate", "Integral explosion-bonded clad plate", "integral_cladding"],
    ["weld_overlay_strip_esw_saw", "Strip weld overlay (ESW / SAW)", "weld_overlay"],
    ["weld_overlay_wire", "Wire weld overlay (local / complex areas)", "weld_overlay"],
    ["applied_sheet_or_strip_lining", "Applied metallic sheet or strip lining", "applied_lining"],
    ["localized_clad_components", "Localized cladding / overlay", "local_cladding"]
  ].map(([id, label, category]) => ({ id, label, category }));
  const materials = [
    ["SS_304L", "304L stainless steel", 7930], ["SS_316L", "316L stainless steel", 8000], ["SS_317L", "317L stainless steel", 8000], ["SS_904L", "904L stainless steel", 8000],
    ["DUPLEX_2205", "Duplex stainless steel 2205", 7800], ["SUPER_DUPLEX_2507", "Super duplex stainless steel 2507", 7800], ["ALLOY_20", "Alloy 20", 8140],
    ["ALLOY_625", "Nickel alloy 625", 8440], ["ALLOY_825", "Nickel alloy 825", 8140], ["ALLOY_C276", "Nickel alloy C-276", 8890],
    ["MONEL_400", "Nickel-copper alloy 400", 8800], ["TITANIUM_GR2", "Titanium Grade 2", 4510]
  ].map(([id, label, densityKgM3]) => ({ id, label, densityKgM3 }));

  function ellipsoidalArea(diameterM) {
    const a = diameterM / 2, c = diameterM / 4, e = Math.sqrt(1 - (c * c) / (a * a));
    return Math.PI * a * a * (1 + ((c * c) / (a * a * e)) * Math.atanh(e));
  }

  function assess(input) {
    if (!input.enabled) return { status: "not_requested" };
    const errors = [];
    const option = options.find(item => item.id === input.optionId);
    const material = materials.find(item => item.id === input.materialId);
    if (!option) errors.push("Select a cladding or overlay construction route.");
    if (!material) errors.push("Select a cladding material.");
    if (!(Number.isFinite(input.insideDiameterM) && input.insideDiameterM > 0 && Number.isFinite(input.shellLengthM) && input.shellLengthM > 0)) errors.push("Enter vessel diameter and tangent-line length so the clad shell area can be calculated.");
    if (!(Number.isFinite(input.finishedThicknessMm) && input.finishedThicknessMm > 0)) errors.push("Enter a positive finished cladding thickness.");
    if (!(Number.isFinite(input.coveragePercent) && input.coveragePercent > 0 && input.coveragePercent <= 100)) errors.push("Coverage must be greater than 0% and not greater than 100%.");
    if (errors.length) return { status: "blocked", errors };

    const shellAreaM2 = Math.PI * input.insideDiameterM * input.shellLengthM;
    let headAreaM2 = 0;
    if (input.cladHeadCount > 0) {
      if (input.headType === "ellipsoidal_2_to_1_head") headAreaM2 = ellipsoidalArea(input.insideDiameterM) * input.cladHeadCount;
      else if (input.headType === "hemispherical_head") headAreaM2 = 2 * Math.PI * (input.insideDiameterM / 2) ** 2 * input.cladHeadCount;
      else if (Number.isFinite(input.headAreaEachM2) && input.headAreaEachM2 > 0) headAreaM2 = input.headAreaEachM2 * input.cladHeadCount;
      else errors.push("For the selected head type, enter the verified inside clad area for one head.");
    }
    if (errors.length) return { status: "blocked", errors };
    const grossAreaM2 = Math.max(0, (shellAreaM2 + headAreaM2 + (input.additionalAreaM2 || 0)) * input.coveragePercent / 100 - (input.excludedAreaM2 || 0));
    if (!(grossAreaM2 > 0)) return { status: "blocked", errors: ["Calculated cladding area must be greater than zero."] };
    const finishedMassKg = grossAreaM2 * ((input.finishedThicknessMm + (input.claddingCaMm || 0)) / 1000) * material.densityKgM3;
    const procurementMassKg = option.category === "integral_cladding" ? finishedMassKg * 1.08 : option.category === "weld_overlay" ? finishedMassKg * 1.2 : finishedMassKg * 1.12;
    if (!(Number.isFinite(input.rawMaterialRatePerKg) && input.rawMaterialRatePerKg > 0)) return { status: "blocked", errors: ["Select a steel-price year so the controlled raw-material rate can be resolved."] };
    const rawMaterialCost = procurementMassKg * input.rawMaterialRatePerKg;
    const supplyP50 = rawMaterialCost * input.supplyP50Factor;
    const supplyP90 = rawMaterialCost * input.supplyP90Factor;
    return { status: "estimated", option, material, shellAreaM2, headAreaM2, grossAreaM2, finishedMassKg, procurementMassKg, rawMaterialCost, supplyP50, supplyP90, rawMaterialRatePerKg: input.rawMaterialRatePerKg, addedWeightPercent: Number.isFinite(input.baseVesselWeightKg) && input.baseVesselWeightKg > 0 ? 100 * finishedMassKg / input.baseVesselWeightKg : null };
  }
  root.CladdingEngine = { options, materials, assess };
})();
