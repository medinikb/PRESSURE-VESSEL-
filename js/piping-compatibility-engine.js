(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const guide = window.ASTM_PIPING_MATERIAL_SPECIFICATION_WEBAPP;

  // This mapping only connects broad vessel material families to the historic piping guide.
  // It is deliberately conservative: an unmapped or incomplete guide row is sent to review,
  // never removed from the original Appendix H vessel-material shortlist.
  const familyMatchers = {
    carbon_steel: [/^Carbon Steel$/i],
    nickel_9: [/Low.*Alloy Steel.*Low temp/i],
    nickel_3_5: [/Low.*Alloy Steel.*Low temp/i],
    nickel_2_5: [/Low.*Alloy Steel.*Low temp/i],
    carbon_half_moly: [/Low.*Alloy Steel.*High temp/i],
    one_chrome_half_moly: [/Low.*Alloy Steel.*High temp/i],
    two_quarter_chrome_one_moly: [/Low.*Alloy Steel.*High temp/i],
    stainless_steel: [/Austenitic Stainless Steel/i],
    incoloy: [/Inconel-825/i],
    inconel: [/Inconel-/i]
  };

  const guideComponents = {
    pipe: row => hasUsableStandard(row.pipes?.material_standard),
    forgings: row => hasUsableStandard(row.flanges?.material_standard),
    fittings: row => hasUsableStandard(row.butt_weld_fittings?.material_standard) ||
      hasUsableStandard(row.socket_weld_fittings?.material_standard)
  };

  function hasUsableStandard(values) {
    return Array.isArray(values) && values.some(value =>
      typeof value === "string" && !/no\s*(equivalent|eq)|no\s*(forging|fitting|cstg|casting)\s*spec/i.test(value)
    );
  }

  function parseTemperatureRange(value) {
    if (typeof value !== "string") return null;
    const normalized = value.replace(/\s+/g, "").replace(/\.\-/g, "-");
    const match = normalized.match(/(-?\d+)to(-?\d+)/i);
    if (!match) return null;
    return { minF: Number(match[1]), maxF: Number(match[2]) };
  }

  function temperatureCoversEnvelope(row, minF, maxF) {
    const range = parseTemperatureRange(row.temperature_limit?.fahrenheit);
    if (!range) return null;
    return range.minF <= minF && range.maxF >= maxF;
  }

  function matchingRows(materialFamilyId) {
    const matchers = familyMatchers[materialFamilyId];
    if (!guide || !matchers) return [];
    return (guide.material_specification_rows || []).filter(row =>
      matchers.some(matcher => matcher.test(row.basic_material_of_construction || ""))
    );
  }

  function requiredComponentCoverage(row, selectedComponents) {
    const applicable = selectedComponents.filter(component => guideComponents[component]);
    if (!applicable.length) return { applicable, complete: null };
    return {
      applicable,
      complete: applicable.every(component => guideComponents[component](row))
    };
  }

  function assessRecord(record, input) {
    const rows = matchingRows(record.material_family_id);
    if (!rows.length) {
      return {
        recordId: record.id,
        decision: "review",
        reason: "No directly mapped ASTM piping-guide family is available for this vessel material family.",
        supportingRows: []
      };
    }

    const minF = Number.isFinite(input.minimum_temperature_f) ? input.minimum_temperature_f : input.maximum_temperature_f;
    const maxF = Number.isFinite(input.maximum_temperature_f) ? input.maximum_temperature_f : input.minimum_temperature_f;
    const evaluated = rows.map(row => ({
      row,
      temperatureCoverage: temperatureCoversEnvelope(row, minF, maxF),
      componentCoverage: requiredComponentCoverage(row, input.selected_components || [])
    }));
    const retained = evaluated.filter(item =>
      item.temperatureCoverage === true && item.componentCoverage.complete === true
    );
    if (retained.length) {
      return {
        recordId: record.id,
        decision: "retain",
        reason: "At least one mapped ASTM piping-guide row covers the temperature envelope and selected piping components.",
        supportingRows: retained.map(item => item.row)
      };
    }

    const hasUnknown = evaluated.some(item => item.temperatureCoverage === null || item.componentCoverage.complete === null);
    return {
      recordId: record.id,
      decision: hasUnknown ? "review" : "exclude",
      reason: hasUnknown ?
        "The mapped piping-guide row has no machine-readable temperature limit or no applicable selected piping component." :
        "No mapped ASTM piping-guide row covers the entered temperature envelope and selected piping components.",
      supportingRows: []
    };
  }

  function assess(materialResult) {
    if (!materialResult?.source_records?.length) return null;
    const records = materialResult.source_records.map(record => assessRecord(record, materialResult.input));
    const retainedIds = records.filter(item => item.decision !== "exclude").map(item => item.recordId);
    return {
      source: guide?.document?.title || "ASTM piping material guide",
      sourceStatus: "historical_reference",
      records,
      retainedIds,
      excludedIds: records.filter(item => item.decision === "exclude").map(item => item.recordId),
      reviewIds: records.filter(item => item.decision === "review").map(item => item.recordId)
    };
  }

  root.PipingCompatibilityEngine = { assess, parseTemperatureRange };
})();
