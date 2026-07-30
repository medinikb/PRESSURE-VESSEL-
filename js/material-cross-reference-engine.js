(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;
  const guide = U.getPath("ASTM_Piping_and_Vessel_Plate_Material_Guide.json");

  // These are broad family links only. The returned plate specification remains a
  // cross-reference for engineering review, never an automatic vessel-material approval.
  const familyMatchers = {
    carbon_steel: record => record.record_id === "MS-001",
    nickel_9: record => /9Ni/i.test(record.chemical_composition_or_grade_family || ""),
    nickel_3_5: record => /3½Ni/i.test(record.chemical_composition_or_grade_family || ""),
    nickel_2_5: record => /2½Ni/i.test(record.chemical_composition_or_grade_family || ""),
    carbon_half_moly: record => /^C-½Mo$/i.test(record.chemical_composition_or_grade_family || ""),
    one_chrome_half_moly: record => /^1Cr-½Mo$/i.test(record.chemical_composition_or_grade_family || ""),
    two_quarter_chrome_one_moly: record => /^2¼Cr-1Mo/i.test(record.chemical_composition_or_grade_family || ""),
    stainless_steel: record => /^Austenitic Stainless Steel$/i.test(record.basic_material_of_construction || ""),
    incoloy: record => /^Incoloy 825$/i.test(record.basic_material_of_construction || ""),
    inconel: record => /^Inconel (600|625)$/i.test(record.basic_material_of_construction || "")
  };

  function parseSourceTemperatureRange(value) {
    if (typeof value !== "string") return null;
    const match = value.replace(/\s+/g, "").match(/(-?\d+)°?F?to(-?\d+)°?F?/i);
    if (!match) return null;
    return { minF: Number(match[1]), maxF: Number(match[2]) };
  }

  function formatRangeC(range) {
    if (!range) return "Temperature range not stated in the source guide";
    const minC = U.convertTemperature(range.minF, "degF", "degC");
    const maxC = U.convertTemperature(range.maxF, "degF", "degC");
    return `${U.formatNumber(minC, 1)}°C to ${U.formatNumber(maxC, 1)}°C`;
  }

  function referenceRows(materialFamilyId) {
    const matches = familyMatchers[materialFamilyId];
    if (!matches) return [];
    return (guide?.material_specification_records || []).filter(matches);
  }

  function assessRecord(record, input) {
    const minF = input.minimum_temperature_f;
    const maxF = input.maximum_temperature_f;
    return referenceRows(record.material_family_id).map(reference => {
      const range = parseSourceTemperatureRange(reference.source_temperature_limit);
      const coversEnvelope = range ? range.minF <= minF && range.maxF >= maxF : null;
      return {
        reference,
        sourceRangeC: formatRangeC(range),
        coversEnvelope,
        status: coversEnvelope === true ? "reference_covers_envelope" :
          coversEnvelope === false ? "reference_range_review" : "reference_range_not_stated"
      };
    });
  }

  function assess(materialResult) {
    if (!materialResult) return null;
    const guideCandidates = materialResult.guide_candidates || [];
    if (!materialResult.source_records?.length && !guideCandidates.length) return null;
    const primaryMaterials = (materialResult.source_records || []).map(record => ({
      sourceRecordId: record.id,
      materialFamilyId: record.material_family_id,
      displayLabel: null,
      references: assessRecord(record, materialResult.input),
      reviewReasons: []
    }));
    const fallbackMaterials = guideCandidates.filter(candidate => candidate.recommended).map(candidate => {
      const range = candidate.temperature_range_f;
      return {
        sourceRecordId: candidate.id,
        materialFamilyId: null,
        displayLabel: candidate.display_label,
        references: [{
          reference: candidate.reference,
          sourceRangeC: formatRangeC(range),
          coversEnvelope: true,
          status: candidate.readiness === "candidate_for_controlled_review" ?
            "reference_covers_envelope" : "reference_range_review"
        }],
        reviewReasons: candidate.review_reasons || []
      };
    });
    return {
      sourceTitle: guide?.document?.title || "ASTM/ASME material cross-reference",
      sourceStatus: guide?.document?.engineering_use_status || "Screening and cross-reference only",
      mandatoryVerification: guide?.document?.mandatory_verification || [],
      materials: [...primaryMaterials, ...fallbackMaterials],
      hiddenCandidates: guideCandidates.filter(candidate => !candidate.recommended)
    };
  }

  root.MaterialCrossReferenceEngine = { assess, parseSourceTemperatureRange, formatRangeC };
})();
