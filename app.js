(() => {
  "use strict";

  const V = window.VesselM;
  const U = V.Utils;
  const ME = V.MaterialEngine;
  const DE = V.DesignEngine;
  const NPE = V.NominalPlateEngine;
  const ATPE = V.AsmeTestPressureEngine;
  const ASE = V.AllowableStressEngine;
  const PCE = V.PipingCompatibilityEngine;
  const MCRE = V.MaterialCrossReferenceEngine;
  const MAE = V.MaterialAuditEngine;
  const VSE = V.VesselSizingEngine;
  const EPE = V.ExternalPressureEngine;
  const CE = V.CladdingEngine;
  const SE = V.SupportEngine;
  const PNE = V.PumpNozzleEngine;
  const TE = V.TestEngine;
  const RE = V.ReportEngine;

  const rawSteelByYear = { 2021: 64.75, 2022: 70.9, 2023: 57.4, 2024: 52.2, 2025: 55.05, 2026: 56.5 };
  // FEED estimate factors convert the calculated raw-material value into a finished vessel supply allowance.
  const finishedPriceFactors = { p50: 1.8, p90: 2.7 };
  const erectionP90Multiplier = 1.5;
  const feedBootDimensionRule = {
    minimumStraightLengthMm: 1000,
    lengthToDiameterRatio: 3,
    roundingIncrementMm: 100,
    attachmentWeightAllowancePercent: 15,
    diameterBands: [
      { vesselIdMaxExclusiveMm: 900, bootIdMm: 300 },
      { vesselIdMinInclusiveMm: 900, vesselIdMaxInclusiveMm: 1400, bootIdMm: 400 },
      { vesselIdMinExclusiveMm: 1400, bootIdMm: 500 }
    ]
  };
  const feedAgitationWeightRule = {
    powerBands: [
      { maxKw: 7.5, installedWeightKg: 450 }, { minExclusiveKw: 7.5, maxKw: 15, installedWeightKg: 700 },
      { minExclusiveKw: 15, maxKw: 30, installedWeightKg: 1100 }, { minExclusiveKw: 30, maxKw: 55, installedWeightKg: 1800 },
      { minExclusiveKw: 55, maxKw: 90, installedWeightKg: 2800 }, { minExclusiveKw: 90, maxKw: 130, installedWeightKg: 4000 }
    ],
    volumeBands: [
      { maxM3: 5, installedWeightKg: 450 }, { minExclusiveM3: 5, maxM3: 15, installedWeightKg: 700 },
      { minExclusiveM3: 15, maxM3: 40, installedWeightKg: 1100 }, { minExclusiveM3: 40, maxM3: 80, installedWeightKg: 1800 },
      { minExclusiveM3: 80, maxM3: 150, installedWeightKg: 2800 }, { minExclusiveM3: 150, installedWeightKg: 4000, manualReviewRequired: true }
    ],
    dutyFactors: { light_circulation: 0.85, normal_blending: 1, prevent_stratification: 1.1, liquid_liquid_dispersion: 1.25, solids_suspension: 1.35, high_viscosity_high_torque: 1.75 },
    topEntryMultiplier: 1.1,
    minimumTopEntryAdditionKg: 200,
    minimumInstalledWeightKg: 400,
    roundUpIncrementKg: 50
  };
  const materialCostFamilies = [
    ["Carbon Steel", 1], ["Low Temp. CS", 1.2], ["3½Ni", 2.21], ["¾Cr, ¾Ni", 1.56], ["2½Ni", 1.86], ["9Ni", 3.98], ["2Ni, 1Cu", 2.21],
    ["API 5L X42 to X52", 1.24], ["API 5L X56 to X70", 1.42], ["API 5L X80 to X120", 1.86], ["C, ½Mo", 1.95], ["½Cr, ½Mo", 2.21], ["1Cr, ½Mo / 1¼Cr, ½Mo", 2.39], ["2¼Cr, 1Mo", 3.1], ["5Cr, ½Mo", 3.1], ["9Cr, 1Mo", 3.89], ["9Cr, 1Mo, V / W modified", 5.31],
    ["18Cr, 8Ni", 3.72], ["16/18Cr, Ni, Mo", 5.76], ["Ti / Cb stabilized SS", 5.04], ["SS316Ti", 8.5], ["25Cr, 20Ni", 9.2], ["SS317", 6.69], ["6Mo Austenitic SS", 18.58], ["904L Austenitic SS", 17.7],
    ["Lean Duplex", 3.54], ["22Cr, 5½Ni, 3Mo", 8.85], ["High alloy duplex", 9.73], ["Super Duplex", 12.83], ["Titanium", 15.93], ["Inconel / Incoloy 825", 23.01], ["Inconel / Incoloy 800", 14.6], ["Inconel 625", 42.48], ["Inconel 600", 26.55], ["Hastelloy C / B family", 53.1], ["Alloy 20", 15.93], ["Nickel 200 / 201", 34.51], ["Monel 400", 31.86], ["Aluminium", 6.73]
  ].map(([name, csFactor]) => ({ name, csFactor }));
  const singlePieceErectionBands = [[30, 35450], [50, 43750], [100, 51900], [200, 62050], [300, 68000]];

  const state = {
    calculationId: `VM-${Date.now()}`,
    materialResult: null,
    vesselSizingResult: null,
    materialVerification: null,
    autoStressRecordId: null,
    designResult: null,
    testResult: null,
    scenarios: loadScenarios(),
    selectedLibraryPath: null
  };

  const titles = {
    overview: "VesselM Assessment Workspace",
    material: "Step 1: Screen Size & Material Options",
    design: "Step 2: Check Preliminary Thickness",
    scenario: "Step 3: Compare Options and Handover",
    verification: "Verification Centre",
    library: "Modular Data Libraries",
    basis: "Basis, Controls and Limitations"
  };

  const $ = id => document.getElementById(id);
  const qsa = selector => [...document.querySelectorAll(selector)];

  const els = {
    appShell: $("appShell"),
    sidebarToggle: $("sidebarToggle"),
    sidebarHoverLabel: $("sidebarHoverLabel"),
    pageTitle: $("pageTitle"),
    globalStatus: $("globalStatus"),
    dataStatus: $("dataStatus"),
    themeButton: $("themeButton"),
    toast: $("toast"),

    materialForm: $("materialForm"),
    materialErrors: $("materialErrors"),
    materialTag: $("materialTag"),
    materialProject: $("materialProject"),
    materialDescription: $("materialDescription"),
    materialMinTemp: $("materialMinTemp"),
    materialMinUnit: $("materialMinUnit"),
    materialMaxTemp: $("materialMaxTemp"),
    materialMaxUnit: $("materialMaxUnit"),
    materialComponentChoices: $("materialComponentChoices"),
    materialServiceChoices: $("materialServiceChoices"),
    materialOverrideEnabled: $("materialOverrideEnabled"),
    materialOverrideFields: $("materialOverrideFields"),
    materialOverrideFamily: $("materialOverrideFamily"),
    materialOverrideReason: $("materialOverrideReason"),
    materialOverrideComment: $("materialOverrideComment"),
    materialOverrideBy: $("materialOverrideBy"),
    materialOverrideDate: $("materialOverrideDate"),
    sizingService: $("sizingService"),
    sizingVolume: $("sizingVolume"),
    sizingLiquidFlow: $("sizingLiquidFlow"),
    sizingHoldup: $("sizingHoldup"),
    sizingGasFlow: $("sizingGasFlow"),
    sizingQuality: $("sizingQuality"),
    sizingFouling: $("sizingFouling"),
    sizingSolids: $("sizingSolids"),
    sizingSlugging: $("sizingSlugging"),
    sizingPumpSuction: $("sizingPumpSuction"),
    apiRp12jEnabled: $("apiRp12jEnabled"),
    apiRp12jFields: $("apiRp12jFields"),
    apiExampleButton: $("apiExampleButton"),
    materialExampleButton: $("materialExampleButton"),
    materialResetButton: $("materialResetButton"),
    materialEmpty: $("materialEmpty"),
    materialResults: $("materialResults"),
    vesselSizingRecommendation: $("vesselSizingRecommendation"),
    materialStatusCard: $("materialStatusCard"),
    materialEndpointCards: $("materialEndpointCards"),
    materialOptionGroups: $("materialOptionGroups"),
    materialPipingFilter: $("materialPipingFilter"),
    materialCrossReference: $("materialCrossReference"),
    materialAuditVerification: $("materialAuditVerification"),
    materialWarnings: $("materialWarnings"),
    materialOverrideResult: $("materialOverrideResult"),
    copyMaterialButton: $("copyMaterialButton"),

    designForm: $("designForm"),
    designErrors: $("designErrors"),
    designTag: $("designTag"),
    designCodeEdition: $("designCodeEdition"),
    designStressSource: $("designStressSource"),
    designMaterialGroup: $("designMaterialGroup"),
    designStressLibraryRecord: $("designStressLibraryRecord"),
    designStressLibraryStatus: $("designStressLibraryStatus"),
    designPressure: $("designPressure"),
    designPressureUnit: $("designPressureUnit"),
    designStaticHead: $("designStaticHead"),
    staticHeadUnitLabel: $("staticHeadUnitLabel"),
    designTemperature: $("designTemperature"),
    designTemperatureUnit: $("designTemperatureUnit"),
    designMaterialBasis: $("designMaterialBasis"),
    designCheckNonShell: $("designCheckNonShell"),
    designAlternateComponent: $("designAlternateComponent"),
    designComponentType: $("designComponentType"),
    designSecondaryNominalThickness: $("designSecondaryNominalThickness"),
    designHeadFormingThinningField: $("designHeadFormingThinningField"),
    designHeadFormingThinning: $("designHeadFormingThinning"),
    designDiameterBasis: $("designDiameterBasis"),
    diameterLabel: $("diameterLabel"),
    designDiameter: $("designDiameter"),
    designLengthUnit: $("designLengthUnit"),
    designHeadDepth: $("designHeadDepth"),
    designCrownRadius: $("designCrownRadius"),
    designKnuckleRadius: $("designKnuckleRadius"),
    designConeAngle: $("designConeAngle"),
    designTangentLength: $("designTangentLength"),
    designVesselCapacity: $("designVesselCapacity"),
    designInstallationLocation: $("designInstallationLocation"),
    designVesselOrientation: $("designVesselOrientation"),
    designNozzleCount: $("designNozzleCount"),
    designRequiresLadderPlatform: $("designRequiresLadderPlatform"),
    designCostMaterialFamily: $("designCostMaterialFamily"),
    designCostSteelYear: $("designCostSteelYear"),
    designCostErectionType: $("designCostErectionType"),
    designCostOperatingWeight: $("designCostOperatingWeight"),
    designQuickCostButton: $("designQuickCostButton"),
    designCladdingEnabled: $("designCladdingEnabled"),
    designCladdingFields: $("designCladdingFields"),
    designCladdingOption: $("designCladdingOption"),
    designCladdingMaterial: $("designCladdingMaterial"),
    designCladdingThickness: $("designCladdingThickness"),
    designCladdingCoverage: $("designCladdingCoverage"),
    designCladdingHeadCount: $("designCladdingHeadCount"),
    designCladdingHeadArea: $("designCladdingHeadArea"),
    designCladdingAdditionalArea: $("designCladdingAdditionalArea"),
    designAgitatorRequired: $("designAgitatorRequired"),
    designAgitatorFields: $("designAgitatorFields"),
    designMixerType: $("designMixerType"),
    designMixingDuty: $("designMixingDuty"),
    designMixerPowerKw: $("designMixerPowerKw"),
    designRequiresBoot: $("designRequiresBoot"),
    designRequiresSubmersiblePumpNozzle: $("designRequiresSubmersiblePumpNozzle"),
    designHasDemisterPad: $("designHasDemisterPad"),
    designHasBafflePlate: $("designHasBafflePlate"),
    designHasVortexBreaker: $("designHasVortexBreaker"),
    designApiInternalsRecommendation: $("designApiInternalsRecommendation"),
    designAbovegroundOptions: $("designAbovegroundOptions"),
    designUndergroundOptions: $("designUndergroundOptions"),
    designStress: $("designStress"),
    designStressUnit: $("designStressUnit"),
    designAmbientStress: $("designAmbientStress"),
    designJointEfficiency: $("designJointEfficiency"),
    designJointBasis: $("designJointBasis"),
    designCA: $("designCA"),
    designFormingAllowance: $("designFormingAllowance"),
    designOtherAllowance: $("designOtherAllowance"),
    designNominalThickness: $("designNominalThickness"),
    enableMapMawp: $("enableMapMawp"),
    enableHydrotest: $("enableHydrotest"),
    designExternalPressureEnabled: $("designExternalPressureEnabled"),
    designExternalPressureFields: $("designExternalPressureFields"),
    designExternalPressure: $("designExternalPressure"),
    designExternalUnsupportedLength: $("designExternalUnsupportedLength"),
    designExampleButton: $("designExampleButton"),
    designResetButton: $("designResetButton"),
    designEmpty: $("designEmpty"),
    designResults: $("designResults"),
    designStatusCard: $("designStatusCard"),
    designKpis: $("designKpis"),
    designComponentComparison: $("designComponentComparison"),
    designConfigurationCard: $("designConfigurationCard"),
    designExternalPressureCard: $("designExternalPressureCard"),
    designCostEstimateSection: $("designCostEstimateSection"),
    designWeightEstimateCard: $("designWeightEstimateCard"),
    designSupportEstimateCard: $("designSupportEstimateCard"),
    designCostEstimateCard: $("designCostEstimateCard"),
    designCladdingEstimateCard: $("designCladdingEstimateCard"),
    designCostAuditCard: $("designCostAuditCard"),
    designCostAuditToggle: $("designCostAuditToggle"),
    designCostAuditContent: $("designCostAuditContent"),
    designFormulaCard: $("designFormulaCard"),
    designFlowCard: $("designFlowCard"),
    designSecondaryCalculation: $("designSecondaryCalculation"),
    designSecondaryFormulaCard: $("designSecondaryFormulaCard"),
    designSecondaryFlowCard: $("designSecondaryFlowCard"),
    designChecksCard: $("designChecksCard"),
    designWarningsCard: $("designWarningsCard"),
    designCapacityCard: $("designCapacityCard"),
    designHydrotestCard: $("designHydrotestCard"),
    saveScenarioButton: $("saveScenarioButton"),
    copyDesignButton: $("copyDesignButton"),
    exportJsonButton: $("exportJsonButton"),
    exportCsvButton: $("exportCsvButton"),
    printButton: $("printButton"),
    designScenarioSaved: $("designScenarioSaved"),

    scenarioEmpty: $("scenarioEmpty"),
    scenarioContent: $("scenarioContent"),
    scenarioCards: $("scenarioCards"),
    scenarioTableBody: $("scenarioTableBody"),
    clearScenariosButton: $("clearScenariosButton"),

    runTestsButton: $("runTestsButton"),
    testTotal: $("testTotal"),
    testPassed: $("testPassed"),
    testFailed: $("testFailed"),
    testState: $("testState"),
    testTableBody: $("testTableBody"),

    librarySearch: $("librarySearch"),
    libraryFileList: $("libraryFileList"),
    librarySelectedTitle: $("librarySelectedTitle"),
    libraryJsonViewer: $("libraryJsonViewer"),
    copyLibraryButton: $("copyLibraryButton")
  };

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2500);
  }

  function showScreen(name) {
    qsa("[data-screen-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.screenPanel === name));
    qsa("[data-screen]").forEach(button => button.classList.toggle("active", button.dataset.screen === name));
    els.pageTitle.textContent = titles[name] || "VesselM";
    updateWorkflowProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // This is a navigation aid only. It never changes an engineering result or bypasses a safety gate.
  function updateWorkflowProgress() {
    const completed = {
      material: Boolean(state.materialResult && state.materialResult.status !== "blocked_input"),
      design: Boolean(state.designResult && state.designResult.status !== "blocked"),
      scenario: state.scenarios.length > 0
    };
    qsa("[data-workflow-step]").forEach(step => {
      const id = step.dataset.workflowStep;
      step.classList.toggle("complete", completed[id]);
      step.classList.toggle("active", !completed[id] && (
        (id === "material") ||
        (id === "design" && completed.material) ||
        (id === "scenario" && completed.design)
      ));
    });
  }

  function updateGlobalStatus() {
    const material = state.materialResult ? RE.statusLabel(state.materialResult.status) : null;
    const design = state.designResult ? RE.statusLabel(state.designResult.status) : null;
    els.globalStatus.textContent = design ? `Design: ${design}` : material ? `Material: ${material}` : "No active calculation";
    updateWorkflowProgress();
  }

  function severityClass(severity) {
    if (["blocking", "fail"].includes(severity)) return severity;
    if (["review", "warning"].includes(severity)) return "review";
    return "";
  }

  function statusCardHtml({ severity, symbol, title, body, badge }) {
    return `
      <div class="status-symbol">${U.escapeHtml(symbol)}</div>
      <div><h3>${U.escapeHtml(title)}</h3><p>${U.escapeHtml(body)}</p></div>
      <span class="status-badge">${U.escapeHtml(badge)}</span>
    `;
  }

  function issueCategory(item) {
    if (item.category) return item.category;
    const code = String(item.code || "").toUpperCase();
    if (/THIN|PRESSURE|DENOMINATOR/.test(code)) return "Pressure thickness";
    if (/TEMP|ENVELOPE|MATERIAL|GUIDE/.test(code)) return "Material & temperature";
    if (/STRESS|ALLOWABLE/.test(code)) return "Allowable stress";
    if (/SERVICE|SOUR|HYDROGEN|CHLORIDE|CAUSTIC/.test(code)) return "Service suitability";
    if (/CODE|FORMULA|BASIS/.test(code)) return "Code basis";
    if (/SOURCE|COMPONENT/.test(code)) return "Source data";
    if (code.startsWith("E_")) return "Required input";
    return "Engineering review";
  }

  function issueStatus(item) {
    if (["blocking", "fail"].includes(item.severity)) return "BLOCKED";
    if (["review", "warning"].includes(item.severity)) return "REVIEW";
    return "INFO";
  }

  function uniqueIssues(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      const key = [item.code || "", item.severity || "", item.message || ""].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderIssueList(items, title = "Engineering warnings and controls") {
    const list = uniqueIssues(items);
    return `
      <div class="card-heading"><span class="section-number">${list.length}</span><h3>${U.escapeHtml(title)}</h3></div>
      <p class="field-note">Use this table to see the engineering action required before the result is relied upon.</p>
      <div class="table-scroll engineering-review-table">
        <table class="check-table">
          <thead><tr><th>Category</th><th>Assessment</th><th>Status</th><th>Remarks / required action</th></tr></thead>
          <tbody>${list.length ? list.map(item => {
            const status = issueStatus(item);
            return `<tr>
              <td>${U.escapeHtml(issueCategory(item))}</td>
              <td><b>${U.escapeHtml(item.title || item.code || "Engineering check")}</b></td>
              <td><span class="review-status ${severityClass(item.severity)}"><i></i>${status}</span></td>
              <td>${U.escapeHtml(item.message || "Review this item before proceeding.")}</td>
            </tr>`;
          }).join("") : `<tr><td>Engineering controls</td><td><b>No active warnings</b></td><td><span class="review-status pass"><i></i>PASS</span></td><td>No additional action is currently recorded. The overall preliminary-design limitations still apply.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  function showFormErrors(container, issues) {
    if (!issues?.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    container.hidden = false;
    container.innerHTML = `<b>Calculation blocked:</b><ul>${issues.map(item => `<li>${U.escapeHtml(item.message || item)}</li>`).join("")}</ul>`;
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setupMaterialInputs() {
    els.materialComponentChoices.innerHTML = Object.entries(ME.componentLabels).map(([id, label]) => `
      <label class="choice">
        <input type="checkbox" name="materialComponent" value="${id}" checked>
        <span>${U.escapeHtml(label)}</span>
      </label>
    `).join("");

    els.materialServiceChoices.innerHTML = Object.entries(ME.serviceFlagLabels).map(([id, label]) => `
      <label class="choice">
        <input type="checkbox" name="materialService" value="${id}">
        <span>${U.escapeHtml(label)}</span>
      </label>
    `).join("");
    els.materialOverrideDate.value = U.dateStamp();
  }

  function materialInput() {
    const min = U.numberOrNull(els.materialMinTemp.value);
    const max = U.numberOrNull(els.materialMaxTemp.value);
    return {
      equipment_tag: els.materialTag.value.trim(),
      project_number: els.materialProject.value.trim(),
      vessel_description: els.materialDescription.value.trim(),
      minimum_temperature_f: min === null ? null : U.convertTemperature(min, els.materialMinUnit.value, "degF"),
      maximum_temperature_f: max === null ? null : U.convertTemperature(max, els.materialMaxUnit.value, "degF"),
      selected_components: qsa('input[name="materialComponent"]:checked').map(item => item.value),
      service_flags: qsa('input[name="materialService"]:checked').map(item => item.value),
      override: els.materialOverrideEnabled.checked ? {
        enabled: true,
        material_family: els.materialOverrideFamily.value.trim(),
        reason_code: els.materialOverrideReason.value,
        comment: els.materialOverrideComment.value.trim(),
        responsible_person: els.materialOverrideBy.value.trim(),
        override_date: els.materialOverrideDate.value
      } : { enabled: false }
    };
  }

  function vesselSizingInput() {
    return {
      service: els.sizingService.value,
      phases: qsa('input[name="sizingPhase"]:checked').map(item => item.value),
      required_volume_m3: U.numberOrNull(els.sizingVolume.value),
      liquid_flow_m3_h: U.numberOrNull(els.sizingLiquidFlow.value),
      holdup_minutes: U.numberOrNull(els.sizingHoldup.value),
      gas_flow_m3_h: U.numberOrNull(els.sizingGasFlow.value),
      separation_quality: els.sizingQuality.value,
      fouling_tendency: els.sizingFouling.value,
      solids_loading: els.sizingSolids.value,
      slugging_expected: els.sizingSlugging.checked,
      pump_suction: els.sizingPumpSuction.checked,
      api_rp_12j: apiRp12jInput()
    };
  }

  function apiNumberList(value) {
    return value.split(",").map(item => U.numberOrNull(item.trim())).filter(Number.isFinite);
  }

  // The three operating cases remain, while irrelevant phase-property rows are hidden.
  function updateApiOperatingCaseFields() {
    const serviceType = $("apiServiceType").value;
    const requiredFields = {
      gas_liquid_scrubber: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s"],
      gas_liquid_separator: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s"],
      gas_oil_water_separator: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "water_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "water_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s", "water_viscosity_pa_s", "oil_water_interfacial_tension_n_m"],
      liquid_liquid_separator: ["pressure_bara", "temperature_c", "oil_mass_flow_kg_h", "water_mass_flow_kg_h", "oil_density_kg_m3", "water_density_kg_m3", "oil_viscosity_pa_s", "water_viscosity_pa_s", "oil_water_interfacial_tension_n_m"],
      separator_with_solids: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s"]
    }[serviceType];
    qsa("[data-api-case-field]").forEach(field => {
      field.closest("tr").hidden = Boolean(requiredFields) && !requiredFields.includes(field.dataset.apiCaseField);
    });
    const liquidLabel = ["gas_oil_water_separator", "liquid_liquid_separator"].includes(serviceType) ? "Oil" : "Liquid";
    const labels = {
      oil_mass_flow_kg_h: `${liquidLabel} mass flow, kg/h`,
      oil_density_kg_m3: `${liquidLabel} density, kg/m³`,
      oil_viscosity_pa_s: `${liquidLabel} viscosity, Pa·s`
    };
    Object.entries(labels).forEach(([fieldName, label]) => {
      const field = document.querySelector(`[data-api-case-field="${fieldName}"]`);
      if (field) field.closest("tr").querySelector("td").textContent = label;
    });
  }

  function apiRp12jInput() {
    if (!els.apiRp12jEnabled.checked) return { enabled: false };
    const cases = ["design", "normal", "minimum"].map(caseType => {
      const item = { case_type: caseType };
      qsa(`[data-api-case="${caseType}"]`).forEach(field => {
        item[field.dataset.apiCaseField] = U.numberOrNull(field.value);
      });
      return item;
    });
    return {
      enabled: true,
      service_type: $("apiServiceType").value,
      compressor_suction_service: $("apiCompressorSuction").checked,
      plot_area_restricted: $("apiPlotRestricted").checked,
      foaming_tendency: $("apiFoaming").value,
      wax_or_asphaltenes_present: $("apiWaxPresent").checked,
      high_viscosity_liquid: $("apiHighViscosity").checked,
      low_interfacial_tension: $("apiLowIft").checked,
      high_turndown_required: $("apiHighTurndown").checked,
      high_liquid_loading: $("apiHighLiquidLoading").checked,
      required_droplet_size_um: U.numberOrNull($("apiDropletTarget").value),
      required_liquid_retention_time_s: U.numberOrNull($("apiRetentionTime").value),
      required_slug_volume_m3: U.numberOrNull($("apiSlugVolume").value),
      standard_vessel_ids_m: apiNumberList($("apiStandardIds").value),
      standard_tangent_lengths_m: apiNumberList($("apiStandardLengths").value),
      operating_cases: cases
    };
  }

  function loadApiExample() {
    const example = VSE.apiWorkedExample?.();
    if (!example) {
      showToast("The API RP 12J v2 worked example is unavailable. Check the local data bundle.");
      return;
    }
    const source = example.input;
    els.apiRp12jEnabled.checked = true;
    els.apiRp12jFields.hidden = false;
    $("apiServiceType").value = source.service_type;
    $("apiCompressorSuction").checked = Boolean(source.compressor_suction_service);
    $("apiPlotRestricted").checked = false;
    $("apiFoaming").value = source.foaming_tendency || "low";
    $("apiWaxPresent").checked = Boolean(source.wax_or_asphaltenes_present);
    $("apiHighViscosity").checked = false;
    $("apiLowIft").checked = false;
    $("apiHighTurndown").checked = Boolean(source.high_turndown_required);
    $("apiHighLiquidLoading").checked = false;
    $("apiDropletTarget").value = source.required_water_droplet_size_um || source.required_oil_droplet_size_um || "";
    $("apiRetentionTime").value = source.required_liquid_retention_time_s || "";
    $("apiSlugVolume").value = "0";
    $("apiStandardIds").value = [example.recommendation.vessel.internal_diameter_m].join(", ");
    $("apiStandardLengths").value = [example.recommendation.vessel.tangent_to_tangent_length_m].join(", ");
    updateApiOperatingCaseFields();
    const cases = Object.fromEntries(["design", "normal", "minimum"].map(caseType => [caseType, source]));
    qsa("[data-api-case-field]").forEach(field => {
      field.value = cases[field.dataset.apiCase][field.dataset.apiCaseField];
    });
    showToast("API RP 12J v2 worked example loaded. The same synthetic snapshot is shown for all three cases; replace it with approved project cases.");
  }

  function applySizingRecommendation(result) {
    const recommendation = result?.recommendation;
    if (!recommendation) return;
    els.designDiameterBasis.value = "inside";
    els.designDiameter.value = U.formatNumber(recommendation.internal_diameter_mm, 0);
    els.designTangentLength.value = U.formatNumber(recommendation.tangent_length_mm, 0);
    els.designVesselCapacity.value = U.formatNumber(recommendation.working_volume_m3, 2);
    const ids = new Set(recommendation.internals.map(item => item.id));
    els.designHasDemisterPad.checked = ids.has("GL-001") || ids.has("GL-002") || ids.has("GL-003");
    els.designHasBafflePlate.checked = ids.has("FLW-001") || ids.has("LL-001");
    els.designHasVortexBreaker.checked = ids.has("OUT-001");
    els.designRequiresBoot.checked = ids.has("LL-002") || ids.has("SOL-001");
    clearApiInternalsRecommendation();
    updateDesignGeometryVisibility();
  }

  function clearApiInternalsRecommendation() {
    els.designApiInternalsRecommendation.hidden = true;
    els.designApiInternalsRecommendation.innerHTML = "";
  }

  function renderApiInternalsRecommendation(api, result) {
    if (!api || api.status !== "api_input_ready") {
      clearApiInternalsRecommendation();
      return;
    }
    const internals = api.internals || [];
    const findInternal = pattern => internals.find(item => pattern.test(item.name || ""));
    const inlet = findInternal(/inlet/i);
    const mist = findInternal(/mist|cyclone/i);
    const baffle = findInternal(/baffle/i);
    const interfaceArrangement = findInternal(/interface|weir/i);
    const vortex = findInternal(/vortex/i);
    const needsSolidsReview = api.service_type === "separator_with_solids" || ["low", "medium", "high"].includes(result?.input?.solids_loading);
    const status = (kind, text) => `<span class="review-status ${kind}"><i></i>${text}</span>`;
    const item = (component, recommendation, kind, statusText, reason) => `
      <tr><td>${U.escapeHtml(component)}</td><td>${U.escapeHtml(recommendation)}</td><td>${status(kind, statusText)}</td><td>${U.escapeHtml(reason)}</td></tr>`;
    const optional = (match, component, fallback) => match
      ? item(component, match.name, "pass", "Recommended", match.reason)
      : item(component, "Not required for this API service basis", "neutral", "Not required", fallback);
    const rows = [
      inlet ? item("Inlet device", inlet.name, "pass", "Recommended", inlet.reason) : item("Inlet device", "Confirm with process engineer", "review", "Needs process review", "The API route did not resolve an inlet-device candidate."),
      mist && /no mist/i.test(mist.name)
        ? item("Mist eliminator", mist.name, "neutral", "Not required", mist.reason)
        : optional(mist, "Mist eliminator", "Fine-mist removal is not required for the selected separation basis."),
      optional(baffle, "Distribution baffle", "The selected orientation and phase arrangement do not call for a preliminary distribution baffle."),
      optional(interfaceArrangement, "Interface weir / liquid outlet arrangement", "A separate liquid-liquid interface arrangement is not required for this service basis."),
      optional(vortex, "Vortex breaker", "No pump-suction or liquid-outlet vortex-control basis was entered."),
      needsSolidsReview
        ? item("Solids sump / cleanout", "Confirm cleanout, drainage and access arrangement", "review", "Needs process review", "Solids handling requires project-specific operating and maintenance information.")
        : item("Solids sump / cleanout", "Not required for current process basis", "neutral", "Not required", "No solids-handling basis was entered."),
      item("Internal supports, drainage and access", "Confirm with vessel supplier", "review", "Needs process review", "Verify removable-internal access, mist-device support, drainage, pressure drop and maintainability before issue for design.")
    ].join("");
    els.designApiInternalsRecommendation.hidden = false;
    els.designApiInternalsRecommendation.innerHTML = `
      <div class="api-internals-heading"><span class="section-number">API</span><div><b>API RP 12J automatic internals recommendation</b><small>Derived from the approved API process-data panel. The three checkboxes above have been pre-filled where applicable.</small></div></div>
      <div class="table-scroll engineering-review-table"><table><thead><tr><th>Internal / check</th><th>Preliminary recommendation</th><th>Status</th><th>Why this is shown</th></tr></thead><tbody>${rows}</tbody></table></div>
      <details class="compatibility-details"><summary>Show supplier and engineering checks</summary><div class="details-content"><ul><li>Confirm inlet momentum, flow distribution, mist-removal performance and pressure drop with process and the internals supplier.</li><li>Confirm internal supports, drainage, access / removal path, manway arrangement and maintainability with the vessel supplier.</li><li>These are preliminary recommendations only; final internals and liquid-level arrangements require process, mechanical and vendor approval.</li></ul></div></details>`;
  }

  function applyApiSizingRecommendation(candidate, api) {
    els.designDiameterBasis.value = "inside";
    els.designDiameter.value = U.formatNumber(candidate.selected_candidate.diameter_m * 1000, 0);
    els.designTangentLength.value = U.formatNumber(candidate.selected_candidate.tangent_length_m * 1000, 0);
    els.designVesselCapacity.value = U.formatNumber(candidate.selected_candidate.gross_shell_volume_m3, 2);
    const internalNames = (api.internals || []).map(item => item.name.toLowerCase()).join(" ");
    els.designHasDemisterPad.checked = /mist|vane|cyclone/.test(internalNames);
    els.designHasBafflePlate.checked = /baffle|interface/.test(internalNames);
    els.designHasVortexBreaker.checked = /vortex/.test(internalNames);
    els.designRequiresBoot.checked = /three-phase|interface/.test(internalNames);
    renderApiInternalsRecommendation(api, state.vesselSizingResult);
    updateDesignGeometryVisibility();
  }

  function renderVesselSizingRecommendation(result) {
    state.vesselSizingResult = result;
    const recommendation = result?.recommendation;
    if (!recommendation) {
      els.vesselSizingRecommendation.hidden = true;
      return;
    }
    els.vesselSizingRecommendation.hidden = false;
    const internals = recommendation.internals.map(item => `<li><b>${U.escapeHtml(item.name)}</b> — ${U.escapeHtml(item.reason)}</li>`).join("");
    const d = recommendation.derivation || {};
    const input = result.input || {};
    const orientationLabels = { horizontal_preferred: "Horizontal recommended", vertical_preferred: "Vertical recommended" };
    const orientationDecision = recommendation.orientation_decision || `${recommendation.orientation}_preferred`;
    const orientationReason = (recommendation.orientation_reasons || []).join(" ") || "Preliminary orientation screening basis.";
    const api = result.api_rp_12j;
    const apiMissingHeading = api?.status === "api_input_ready" ? "API completeness gate passed" : "Required inputs not yet available";
    const apiCandidate = api?.api_preliminary_recommendation;
    if (apiCandidate?.status === "inventory_candidate") {
      const candidate = apiCandidate.selected_candidate;
      els.vesselSizingRecommendation.innerHTML = `
        <div class="card-heading"><span class="section-number">API</span><h3>API RP 12J preliminary vessel size &amp; internals recommendation</h3></div>
        <p class="field-note">API RP 12J is the active sizing route for this case. Its selected geometry has been transferred to Step 2 for the preliminary thickness check.</p>
        <div class="capacity-grid">
          <div class="capacity-card"><span>Orientation recommendation</span><strong>${U.escapeHtml(apiCandidate.orientation.replace(/\b\w/g, letter => letter.toUpperCase()))}</strong><small>${U.escapeHtml(apiCandidate.governing_case)} case governs inventory</small></div>
          <div class="capacity-card"><span>Preliminary working capacity</span><strong>${U.formatNumber(candidate.gross_shell_volume_m3, 2)} m³</strong><small>Standard-vessel candidate</small></div>
          <div class="capacity-card"><span>Estimated internal diameter</span><strong>${U.formatNumber(candidate.diameter_m * 1000, 0)} mm</strong><small>Entered standard size</small></div>
          <div class="capacity-card"><span>Tangent-line length</span><strong>${U.formatNumber(candidate.tangent_length_m * 1000, 0)} mm</strong><small>Entered standard length</small></div>
        </div>
        <div class="cross-reference-grid"><article class="cross-reference-card"><h4>Preliminary outlet nozzle minimum IDs</h4><dl class="cross-reference-details"><dt>Gas outlet</dt><dd>${U.formatNumber(apiCandidate.nozzle_minimum_ids_m.gas_outlet * 1000, 0)} mm</dd><dt>Oil outlet</dt><dd>${U.formatNumber(apiCandidate.nozzle_minimum_ids_m.oil_outlet * 1000, 0)} mm</dd><dt>Water outlet</dt><dd>${U.formatNumber(apiCandidate.nozzle_minimum_ids_m.water_outlet * 1000, 0)} mm</dd></dl></article><article class="cross-reference-card"><h4>Recommended internals</h4><ul>${api.internals.map(item => `<li><b>${U.escapeHtml(item.name)}</b> — ${U.escapeHtml(item.reason)}</li>`).join("")}</ul></article></div>
        <details class="compatibility-details"><summary>Show API calculation basis and pending checks</summary><div class="details-content"><ul>${apiCandidate.calculation_notes.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></div></details>`;
      applyApiSizingRecommendation(apiCandidate, api);
      return;
    }
    const apiVesselRecommendation = !apiCandidate ? "" : apiCandidate.status === "no_inventory_candidate" ? `
      <section class="panel result-panel"><div class="card-heading"><span class="section-number">API</span><h3>API RP 12J preliminary vessel size &amp; internals recommendation</h3></div><div class="alert review"><b>No standard vessel candidate meets the inventory screen.</b><p>Add a larger standard vessel ID or tangent length, then re-run the screen. This is not a final API failure assessment.</p></div></section>` : `
      <section class="panel result-panel">
        <div class="card-heading"><span class="section-number">API</span><h3>API RP 12J preliminary vessel size &amp; internals recommendation</h3></div>
        <p class="field-note">Separate from the simplified recommendation above. This is the smallest entered standard vessel that passes the liquid-inventory screen; it is not a final API-approved vessel configuration.</p>
        <div class="capacity-grid">
          <div class="capacity-card"><span>API orientation</span><strong>${U.escapeHtml(apiCandidate.orientation.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()))}</strong><small>${U.escapeHtml(apiCandidate.governing_case)} case governs inventory</small></div>
          <div class="capacity-card"><span>Estimated internal diameter</span><strong>${U.formatNumber(apiCandidate.selected_candidate.diameter_m * 1000, 0)} mm</strong><small>Entered standard size</small></div>
          <div class="capacity-card"><span>Tangent-line length</span><strong>${U.formatNumber(apiCandidate.selected_candidate.tangent_length_m * 1000, 0)} mm</strong><small>Entered standard length</small></div>
          <div class="capacity-card"><span>Gross shell volume</span><strong>${U.formatNumber(apiCandidate.selected_candidate.gross_shell_volume_m3, 2)} m³</strong><small>Inventory screen: ${U.formatNumber(apiCandidate.required_inventory_m3, 2)} m³ required</small></div>
        </div>
        <div class="cross-reference-grid"><article class="cross-reference-card"><h4>Preliminary outlet nozzle minimum IDs</h4><dl class="cross-reference-details"><dt>Gas outlet</dt><dd>${U.formatNumber(apiCandidate.nozzle_minimum_ids_m.gas_outlet * 1000, 0)} mm</dd><dt>Oil outlet</dt><dd>${U.formatNumber(apiCandidate.nozzle_minimum_ids_m.oil_outlet * 1000, 0)} mm</dd><dt>Water outlet</dt><dd>${U.formatNumber(apiCandidate.nozzle_minimum_ids_m.water_outlet * 1000, 0)} mm</dd></dl></article><article class="cross-reference-card"><h4>API preliminary internals</h4><ul>${api.internals.map(item => `<li><b>${U.escapeHtml(item.name)}</b> — ${U.escapeHtml(item.reason)}</li>`).join("")}</ul></article></div>
        <details class="compatibility-details"><summary>Show API calculation basis and pending checks</summary><div class="details-content"><ul>${apiCandidate.calculation_notes.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></div></details>
      </section>`;
    const apiComparison = !api ? "" : ["not_applicable", "library_not_loaded", "not_requested"].includes(api.status) ? `
      <section class="panel result-panel">
        <div class="card-heading"><span class="section-number">API</span><h3>API RP 12J comparison recommendation</h3></div>
        <div class="alert review"><b>${api.status === "not_applicable" ? "Not applicable to this case" : api.status === "not_requested" ? "Detailed API data not entered" : "API rules library unavailable"}</b><p>${U.escapeHtml(api.message)}</p></div>
      </section>` : `
      <section class="panel result-panel">
        <div class="card-heading"><span class="section-number">API</span><h3>API RP 12J comparison recommendation</h3></div>
        <p class="field-note">A separate preliminary comparison using the supplied API RP 12J 9th Edition rules library (v${U.escapeHtml(api.metadata?.library_version || "current")}). It does not replace the existing recommendation; full API sizing remains blocked until all required operating cases and fluid properties are available.</p>
        <div class="capacity-grid">
          <div class="capacity-card"><span>Phase configuration</span><strong>${U.escapeHtml(api.phase_configuration.replaceAll("_", " "))}</strong><small>API comparison basis</small></div>
          <div class="capacity-card"><span>Orientation</span><strong>${U.escapeHtml(api.orientation.replaceAll("_", " "))}</strong><small>${U.escapeHtml(api.confidence)} confidence</small></div>
        </div>
        <dl class="cross-reference-details"><dt>Orientation basis</dt><dd>${U.escapeHtml(api.orientation_basis)}</dd><dt>Recommended internals</dt><dd><ul>${api.internals.map(item => `<li><b>${U.escapeHtml(item.name)}</b> — ${U.escapeHtml(item.reason)}</li>`).join("")}</ul></dd></dl>
        <div class="alert review"><b>Source basis: ${U.escapeHtml([api.source?.document, api.source?.edition, api.source?.publication_date].filter(Boolean).join(" — ") || "API RP 12J rules library")}</b><p>${U.escapeHtml(api.warning)}</p></div>
        <details class="compatibility-details"><summary>Show API RP 12J comparison limits and outstanding checks</summary><div class="details-content"><p><b>${apiMissingHeading}:</b></p>${api.missing_inputs.length ? `<ul>${api.missing_inputs.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul>` : "<p>All required panel fields are present. Continue with detailed candidate iteration before approving a vessel size.</p>"}<p><b>Checks not run:</b></p><ul>${api.verification.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></div></details>
      </section>`;
    const volumeCalculation = d.volume_basis === "user_entered_working_capacity" ?
      `User-entered preliminary working capacity = ${U.formatNumber(recommendation.working_volume_m3, 2)} m³.` :
      `Working capacity = liquid flow × holdup time = ${U.formatNumber(input.liquid_flow_m3_h, 3)} m³/h × ${U.formatNumber(input.holdup_minutes, 2)} min ÷ 60 = ${U.formatNumber(recommendation.working_volume_m3, 2)} m³.`;
    els.vesselSizingRecommendation.innerHTML = `
      <div class="card-heading"><span class="section-number">AUTO</span><h3>Preliminary vessel size &amp; internals recommendation</h3></div>
      <p class="field-note">Automatically derived from the supplied sizing and internals logic. These dimensions have been transferred to Step 2 for the preliminary thickness check.</p>
      <div class="capacity-grid">
        <div class="capacity-card"><span>Orientation recommendation</span><strong>${U.escapeHtml(orientationLabels[orientationDecision] || recommendation.orientation)}</strong><small>${U.escapeHtml(recommendation.service_label)}</small></div>
        <div class="capacity-card"><span>Preliminary working capacity</span><strong>${U.formatNumber(recommendation.working_volume_m3, 2)} m³</strong><small>Process basis to confirm</small></div>
        <div class="capacity-card"><span>Estimated internal diameter</span><strong>${U.formatNumber(recommendation.internal_diameter_mm, 0)} mm</strong><small>Screening geometry</small></div>
        <div class="capacity-card"><span>Tangent-line length</span><strong>${U.formatNumber(recommendation.tangent_length_mm, 0)} mm</strong><small>Screening geometry</small></div>
      </div>
      <div class="alert review"><b>Recommended internals</b><ul>${internals}</ul></div>
      ${apiVesselRecommendation}
      <details class="compatibility-details sizing-calculation-details">
        <summary>Show assumptions and calculations for these recommendations</summary>
        <div class="details-content">
          <dl class="cross-reference-details">
            <dt>Process duty</dt><dd>${U.escapeHtml(recommendation.service_label)}</dd>
            <dt>Phases considered</dt><dd>${U.escapeHtml((input.phases || []).map(item => item.replaceAll("_", " ")).join(", "))}</dd>
            <dt>Capacity calculation</dt><dd>${U.escapeHtml(volumeCalculation)}</dd>
            <dt>Orientation rule</dt><dd>${U.escapeHtml(orientationReason)}</dd>
            <dt>Geometry assumption</dt><dd>L/D = ${U.formatNumber(d.length_to_diameter_ratio, 1)} for the selected ${U.escapeHtml(recommendation.orientation)} screening configuration. This is a preliminary layout heuristic, not a final design ratio.</dd>
            <dt>Diameter calculation</dt><dd>${U.escapeHtml(d.diameter_formula || "D = cube root(4 × V / (π × L/D))")}. Using V = ${U.formatNumber(recommendation.working_volume_m3, 3)} m³ and L/D = ${U.formatNumber(d.length_to_diameter_ratio, 1)} gives D = ${U.formatNumber(recommendation.internal_diameter_mm / 1000, 3)} m (${U.formatNumber(recommendation.internal_diameter_mm, 0)} mm).</dd>
            <dt>Tangent-line length</dt><dd>${U.escapeHtml(d.tangent_length_formula || "L = (L/D) × D")}. ${U.formatNumber(d.length_to_diameter_ratio, 1)} × ${U.formatNumber(recommendation.internal_diameter_mm / 1000, 3)} m = ${U.formatNumber(recommendation.tangent_length_mm / 1000, 3)} m (${U.formatNumber(recommendation.tangent_length_mm, 0)} mm).</dd>
            <dt>Gas-flow check</dt><dd>${Number.isFinite(recommendation.gas_flow_m3_h) ? `${U.formatNumber(recommendation.gas_flow_m3_h, 2)} m³/h entered. Gas velocity, density and droplet-removal calculations remain for process confirmation.` : "No gas flow entered; gas capacity has not been verified."}</dd>
            <dt>Internal-selection basis</dt><dd>Recommendations use the selected phases, duty, separation quality, fouling, solids, slugging and pump-suction flags. Each recommendation and reason is shown above.</dd>
          </dl>
          <p class="field-note">Source logic: ${U.escapeHtml(result.source?.sizing || "Preliminary vessel sizing logic")} and ${U.escapeHtml(result.source?.internals || "Preliminary internals logic")}. Confirm fluid properties, retention/slug basis, liquid levels, nozzle sizing and vendor requirements before finalising.</p>
        </div>
      </details>
      ${result.warnings?.length ? renderIssueList(result.warnings, "Sizing assumptions and required confirmations") : ""}
    `;
    applySizingRecommendation(result);
  }

  function materialStatusCopy(result) {
    const blocking = result.severity === "blocking";
    const review = result.severity === "review";
    return {
      symbol: blocking ? "×" : review ? "!" : "✓",
      title: result.status === "guide_candidates_review" ? "Guide-based material candidates found for review" :
        result.status === "outside_guide" ? "No material recommendation for this temperature envelope" :
        blocking ? "Source or input resolution required" :
        review ? "Source match found with engineering review" :
        "Full-envelope source match found",
      body: result.status_definition?.engineering_meaning ||
        "The temperature-based source result is shown below.",
      badge: RE.statusLabel(result.status)
    };
  }

  function renderMaterialEndpoint(endpoint) {
    const matches = endpoint.matches || [];
    const families = U.unique(matches.map(item => ME.familyLabels[item.material_family_id] || item.material_family_id));
    return `
      <article class="panel endpoint-card">
        <header>
          <div><small>${U.escapeHtml(endpoint.label.toUpperCase())}</small><h3>${U.formatNumber(endpoint.temperature_c, 1)}°C</h3></div>
          <div class="endpoint-conversion">${matches.length} source route${matches.length === 1 ? "" : "s"}</div>
        </header>
        ${matches.length ? `
          <span class="range-chip">${U.escapeHtml(ME.formatRange(matches[0]))}</span>
          <div class="family-line">
            <strong>${U.escapeHtml(families.join(" / "))}</strong>
            <span>${U.escapeHtml(ME.categoryLabels[matches[0].category_id] || matches[0].category_id)}</span>
          </div>
        ` : `<div class="no-match">No exact source record contains this temperature.</div>`}
      </article>
    `;
  }

  function renderMaterialEnvelope(result) {
    const envelope = result.envelope;
    if (!envelope) return "";
    const minC = U.convertTemperature(envelope.minimum_temperature_f, "degF", "degC");
    const maxC = U.convertTemperature(envelope.maximum_temperature_f, "degF", "degC");
    const primaryCount = envelope.matches?.length || 0;
    const guideCount = result.guide_candidates?.length || 0;
    const count = primaryCount + guideCount;
    return `
      <article class="panel endpoint-card material-envelope-card">
        <header>
          <div><small>COMPLETE DESIGN-TEMPERATURE ENVELOPE</small><h3>${U.formatNumber(minC, 1)}°C to ${U.formatNumber(maxC, 1)}°C</h3></div>
          <div class="endpoint-conversion">${primaryCount ? `${primaryCount} primary source route${primaryCount === 1 ? "" : "s"}` : `${guideCount} guide candidate${guideCount === 1 ? "" : "s"}`}</div>
        </header>
        ${count ? `
          <span class="range-chip">Each option below covers this complete range</span>
          <div class="family-line"><strong>${primaryCount ? "Only full-envelope material routes are shown" : "ASTM/ASME guide candidates are shown for review"}</strong><span>Junior-engineer view</span></div>
        ` : `<div class="no-match">No single source material route covers this complete temperature range. Escalate the case; no material is recommended.</div>`}
      </article>
    `;
  }

  function renderMaterialOptions(result, sourceRecords = result.source_records || []) {
    if (!sourceRecords.length) {
      if (result.guide_candidates?.length) {
        els.materialOptionGroups.innerHTML = "";
        return;
      }
      els.materialOptionGroups.innerHTML = `
        <article class="panel result-panel">
          <div class="card-heading"><span class="section-number">STOP</span><h3>No material recommendation</h3></div>
          <p class="field-note">No single source route covers the complete design-temperature envelope. Refer this case to the senior or materials engineer.</p>
        </article>
      `;
      return;
    }
    const groups = new Map();
    for (const record of sourceRecords) {
      const key = record.alternative_group_id || `${record.min_f}_${record.max_f}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }

    els.materialOptionGroups.innerHTML = [...groups.values()].map(records => `
      <section class="option-group">
        <div class="option-group-heading">
          <div>
            <h3>${records.length > 1 ? "Source-listed material alternatives" : "Source-listed material route"}</h3>
            <p>${U.escapeHtml(ME.formatRange(records[0]))}. VesselM does not rank the alternatives.</p>
          </div>
          ${records.length > 1 ? `<span class="option-count">${records.length} OPTIONS</span>` : ""}
        </div>
        <div class="option-grid">
          ${records.sort((a,b) => a.option_rank - b.option_rank).map(record => `
            <article class="panel option-card">
              <div class="option-card-header">
                <div>
                  <h4>${U.escapeHtml(ME.familyLabels[record.material_family_id] || record.material_family_id)}</h4>
                  <p>${U.escapeHtml(ME.categoryLabels[record.category_id] || record.category_id)}</p>
                </div>
                <span class="option-rank">OPT ${record.option_rank || 1}</span>
              </div>
              <dl class="material-matrix">
                ${result.input.selected_components.map(component => {
                  const data = record.components?.[component];
                  const text = data?.source_text || "Not specified in source";
                  const quality = data?.data_quality || "not_specified_in_source";
                  return `
                    <div class="material-row">
                      <dt>${U.escapeHtml(ME.componentLabels[component] || component)}</dt>
                      <dd>${U.escapeHtml(text)}<br><span class="quality-tag ${U.escapeHtml(quality)}">${U.escapeHtml(quality.replaceAll("_", " "))}</span></dd>
                    </div>
                  `;
                }).join("")}
              </dl>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  function renderPipingCompatibility(result) {
    const assessment = PCE?.assess(result);
    if (!assessment) {
      els.materialPipingFilter.hidden = true;
      return result.source_records || [];
    }

    const excluded = assessment.records.filter(item => item.decision === "exclude");
    const review = assessment.records.filter(item => item.decision === "review");
    const visibleRecords = (result.source_records || []).filter(record => assessment.retainedIds.includes(record.id));
    els.materialPipingFilter.hidden = false;
    els.materialPipingFilter.innerHTML = `
      <div class="card-heading"><span class="section-number">ASTM</span><h3>Piping specification cross-check</h3></div>
      <p class="field-note">A secondary historical ASTM/ASME piping guide narrows only the displayed options. Your original vessel-source result remains preserved in the audit record.</p>
      <div class="compatibility-summary">
        <span class="compatibility-retain">${visibleRecords.length} displayed</span>
        <span class="compatibility-review">${review.length} needs review</span>
        <span class="compatibility-exclude">${excluded.length} hidden</span>
      </div>
      ${excluded.length ? `<details class="compatibility-details"><summary>View hidden options and reasons</summary><ul>${excluded.map(item => {
        const record = (result.source_records || []).find(candidate => candidate.id === item.recordId);
        const label = ME.familyLabels[record?.material_family_id] || item.recordId;
        return `<li><b>${U.escapeHtml(label)}</b> — ${U.escapeHtml(item.reason)}</li>`;
      }).join("")}</ul></details>` : ""}
      ${review.length ? `<div class="alert review"><b>Review items remain displayed.</b><p>The piping guide cannot provide a complete machine-readable confirmation for these options. Check the original guide and project specification before selection.</p></div>` : ""}
    `;
    return visibleRecords;
  }

  function renderMaterialCrossReference(result) {
    const crossReference = MCRE?.assess(result);
    if (!crossReference?.materials?.length) {
      els.materialCrossReference.hidden = true;
      return;
    }

    const cards = crossReference.materials.map(material => {
      const family = material.displayLabel || ME.familyLabels[material.materialFamilyId] || material.materialFamilyId;
      if (!material.references.length) {
        return `<div class="cross-reference-card"><h4>${U.escapeHtml(family)}</h4><p>No directly mapped plate reference is available. Keep the material route for senior materials-engineer review.</p></div>`;
      }
      return material.references.map(item => {
        const reference = item.reference;
        const status = item.status === "reference_covers_envelope" ? "confirmed" : "review";
        const label = item.status === "reference_covers_envelope" ? "Guide range covers envelope" :
          item.status === "reference_range_review" ? "Guide range requires review" : "Guide range not stated";
        return `
          <article class="cross-reference-card">
            <div class="cross-reference-title"><div><h4>${U.escapeHtml(family)} — ${U.escapeHtml(reference.chemical_composition_or_grade_family || reference.basic_material_of_construction)}</h4><p>${U.escapeHtml(reference.basic_material_of_construction)}</p></div><span class="cross-reference-status ${status}">${U.escapeHtml(label)}</span></div>
            <dl class="cross-reference-details">
              <dt>Source temperature guide</dt><dd>${U.escapeHtml(item.sourceRangeC)}</dd>
              <dt>Vessel plate reference</dt><dd>${U.escapeHtml(reference.plate?.material_specification_or_grade || "Not stated")}</dd>
              <dt>Plate mapping</dt><dd>${U.escapeHtml(reference.plate?.mapping_status || "Engineering review required")}</dd>
            </dl>
            <p class="cross-reference-note">${U.escapeHtml(reference.plate?.vessel_engineering_note || "Confirm the exact product form and controlled code requirements.")}</p>
            ${material.reviewReasons?.length ? `<div class="alert review"><b>Additional review required</b><p>${U.escapeHtml(material.reviewReasons.join(" "))}</p></div>` : ""}
            <details class="compatibility-details"><summary>View piping and component references</summary><dl class="cross-reference-details">
              <dt>Pipe</dt><dd>${U.escapeHtml(reference.pipe?.material_standard || "Not stated")}</dd>
              <dt>Socket-weld fittings</dt><dd>${U.escapeHtml(reference.socket_weld_fittings?.material_standard || "Not stated")}</dd>
              <dt>Butt-weld fittings</dt><dd>${U.escapeHtml(reference.butt_weld_fittings?.material_standard || "Not stated")}</dd>
              <dt>Flanges / forgings</dt><dd>${U.escapeHtml(reference.flanges?.material_standard || "Not stated")}</dd>
              <dt>Castings</dt><dd>${U.escapeHtml(reference.castings?.material_standard || "Not stated")}</dd>
            </dl></details>
          </article>
        `;
      }).join("");
    }).join("");

    els.materialCrossReference.hidden = false;
    const hiddenCandidates = crossReference.hiddenCandidates || [];
    els.materialCrossReference.innerHTML = `
      <div class="card-heading"><span class="section-number">PLATE</span><h3>ASTM/ASME vessel plate cross-reference</h3></div>
      <p class="field-note">${U.escapeHtml(crossReference.sourceTitle)} — ${U.escapeHtml(crossReference.sourceStatus)}. This adds plate and piping reference information; it does not approve a final material selection.</p>
      ${hiddenCandidates.length ? `<div class="candidate-ranking-note"><b>Top 2 nearest temperature candidates shown.</b><span>${hiddenCandidates.length} additional candidate${hiddenCandidates.length === 1 ? " is" : "s are"} hidden to keep this review focused.</span></div>` : ""}
      <div class="cross-reference-grid">${cards}</div>
      ${hiddenCandidates.length ? `<details class="compatibility-details"><summary>Show additional temperature-qualified candidates</summary><ul>${hiddenCandidates.map(candidate => {
        const minC = U.convertTemperature(candidate.temperature_range_f.minF, "degF", "degC");
        const maxC = U.convertTemperature(candidate.temperature_range_f.maxF, "degF", "degC");
        return `<li><b>${U.escapeHtml(candidate.display_label)}</b> — ${U.formatNumber(minC, 1)}°C to ${U.formatNumber(maxC, 1)}°C</li>`;
      }).join("")}</ul></details>` : ""}
      <details class="compatibility-details"><summary>Mandatory checks before final selection</summary><ul>${crossReference.mandatoryVerification.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></details>
    `;
  }

  function renderMaterialAuditVerification(result) {
    const verification = MAE?.assess(result);
    state.materialVerification = verification;
    if (!verification) {
      els.materialAuditVerification.hidden = true;
      els.materialAuditVerification.innerHTML = "";
      return;
    }

    const candidateCards = verification.candidates.map(candidate => {
      const listing = candidate.codeListing?.["2023_listing_status"] || "No direct listing found";
      const stress = candidate.stressCheck?.lookup_result || "No stress-record check available";
      const bolting = candidate.bolting;
      return `
        <article class="cross-reference-card">
          <div class="cross-reference-title"><div><h4>${U.escapeHtml(candidate.label)}</h4><p>Audit ID: ${U.escapeHtml(candidate.auditId || "Not mapped")}</p></div><span class="cross-reference-status review">ENGINEERING REVIEW</span></div>
          <dl class="cross-reference-details">
            <dt>Preliminary vessel plate</dt><dd>${U.escapeHtml(candidate.plateSpecification || "Confirm with engineering")}</dd>
            <dt>ASME VIII-1 2023 listing</dt><dd>${U.escapeHtml(listing)}</dd>
            <dt>Allowable-stress record</dt><dd>${U.escapeHtml(stress)}</dd>
            <dt>Reference records available</dt><dd>${candidate.stressRecords.length} record(s); no record has been selected automatically.</dd>
            <dt>Suggested bolting basis</dt><dd>${U.escapeHtml(bolting ? `${bolting.bolt_material_specification} / ${bolting.nut_material_specification}` : "Confirm bolt and nut set")}</dd>
          </dl>
          <details class="compatibility-details"><summary>Why engineering confirmation is still required</summary><ul>${candidate.messages.map(message => `<li>${U.escapeHtml(message)}</li>`).join("")}</ul></details>
        </article>`;
    }).join("");

    els.materialAuditVerification.hidden = false;
    els.materialAuditVerification.innerHTML = `
      <div class="card-heading"><span class="section-number">VERIFY</span><h3>Material Verification Centre</h3></div>
      <p class="field-note">This audit-guide check is a safety gate, not an approval. It retains the guide's fail-closed rule: allowable stress is never selected automatically.</p>
      <div class="alert review"><b>Mixed-edition reference basis</b><p>${U.escapeHtml(verification.source.governance.edition_compatibility || "Confirm the controlled ASME code edition before approval.")}</p></div>
      <div class="cross-reference-grid">${candidateCards || "<p class=\"field-note\">No displayed material candidate could be mapped for verification.</p>"}</div>
      <div class="alert review"><b>Chemical compatibility: ${U.escapeHtml(verification.chemicalCompatibility.status.replaceAll("_", " "))}</b><p>${U.escapeHtml(verification.chemicalCompatibility.message)}</p></div>
      <details class="compatibility-details"><summary>Mandatory approval actions</summary><ul>${verification.mandatoryActions.map(action => `<li>${U.escapeHtml(action)}</li>`).join("")}</ul></details>
    `;
  }

  function renderMaterialResult(result) {
    // Retain the preliminary sizing basis beside the material screen for audit export and senior review.
    if (state.vesselSizingResult?.recommendation) result.vessel_sizing_recommendation = state.vesselSizingResult;
    state.materialResult = result;
    showFormErrors(els.materialErrors, result.status === "blocked_input" ? (result.warnings || result.errors) : []);
    if (result.status === "blocked_input") {
      // API RP 12J may provide a complete vessel-sizing basis even when the
      // separate material-temperature screen is still incomplete.
      if (state.vesselSizingResult?.recommendation) {
        els.materialEmpty.hidden = true;
        els.materialResults.hidden = false;
        els.materialStatusCard.innerHTML = "";
        els.materialEndpointCards.innerHTML = "";
        els.materialOptionGroups.innerHTML = "";
        els.materialWarnings.innerHTML = "";
        [els.materialPipingFilter, els.materialCrossReference, els.materialAuditVerification, els.materialOverrideResult].forEach(panel => panel.hidden = true);
      }
      return;
    }

    els.materialEmpty.hidden = true;
    els.materialResults.hidden = false;

    const copy = materialStatusCopy(result);
    els.materialStatusCard.className = `status-card panel ${severityClass(result.severity)}`;
    els.materialStatusCard.innerHTML = statusCardHtml({ severity: result.severity, ...copy });
    els.materialEndpointCards.innerHTML = renderMaterialEnvelope(result);
    renderMaterialOptions(result, renderPipingCompatibility(result));
    renderMaterialCrossReference(result);
    renderMaterialAuditVerification(result);
    els.materialWarnings.innerHTML = renderIssueList([...(result.warnings || []), ...(result.errors || [])]);

    if (result.input.override?.enabled) {
      els.materialOverrideResult.hidden = false;
      const o = result.input.override;
      els.materialOverrideResult.innerHTML = `
        <div class="card-heading"><span class="section-number">OVR</span><h3>Engineering override record</h3></div>
        <dl class="formula-meta">
          <dt>Override material</dt><dd>${U.escapeHtml(o.material_family)}</dd>
          <dt>Reason</dt><dd>${U.escapeHtml(o.reason_code)}</dd>
          <dt>Justification</dt><dd>${U.escapeHtml(o.comment)}</dd>
          <dt>Responsible person</dt><dd>${U.escapeHtml(o.responsible_person)}</dd>
          <dt>Date</dt><dd>${U.escapeHtml(o.override_date)}</dd>
        </dl>
      `;
    } else {
      els.materialOverrideResult.hidden = true;
      els.materialOverrideResult.innerHTML = "";
    }

    els.designTag.value = result.input.equipment_tag;
    els.designMaterialBasis.value = ME.selectedFamilySummary(result);
    if (U.numberOrNull(els.designTemperature.value) === null) {
      const maximum = (result.endpoints || []).find(endpoint => endpoint.id === "maximum");
      if (Number.isFinite(maximum?.temperature_c)) els.designTemperature.value = U.formatNumber(maximum.temperature_c, 1);
    }
    state.autoStressRecordId = null;
    els.designStressLibraryRecord.value = "";
    const screenedGroup = screenedMaterialGroup();
    if (screenedGroup && [...els.designMaterialGroup.options].some(option => option.value === screenedGroup)) {
      els.designMaterialGroup.value = screenedGroup;
    }
    refreshStressRecordOptions();
    updateGlobalStatus();
    localStorage.setItem("vesselm-last-material", JSON.stringify(result));
    showToast("Material screening completed.");
    els.materialStatusCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetMaterial() {
    els.materialForm.reset();
    qsa('input[name="materialComponent"]').forEach(item => item.checked = true);
    els.materialOverrideFields.hidden = true;
    els.apiRp12jFields.hidden = true;
    els.materialOverrideDate.value = U.dateStamp();
    els.materialErrors.hidden = true;
    els.materialResults.hidden = true;
    els.materialEmpty.hidden = false;
    state.materialResult = null;
    state.materialVerification = null;
    state.vesselSizingResult = null;
    els.vesselSizingRecommendation.hidden = true;
    els.vesselSizingRecommendation.innerHTML = "";
    updateGlobalStatus();
  }

  function loadMaterialExample() {
    els.materialTag.value = "V-EX-003";
    els.materialProject.value = "VESSELM / DEMO";
    // The demonstration range stays within one carbon-steel source route so the
    // ASTM/ASME plate cross-reference can be displayed immediately.
    els.materialDescription.value = "Carbon-steel vessel demonstration";
    els.materialMinTemp.value = "20";
    els.materialMinUnit.value = "degC";
    els.materialMaxTemp.value = "400";
    els.materialMaxUnit.value = "degC";
    els.sizingService.value = "gas_liquid";
    els.sizingVolume.value = "20";
    els.sizingLiquidFlow.value = "";
    els.sizingHoldup.value = "5";
    els.sizingGasFlow.value = "1000";
    els.sizingQuality.value = "normal";
    els.sizingFouling.value = "low";
    els.sizingSolids.value = "none";
    els.sizingSlugging.checked = false;
    els.sizingPumpSuction.checked = true;
    els.apiRp12jEnabled.checked = false;
    els.apiRp12jFields.hidden = true;
    qsa('input[name="sizingPhase"]').forEach(item => item.checked = ["gas", "light_liquid"].includes(item.value));
    qsa('input[name="materialComponent"]').forEach(item => item.checked = true);
    qsa('input[name="materialService"]').forEach(item => item.checked = item.value === "high_temperature_hydrocarbon");
    const sizing = VSE.assess(vesselSizingInput());
    renderVesselSizingRecommendation(sizing);
    renderMaterialResult(ME.assess(materialInput()));
  }

  function setupDesignInputs() {
    els.designPressureUnit.value = "kgf_per_cm2";
    els.designComponentType.innerHTML = [
      '<option value="">Select head type or cone section</option>',
      ...Object.entries(DE.componentCatalog).filter(([id]) => id !== "cylindrical_shell").map(([id, item]) =>
      `<option value="${id}">${U.escapeHtml(item.label)}</option>`
      )
    ].join("");
    // A shell and a standard 2:1 ellipsoidal head are the normal vessel screening pair.
    els.designCheckNonShell.checked = true;
    els.designComponentType.value = "ellipsoidal_2_to_1_head";
    els.designMaterialGroup.innerHTML = [
      '<option value="">All material groups</option>',
      ...(ASE?.materialGroups?.() || []).map(group => `<option value="${U.escapeHtml(group)}">${U.escapeHtml(group)}</option>`)
    ].join("");
    els.designCostMaterialFamily.innerHTML = materialCostFamilies.map(item =>
      `<option value="${U.escapeHtml(item.name)}">${U.escapeHtml(item.name)} (CS factor ${U.formatNumber(item.csFactor, 2)})</option>`
    ).join("");
    els.designCladdingOption.innerHTML = CE.options.map(item => `<option value="${item.id}">${U.escapeHtml(item.label)}</option>`).join("");
    els.designCladdingMaterial.innerHTML = CE.materials.map(item => `<option value="${item.id}">${U.escapeHtml(item.label)}</option>`).join("");
    refreshStressRecordOptions();
    updateAllowableStressLookup();
    updateDesignGeometryVisibility();
  }

  function stressRecordIdsForScreenedMaterial() {
    return U.unique((state.materialVerification?.candidates || []).flatMap(candidate =>
      (candidate.stressRecords || []).map(record => record.record_id)
    ));
  }

  function screenedMaterialGroup() {
    return state.materialVerification?.candidates?.[0]?.basicMaterial || "";
  }

  function automaticStressRecord(availableRecords, screenedRecordIds) {
    if (!screenedRecordIds.length) return null;
    if (availableRecords.length === 1) return availableRecords[0];

    // SA-516 Grade 70 is the standard preliminary plate screen for the broad
    // carbon-steel route. It is only prefilled after that route was screened.
    return availableRecords.find(record =>
      record.specification?.full_designation === "SA-516" && String(record.grade) === "70"
    ) || null;
  }

  function refreshStressRecordOptions() {
    if (!ASE) return;
    const previousSelection = els.designStressLibraryRecord.value;
    const temperatureC = U.numberOrNull(els.designTemperature.value);
    const screenedRecordIds = stressRecordIdsForScreenedMaterial();
    const selectedGroup = els.designMaterialGroup.value;
    const groupRecords = selectedGroup ? ASE.recordsForMaterialGroup(selectedGroup) : ASE.records;
    const recordsInScope = selectedGroup ? groupRecords :
      (screenedRecordIds.length ? groupRecords.filter(record => screenedRecordIds.includes(record.record_id)) : groupRecords);
    const availableRecords = Number.isFinite(temperatureC) ? recordsInScope.filter(record =>
      ASE.lookup(record.record_id, temperatureC).status === "available"
    ) : recordsInScope;
    const scope = selectedGroup ? `in ${selectedGroup}` :
      (screenedRecordIds.length ? "matched to the screened material" : "in the reference library");
    els.designStressLibraryRecord.innerHTML = [
      `<option value="">Select a plate record (${availableRecords.length} ${scope})</option>`,
      ...availableRecords.map(record => `<option value="${U.escapeHtml(record.record_id)}">${U.escapeHtml(ASE.label(record))}</option>`)
    ].join("");
    if (availableRecords.some(record => record.record_id === previousSelection)) {
      els.designStressLibraryRecord.value = previousSelection;
    } else {
      const automaticRecord = (!selectedGroup || selectedGroup === screenedMaterialGroup()) ?
        automaticStressRecord(availableRecords, screenedRecordIds) : null;
      if (automaticRecord) {
        els.designStressLibraryRecord.value = automaticRecord.record_id;
        state.autoStressRecordId = automaticRecord.record_id;
      } else {
        state.autoStressRecordId = null;
      }
    }
  }

  function updateAllowableStressLookup() {
    refreshStressRecordOptions();
    const selection = els.designStressLibraryRecord.value;
    const temperatureC = U.numberOrNull(els.designTemperature.value);
    const lookup = ASE?.lookup(selection, temperatureC);
    els.designStress.value = "";
    els.designAmbientStress.value = "";
    els.designStressSource.value = "";
    els.designStressLibraryStatus.className = "library-stress-status blocking";

    if (!lookup || lookup.status === "no_record") {
      els.designStressLibraryStatus.textContent = "Select a plate record from the available library. Thickness calculation remains blocked until a published stress is found.";
      return;
    }
    if (lookup.status === "temperature_required") {
      els.designStressLibraryStatus.textContent = "Enter the design temperature in °C to look up a published allowable-stress value.";
      return;
    }
    if (lookup.status === "stress_not_published") {
      els.designStressLibraryStatus.textContent = "No published allowable-stress value is available for this plate record at the entered design temperature. Add verified data before calculating.";
      return;
    }

    els.designStress.value = lookup.designPoint.allowable_stress_mpa;
    els.designAmbientStress.value = lookup.ambientPoint.allowable_stress_mpa;
    els.designStressUnit.value = "MPa";
    els.designStressSource.value = lookup.sourceReference;
    els.designStressLibraryStatus.className = "library-stress-status available";
    const selectionNote = selection === state.autoStressRecordId ?
      "Auto-filled from the screened material route. " : "Selected plate record. ";
    els.designStressLibraryStatus.textContent = `${selectionNote}${lookup.designPoint.allowable_stress_mpa} MPa at the ${lookup.designPoint.temperature_c}°C upper-bound column; ${lookup.ambientPoint.allowable_stress_mpa} MPa at ${lookup.ambientPoint.temperature_c}°C for ambient screening. Confirm product form, class, condition and thickness before use.`;
  }

  function updateDesignGeometryVisibility() {
    const isNonShellCheck = els.designCheckNonShell.checked;
    els.designAlternateComponent.hidden = !isNonShellCheck;
    const component = isNonShellCheck ? els.designComponentType.value : "cylindrical_shell";
    const isHead = isNonShellCheck && ["ellipsoidal_2_to_1_head", "ellipsoidal_generic_head", "torispherical_100_6_head", "torispherical_generic_head", "hemispherical_head"].includes(component);
    els.designHeadFormingThinningField.hidden = !isHead;
    const fields = DE.componentCatalog[component]?.fields || [];
    qsa("[data-design-field]").forEach(field => {
      field.hidden = !fields.includes(field.dataset.designField);
    });
    els.diameterLabel.textContent = els.designDiameterBasis.value === "inside" ? "Inside diameter *" : "Outside diameter *";
    const isUnderground = els.designInstallationLocation.value === "underground";
    const isHorizontal = els.designVesselOrientation.value === "horizontal";
    els.designAbovegroundOptions.hidden = isUnderground || !isHorizontal;
    if (isUnderground || !isHorizontal) els.designRequiresBoot.checked = false;
    els.designUndergroundOptions.hidden = !isUnderground;
    els.designAgitatorFields.hidden = !els.designAgitatorRequired.checked;
    els.designExternalPressureFields.hidden = !els.designExternalPressureEnabled.checked;
    els.designCladdingFields.hidden = !els.designCladdingEnabled.checked;
    if (els.designAgitatorRequired.checked && isHorizontal && els.designMixerType.value === "to_be_confirmed") {
      els.designMixerType.value = "side_entry";
    }
  }

  function designInput() {
    const stressRecord = ASE?.records?.find(record => record.record_id === els.designStressLibraryRecord.value) || null;
    return {
      equipment_tag: els.designTag.value.trim(),
      controlled_code_edition: els.designCodeEdition.value.trim(),
      allowable_stress_source_reference: els.designStressSource.value.trim(),
      design_pressure: U.numberOrNull(els.designPressure.value),
      static_head_pressure: U.numberOrNull(els.designStaticHead.value) || 0,
      pressure_unit: els.designPressureUnit.value,
      design_temperature: U.numberOrNull(els.designTemperature.value),
      temperature_unit: els.designTemperatureUnit.value,
      material_basis: els.designMaterialBasis.value.trim(),
      material_record_id: stressRecord?.record_id || null,
      material_specification: stressRecord?.specification?.full_designation || null,
      material_grade: stressRecord?.grade || null,
      material_product_form: stressRecord?.product_form || null,
      component_type: "cylindrical_shell",
      secondary_component_type: els.designCheckNonShell.checked ? els.designComponentType.value : null,
      secondary_available_nominal_thickness: els.designCheckNonShell.checked ?
        U.numberOrNull(els.designSecondaryNominalThickness.value) : null,
      head_forming_thinning_percent: els.designCheckNonShell.checked ? U.numberOrNull(els.designHeadFormingThinning.value) || 0 : 0,
      diameter_basis: els.designDiameterBasis.value,
      diameter: U.numberOrNull(els.designDiameter.value),
      length_unit: els.designLengthUnit.value,
      head_depth: U.numberOrNull(els.designHeadDepth.value),
      crown_radius: U.numberOrNull(els.designCrownRadius.value),
      knuckle_radius: U.numberOrNull(els.designKnuckleRadius.value),
      cone_half_apex_angle: U.numberOrNull(els.designConeAngle.value),
      vessel_tangent_length: U.numberOrNull(els.designTangentLength.value),
      vessel_capacity_m3: U.numberOrNull(els.designVesselCapacity.value),
      installation_location: els.designInstallationLocation.value,
      vessel_orientation: els.designVesselOrientation.value,
      nozzle_count: U.numberOrNull(els.designNozzleCount.value) || 0,
      requires_ladder_platform: els.designRequiresLadderPlatform.checked,
      agitator_required: els.designAgitatorRequired.checked,
      mixer_type: els.designAgitatorRequired.checked ? els.designMixerType.value : null,
      mixing_duty: els.designAgitatorRequired.checked ? els.designMixingDuty.value : null,
      mixer_power_kw: els.designAgitatorRequired.checked ? U.numberOrNull(els.designMixerPowerKw.value) : null,
      requires_boot: els.designInstallationLocation.value === "aboveground" && els.designVesselOrientation.value === "horizontal" && els.designRequiresBoot.checked,
      requires_submersible_pump_nozzle: els.designInstallationLocation.value === "underground" && els.designRequiresSubmersiblePumpNozzle.checked,
      has_demister_pad: els.designHasDemisterPad.checked,
      has_baffle_plate: els.designHasBafflePlate.checked,
      has_vortex_breaker: els.designHasVortexBreaker.checked,
      allowable_stress_design: U.numberOrNull(els.designStress.value),
      allowable_stress_ambient: U.numberOrNull(els.designAmbientStress.value),
      stress_unit: els.designStressUnit.value,
      joint_efficiency: U.numberOrNull(els.designJointEfficiency.value),
      joint_efficiency_basis: els.designJointBasis.value.trim(),
      // Allowances and available thickness are always entered in mm, even when geometry uses another length unit.
      corrosion_allowance: U.convertLength(U.numberOrNull(els.designCA.value) || 0, "mm", els.designLengthUnit.value),
      forming_allowance: U.convertLength(U.numberOrNull(els.designFormingAllowance.value) || 0, "mm", els.designLengthUnit.value),
      other_allowance: U.convertLength(U.numberOrNull(els.designOtherAllowance.value) || 0, "mm", els.designLengthUnit.value),
      available_nominal_thickness: U.convertLength(U.numberOrNull(els.designNominalThickness.value), "mm", els.designLengthUnit.value),
      enable_map_mawp: els.enableMapMawp.checked || els.enableHydrotest.checked,
      enable_hydrotest: els.enableHydrotest.checked,
      external_pressure_check_enabled: els.designExternalPressureEnabled.checked,
      external_design_pressure_mpa: U.numberOrNull(els.designExternalPressure.value),
      external_unsupported_length_mm: U.numberOrNull(els.designExternalUnsupportedLength.value),
      formula_basis_confirmed: true
    };
  }

  function designStatusCopy(result) {
    if (result.severity === "blocking") return {
      symbol: "×", title: "Preliminary design blocked",
      body: "Resolve the controlled basis, input or formula-applicability conditions before using a result.",
      badge: RE.statusLabel(result.status)
    };
    if (result.severity === "fail") return {
      symbol: "×", title: "Available nominal thickness is inadequate",
      body: "The entered nominal thickness is below the calculated minimum required new thickness.",
      badge: RE.statusLabel(result.status)
    };
    return {
      symbol: "!", title: "Preliminary calculation completed",
      body: "The result uses historical formulas and verified manual inputs. Controlled engineering review remains mandatory.",
      badge: RE.statusLabel(result.status)
    };
  }

  function combineDesignResults(shellResult, secondaryResult) {
    const componentResults = [shellResult, secondaryResult];
    if (componentResults.some(item => item.status === "blocked")) {
      const blocked = componentResults.find(item => item.status === "blocked");
      return { ...blocked, component_results: componentResults };
    }
    const severityRank = { information: 0, review: 1, fail: 2, blocking: 3 };
    const governing = componentResults.reduce((current, candidate) =>
      candidate.minimum_required_new_thickness_mm > current.minimum_required_new_thickness_mm ? candidate : current
    );
    const worst = componentResults.reduce((current, candidate) =>
      (severityRank[candidate.severity] || 0) > (severityRank[current.severity] || 0) ? candidate : current
    );
    return {
      ...governing,
      status: worst.status,
      severity: worst.severity,
      warnings: uniqueIssues([...(shellResult.warnings || []), ...(secondaryResult.warnings || [])]),
      errors: uniqueIssues([...(shellResult.errors || []), ...(secondaryResult.errors || [])]),
      component_results: componentResults,
      governing_component: governing.input.component_type
    };
  }

  function calculateDesignAssessment() {
    const input = applyAutomaticNominalPlateSelection(designInput());
    const shellResult = DE.calculate({ ...input, component_type: "cylindrical_shell", include_agitator_warning: true });
    if (input.secondary_component_type === null) return attachNominalPlateSelectionReview(shellResult, input);
    const secondaryNominal = input.secondary_available_nominal_thickness ?? input.available_nominal_thickness;
    const secondaryResult = DE.calculate({
      ...input,
      component_type: input.secondary_component_type,
      include_agitator_warning: false,
      available_nominal_thickness: secondaryNominal
    });
    return attachNominalPlateSelectionReview(combineDesignResults(shellResult, secondaryResult), input);
  }

  function attachNominalPlateSelectionReview(result, input) {
    if (!input.nominal_plate_selection_errors?.length) return result;
    return {
      ...result,
      warnings: [...(result.warnings || []), {
        code: "W_NOMINAL_PLATE_SELECTION_VENDOR_REVIEW",
        severity: "review",
        title: "Automatic nominal plate selection needs review",
        message: input.nominal_plate_selection_errors.join(" ")
      }]
    };
  }

  function applyAutomaticNominalPlateSelection(input) {
    const selectionErrors = [];
    const selectForComponent = componentType => {
      const preliminary = DE.calculate({
        ...input,
        component_type: componentType,
        available_nominal_thickness: null,
        enable_map_mawp: false,
        enable_hydrotest: false
      });
      if (preliminary.status === "blocked") return null;
      const selection = NPE?.select(preliminary.minimum_required_new_thickness_mm);
      if (!selection || selection.status !== "selected") {
        selectionErrors.push(...(selection?.errors || ["The nominal plate-thickness library could not select a FEED plate."]));
        return null;
      }
      return selection;
    };
    const shellSelection = selectForComponent("cylindrical_shell");
    const secondarySelection = input.secondary_component_type ? selectForComponent(input.secondary_component_type) : null;
    if (shellSelection) els.designNominalThickness.value = U.formatNumber(shellSelection.selectedNominalThicknessMm, 0);
    if (input.secondary_component_type) els.designSecondaryNominalThickness.value = secondarySelection ? U.formatNumber(secondarySelection.selectedNominalThicknessMm, 0) : "";
    return {
      ...input,
      available_nominal_thickness: shellSelection ? U.convertLength(shellSelection.selectedNominalThicknessMm, "mm", input.length_unit) : input.available_nominal_thickness,
      secondary_available_nominal_thickness: secondarySelection ? U.convertLength(secondarySelection.selectedNominalThicknessMm, "mm", input.length_unit) : input.secondary_available_nominal_thickness,
      nominal_plate_selection: shellSelection,
      secondary_nominal_plate_selection: secondarySelection,
      nominal_plate_selection_errors: selectionErrors
    };
  }

  function renderComponentComparison(result) {
    const components = result.component_results || [];
    if (components.length < 2 || components.some(item => item.status === "blocked")) {
      els.designComponentComparison.hidden = true;
      return;
    }
    const secondary = components.find(item => item.input.component_type !== "cylindrical_shell");
    const secondaryLabel = DE.componentCatalog[secondary?.input.component_type]?.label || "selected section";
    els.designComponentComparison.hidden = false;
    els.designComponentComparison.innerHTML = `
      <div class="card-heading"><span class="section-number">BOTH</span><h3>Shell and ${U.escapeHtml(secondaryLabel)} thickness comparison</h3></div>
      <div class="table-scroll"><table class="check-table">
        <thead><tr><th>Vessel part</th><th>Material specification / grade</th><th>Required new thickness</th><th>Available nominal thickness</th><th>Margin</th><th>Status</th></tr></thead>
        <tbody>${components.map(item => {
          const available = item.available_thickness || {};
          const status = item.severity === "fail" ? "FAIL" : item.severity === "review" ? "REVIEW" : "PASS";
          const material = [item.input.material_specification, item.input.material_grade ? `Gr. ${item.input.material_grade}` : ""].filter(Boolean).join(" ") || "not selected";
          const selection = item.input.component_type === "cylindrical_shell" ? item.input.nominal_plate_selection : item.input.secondary_nominal_plate_selection;
          const selectionNote = selection ? `<br><small>${U.escapeHtml(selection.selectionSeriesId)}; ${U.escapeHtml(selection.costRateBandId || "rate band to confirm")}</small>` : "";
          return `<tr><td>${U.escapeHtml(DE.componentCatalog[item.input.component_type]?.label || item.input.component_type)}</td><td>${U.escapeHtml(material)}</td><td>${U.formatNumber(item.minimum_required_new_thickness_mm, 3)} mm</td><td>${Number.isFinite(available.nominal) ? `${U.formatNumber(available.nominal, 3)} mm${selectionNote}` : "not provided"}</td><td>${Number.isFinite(available.thickness_margin) ? `${U.formatNumber(available.thickness_margin, 3)} mm` : "not provided"}</td><td class="${status === "FAIL" ? "check-fail" : status === "PASS" ? "check-pass" : ""}">${status}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
      <p class="field-note">The detailed formula below is for the governing part: ${U.escapeHtml(DE.componentCatalog[result.governing_component]?.label || "the highest required thickness")}.</p>
    `;
  }

  function formatPressureKgfCm2(valueMPa) {
    return `${U.formatNumber(U.convertPressure(valueMPa, "MPa", "kgf_per_cm2"), 3)} kgf/cm²`;
  }

  function componentLabel(componentResult) {
    return DE.componentCatalog[componentResult?.input?.component_type]?.label || "Vessel part";
  }

  function formulaDisplay(formula) {
    const fractions = {
      SH_CIRC_T_ID: ["P &times; Ri", "S &times; E &minus; 0.6 &times; P"],
      SH_CIRC_T_OD: ["P &times; Ro", "S &times; E + 0.4 &times; P"],
      SH_LONG_T_ID: ["P &times; Ri", "2 &times; S &times; E + 0.4 &times; P"],
      SH_LONG_T_OD: ["P &times; Ro", "2 &times; S &times; E + 1.4 &times; P"],
      ELLIP_2_1_T_ID: ["P &times; Di", "2 &times; S &times; E &minus; 0.2 &times; P"],
      ELLIP_2_1_T_OD: ["P &times; Do", "2 &times; S &times; E + 1.8 &times; P"],
      HEMI_T_ID: ["P &times; Ri", "2 &times; S &times; E &minus; 0.2 &times; P"],
      HEMI_T_OD: ["P &times; Ro", "2 &times; S &times; E + 0.8 &times; P"],
      ELLIP_GENERIC_T_ID: ["P &times; Di &times; K", "2 &times; S &times; E &minus; 0.2 &times; P"],
      ELLIP_GENERIC_T_OD: ["P &times; Do &times; K", "2 &times; S &times; E + 2 &times; P &times; (K &minus; 0.1)"],
      CONE_CIRC_T_ID: ["P &times; Di", "2 &times; cos &alpha; &times; (S &times; E &minus; 0.6 &times; P)"],
      CONE_CIRC_T_OD: ["P &times; Do", "2 &times; cos &alpha; &times; (S &times; E + 0.4 &times; P)"],
      CONE_LONG_T_ID: ["P &times; Di", "4 &times; cos &alpha; &times; (S &times; E + 0.4 &times; P)"],
      CONE_LONG_T_OD: ["P &times; Do", "4 &times; cos &alpha; &times; (S &times; E + 1.4 &times; P)"]
    };
    const fraction = fractions[formula.formula_id];
    if (!fraction) return `<code>${U.escapeHtml(formula.equation)}</code>`;
    return `<span class="equation-symbol">t =</span><span class="equation-fraction"><span>${fraction[0]}</span><span>${fraction[1]}</span></span>`;
  }

  function formulaInputDefinitions(inputs) {
    const definitions = {
      P: ["Design pressure including static head", "MPa"],
      S: ["Allowable stress at design temperature", "MPa"],
      E: ["Weld joint efficiency", "-"],
      Ri: ["Inside radius", "mm"],
      Ro: ["Outside radius", "mm"],
      Di: ["Inside diameter", "mm"],
      Do: ["Outside diameter", "mm"],
      Li: ["Inside crown radius", "mm"],
      Lo: ["Outside crown radius", "mm"],
      K: ["Ellipsoidal head factor", "-"],
      M: ["Torispherical head factor", "-"],
      alpha: ["Cone half-apex angle", "degrees"]
    };
    return Object.entries(inputs || {}).map(([key, value]) => {
      const [meaning, unit] = definitions[key] || [key, "-"];
      return `<div class="equation-definition"><b>${U.escapeHtml(key)}</b><span>${U.escapeHtml(meaning)}</span><strong>${U.formatNumber(value, 4)} ${unit}</strong></div>`;
    }).join("");
  }

  function renderComponentFormula(componentResult) {
    const formula = componentResult.governing_formula;
    const label = componentLabel(componentResult);
    return `
      <div class="card-heading"><span class="section-number">FORM</span><h3>${U.escapeHtml(label)} formula</h3></div>
      <p class="formula-reference">${U.escapeHtml(formula.label)} &middot; ${U.escapeHtml(formula.formula_id)}</p>
      <div class="formula-box engineering-equation">${formulaDisplay(formula)}</div>
      <p class="field-note">t is the pressure design thickness before corrosion and other allowances.</p>
      <div class="equation-definitions">${formulaInputDefinitions(formula.inputs)}</div>
      <dl class="formula-meta">
        <dt>Geometry basis</dt><dd>${U.escapeHtml(formula.basis)}</dd>
        <dt>Calculated pressure thickness (t)</dt><dd>${U.formatNumber(formula.value, 6)} mm</dd>
        ${Object.entries(componentResult.geometry_factors || {}).map(([key, value]) =>
          `<dt>${U.escapeHtml(key)}</dt><dd>${U.formatNumber(value, 6)}</dd>`
        ).join("")}
      </dl>
    `;
  }

  function renderComponentThicknessBuildUp(componentResult) {
    const additions = componentResult.additions_mm;
    return `
      <div class="card-heading"><span class="section-number">FLOW</span><h3>${U.escapeHtml(componentLabel(componentResult))} thickness build-up</h3></div>
      <div class="thickness-flow">
        <div class="flow-row"><span>Pressure design thickness</span><strong>${U.formatNumber(componentResult.pressure_thickness_mm, 3)} mm</strong></div>
        <div class="flow-row"><span>Corrosion allowance</span><strong>+ ${U.formatNumber(additions.corrosion_allowance, 3)} mm</strong></div>
        ${additions.head_forming_thinning_percent > 0 ? `<div class="flow-row"><span>Head forming thinning (${U.formatNumber(additions.head_forming_thinning_percent, 2)}%; divide by ${U.formatNumber(additions.retained_formed_thickness_fraction, 3)})</span><strong>+ ${U.formatNumber(additions.head_forming_thinning_allowance, 3)} mm</strong></div>` : ""}
        <div class="flow-row"><span>Forming allowance</span><strong>+ ${U.formatNumber(additions.forming_allowance, 3)} mm</strong></div>
        <div class="flow-row"><span>Other allowance</span><strong>+ ${U.formatNumber(additions.other_allowance, 3)} mm</strong></div>
        <div class="flow-row total"><span>Minimum required new thickness</span><strong>${U.formatNumber(componentResult.minimum_required_new_thickness_mm, 3)} mm</strong></div>
      </div>
    `;
  }

  function renderVesselConfiguration(result) {
    const input = result.input || {};
    const features = [
      input.requires_boot ? "Liquid boot" : null,
      input.requires_submersible_pump_nozzle ? "Submersible-pump nozzle" : null,
      input.has_demister_pad ? "Demister pad" : null,
      input.has_baffle_plate ? "Weir plate" : null,
      input.has_vortex_breaker ? "Vortex breaker" : null
      , input.requires_ladder_platform ? "Ladder and platform (5% estimating allowance)" : null
    ].filter(Boolean);
    els.designConfigurationCard.hidden = false;
    els.designConfigurationCard.innerHTML = `
      <div class="card-heading"><span class="section-number">CFG</span><h3>Vessel configuration captured</h3></div>
      <dl class="formula-meta">
        <dt>Installation</dt><dd>${U.escapeHtml(input.installation_location === "underground" ? "Underground" : "Aboveground")}</dd>
        <dt>Tangent-line length</dt><dd>${Number.isFinite(input.vessel_tangent_length) ? `${U.formatNumber(input.vessel_tangent_length, 3)} ${U.escapeHtml(input.length_unit || "mm")}` : "Not entered"}</dd>
        <dt>Vessel capacity</dt><dd>${Number.isFinite(input.vessel_capacity_m3) ? `${U.formatNumber(input.vessel_capacity_m3, 3)} m³` : "Not entered"}</dd>
        <dt>Nozzles</dt><dd>${Number.isFinite(input.nozzle_count) ? input.nozzle_count : 0}</dd>
        <dt>Process features</dt><dd>${U.escapeHtml(features.join("; ") || "None recorded")}</dd>
      </dl>
    `;
  }

  function estimateFeedBootWeight(vesselIdMm, shellThicknessM, steelDensityKgM3) {
    if (!(Number.isFinite(vesselIdMm) && vesselIdMm > 0 && Number.isFinite(shellThicknessM) && shellThicknessM > 0)) return null;
    const band = feedBootDimensionRule.diameterBands.find(item =>
      (item.vesselIdMaxExclusiveMm == null || vesselIdMm < item.vesselIdMaxExclusiveMm) &&
      (item.vesselIdMinInclusiveMm == null || vesselIdMm >= item.vesselIdMinInclusiveMm) &&
      (item.vesselIdMinExclusiveMm == null || vesselIdMm > item.vesselIdMinExclusiveMm) &&
      (item.vesselIdMaxInclusiveMm == null || vesselIdMm <= item.vesselIdMaxInclusiveMm)
    );
    if (!band) return null;
    const bootIdMm = band.bootIdMm;
    const unroundedLengthMm = Math.max(feedBootDimensionRule.minimumStraightLengthMm, feedBootDimensionRule.lengthToDiameterRatio * bootIdMm);
    const bootStraightLengthMm = Math.ceil(unroundedLengthMm / feedBootDimensionRule.roundingIncrementMm) * feedBootDimensionRule.roundingIncrementMm;
    const bootDiameterM = bootIdMm / 1000;
    const bootStraightLengthM = bootStraightLengthMm / 1000;
    const shellWeightKg = Math.PI * bootDiameterM * bootStraightLengthM * shellThicknessM * steelDensityKgM3;
    // The rule excludes the bottom head from straight length. For FEED weight only, use one 2:1 ellipsoidal bottom head at shell thickness.
    const radiusM = bootDiameterM / 2;
    const depthRatio = 0.5; // 2:1 ellipsoidal head: depth = D/4 and depth/radius = 0.5.
    const bottomHeadAreaM2 = Math.PI * radiusM ** 2 * (1 + ((depthRatio ** 2 / Math.sqrt(1 - depthRatio ** 2)) * Math.atanh(Math.sqrt(1 - depthRatio ** 2))));
    const bottomHeadWeightKg = bottomHeadAreaM2 * shellThicknessM * steelDensityKgM3;
    const basicWeightKg = shellWeightKg + bottomHeadWeightKg;
    const attachmentAllowanceKg = basicWeightKg * (feedBootDimensionRule.attachmentWeightAllowancePercent / 100);
    return {
      bootIdMm,
      bootStraightLengthMm,
      shellWeightKg,
      bottomHeadWeightKg,
      attachmentAllowanceKg,
      totalWeightKg: basicWeightKg + attachmentAllowanceKg
    };
  }

  function estimateFeedAgitationWeight(input) {
    if (!input.agitator_required) return null;
    const powerKw = input.mixer_power_kw;
    const volumeM3 = input.vessel_capacity_m3;
    let baseWeightKg = null;
    let source = null;
    let manualReviewRequired = false;
    if (Number.isFinite(powerKw) && powerKw > 0) {
      const band = feedAgitationWeightRule.powerBands.find(item =>
        (item.minExclusiveKw == null || powerKw > item.minExclusiveKw) && (item.maxKw == null || powerKw <= item.maxKw)
      );
      const selected = band || feedAgitationWeightRule.powerBands[feedAgitationWeightRule.powerBands.length - 1];
      baseWeightKg = selected.installedWeightKg;
      source = `${U.formatNumber(powerKw, 1)} kW motor-power basis`;
      manualReviewRequired = !band;
    } else if (Number.isFinite(volumeM3) && volumeM3 > 0) {
      const band = feedAgitationWeightRule.volumeBands.find(item =>
        (item.minExclusiveM3 == null || volumeM3 > item.minExclusiveM3) && (item.maxM3 == null || volumeM3 <= item.maxM3)
      );
      if (!band) return null;
      baseWeightKg = band.installedWeightKg;
      source = `${U.formatNumber(volumeM3, 2)} m³ liquid-volume fallback`;
      manualReviewRequired = Boolean(band.manualReviewRequired);
    } else {
      return null;
    }
    const dutyFactor = feedAgitationWeightRule.dutyFactors[input.mixing_duty] || feedAgitationWeightRule.dutyFactors.normal_blending;
    const dutyAdjustedWeightKg = baseWeightKg * dutyFactor;
    const topEntry = input.mixer_type === "top_entry";
    const arrangementAdjustedWeightKg = topEntry ?
      Math.max(dutyAdjustedWeightKg * feedAgitationWeightRule.topEntryMultiplier, dutyAdjustedWeightKg + feedAgitationWeightRule.minimumTopEntryAdditionKg) : dutyAdjustedWeightKg;
    const totalWeightKg = Math.ceil(Math.max(feedAgitationWeightRule.minimumInstalledWeightKg, arrangementAdjustedWeightKg) / feedAgitationWeightRule.roundUpIncrementKg) * feedAgitationWeightRule.roundUpIncrementKg;
    return { baseWeightKg, dutyFactor, topEntry, source, manualReviewRequired, totalWeightKg };
  }

  function renderPreliminaryWeightEstimate(result) {
    const components = result.component_results || [result];
    const shell = components.find(item => item.input.component_type === "cylindrical_shell") || result;
    const input = shell.input || {};
    const diameterM = shell.normalized_input?.D / 1000;
    const tangentLengthM = U.convertLength(input.vessel_tangent_length, input.length_unit || "mm", "mm") / 1000;
    const shellThicknessM = shell.available_thickness?.nominal / 1000;
    if (!(Number.isFinite(diameterM) && diameterM > 0 && Number.isFinite(tangentLengthM) && tangentLengthM > 0 && Number.isFinite(shellThicknessM) && shellThicknessM > 0)) {
      els.designWeightEstimateCard.hidden = true;
      els.designSupportEstimateCard.hidden = true;
      return null;
    }
    const steelDensityKgM3 = 7850;
    const shellWeightKg = Math.PI * diameterM * tangentLengthM * shellThicknessM * steelDensityKgM3;
    const head = components.find(item => item.input.component_type !== "cylindrical_shell");
    let headWeightKg = 0;
    if (head?.available_thickness?.nominal) {
      const radiusM = diameterM / 2;
      const depthM = head.input.component_type === "ellipsoidal_generic_head" ? (U.convertLength(head.input.head_depth, head.input.length_unit || "mm", "mm") / 1000) : radiusM / 2;
      const depthRatio = Math.min(0.99, Math.max(0.05, depthM / radiusM));
      const headAreaM2 = head.input.component_type === "hemispherical_head" ? 2 * Math.PI * radiusM ** 2 :
        Math.PI * radiusM ** 2 * (1 + ((depthRatio ** 2 / Math.sqrt(1 - depthRatio ** 2)) * Math.atanh(Math.sqrt(1 - depthRatio ** 2))));
      headWeightKg = headAreaM2 * (head.available_thickness.nominal / 1000) * steelDensityKgM3;
    }
    const vesselIdMm = shell.geometry?.Di || (diameterM * 1000);
    const bootEstimate = input.requires_boot && input.installation_location === "aboveground" && input.vessel_orientation === "horizontal" ?
      estimateFeedBootWeight(vesselIdMm, shellThicknessM, steelDensityKgM3) : null;
    const agitationEstimate = estimateFeedAgitationWeight(input);
    const pumpNozzleEstimate = PNE.assess({
      required: input.requires_submersible_pump_nozzle,
      installationLocation: input.installation_location
    });
    const supportEstimate = SE.estimate({
      orientation: input.vessel_orientation,
      diameterMm: diameterM * 1000,
      tangentLengthMm: tangentLengthM * 1000,
      shellThicknessMm: shellThicknessM * 1000
    });
    // Keep the base vessel separate from optional equipment allowances so the total is auditable.
    const bareVesselWeightKg = shellWeightKg + headWeightKg;
    const bootWeightKg = bootEstimate?.totalWeightKg || 0;
    const agitationWeightKg = agitationEstimate?.totalWeightKg || 0;
    const pumpNozzleWeightKg = pumpNozzleEstimate.status === "preliminary_review_required" ? pumpNozzleEstimate.totalWeightKg : 0;
    const weightBeforeLadderPlatformKg = bareVesselWeightKg + bootWeightKg + agitationWeightKg + pumpNozzleWeightKg;
    const ladderPlatformWeightKg = input.requires_ladder_platform ? weightBeforeLadderPlatformKg * 0.05 : 0;
    const supportWeightKg = supportEstimate.status === "preliminary_review_required" ? supportEstimate.installedWeightKg : 0;
    const totalWeightKg = weightBeforeLadderPlatformKg + ladderPlatformWeightKg + supportWeightKg;
    els.designWeightEstimateCard.hidden = false;
    els.designWeightEstimateCard.innerHTML = `
      <div class="card-heading"><span class="section-number">WT</span><h3>Preliminary metal weight estimate</h3></div>
      <div class="capacity-grid">
        <div class="capacity-card"><span>Bare vessel metal weight</span><strong>${U.formatNumber(bareVesselWeightKg / 1000, 2)} MT</strong><small>Shell${head ? " and selected head" : ""}; excludes optional equipment allowances</small></div>
        <div class="capacity-card"><span>Liquid boot allowance</span><strong>${bootEstimate ? `${U.formatNumber(bootEstimate.totalWeightKg / 1000, 2)} MT` : "Not included"}</strong><small>${bootEstimate ? `${U.formatNumber(bootEstimate.bootIdMm, 0)} mm ID × ${U.formatNumber(bootEstimate.bootStraightLengthMm, 0)} mm straight length; includes bottom head and 15% attachments` : "Select aboveground, horizontal and liquid boot required"}</small></div>
        <div class="capacity-card"><span>Installed mixer allowance</span><strong>${agitationEstimate ? `${U.formatNumber(agitationEstimate.totalWeightKg / 1000, 2)} MT` : "Not included"}</strong><small>${agitationEstimate ? `${agitationEstimate.source}; duty factor ${U.formatNumber(agitationEstimate.dutyFactor, 2)}${agitationEstimate.topEntry ? "; top-entry allowance applied" : ""}${agitationEstimate.manualReviewRequired ? "; manual review required" : ""}` : "Select agitation/mixing and enter motor power or vessel capacity"}</small></div>
        <div class="capacity-card"><span>Submersible-pump nozzle allowance</span><strong>${pumpNozzleEstimate.status === "preliminary_review_required" ? `${U.formatNumber(pumpNozzleWeightKg / 1000, 2)} MT` : "Not included"}</strong><small>${pumpNozzleEstimate.status === "preliminary_review_required" ? `24 in NB × 14 mm; ${U.formatNumber(pumpNozzleEstimate.projectionAboveShellMm / 1000, 1)} m above vessel shell; 150 lb top flange allowance` : "Select underground vessel and submersible pump nozzle required"}</small></div>
        <div class="capacity-card"><span>Ladder and platform allowance</span><strong>${input.requires_ladder_platform ? `${U.formatNumber(ladderPlatformWeightKg / 1000, 2)} MT` : "Not included"}</strong><small>${input.requires_ladder_platform ? "5% of vessel and selected equipment allowances" : "Select the L&P requirement to include 5%"}</small></div>
        <div class="capacity-card"><span>${supportEstimate.status === "preliminary_review_required" ? supportEstimate.supportType : "Support allowance"}</span><strong>${supportEstimate.status === "preliminary_review_required" ? `${U.formatNumber(supportWeightKg / 1000, 2)} MT` : "Needs geometry"}</strong><small>${supportEstimate.status === "preliminary_review_required" ? "Automatically included in total metal weight" : U.escapeHtml(supportEstimate.errors.join(" "))}</small></div>
        <div class="capacity-card"><span>Total estimated metal weight</span><strong>${U.formatNumber(totalWeightKg / 1000, 2)} MT</strong><small>Bare vessel + selected allowances and support</small></div>
      </div>
      <p class="field-note">When selected, the liquid-boot allowance is for an aboveground horizontal vessel only. The installed-mixer allowance uses motor power first, then vessel capacity as a fallback; it includes the mixer package and mounting allowance only. For an underground vessel, the selected submersible-pump nozzle adds a 24 in NB × 14 mm × 2.0 m minimum riser with a 150 lb flange/attachment allowance. The automatic support allowance is FEED-only. Process, vendor and mechanical verification are required. Maintenance platform, electrical cabling, external piping/pump, operating liquid, dynamic torque, bending moment and nozzle-load verification are excluded. This is for estimating only, not a fabrication weight.</p>`;
    renderSupportEstimate(supportEstimate);
    return { bareVesselWeightKg, totalWeightKg, shellWeightKg, headWeightKg, bootWeightKg, bootEstimate, agitationWeightKg, agitationEstimate, pumpNozzleWeightKg, pumpNozzleEstimate, ladderPlatformWeightKg, supportWeightKg, supportEstimate, diameterM, tangentLengthM, shellThicknessM, steelDensityKgM3 };
  }

  function renderSupportEstimate(result) {
    if (!result || result.status === "blocked") {
      els.designSupportEstimateCard.hidden = true;
      return;
    }
    const longSpanMessage = result.longSpanReview ? `<div class="alert warning"><b>Check saddle spacing with your lead engineer</b><p>The calculated saddle spacing is above 4,000 mm. This remains a FEED estimate, but confirm final saddle locations, transport/lifting condition and local shell stresses during detailed design.</p></div>` : "";
    els.designSupportEstimateCard.hidden = false;
    els.designSupportEstimateCard.innerHTML = `
      <div class="card-heading"><span class="section-number">SUP</span><h3>Automatic vessel support recommendation</h3></div>
      <div class="capacity-grid">
        <div class="capacity-card"><span>Recommended support</span><strong>${U.escapeHtml(result.supportType)}</strong><small>${U.escapeHtml(result.message)}</small></div>
        <div class="capacity-card"><span>Estimated installed support weight</span><strong>${U.formatNumber(result.installedWeightKg / 1000, 2)} MT</strong><small>Included in total estimated metal weight and FEED cost</small></div>
      </div>
      <details class="compatibility-details"><summary>Show preliminary support basis</summary><div class="details-content"><ul>${result.details.map(detail => `<li>${U.escapeHtml(detail)}</li>`).join("")}</ul><p>Automatic support selection uses vessel orientation. It is a weight-and-cost allowance only; it is not a final support, foundation, anchor, local-shell-stress, wind, seismic, lifting or transport design.</p></div></details>
      ${longSpanMessage}`;
  }

  function toggleCostAuditTrail() {
    const willShow = els.designCostAuditContent.hidden;
    els.designCostAuditContent.hidden = !willShow;
    els.designCostAuditToggle.textContent = willShow ? "Hide Calculation Methodology & Audit Trail" : "Show Calculation Methodology & Audit Trail";
    els.designCostAuditToggle.setAttribute("aria-expanded", String(willShow));
  }

  function renderCladdingEstimate(weightEstimate) {
    if (!els.designCladdingEnabled.checked) {
      els.designCladdingEstimateCard.hidden = true;
      return null;
    }
    const components = state.designResult?.component_results || [state.designResult].filter(Boolean);
    const shell = components.find(item => item?.input?.component_type === "cylindrical_shell");
    const head = components.find(item => item?.input?.component_type !== "cylindrical_shell");
    const materialRateMapping = { SS_304L: "18Cr, 8Ni", SS_316L: "16/18Cr, Ni, Mo", SS_317L: "SS317", SS_904L: "904L", DUPLEX_2205: "22Cr, 5Â½Ni, 3Mo", SUPER_DUPLEX_2507: "Super Duplex", ALLOY_20: "Alloy 20", ALLOY_625: "Inconel 625", ALLOY_825: "Inconel / Incoloy 825", ALLOY_C276: "Hastelloy C / B family", MONEL_400: "Monel 400", TITANIUM_GR2: "Titanium" };
    const claddingFamily = materialCostFamilies.find(item => item.name === materialRateMapping[els.designCladdingMaterial.value]);
    const rawMaterialRatePerKg = rawSteelByYear[els.designCostSteelYear.value] * (claddingFamily?.csFactor || 0);
    const result = CE.assess({
      enabled: true,
      optionId: els.designCladdingOption.value,
      materialId: els.designCladdingMaterial.value,
      finishedThicknessMm: U.numberOrNull(els.designCladdingThickness.value),
      coveragePercent: U.numberOrNull(els.designCladdingCoverage.value),
      cladHeadCount: Number(els.designCladdingHeadCount.value),
      headAreaEachM2: U.numberOrNull(els.designCladdingHeadArea.value),
      additionalAreaM2: U.numberOrNull(els.designCladdingAdditionalArea.value) || 0,
      rawMaterialRatePerKg,
      supplyP50Factor: finishedPriceFactors.p50,
      supplyP90Factor: finishedPriceFactors.p90,
      insideDiameterM: shell?.geometry?.Di / 1000,
      shellLengthM: weightEstimate?.tangentLengthM,
      headType: head?.input?.component_type || "none",
      baseVesselWeightKg: weightEstimate?.bareVesselWeightKg
    });
    els.designCladdingEstimateCard.hidden = false;
    if (result.status === "blocked") {
      els.designCladdingEstimateCard.innerHTML = `<div class="card-heading"><span class="section-number">CLAD</span><h3>Cladding / overlay FEED estimate</h3></div><div class="alert blocking"><b>Cladding estimate needs more information</b><ul>${result.errors.map(error => `<li>${U.escapeHtml(error)}</li>`).join("")}</ul></div>`;
      return null;
    }
    els.designCladdingEstimateCard.innerHTML = `<div class="card-heading"><span class="section-number">CLAD</span><h3>Cladding / overlay FEED estimate</h3></div><div class="capacity-grid"><div class="capacity-card"><span>Gross clad area</span><strong>${U.formatNumber(result.grossAreaM2, 2)} m²</strong><small>Shell ${U.formatNumber(result.shellAreaM2, 2)} m²; heads ${U.formatNumber(result.headAreaM2, 2)} m²</small></div><div class="capacity-card"><span>Added finished cladding weight</span><strong>${U.formatNumber(result.finishedMassKg / 1000, 2)} MT</strong><small>${U.escapeHtml(result.material.label)}; ${U.formatNumber(result.addedWeightPercent, 1)}% of bare vessel weight</small></div><div class="capacity-card"><span>Raw material rate</span><strong>₹ ${U.formatNumber(result.rawMaterialRatePerKg, 2)}/kg</strong><small>${U.escapeHtml(claddingFamily?.name || "controlled rate family")}; ${els.designCostSteelYear.value} rate library</small></div><div class="capacity-card"><span>Cladding supply price — P50 / P90</span><strong>₹ ${U.formatNumber(result.supplyP50 / 100000, 2)} / ${U.formatNumber(result.supplyP90 / 100000, 2)} lakh</strong><small>Raw material value × ${U.formatNumber(finishedPriceFactors.p50, 2)} / ${U.formatNumber(finishedPriceFactors.p90, 2)}</small></div></div><div class="alert review"><b>FEED control:</b> The carbon-steel base vessel retains the pressure-strength credit. Cost uses the same raw-material rate library and P50/P90 conversion factors as vessel supply; confirm against a current clad-plate or overlay vendor quote before approval.</div>`;
    return result;
  }

  function renderFeedCostEstimate(weightEstimate, claddingEstimate = null) {
    const enteredVesselWeightMt = U.numberOrNull(els.designCostOperatingWeight.value);
    if (!weightEstimate && !(Number.isFinite(enteredVesselWeightMt) && enteredVesselWeightMt > 0)) {
      // Keep the quick-estimate inputs visible: a user may have a known vessel weight even when the automatic weight cannot be derived.
      els.designCostEstimateCard.hidden = true;
      els.designCostEstimateSection.hidden = false;
      return;
    }
    const family = materialCostFamilies.find(item => item.name === els.designCostMaterialFamily.value) || materialCostFamilies[0];
    const steelRate = rawSteelByYear[els.designCostSteelYear.value];
    const materialRate = steelRate * family.csFactor;
    const enteredWeight = Number.isFinite(enteredVesselWeightMt) && enteredVesselWeightMt > 0;
    const claddingWeightKg = claddingEstimate?.finishedMassKg || 0;
    const costWeightKg = enteredWeight ? enteredVesselWeightMt * 1000 : weightEstimate.totalWeightKg;
    const rawMaterialCost = costWeightKg * materialRate;
    const supplyP50 = rawMaterialCost * finishedPriceFactors.p50;
    const supplyP90 = rawMaterialCost * finishedPriceFactors.p90;
    const erectionWeightMt = (costWeightKg + (enteredWeight ? 0 : claddingWeightKg)) / 1000;
    const multiPiece = els.designCostErectionType.value === "multi";
    const erectionP50Rate = multiPiece ? 65300 : (singlePieceErectionBands.find(([limit]) => erectionWeightMt <= limit)?.[1] || 68000);
    // Management provision: erection P90 is consistently 50% above the applicable P50 rate.
    const erectionP90Rate = erectionP50Rate * erectionP90Multiplier;
    const erectionP50 = erectionWeightMt * erectionP50Rate;
    const erectionP90 = erectionWeightMt * erectionP90Rate;
    // The main price result is the primary action. Render it before the optional audit trail.
    const totalP50 = supplyP50 + erectionP50 + (claddingEstimate?.supplyP50 || 0);
    const totalP90 = supplyP90 + erectionP90 + (claddingEstimate?.supplyP90 || 0);
    const claddingNote = claddingEstimate ? ` Includes cladding supply: ₹ ${U.formatNumber(claddingEstimate.supplyP50 / 100000, 2)} lakh P50 / ₹ ${U.formatNumber(claddingEstimate.supplyP90 / 100000, 2)} lakh P90.` : "";
    els.designCostEstimateCard.innerHTML = `
      <div class="card-heading"><span class="section-number">₹</span><h3>FEED vessel cost estimate — supply to site installation</h3></div>
      <div class="capacity-grid">
        <div class="capacity-card"><span>Vessel weight used</span><strong>${U.formatNumber(erectionWeightMt, 2)} MT</strong><small>${enteredWeight ? "User-entered quick-estimate weight; assumed to include any cladding" : `Automatic vessel weight${claddingEstimate ? " plus finished cladding weight" : ""}`}</small></div>
        <div class="capacity-card"><span>Raw material rate</span><strong>₹ ${U.formatNumber(materialRate, 2)}/kg</strong><small>${U.escapeHtml(family.name)}; ${els.designCostSteelYear.value} CS rate × ${U.formatNumber(family.csFactor, 2)}</small></div>
        <div class="capacity-card"><span>Base vessel supply price — P50</span><strong>₹ ${U.formatNumber(supplyP50 / 100000, 2)} lakh</strong><small>Excludes cladding; raw material value × ${U.formatNumber(finishedPriceFactors.p50, 2)} finished-price factor</small></div>
        <div class="capacity-card"><span>Base vessel supply price — P90</span><strong>₹ ${U.formatNumber(supplyP90 / 100000, 2)} lakh</strong><small>Excludes cladding; raw material value × ${U.formatNumber(finishedPriceFactors.p90, 2)} finished-price factor</small></div>
        <div class="capacity-card"><span>Site erection — P50 / P90</span><strong>₹ ${U.formatNumber(erectionP50 / 100000, 2)} / ${U.formatNumber(erectionP90 / 100000, 2)} lakh</strong><small>P50: ${U.formatNumber(erectionWeightMt, 2)} MT × ₹ ${U.formatNumber(erectionP50Rate, 0)}/MT; P90 = P50 × ${U.formatNumber(erectionP90Multiplier, 2)} (+50%)</small></div>
        <div class="capacity-card"><span>Total price — supply + erection</span><strong>₹ ${U.formatNumber(totalP50 / 100000, 2)} / ${U.formatNumber(totalP90 / 100000, 2)} lakh</strong><small>P50 / P90 ready-to-operate FEED budget${claddingEstimate ? "; includes cladding" : ""}</small></div>
      </div>
      <div class="alert review"><b>Ready-to-operate FEED budget: ₹ ${U.formatNumber(totalP50 / 100000, 2)} lakh (P50) to ₹ ${U.formatNumber(totalP90 / 100000, 2)} lakh (P90).</b><p>${enteredWeight ? "Uses the entered vessel weight for material supply and erection." : "Uses the app's automatic preliminary metal weight for material supply and erection; replace it with a known vessel weight when available."}${claddingNote} Supply P50 uses raw material value × ${U.formatNumber(finishedPriceFactors.p50, 2)}; Supply P90 uses raw material value × ${U.formatNumber(finishedPriceFactors.p90, 2)}. Excludes civil foundation, utilities, E&I hook-up, commissioning, taxes and escalation.</p></div>`;
    els.designCostEstimateCard.hidden = false;
    els.designCostEstimateSection.hidden = false;
  }

  function refreshQuickCostEstimate() {
    const automaticWeightEstimate = state.designResult && state.designResult.status !== "blocked" ?
      renderPreliminaryWeightEstimate(state.designResult) : null;
    const claddingEstimate = renderCladdingEstimate(automaticWeightEstimate);
    renderFeedCostEstimate(automaticWeightEstimate, claddingEstimate);
  }

  function renderExternalPressureResult(result) {
    if (!result || result.status === "not_requested") {
      els.designExternalPressureCard.hidden = true;
      return;
    }
    els.designExternalPressureCard.hidden = false;
    if (result.status === "blocked_input" || result.status === "blocked") {
      const outsideFigureG = (result.errors || []).some(error => error.includes("outside the supplied ASME 2021 Figure G chart limits"));
      const nextAction = outsideFigureG ? `<div class="alert warning"><b>What to do next</b><p>This is not a calculation failure. The vessel geometry is outside the supplied Figure G chart range, so the app will not guess a result.</p><p><b>Check first:</b> Confirm the unsupported length is the clear length between valid code-defined lines of support, and confirm the selected diameter basis, nominal thickness and corrosion allowance.</p><p><b>Typical engineering solutions to discuss with your lead engineer:</b></p><ol><li>Increase shell thickness and repeat the preliminary screen.</li><li>Reduce the unsupported length using a properly designed stiffening-ring arrangement.</li><li>Obtain a controlled ASME chart/calculation review from the vessel mechanical engineer.</li><li>Reconsider the vessel diameter or geometry while the vessel is still at preliminary-design stage.</li></ol><p><b>Important:</b> Do not enter a smaller unsupported length unless it represents real, code-valid supports.</p></div>` : "";
      els.designExternalPressureCard.innerHTML = `<div class="card-heading"><span class="section-number">VAC</span><h3>External pressure / vacuum check</h3></div><div class="alert blocking"><b>External-pressure screen needs more inputs</b><ul>${result.errors.map(error => `<li>${U.escapeHtml(error)}</li>`).join("")}</ul></div>${nextAction}`;
      return;
    }
    if (result.status === "preliminary_pass_demonstration_only" || result.status === "candidate_thickness_inadequate") {
      const passes = result.status === "preliminary_pass_demonstration_only";
      els.designExternalPressureCard.innerHTML = `
        <div class="card-heading"><span class="section-number">VAC</span><h3>External pressure / vacuum check</h3></div>
        <div class="alert ${passes ? "warning" : "blocking"}"><b>${passes ? "Reference-preview external-pressure screen passed" : "Entered thickness is inadequate for the external-pressure screen"}</b><p>${U.escapeHtml(result.banner)}</p></div>
        <div class="capacity-grid">
          <div class="capacity-card"><span>External design pressure</span><strong>${U.formatNumber(result.externalDesignPressureMpa, 6)} MPa</strong><small>User-entered differential pressure</small></div>
          <div class="capacity-card"><span>Effective thickness</span><strong>${U.formatNumber(result.effectiveThicknessMm, 3)} mm</strong><small>Nominal thickness less corrosion allowance</small></div>
          <div class="capacity-card"><span>Allowable external pressure, Pa</span><strong>${U.formatNumber(result.allowableExternalPressureMpa, 4)} MPa</strong><small>${U.escapeHtml(result.governingFormulaId)}</small></div>
          <div class="capacity-card"><span>Pressure utilisation</span><strong>${U.formatNumber(result.utilizationRatio * 100, 1)}%</strong><small>Design external pressure / Pa</small></div>
        </div>
        <details class="compatibility-details"><summary>Show calculation basis and data trace</summary><div class="details-content"><p><b>Material chart:</b> ${U.escapeHtml(result.materialAssignment.external_pressure_chart_id)}. <b>Modulus curve:</b> ${U.escapeHtml(result.materialAssignment.modulus_curve_id)}.</p><p><b>Geometry:</b> L/Do = ${U.formatNumber(result.geometryRatios.lengthOverDiameter, 4)}; Do/t = ${U.formatNumber(result.geometryRatios.diameterOverThickness, 2)}. Figure G factor A = ${U.formatNumber(result.factorA, 7)}.</p><p><b>Material result:</b> ${result.factorBMpa === null ? "Elastic region; modulus E = " + U.formatNumber(result.modulusOfElasticityMpa, 0) + " MPa" : "Factor B = " + U.formatNumber(result.factorBMpa, 3) + " MPa"}.</p><p><b>Source:</b> ASME Section II Part D 2021 Figure G, material external-pressure charts and Table TM. This reference preview is not edition-matched to the ASME VIII-1 2023 design basis and cannot approve construction.</p></div></details>`;
      return;
    }
    els.designExternalPressureCard.innerHTML = `
      <div class="card-heading"><span class="section-number">VAC</span><h3>External pressure / vacuum check</h3></div>
      <div class="alert blocking"><b>Calculation blocked — controlled chart data required</b><p>${U.escapeHtml(result.reason)}</p></div>
      <div class="capacity-grid">
        <div class="capacity-card"><span>External design pressure</span><strong>${U.formatNumber(result.externalDesignPressureMpa, 6)} MPa</strong><small>User-entered differential pressure</small></div>
        <div class="capacity-card"><span>Effective thickness</span><strong>${U.formatNumber(result.effectiveThicknessMm, 3)} mm</strong><small>Nominal thickness less corrosion allowance</small></div>
        <div class="capacity-card"><span>Outside diameter</span><strong>${U.formatNumber(result.outsideDiameterMm, 1)} mm</strong><small>External-pressure geometry basis</small></div>
        <div class="capacity-card"><span>Unsupported length</span><strong>${U.formatNumber(result.unsupportedLengthMm, 1)} mm</strong><small>Between code-defined lines of support</small></div>
      </div>
      <details class="compatibility-details"><summary>Show controlled-data requirement</summary><div class="details-content"><p><b>Logic source:</b> ${U.escapeHtml(result.library.id)} v${U.escapeHtml(result.library.version)}.</p><p><b>Design-rule basis:</b> ${U.escapeHtml(result.library.designRule)}. <b>Current chart source:</b> ${U.escapeHtml(result.library.chartSource)}.</p><p><b>Required before calculation:</b> ${result.library.pendingDatasets.map(item => U.escapeHtml(item)).join(", ")}.</p><p>Do not use the internal-pressure weld joint efficiency as elastic modulus. Conical sections and stiffening-ring design remain outside this automated screen.</p></div></details>`;
  }

  function friendlyDesignErrors(errors) {
    const list = errors || [];
    const codes = new Set(list.map(item => item.code));
    const materialRecordMissing = !els.designStressLibraryRecord.value &&
      (codes.has("E_ALLOWABLE_STRESS_POSITIVE") || codes.has("E_STRESS_SOURCE_REQUIRED"));
    if (!materialRecordMissing) return list;
    const remaining = list.filter(item => !["E_ALLOWABLE_STRESS_POSITIVE", "E_STRESS_SOURCE_REQUIRED"].includes(item.code));
    return [{
      code: "E_MATERIAL_RECORD_REQUIRED",
      severity: "blocking",
      title: "Select a plate material record",
      message: "Select a material group and then an available plate stress record. The app will fill the design-temperature allowable stress and its controlled source reference automatically."
    }, ...remaining];
  }

  function renderDesignResult(result) {
    state.designResult = result;
    els.designScenarioSaved.hidden = true;
    const displayErrors = friendlyDesignErrors(result.errors || []);
    showFormErrors(els.designErrors, displayErrors);
    if (result.status === "blocked") {
      renderComponentComparison(result);
      els.designEmpty.hidden = true;
      els.designResults.hidden = false;
      const copy = designStatusCopy(result);
      els.designStatusCard.className = "status-card panel blocking";
      els.designStatusCard.innerHTML = statusCardHtml({ severity: result.severity, ...copy });
      els.designFormulaCard.innerHTML = `<div class="card-heading"><span class="section-number">STOP</span><h3>No calculation result</h3></div><p>Correct the blocking items below.</p>`;
      els.designFlowCard.innerHTML = `<div class="card-heading"><span class="section-number">BASIS</span><h3>Controlled inputs required</h3></div><p>The app does not infer a code edition, allowable stress or source reference.</p>`;
      els.designSecondaryCalculation.hidden = true;
      els.designConfigurationCard.hidden = true;
      els.designWeightEstimateCard.hidden = true;
      els.designSupportEstimateCard.hidden = true;
      els.designCostEstimateCard.hidden = true;
      // A known vessel weight can still be used for a quick FEED cost estimate.
      els.designCostEstimateSection.hidden = false;
      els.designChecksCard.innerHTML = "";
      els.designWarningsCard.innerHTML = renderIssueList([...displayErrors, ...(result.warnings || [])], "Blocking items and warnings");
      els.designCapacityCard.hidden = true;
      els.designHydrotestCard.hidden = true;
      updateGlobalStatus();
      return;
    }

    els.designEmpty.hidden = true;
    els.designResults.hidden = false;

    const copy = designStatusCopy(result);
    els.designStatusCard.className = `status-card panel ${severityClass(result.severity)}`;
    els.designStatusCard.innerHTML = statusCardHtml({ severity: result.severity, ...copy });
    renderComponentComparison(result);
    renderVesselConfiguration(result);
    const automaticWeightEstimate = renderPreliminaryWeightEstimate(result);
    const claddingEstimate = renderCladdingEstimate(automaticWeightEstimate);
    renderFeedCostEstimate(automaticWeightEstimate, claddingEstimate);

    const margin = result.available_thickness?.thickness_margin;
    if (els.designKpis) els.designKpis.innerHTML = [
      ["Pressure thickness", result.pressure_thickness_mm, "mm"],
      ["Required new thickness", result.minimum_required_new_thickness_mm, "mm"],
      ["Available nominal", result.available_thickness?.nominal, "mm"],
      ["Thickness margin", margin, "mm"]
    ].map(([label, value, unit]) => `
      <article class="panel kpi-card">
        <span>${U.escapeHtml(label)}</span>
        <strong>${Number.isFinite(value) ? U.formatNumber(value, 3) : "—"}</strong>
        <small>${Number.isFinite(value) ? unit : "not provided"}</small>
      </article>
    `).join("");

    const componentResults = result.component_results || [result];
    const shellResult = componentResults.find(item => item.input.component_type === "cylindrical_shell") || result;
    const secondaryResult = componentResults.find(item => item.input.component_type !== "cylindrical_shell");
    els.designFormulaCard.innerHTML = renderComponentFormula(shellResult);

    els.designFlowCard.innerHTML = renderComponentThicknessBuildUp(shellResult);
    if (secondaryResult) {
      els.designSecondaryCalculation.hidden = false;
      els.designSecondaryFormulaCard.innerHTML = renderComponentFormula(secondaryResult);
      els.designSecondaryFlowCard.innerHTML = renderComponentThicknessBuildUp(secondaryResult);
    } else {
      els.designSecondaryCalculation.hidden = true;
      els.designSecondaryFormulaCard.innerHTML = "";
      els.designSecondaryFlowCard.innerHTML = "";
    }

    els.designChecksCard.innerHTML = `
      <div class="card-heading"><span class="section-number">CHK</span><h3>Formula applicability checks</h3></div>
      <div class="table-scroll">
        <table class="check-table">
          <thead><tr><th>Check</th><th>Actual</th><th>Limit</th><th>Status</th></tr></thead>
          <tbody>${(result.applicability_checks || []).map(check => `
            <tr>
              <td>${U.escapeHtml(check.label)}</td>
              <td>${U.escapeHtml(check.actual)}</td>
              <td>${U.escapeHtml(check.limit)}</td>
              <td class="${check.pass ? "check-pass" : "check-fail"}">${check.pass ? "PASS" : "FAIL"}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;

    els.designWarningsCard.innerHTML = renderIssueList([...(result.errors || []), ...(result.warnings || [])]);

    if (result.mawp || result.map) {
      const operatingPressurePass = result.mawp?.value_mpa >= result.normalized_input.P;
      els.designCapacityCard.hidden = false;
      els.designCapacityCard.innerHTML = `
        <div class="card-heading"><span class="section-number">CAP</span><h3>Preliminary pressure capacity</h3></div>
        <div class="capacity-grid">
          <div class="capacity-card"><span>Design pressure + head</span><strong>${formatPressureKgfCm2(result.normalized_input.P)}</strong><small>Required service pressure, including static liquid head</small></div>
          <div class="capacity-card"><span>MAWP</span><strong>${formatPressureKgfCm2(result.mawp?.value_mpa)}</strong><small>Normal operating limit at design temperature after corrosion: ${operatingPressurePass ? "PASS — above required pressure" : "REVIEW — below required pressure"}</small></div>
          <div class="capacity-card"><span>MAP</span><strong>${formatPressureKgfCm2(result.map?.value_mpa)}</strong><small>New and cold pressure capacity; reference for preliminary test screening, not normal operation</small></div>
        </div>
      `;
    } else {
      els.designCapacityCard.hidden = true;
    }

    const asmeHydrotest = ATPE.assess({
      enabled: result.normalized_input.enable_hydrotest,
      mawpMpa: result.mawp?.value_mpa,
      allowableStressDesignMpa: result.normalized_input.S,
      allowableStressTestMpa: result.normalized_input.Sa
    });
    if (asmeHydrotest.status === "preliminary_review_required") {
      els.designHydrotestCard.hidden = false;
      els.designHydrotestCard.innerHTML = `
        <div class="card-heading"><span class="section-number">TEST</span><h3>Preliminary hydrotest pressure</h3></div>
        <p class="field-note">One FEED hydrostatic test-pressure reference using ASME VIII-1 UG-99(b). This is not a final test instruction.</p>
        <div class="capacity-grid"><div class="capacity-card"><span>UG-99(b) preliminary hydrotest pressure</span><strong>${formatPressureKgfCm2(asmeHydrotest.roundedPressureMpa)}</strong><small>Calculated from MAWP and the lowest applicable allowable-stress ratio; rounded up to the FEED increment</small></div></div>
        <details class="compatibility-details"><summary>Show calculation basis and assumptions</summary><div class="details-content"><p><b>Formula:</b> Test pressure = 1.3 × calculated MAWP × stress ratio.</p><p><b>MAWP basis:</b> ${formatPressureKgfCm2(asmeHydrotest.pressureBasisMpa)}. <b>Stress ratio:</b> ${U.formatNumber(asmeHydrotest.allowableStressTestMpa, 2)} ÷ ${U.formatNumber(asmeHydrotest.allowableStressDesignMpa, 2)} = ${U.formatNumber(asmeHydrotest.lowestStressRatio, 2)}.</p><ul>${asmeHydrotest.assumptions.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></div></details>
        <div class="alert review"><b>Engineering review required</b><ul>${asmeHydrotest.warnings.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></div>
      `;
    } else if (asmeHydrotest.status === "blocked") {
      els.designHydrotestCard.hidden = false;
      els.designHydrotestCard.innerHTML = `<div class="card-heading"><span class="section-number">TEST</span><h3>Preliminary hydrotest pressure</h3></div><div class="alert blocking"><b>Hydrotest calculation needs more information</b><ul>${asmeHydrotest.errors.map(item => `<li>${U.escapeHtml(item)}</li>`).join("")}</ul></div>`;
    } else if (result.hydrotest) {
      els.designHydrotestCard.hidden = false;
      els.designHydrotestCard.innerHTML = `
        <div class="card-heading"><span class="section-number">TEST</span><h3>Historical test-pressure screening</h3></div>
        <p class="field-note">These are three historical comparison methods, not three pressure tests to perform. The app does not select the final test pressure.</p>
        <div class="capacity-grid">
          <div class="capacity-card"><span>Shop test from MAP</span><strong>${formatPressureKgfCm2(result.hydrotest.shop_from_map_mpa)}</strong><small>PS = 1.3 × MAP</small></div>
          <div class="capacity-card"><span>Shop test from MAWP ratio</span><strong>${formatPressureKgfCm2(result.hydrotest.shop_from_mawp_ratio_mpa)}</strong><small>PS = 1.3 × MAWP × Sa/SDT</small></div>
          <div class="capacity-card"><span>Field test screen</span><strong>${formatPressureKgfCm2(result.hydrotest.field_from_design_pressure_mpa)}</strong><small>PF = 1.3 × design pressure</small></div>
        </div>
        <div class="alert review"><b>What should you do?</b><p>Do not choose the highest or lowest value yourself. These values only show why historical methods differ. The mechanical engineer must confirm one final shop or field test pressure using the controlled current code and project specification.</p></div>
      `;
    } else {
      els.designHydrotestCard.hidden = true;
    }

    updateGlobalStatus();
    localStorage.setItem("vesselm-last-design", JSON.stringify(result));
    showToast("Preliminary pressure design completed.");
    els.designStatusCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetDesign() {
    els.designForm.reset();
    els.designPressureUnit.value = "kgf_per_cm2";
    els.staticHeadUnitLabel.textContent = els.designPressureUnit.selectedOptions[0].textContent;
    els.designJointEfficiency.value = "0.85";
    els.designCA.value = "3";
    els.designStaticHead.value = "0";
    els.designFormingAllowance.value = "0";
    els.designHeadFormingThinning.value = "10";
    els.designOtherAllowance.value = "0";
    els.designCheckNonShell.checked = true;
    els.designComponentType.value = "ellipsoidal_2_to_1_head";
    els.designSecondaryNominalThickness.value = "";
    els.designInstallationLocation.value = "aboveground";
    els.designVesselOrientation.value = "horizontal";
    els.designNozzleCount.value = "0";
    els.designRequiresLadderPlatform.checked = false;
    els.designAgitatorRequired.checked = false;
    els.designMixerType.value = "to_be_confirmed";
    els.designMixingDuty.value = "normal_blending";
    els.designMixerPowerKw.value = "";
    els.designRequiresBoot.checked = false;
    els.designExternalPressureEnabled.checked = false;
    els.designExternalPressure.value = "0.101325";
    els.designExternalUnsupportedLength.value = "";
    els.designRequiresSubmersiblePumpNozzle.checked = false;
    els.designHasDemisterPad.checked = false;
    els.designHasBafflePlate.checked = false;
    els.designHasVortexBreaker.checked = false;
    clearApiInternalsRecommendation();
    els.designErrors.hidden = true;
    els.designResults.hidden = true;
    els.designExternalPressureCard.hidden = true;
    els.designSupportEstimateCard.hidden = true;
    els.designScenarioSaved.hidden = true;
    els.designEmpty.hidden = false;
    state.designResult = null;
    state.autoStressRecordId = null;
    updateAllowableStressLookup();
    updateDesignGeometryVisibility();
    updateGlobalStatus();
  }

  function loadDesignExample() {
    state.autoStressRecordId = null;
    els.designTag.value = state.materialResult?.input?.equipment_tag || "21-V-101";
    els.designCodeEdition.value = "Controlled edition to be confirmed by engineering";
    // 1.5 MPa and 0.05 MPa converted to the application's default kgf/cm² display unit.
    els.designPressure.value = "15.296";
    els.designPressureUnit.value = "kgf_per_cm2";
    els.designStaticHead.value = "0.509858";
    els.staticHeadUnitLabel.textContent = "kgf/cm²";
    els.designTemperature.value = "250";
    els.designTemperatureUnit.value = "degC";
    els.designMaterialBasis.value = state.materialResult ? ME.selectedFamilySummary(state.materialResult) : "Carbon steel, screening basis";
    els.designCheckNonShell.checked = true;
    els.designComponentType.value = "ellipsoidal_2_to_1_head";
    els.designSecondaryNominalThickness.value = "";
    els.designTangentLength.value = "6000";
    els.designVesselCapacity.value = "20";
    els.designInstallationLocation.value = "aboveground";
    els.designVesselOrientation.value = "horizontal";
    els.designNozzleCount.value = "4";
    els.designRequiresLadderPlatform.checked = false;
    els.designAgitatorRequired.checked = false;
    els.designMixerType.value = "to_be_confirmed";
    els.designMixingDuty.value = "normal_blending";
    els.designMixerPowerKw.value = "";
    els.designRequiresBoot.checked = false;
    els.designExternalPressureEnabled.checked = false;
    els.designExternalPressure.value = "0.101325";
    els.designExternalUnsupportedLength.value = "";
    els.designRequiresSubmersiblePumpNozzle.checked = false;
    els.designHasDemisterPad.checked = true;
    els.designHasBafflePlate.checked = true;
    els.designHasVortexBreaker.checked = false;
    clearApiInternalsRecommendation();
    els.designDiameterBasis.value = "inside";
    els.designDiameter.value = "2000";
    els.designLengthUnit.value = "mm";
    els.designStressUnit.value = "MPa";
    const exampleRecord = (ASE?.records || []).find(record =>
      record.specification?.full_designation === "SA-516" && record.grade === "70"
    );
    els.designStressLibraryRecord.value = exampleRecord?.record_id || "";
    els.designJointEfficiency.value = "0.85";
    els.designJointBasis.value = "Synthetic demonstration basis";
    els.designCA.value = "3";
    els.designFormingAllowance.value = "0";
    els.designHeadFormingThinning.value = "10";
    els.designOtherAllowance.value = "0";
    els.designNominalThickness.value = "20";
    els.enableMapMawp.checked = true;
    els.enableHydrotest.checked = true;
    updateAllowableStressLookup();
    updateDesignGeometryVisibility();
    showToast("Design example loaded from the available plate stress library.");
  }

  function loadScenarios() {
    try {
      const parsed = JSON.parse(localStorage.getItem("vesselm-scenarios") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveScenarios() {
    localStorage.setItem("vesselm-scenarios", JSON.stringify(state.scenarios));
  }

  function saveScenario() {
    if (!state.designResult || state.designResult.status === "blocked") {
      showToast("Calculate a valid design case before saving a scenario.");
      return;
    }
    const scenario = {
      id: `SCN-${Date.now()}`,
      name: `Scenario ${state.scenarios.length + 1}`,
      saved_at: U.timestamp(),
      result: state.designResult
    };
    state.scenarios.push(scenario);
    saveScenarios();
    renderScenarios();
    els.designScenarioSaved.hidden = false;
    els.designScenarioSaved.querySelector("p").textContent = `${scenario.name} was added to Scenario Comparison Lab. You can compare it with other saved options there.`;
    showToast("Scenario saved. Open Scenario Comparison Lab to compare it.");
  }

  function removeScenario(id) {
    state.scenarios = state.scenarios.filter(item => item.id !== id);
    saveScenarios();
    renderScenarios();
  }

  function renderScenarios() {
    updateWorkflowProgress();
    const has = state.scenarios.length > 0;
    els.scenarioEmpty.hidden = has;
    els.scenarioContent.hidden = !has;
    if (!has) return;

    els.scenarioCards.innerHTML = state.scenarios.map(scenario => {
      const r = scenario.result;
      return `
        <article class="panel scenario-card">
          <header><h3>${U.escapeHtml(scenario.name)}</h3><button type="button" data-remove-scenario="${scenario.id}" aria-label="Remove scenario">×</button></header>
          <dl>
            <dt>Component</dt><dd>${U.escapeHtml(DE.componentCatalog[r.input.component_type]?.label || r.input.component_type)}</dd>
            <dt>Required new thickness</dt><dd>${U.formatNumber(r.minimum_required_new_thickness_mm, 3)} mm</dd>
            <dt>Nominal thickness</dt><dd>${U.formatNumber(r.available_thickness?.nominal, 3)} mm</dd>
            <dt>Margin</dt><dd>${U.formatNumber(r.available_thickness?.thickness_margin, 3)} mm</dd>
          </dl>
        </article>
      `;
    }).join("");

    qsa("[data-remove-scenario]").forEach(button => button.addEventListener("click", () => removeScenario(button.dataset.removeScenario)));

    els.scenarioTableBody.innerHTML = state.scenarios.map(scenario => {
      const r = scenario.result;
      const n = r.normalized_input;
      return `
        <tr>
          <td>${U.escapeHtml(scenario.name)}</td>
          <td>${U.escapeHtml(DE.componentCatalog[r.input.component_type]?.label || r.input.component_type)}</td>
          <td>${U.formatNumber(n.P, 3)} MPa</td>
          <td>${U.formatNumber(n.S, 3)} MPa</td>
          <td>${U.formatNumber(r.minimum_required_new_thickness_mm, 3)} mm</td>
          <td>${U.formatNumber(r.available_thickness?.nominal, 3)} mm</td>
          <td>${U.formatNumber(r.available_thickness?.thickness_margin, 3)} mm</td>
          <td>${U.formatNumber(r.mawp?.value_mpa, 3)} MPa</td>
        </tr>
      `;
    }).join("");
  }

  function renderTests(result) {
    state.testResult = result;
    els.testTotal.textContent = result.total;
    els.testPassed.textContent = result.passed;
    els.testFailed.textContent = result.failed;
    els.testState.textContent = result.failed === 0 ? "Software tests pass" : "Failures present";
    els.testState.className = result.failed === 0 ? "test-pass" : "test-fail";

    els.testTableBody.innerHTML = result.results.map(test => `
      <tr>
        <td>${U.escapeHtml(test.id)}</td>
        <td>${U.escapeHtml(test.group)}</td>
        <td>${U.escapeHtml(String(test.expected))}</td>
        <td>${U.escapeHtml(Number.isFinite(test.actual) ? U.formatNumber(test.actual, 9) : String(test.actual))}</td>
        <td class="${test.passed ? "test-pass" : "test-fail"}">${test.passed ? "PASS" : "FAIL"}</td>
      </tr>
    `).join("");
    showToast(`${result.passed} of ${result.total} tests passed.`);
  }

  function setupLibrary() {
    renderLibraryFiles();
    els.dataStatus.textContent = `${Object.keys(window.VESSELM_DATA || {}).length} modular JSON databanks loaded locally`;
  }

  function renderLibraryFiles() {
    const query = els.librarySearch.value.trim().toLowerCase();
    const paths = Object.keys(window.VESSELM_DATA || {}).filter(path => {
      if (!query) return true;
      const content = JSON.stringify(window.VESSELM_DATA[path]).toLowerCase();
      return path.toLowerCase().includes(query) || content.includes(query);
    });
    els.libraryFileList.innerHTML = paths.map(path => `
      <button type="button" class="library-file ${state.selectedLibraryPath === path ? "active" : ""}" data-library-path="${U.escapeHtml(path)}">${U.escapeHtml(path)}</button>
    `).join("");
    qsa("[data-library-path]").forEach(button => button.addEventListener("click", () => selectLibrary(button.dataset.libraryPath)));
  }

  function selectLibrary(path) {
    state.selectedLibraryPath = path;
    els.librarySelectedTitle.textContent = path;
    els.libraryJsonViewer.textContent = JSON.stringify(window.VESSELM_DATA[path], null, 2);
    els.copyLibraryButton.disabled = false;
    renderLibraryFiles();
  }

  async function copyMaterialSummary() {
    if (!state.materialResult) return;
    await U.copyText(RE.buildTextSummary(state));
    showToast("Material and calculation summary copied.");
  }

  async function copyDesignSummary() {
    if (!state.designResult) return;
    await U.copyText(RE.buildTextSummary(state));
    showToast("Design summary copied.");
  }

  function restoreLastResults() {
    try {
      const material = JSON.parse(localStorage.getItem("vesselm-last-material") || "null");
      const design = JSON.parse(localStorage.getItem("vesselm-last-design") || "null");
      if (material) renderMaterialResult(material);
      if (design) renderDesignResult(design);
    } catch {
      // Ignore invalid local state.
    }
  }

  function setupTheme() {
    const saved = localStorage.getItem("vesselm-theme");
    const preferred = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(saved || preferred);
  }

  function setSidebarCollapsed(collapsed) {
    els.appShell.classList.toggle("sidebar-collapsed", collapsed);
    els.sidebarHoverLabel.hidden = true;
    els.sidebarToggle.textContent = collapsed ? "›" : "‹";
    els.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    els.sidebarToggle.setAttribute("aria-label", collapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar");
    els.sidebarToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    localStorage.setItem("vesselm-sidebar-collapsed", String(collapsed));
  }

  function setupSidebar() {
    setSidebarCollapsed(localStorage.getItem("vesselm-sidebar-collapsed") === "true");
  }

  function normalizeAuditMethodologyHeadings() {
    const correctedHeadings = {
      "4. Material Rate & Supply Price": "5. Material Rate & Supply Price",
      "5. Site Erection & Total Cost": "6. Site Erection & Total Cost",
      "6. Audit Limits & Engineering Controls": "7. Audit Limits & Engineering Controls"
    };
    qsa("#designCostAuditContent > .result-grid > article.panel.result-panel > h4").forEach(heading => {
      const corrected = correctedHeadings[heading.textContent.trim()];
      if (corrected) heading.textContent = corrected;
    });
  }

  function showSidebarHoverLabel(button) {
    if (!els.appShell.classList.contains("sidebar-collapsed")) return;
    const label = button.dataset.sidebarLabel;
    if (!label) return;
    const rect = button.getBoundingClientRect();
    els.sidebarHoverLabel.textContent = label;
    els.sidebarHoverLabel.style.left = `${Math.round(rect.right + 12)}px`;
    els.sidebarHoverLabel.style.top = `${Math.round(Math.max(8, Math.min(window.innerHeight - 38, rect.top + (rect.height / 2) - 16)))}px`;
    els.sidebarHoverLabel.hidden = false;
  }

  function hideSidebarHoverLabel() {
    els.sidebarHoverLabel.hidden = true;
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vesselm-theme", theme);
    els.themeButton.textContent = theme === "dark" ? "☀" : "◐";
  }

  function bindEvents() {
    qsa("[data-screen]").forEach(button => button.addEventListener("click", () => showScreen(button.dataset.screen)));
    qsa("[data-go]").forEach(button => button.addEventListener("click", () => showScreen(button.dataset.go)));

    els.themeButton.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    els.sidebarToggle.addEventListener("click", () => {
      setSidebarCollapsed(!els.appShell.classList.contains("sidebar-collapsed"));
    });
    qsa(".nav-item[data-sidebar-label]").forEach(button => {
      button.addEventListener("mouseenter", () => showSidebarHoverLabel(button));
      button.addEventListener("mouseleave", hideSidebarHoverLabel);
      button.addEventListener("focus", () => showSidebarHoverLabel(button));
      button.addEventListener("blur", hideSidebarHoverLabel);
    });

    els.materialForm.addEventListener("submit", event => {
      event.preventDefault();
      const sizing = VSE.assess(vesselSizingInput());
      if (sizing.status === "blocked_input") {
        showFormErrors(els.materialErrors, sizing.errors);
        return;
      }
      renderVesselSizingRecommendation(sizing);
      renderMaterialResult(ME.assess(materialInput()));
    });
    els.materialExampleButton.addEventListener("click", loadMaterialExample);
    els.materialResetButton.addEventListener("click", resetMaterial);
    els.materialOverrideEnabled.addEventListener("change", () => {
      els.materialOverrideFields.hidden = !els.materialOverrideEnabled.checked;
    });
    els.apiRp12jEnabled.addEventListener("change", () => {
      els.apiRp12jFields.hidden = !els.apiRp12jEnabled.checked;
    });
    $("apiServiceType").addEventListener("change", updateApiOperatingCaseFields);
    els.apiExampleButton.addEventListener("click", loadApiExample);
    els.copyMaterialButton.addEventListener("click", copyMaterialSummary);

    els.designForm.addEventListener("submit", event => {
      event.preventDefault();
      updateAllowableStressLookup();
      renderDesignResult(calculateDesignAssessment());
      renderExternalPressureResult(EPE.assess(designInput()));
    });
    els.designExampleButton.addEventListener("click", loadDesignExample);
    els.designResetButton.addEventListener("click", resetDesign);
    els.designCheckNonShell.addEventListener("change", updateDesignGeometryVisibility);
    els.designComponentType.addEventListener("change", updateDesignGeometryVisibility);
    els.designInstallationLocation.addEventListener("change", updateDesignGeometryVisibility);
    els.designVesselOrientation.addEventListener("change", updateDesignGeometryVisibility);
    els.designAgitatorRequired.addEventListener("change", updateDesignGeometryVisibility);
    els.designExternalPressureEnabled.addEventListener("change", updateDesignGeometryVisibility);
    els.designCladdingEnabled.addEventListener("change", () => {
      updateDesignGeometryVisibility();
      refreshQuickCostEstimate();
    });
    [els.designCostMaterialFamily, els.designCostSteelYear, els.designCostErectionType, els.designCostOperatingWeight].forEach(field => {
      field.addEventListener(field.tagName === "INPUT" ? "input" : "change", refreshQuickCostEstimate);
    });
    [els.designCladdingOption, els.designCladdingMaterial, els.designCladdingThickness, els.designCladdingCoverage, els.designCladdingHeadCount, els.designCladdingHeadArea, els.designCladdingAdditionalArea].forEach(field => {
      field.addEventListener(field.tagName === "INPUT" ? "input" : "change", refreshQuickCostEstimate);
    });
    els.designQuickCostButton.addEventListener("click", () => {
      refreshQuickCostEstimate();
      if (!els.designCostEstimateCard.hidden) {
        els.designCostEstimateCard.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        showToast("Enter a vessel weight or complete the preliminary metal-weight calculation first.");
      }
    });
    els.designCostAuditToggle.addEventListener("click", toggleCostAuditTrail);
    els.designMaterialGroup.addEventListener("change", () => {
      state.autoStressRecordId = null;
      els.designStressLibraryRecord.value = "";
      updateAllowableStressLookup();
    });
    els.designStressLibraryRecord.addEventListener("change", () => {
      state.autoStressRecordId = null;
      updateAllowableStressLookup();
    });
    els.designTemperature.addEventListener("input", updateAllowableStressLookup);
    els.designDiameterBasis.addEventListener("change", updateDesignGeometryVisibility);
    els.designPressureUnit.addEventListener("change", () => {
      els.staticHeadUnitLabel.textContent = els.designPressureUnit.selectedOptions[0].textContent;
    });
    els.saveScenarioButton.addEventListener("click", saveScenario);
    els.copyDesignButton.addEventListener("click", copyDesignSummary);
    els.exportJsonButton.addEventListener("click", () => RE.exportJson(state));
    els.exportCsvButton.addEventListener("click", () => RE.exportCsv(state));
    els.printButton.addEventListener("click", () => window.print());

    els.clearScenariosButton.addEventListener("click", () => {
      if (!state.scenarios.length) return;
      if (confirm("Clear all saved scenarios from this browser?")) {
        state.scenarios = [];
        saveScenarios();
        renderScenarios();
      }
    });

    els.runTestsButton.addEventListener("click", () => renderTests(TE.runAll()));

    els.librarySearch.addEventListener("input", U.debounce(renderLibraryFiles, 150));
    els.copyLibraryButton.addEventListener("click", async () => {
      if (!state.selectedLibraryPath) return;
      await U.copyText(JSON.stringify(window.VESSELM_DATA[state.selectedLibraryPath], null, 2));
      showToast("JSON copied.");
    });
  }

  function init() {
    setupTheme();
    setupSidebar();
    normalizeAuditMethodologyHeadings();
    setupMaterialInputs();
    setupDesignInputs();
    setupLibrary();
    bindEvents();
    renderScenarios();
    els.staticHeadUnitLabel.textContent = els.designPressureUnit.selectedOptions[0].textContent;
    updateGlobalStatus();
    // Keep the initial page clean; prior results remain available in localStorage but are not auto-rendered.
  }

  init();
})();
