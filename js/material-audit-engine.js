(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;
  const auditGuide = U.getPath("material_compatibility/Vessel_Material_Audit_Guide_WebApp.json");

  // These links identify a broad screening family only. They never select a
  // material grade, condition, allowable stress, or final design basis.
  const familyTerms = {
    carbon_steel: ["Carbon Steel", "C"],
    nickel_9: ["Low & Intermediate Alloy Steel for Low Temperature Service", "9Ni"],
    nickel_3_5: ["Low & Intermediate Alloy Steel for Low Temperature Service", "3½Ni"],
    nickel_2_5: ["Low & Intermediate Alloy Steel for Low Temperature Service", "2½Ni"],
    carbon_half_moly: ["Low & Intermediate Alloy Steel for High Temperature Service", "C-½Mo"],
    one_chrome_half_moly: ["Low & Intermediate Alloy Steel for High Temperature Service", "1Cr-½Mo"],
    two_quarter_chrome_one_moly: ["Low & Intermediate Alloy Steel for High Temperature Service", "2¼Cr-1Mo / modified 2¼Cr-1Mo"],
    stainless_steel: ["Austenitic Stainless Steel", "18Cr-8Ni"],
    incoloy: ["Incoloy 825", "UNS N08825"],
    inconel: ["Inconel 625", "UNS N06625"]
  };

  function normalized(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findGuideRow(basicMaterial, gradeFamily) {
    const basic = normalized(basicMaterial);
    const grade = normalized(gradeFamily);
    return (auditGuide?.data?.material_guide || []).find(row =>
      normalized(row.basic_material_of_construction) === basic &&
      normalized(row.chemical_composition_grade_family) === grade
    ) || null;
  }

  function materialCandidates(materialResult) {
    const guideCandidates = (materialResult.guide_candidates || [])
      .filter(candidate => candidate.recommended)
      .map(candidate => ({
        label: candidate.display_label,
        basicMaterial: candidate.reference?.basic_material_of_construction,
        gradeFamily: candidate.reference?.chemical_composition_or_grade_family
      }));
    if (guideCandidates.length) return guideCandidates;

    return (materialResult.source_records || []).slice(0, 2).map(record => {
      const terms = familyTerms[record.material_family_id] || [];
      return {
        label: record.display_label || (terms.length ? `${terms[0]} — ${terms[1]}` : record.material_family_id),
        basicMaterial: terms[0],
        gradeFamily: terms[1]
      };
    });
  }

  function assessCandidate(candidate) {
    const guideRow = findGuideRow(candidate.basicMaterial, candidate.gradeFamily);
    if (!guideRow) {
      return { ...candidate, status: "unmapped_review_required", messages: ["No direct audit-guide mapping was found. Confirm the exact vessel plate grade with engineering."], codeListing: null, stressCheck: null, bolting: null, stressRecords: [] };
    }
    const auditId = guideRow.row_audit_id;
    const codeListing = (auditGuide.data.asme_viii_1_2023_checks || []).find(item => item.audit_id === auditId) || null;
    const stressCheck = (auditGuide.data.asme_ii_d_2021_checks || []).find(item => item.audit_id === auditId) || null;
    const stressRecords = (auditGuide.data.asme_ii_d_stress_records || []).filter(item =>
      (stressCheck?.source_row || "").includes(`p. ${item.material_page}, line ${item.line_no}`)
    );
    const needsReview = !codeListing || !/listed|corrected/i.test(codeListing["2023_listing_status"] || "") ||
      !stressCheck || stressCheck.lookup_result !== "resolved_exact_record";
    return {
      ...candidate,
      auditId,
      plateSpecification: guideRow.plate_vessel?.material_specification_grade || "Not stated",
      status: needsReview ? "engineering_review_required" : "verification_ready",
      codeListing,
      stressCheck,
      bolting: guideRow.vessel_bolting || null,
      stressRecords: stressRecords.map(record => ({ record_id: record.record_id, candidate_material: record.candidate_material_s, published_min_c: record.published_temperature_min_deg_c, published_max_c: record.published_temperature_max_deg_c })),
      messages: [guideRow.vessel_engineering_note, "Allowable stress remains unselected until the exact grade, condition, thickness, design temperature and approved code-edition basis are confirmed."].filter(Boolean)
    };
  }

  function assess(materialResult) {
    if (!materialResult || materialResult.status === "blocked_input") return null;
    const candidates = materialCandidates(materialResult).map(assessCandidate);
    return {
      source: { schema_version: auditGuide?.schema_version || "unknown", source_workbook: auditGuide?.source_workbook?.filename || "Vessel material audit guide", governance: auditGuide?.governance || {} },
      status: candidates.length ? "engineering_review_required" : "no_candidate_to_verify",
      candidates,
      chemicalCompatibility: { status: "not_assessed_missing_service_details", message: "Chemical name, concentration and operating temperature are not entered; chemical compatibility has not been assessed." },
      mandatoryActions: ["Confirm the exact vessel plate grade, class/condition and governing thickness.", "Use a matched controlled ASME code edition before approving allowable stress.", "Confirm MDMT, impact-test basis, PWHT and applicable damage mechanisms.", "Select the bolt/nut set for the exact temperature and service environment."],
      final_engineering_approval: false,
      generated_at: U.timestamp()
    };
  }

  root.MaterialAuditEngine = { assess };
})();
