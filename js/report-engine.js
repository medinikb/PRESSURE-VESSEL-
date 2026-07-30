(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;
  const ME = root.MaterialEngine;
  const DE = root.DesignEngine;

  function statusLabel(status) {
    const map = {
      blocked_input: "Input blocked",
      outside_guide: "Outside guide",
      source_verification_required: "Source verification required",
      component_data_incomplete: "Component data incomplete",
      multiple_options_review: "Multiple options review",
      temperature_envelope_review: "Temperature envelope review",
      service_review_required: "Service review required",
      provisional_guide_match: "Provisional guide match",
      user_override_pending_approval: "Override pending approval",
      blocked: "Calculation blocked",
      nominal_thickness_inadequate: "Nominal thickness inadequate",
      preliminary_result_review_required: "Preliminary result, review required"
    };
    return map[status] || String(status || "Not calculated").replaceAll("_", " ");
  }

  function createAuditRecord(state) {
    const material = state.materialResult || null;
    const design = state.designResult || null;
    const identity = {
      equipment_tag: material?.input?.equipment_tag || design?.input?.equipment_tag || "",
      project_number: material?.input?.project_number || design?.input?.project_number || "",
      vessel_description: material?.input?.vessel_description || design?.input?.vessel_description || ""
    };

    return {
      document_control: {
        product: "VesselM",
        product_version: "1.0.0",
        included_phases: [1, 2, 3, 4, 5, 6],
        calculation_id: state.calculationId || `VM-${Date.now()}`,
        revision: 0,
        status: "draft_preliminary",
        generated_at: U.timestamp(),
        source_basis: [
          "Pressure Vessel Design Manual, Third Edition, Appendix H",
          "Pressure Vessel Design Manual, Third Edition, Procedures 2-1 and 2-3",
          "VesselM modular databanks v0.1.0 and v0.2.0"
        ]
      },
      equipment_identity: identity,
      material_selection: material,
      material_verification: state.materialVerification || null,
      preliminary_pressure_design: design,
      scenarios: state.scenarios || [],
      verification_summary: state.testResult ? {
        total: state.testResult.total,
        passed: state.testResult.passed,
        failed: state.testResult.failed,
        generated_at: state.testResult.generated_at
      } : null,
      limitations: [
        "Preliminary engineering support only.",
        "Material selection is temperature-based screening and does not establish service suitability.",
        "Pressure formulas are based on a historical manual and require verification against the controlled current code edition.",
        "External pressure, MDMT, PWHT, nozzle reinforcement, local loads, fatigue, supports, transportation and erection are outside Phases 1 to 6.",
        "Allowable stress is limited to the included draft plate library. A calculation is blocked where no exact record or published temperature value is available."
      ],
      final_engineering_approval: false
    };
  }

  function materialSummary(result) {
    if (!result) return ["Material screening: not calculated."];
    const lines = [
      `Material screening status: ${statusLabel(result.status)}`,
      `Source-listed family: ${ME.selectedFamilySummary(result)}`
    ];
    for (const endpoint of result.endpoints || []) {
      lines.push(
        `${endpoint.label}: ${U.formatNumber(endpoint.temperature_c, 1)}°C`
      );
      if (endpoint.matches?.length) {
        lines.push(`  Source range: ${ME.formatRange(endpoint.matches[0])}`);
      }
    }
    return lines;
  }

  function designSummary(result) {
    if (!result) return ["Pressure design: not calculated."];
    const lines = [`Pressure-design status: ${statusLabel(result.status)}`];
    if (Number.isFinite(result.pressure_thickness_mm)) {
      lines.push(`Pressure thickness: ${U.formatNumber(result.pressure_thickness_mm, 3)} mm`);
      lines.push(`Minimum required new thickness: ${U.formatNumber(result.minimum_required_new_thickness_mm, 3)} mm`);
    }
    if (result.available_thickness) {
      lines.push(`Available nominal thickness: ${U.formatNumber(result.available_thickness.nominal, 3)} mm`);
      lines.push(`Thickness margin: ${U.formatNumber(result.available_thickness.thickness_margin, 3)} mm`);
    }
    if (result.mawp) lines.push(`Preliminary MAWP: ${U.formatNumber(result.mawp.value_mpa, 3)} MPa`);
    if (result.map) lines.push(`Preliminary MAP: ${U.formatNumber(result.map.value_mpa, 3)} MPa`);
    if (result.hydrotest) {
      lines.push(`Historical shop-test screen from MAP: ${U.formatNumber(result.hydrotest.shop_from_map_mpa, 3)} MPa`);
    }
    return lines;
  }

  function buildTextSummary(state) {
    const record = createAuditRecord(state);
    const lines = [
      "VesselM Phase 1 to Phase 6 Preliminary Engineering Summary",
      `Calculation ID: ${record.document_control.calculation_id}`,
      `Equipment tag: ${record.equipment_identity.equipment_tag || "Not entered"}`,
      `Project number: ${record.equipment_identity.project_number || "Not entered"}`,
      "",
      ...materialSummary(record.material_selection),
      `Material verification: ${record.material_verification?.status?.replaceAll("_", " ") || "not calculated"}`,
      "",
      ...designSummary(record.preliminary_pressure_design),
      "",
      "Open warnings:"
    ];

    const warnings = [
      ...(record.material_selection?.warnings || []),
      ...(record.material_selection?.errors || []),
      ...(record.preliminary_pressure_design?.warnings || []),
      ...(record.preliminary_pressure_design?.errors || [])
    ];
    if (warnings.length) warnings.forEach(item => lines.push(`- ${item.code}: ${item.message}`));
    else lines.push("- None recorded.");

    lines.push(
      "",
      "This output is preliminary. Final design shall be verified against the controlled current code edition, project specifications and competent engineering judgement."
    );
    return lines.join("\n");
  }

  function exportJson(state) {
    const record = createAuditRecord(state);
    const tag = U.safeFilename(record.equipment_identity.equipment_tag || "VesselM");
    U.downloadJson(`VesselM_${tag}_${U.dateStamp()}.json`, record);
  }

  function exportCsv(state) {
    const record = createAuditRecord(state);
    const material = record.material_selection;
    const design = record.preliminary_pressure_design;
    const rows = [
      ["Section", "Field", "Value", "Unit"],
      ["Identity", "Equipment tag", record.equipment_identity.equipment_tag, ""],
      ["Identity", "Project number", record.equipment_identity.project_number, ""],
      ["Material", "Status", material ? statusLabel(material.status) : "Not calculated", ""],
      ["Material", "Material family", material ? ME.selectedFamilySummary(material) : "", ""],
      ["Material verification", "Status", record.material_verification?.status?.replaceAll("_", " ") || "Not calculated", ""],
      ["Material verification", "Chemical compatibility", record.material_verification?.chemicalCompatibility?.status?.replaceAll("_", " ") || "Not assessed", ""],
      ["Design", "Status", design ? statusLabel(design.status) : "Not calculated", ""],
      ["Design", "Pressure thickness", design?.pressure_thickness_mm ?? "", "mm"],
      ["Design", "Minimum required new thickness", design?.minimum_required_new_thickness_mm ?? "", "mm"],
      ["Design", "Available nominal thickness", design?.available_thickness?.nominal ?? "", "mm"],
      ["Design", "Thickness margin", design?.available_thickness?.thickness_margin ?? "", "mm"],
      ["Design", "MAWP", design?.mawp?.value_mpa ?? "", "MPa"],
      ["Design", "MAP", design?.map?.value_mpa ?? "", "MPa"]
    ];
    const csv = rows.map(row => row.map(value => {
      const text = String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    }).join(",")).join("\n");
    const tag = U.safeFilename(record.equipment_identity.equipment_tag || "VesselM");
    U.downloadText(`VesselM_${tag}_${U.dateStamp()}.csv`, csv, "text/csv");
  }

  root.ReportEngine = {
    statusLabel,
    createAuditRecord,
    buildTextSummary,
    exportJson,
    exportCsv
  };
})();
