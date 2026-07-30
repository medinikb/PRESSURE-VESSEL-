(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;

  const rangeData = U.getPath("phase_01_material_selection/material_selection_ranges.json");
  const warningData = U.getPath("phase_01_material_selection/warning_catalog.json");
  const statusData = U.getPath("phase_02_engineering_decision_logic/result_status_catalog.json");
  const serviceRules = U.getPath("phase_02_engineering_decision_logic/service_review_rules.json");
  const astmCrossReferenceGuide = U.getPath("ASTM_Piping_and_Vessel_Plate_Material_Guide.json");

  const ranges = rangeData?.records || [];
  const warningMap = new Map((warningData?.messages || []).map(item => [item.code, item]));
  const statusMap = new Map((statusData?.statuses || []).map(item => [item.id, item]));

  const familyLabels = {
    stainless_steel: "Stainless steel",
    nickel_9: "9% nickel",
    nickel_3_5: "3½% nickel",
    nickel_2_5: "2½% nickel",
    carbon_steel: "Carbon steel",
    carbon_half_moly: "C-½Mo",
    one_chrome_half_moly: "1Cr-½Mo",
    two_quarter_chrome_one_moly: "2¼Cr-1Mo",
    incoloy: "Incoloy",
    inconel: "Inconel"
  };

  const categoryLabels = {
    cryogenic: "Cryogenic",
    low_temperature: "Low temperature",
    intermediate: "Intermediate",
    elevated_temperature: "Elevated temperature"
  };

  const componentLabels = {
    plate: "Plate / shell and head",
    pipe: "Pipe / nozzle neck",
    forgings: "Forgings / flanges",
    fittings: "Fittings",
    bolting: "Bolting"
  };

  const serviceFlagLabels = {
    wet_h2s_sour: "Wet H₂S / sour service",
    hydrogen: "Hydrogen service",
    chlorides: "Chloride-containing service",
    caustic: "Caustic service",
    amine: "Amine service",
    ammonia: "Ammonia service",
    cyclic_service: "Cyclic service",
    cryogenic: "Cryogenic service",
    high_temperature_hydrocarbon: "High-temperature hydrocarbon",
    cladding_or_lining: "Cladding / lining / overlay"
  };

  function msg(code, fallbackSeverity = "review", fallbackTitle = code, fallbackMessage = "Engineering review required.") {
    return warningMap.get(code) || {
      code,
      severity: fallbackSeverity,
      title: fallbackTitle,
      message: fallbackMessage
    };
  }

  function formatRange(record) {
    if (!record) return "No source range";
    const minC = U.convertTemperature(record.min_f, "degF", "degC");
    if (record.max_f === null) return `Above ${U.formatNumber(minC, 1)}°C`;
    const maxC = U.convertTemperature(record.max_f, "degF", "degC");
    return `${U.formatNumber(minC, 1)} to ${U.formatNumber(maxC, 1)}°C`;
  }

  function containsTemperature(record, tempF) {
    if (!Number.isFinite(tempF)) return false;
    const minOK = record.min_f === null ||
      tempF > record.min_f ||
      (record.min_inclusive && tempF === record.min_f);
    const maxOK = record.max_f === null ||
      tempF < record.max_f ||
      (record.max_inclusive && tempF === record.max_f);
    return minOK && maxOK;
  }

  function matchesFor(tempF) {
    return ranges
      .filter(record => containsTemperature(record, tempF))
      .sort((a, b) => (a.option_rank || 1) - (b.option_rank || 1));
  }

  function validate(input) {
    const errors = [];
    if (!input.equipment_tag?.trim()) errors.push(msg("E_TAG_REQUIRED"));
    const hasMin = Number.isFinite(input.minimum_temperature_f);
    const hasMax = Number.isFinite(input.maximum_temperature_f);
    if (!hasMin || !hasMax) errors.push(msg("E_TEMP_REQUIRED"));
    if (!Array.isArray(input.selected_components) || input.selected_components.length === 0) {
      errors.push(msg("E_COMPONENT_REQUIRED"));
    }
    if (hasMin && hasMax && input.minimum_temperature_f > input.maximum_temperature_f) {
      errors.push(msg("E_TEMP_ENVELOPE_INVALID"));
    }
    if (input.override?.enabled) {
      const complete = input.override.reason_code &&
        input.override.comment &&
        input.override.responsible_person &&
        input.override.override_date;
      if (!complete) errors.push(msg("E_OVERRIDE_INCOMPLETE"));
    }
    return errors;
  }

  function dedupe(items) {
    const map = new Map();
    items.forEach(item => map.set(item.code, item));
    return [...map.values()];
  }

  function parseGuideTemperatureRange(value) {
    if (typeof value !== "string") return null;
    const match = value.replace(/\s+/g, "").match(/(-?\d+)°?F?to(-?\d+)°?F?/i);
    if (!match) return null;
    return { minF: Number(match[1]), maxF: Number(match[2]) };
  }

  function guideTextIsUsable(value) {
    return typeof value === "string" && value.trim() &&
      !/no direct|no equivalent|not stated|to be confirmed/i.test(value);
  }

  function buildGuideCandidates(input) {
    const candidates = (astmCrossReferenceGuide?.material_specification_records || []).map(reference => {
      const range = parseGuideTemperatureRange(reference.source_temperature_limit);
      if (!range || range.minF > input.minimum_temperature_f || range.maxF < input.maximum_temperature_f) return null;

      const reviewReasons = [];
      if (!guideTextIsUsable(reference.plate?.material_specification_or_grade) ||
          /engineering selection required/i.test(reference.plate?.mapping_status || "")) {
        reviewReasons.push("Vessel plate mapping requires engineering selection.");
      }
      if (input.selected_components.includes("pipe") && !guideTextIsUsable(reference.pipe?.material_standard)) {
        reviewReasons.push("Pipe material reference is not resolved in the guide.");
      }
      if (input.selected_components.includes("forgings") && !guideTextIsUsable(reference.flanges?.material_standard)) {
        reviewReasons.push("Flange/forging material reference is not resolved in the guide.");
      }
      if (input.selected_components.includes("fittings") &&
          !guideTextIsUsable(reference.butt_weld_fittings?.material_standard) &&
          !guideTextIsUsable(reference.socket_weld_fittings?.material_standard)) {
        reviewReasons.push("Fitting material reference is not resolved in the guide.");
      }
      if (input.selected_components.includes("bolting")) {
        reviewReasons.push("Bolting is not selected from this cross-reference guide.");
      }

      return {
        id: `ASTM-${reference.record_id}`,
        display_label: `${reference.basic_material_of_construction} — ${reference.chemical_composition_or_grade_family}`,
        reference,
        temperature_range_f: range,
        upper_temperature_margin_f: range.maxF - input.maximum_temperature_f,
        review_reasons: reviewReasons,
        readiness: reviewReasons.length ? "engineering_review_required" : "candidate_for_controlled_review",
        plate_mapping_priority: reviewReasons.some(reason => reason.startsWith("Vessel plate mapping")) ? 1 : 0
      };
    }).filter(Boolean);

    // Keep the junior view focused on the two closest workable temperature candidates.
    // A clearer vessel-plate mapping breaks ties at the same temperature headroom.
    return candidates.sort((a, b) =>
      a.upper_temperature_margin_f - b.upper_temperature_margin_f ||
      a.plate_mapping_priority - b.plate_mapping_priority ||
      a.reference.record_id.localeCompare(b.reference.record_id)
    ).map((candidate, index) => ({
      ...candidate,
      recommended: index < 2,
      rank: index + 1
    }));
  }

  function assess(rawInput) {
    const input = structuredClone(rawInput);
    const validation = validate(input);
    if (validation.length) {
      return {
        module_id: "material_selection",
        status: "blocked_input",
        severity: "blocking",
        input,
        endpoints: [],
        warnings: validation,
        source_records: [],
        audit_events: [{
          type: "calculation_blocked",
          timestamp: U.timestamp(),
          reason_codes: validation.map(item => item.code)
        }]
      };
    }

    const endpoints = [];
    if (Number.isFinite(input.minimum_temperature_f)) {
      endpoints.push({
        id: "minimum",
        label: "Minimum design temperature",
        temperature_f: input.minimum_temperature_f,
        temperature_c: U.convertTemperature(input.minimum_temperature_f, "degF", "degC"),
        matches: matchesFor(input.minimum_temperature_f)
      });
    }
    if (Number.isFinite(input.maximum_temperature_f)) {
      endpoints.push({
        id: "maximum",
        label: "Maximum design temperature",
        temperature_f: input.maximum_temperature_f,
        temperature_c: U.convertTemperature(input.maximum_temperature_f, "degF", "degC"),
        matches: matchesFor(input.maximum_temperature_f)
      });
    }

    const warnings = [msg("W_HISTORICAL_REFERENCE")];
    let status = "provisional_guide_match";

    // Junior engineers receive only routes that cover the entire design envelope.
    // Endpoint matches remain in the result for auditability but are never recommendations.
    const envelopeMatches = ranges
      .filter(record => containsTemperature(record, input.minimum_temperature_f) &&
        containsTemperature(record, input.maximum_temperature_f))
      .sort((a, b) => (a.option_rank || 1) - (b.option_rank || 1));

    const guideCandidates = !envelopeMatches.length ? buildGuideCandidates(input) : [];
    if (!envelopeMatches.length) {
      if (guideCandidates.length) {
        warnings.push(msg("W_GUIDE_CANDIDATES_REVIEW"));
        status = "guide_candidates_review";
      } else {
        warnings.push(msg("W_NO_FULL_ENVELOPE_MATCH"));
        status = "outside_guide";
      }
    }

    if (envelopeMatches.length > 1 && status !== "outside_guide") {
      warnings.push(msg("W_MULTIPLE_OPTIONS"));
      status = "multiple_options_review";
    }

    for (const record of envelopeMatches) {
      for (const component of input.selected_components) {
        const componentData = record.components?.[component];
        if (!componentData || componentData.status === "not_specified_in_source") {
          warnings.push(msg("W_SOURCE_BLANK"));
          if (!["outside_guide", "source_verification_required"].includes(status)) {
            status = "component_data_incomplete";
          }
        }
        if (componentData?.data_quality === "ambiguous_source_text") {
          warnings.push(msg("W_SOURCE_AMBIGUOUS"));
          status = "source_verification_required";
        }
      }
    }

    for (const flag of input.service_flags || []) {
      const rule = (serviceRules?.rules || []).find(item => item.service_flag === flag);
      if (rule) warnings.push(msg(rule.warning_code));
    }
    if ((input.service_flags || []).length &&
        !["outside_guide", "source_verification_required", "guide_candidates_review"].includes(status)) {
      status = "service_review_required";
    }

    if (input.override?.enabled) {
      status = "user_override_pending_approval";
    }

    const uniqueRecords = new Map(envelopeMatches.map(record => [record.id, record]));

    const uniqueWarnings = dedupe(warnings);
    const severity = uniqueWarnings.some(item => item.severity === "blocking") ? "blocking" :
      uniqueWarnings.some(item => item.severity === "review") ? "review" : "information";

    const auditEvents = [{
      type: "system_result_generated",
      timestamp: U.timestamp(),
      status,
      source_record_ids: [...uniqueRecords.keys()],
      guide_candidate_ids: guideCandidates.map(item => item.id)
    }];
    if (input.override?.enabled) {
      auditEvents.push({
        type: "override_created",
        timestamp: U.timestamp(),
        override: input.override,
        original_system_status: status === "user_override_pending_approval" ? "preserved_in_payload" : status
      });
    }

    return {
      module_id: "material_selection",
      status,
      status_definition: statusMap.get(status) || null,
      severity,
      input,
      endpoints,
      envelope: {
        minimum_temperature_f: input.minimum_temperature_f,
        maximum_temperature_f: input.maximum_temperature_f,
        matches: envelopeMatches
      },
      guide_candidates: guideCandidates,
      warnings: uniqueWarnings,
      source_records: [...uniqueRecords.values()],
      audit_events: auditEvents,
      source: {
        source_id: rangeData?.source_id || "PVMD_3E_APPENDIX_H",
        title: "Pressure Vessel Design Manual, Third Edition, Appendix H, Material Selection Guide",
        source_status: "historical_reference"
      },
      generated_at: U.timestamp(),
      final_engineering_approval: false
    };
  }

  function selectedFamilySummary(result) {
    if (!result?.source_records?.length) return "No source match";
    return U.unique(result.source_records.map(record =>
      familyLabels[record.material_family_id] || record.material_family_id
    )).join(" / ");
  }

  root.MaterialEngine = {
    ranges,
    familyLabels,
    categoryLabels,
    componentLabels,
    serviceFlagLabels,
    formatRange,
    matchesFor,
    buildGuideCandidates,
    validate,
    assess,
    selectedFamilySummary
  };
})();
