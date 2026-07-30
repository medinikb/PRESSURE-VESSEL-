(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;
  const legacyLibrary = U.getPath("VesselM_ASME_2021_Allowable_Stress_JSON_v0.1.0/allowable_stress_plate.json");
  const auditGuide = U.getPath("material_compatibility/Vessel_Material_Audit_Guide_WebApp.json");
  const materialGuide = auditGuide?.data?.material_guide || [];

  function materialGroupForAuditRecord(record) {
    const guideRow = Number(record.guide_rows?.[0]);
    // The imported audit guide begins its material rows at source row 5.
    return materialGuide[guideRow - 5]?.basic_material_of_construction || "Other / unresolved";
  }

  function auditRecordToStressRecord(record) {
    const values = record.allowable_stress_mpa_by_temperature_c || {};
    const temperatureStressPoints = Object.entries(values).map(([temperatureC, stress]) => ({
      temperature_c: Number(temperatureC),
      allowable_stress_mpa: Number.isFinite(stress) ? stress : null,
      cell_status: Number.isFinite(stress) ? "value_published" : "source_cell_unavailable"
    }));
    return {
      record_id: record.record_id,
      basic_material_group: materialGroupForAuditRecord(record),
      specification: { full_designation: record.specification },
      grade: record.type_grade,
      class: record.class_condition_temper,
      product_form: record.product_form,
      thickness_range: { source_text: record.size_thickness },
      source_note_ids: record.note_ids || [],
      temperature_stress_points: temperatureStressPoints,
      governing_table: {
        table_number: record.source_table,
        row_identifier: `Table ${record.source_table}, p. ${record.material_page}, line ${record.line_no}`
      },
      source_status: "reference_only_mixed_edition",
      verification_status: record.verification_status,
      edition_compatibility: record.edition_compatibility
    };
  }

  // The supplied audit guide is the current comprehensive source. The legacy
  // data remains only as a fallback if that guide is unavailable.
  const auditRecords = (auditGuide?.data?.asme_ii_d_stress_records || []).map(auditRecordToStressRecord);
  const records = auditRecords.length ? auditRecords : (legacyLibrary?.records || []);

  function label(record) {
    const grade = record.grade && record.grade !== "..." ? `Gr ${record.grade}` : "";
    const classText = record.class && record.class !== "..." ? `Cl/condition ${record.class}` : "";
    return [record.specification?.full_designation, grade, classText].filter(Boolean).join(" ");
  }

  function lookup(recordId, designTemperatureC) {
    const record = records.find(item => item.record_id === recordId);
    if (!record) return { status: "no_record", record: null };
    if (!Number.isFinite(designTemperatureC)) return { status: "temperature_required", record };

    // Source temperature headings are upper-bound columns. No interpolation is used.
    const published = (record.temperature_stress_points || [])
      .filter(point => point.cell_status === "value_published" && Number.isFinite(point.temperature_c) && Number.isFinite(point.allowable_stress_mpa))
      .sort((a, b) => a.temperature_c - b.temperature_c);
    const designPoint = published.find(point => designTemperatureC <= point.temperature_c);
    const ambientPoint = published.find(point => point.temperature_c === 40) || published[0];
    if (!designPoint || !ambientPoint) return { status: "stress_not_published", record, published };

    return {
      status: "available",
      record,
      designPoint,
      ambientPoint,
      sourceReference: `${record.governing_table?.table_number || "ASME table"}, ${record.governing_table?.row_identifier || record.record_id}; ${record.record_id}`
    };
  }

  function availableAtTemperature(designTemperatureC, allowedRecordIds = []) {
    const allowed = new Set(allowedRecordIds);
    return records.filter(record =>
      (!allowed.size || allowed.has(record.record_id)) && lookup(record.record_id, designTemperatureC).status === "available"
    );
  }

  function materialGroups() {
    return U.unique(records.map(record => record.basic_material_group).filter(Boolean)).sort((a, b) => a.localeCompare(b));
  }

  function recordsForMaterialGroup(group) {
    if (!group) return records;
    return records.filter(record => record.basic_material_group === group);
  }

  root.AllowableStressEngine = { records, label, lookup, availableAtTemperature, materialGroups, recordsForMaterialGroup };
})();
