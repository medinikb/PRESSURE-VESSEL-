(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;
  const sizingLibrary = U.getPath("Vessel sizing_and_internal_logic/refinery_vessel_sizing_logic_v1_v3.json");
  const internalsLibrary = U.getPath("Vessel sizing_and_internal_logic/vessel_preliminary_internals_logic_v1.json");
  const apiRp12jLibrary = U.getPath("Vessel sizing_and_internal_logic/API_RP_12j_preliminary_vessel_sizing_rules_v2_with_example.json");

  const labels = { gas_liquid: "Gas and liquid separation", three_phase: "Gas and two-liquid separation", liquid_surge: "Liquid surge / holdup", compressor_protection: "Compressor protection scrubber", flare: "Flare / vent liquid knockout", flash: "Flash drum" };
  const issue = (code, severity, title, message) => ({ code, severity, title, message, category: "Preliminary vessel sizing" });
  const safeNumber = value => Number.isFinite(value) && value > 0 ? value : null;

  function apiWorkedExample() {
    const examples = apiRp12jLibrary?.worked_examples;
    const example = Array.isArray(examples) ? examples[0] : examples;
    if (!example?.input_snapshot || !example?.preliminary_recommendation) return null;
    return {
      title: example.title,
      status: example.status,
      input: example.input_snapshot,
      recommendation: example.preliminary_recommendation,
      assumptions: example.assumption_explanations || [],
      warnings: example.recommendations || []
    };
  }

  function orientationRecommendation({ service, hasGas, hasTwoLiquids, hasLiquid, sluggingExpected, liquidFlow, gasFlow, holdupMinutes }) {
    const reasons = [];
    if (hasTwoLiquids || service === "three_phase") {
      reasons.push("two-liquid separation needs interface area and stable liquid-level control");
      return { decision: "horizontal_preferred", geometryOrientation: "horizontal", reasons };
    }
    if (sluggingExpected) {
      reasons.push("expected slug volume is usually accommodated more effectively in a horizontal vessel");
      return { decision: "horizontal_preferred", geometryOrientation: "horizontal", reasons };
    }
    if (service === "compressor_protection") {
      reasons.push("gas-dominated compressor protection commonly favours a compact vertical scrubber");
      return { decision: "vertical_preferred", geometryOrientation: "vertical", reasons };
    }
    if (service === "liquid_surge" && hasLiquid && !hasGas) {
      reasons.push("liquid-only surge service benefits from a long liquid-level control range");
      return { decision: "horizontal_preferred", geometryOrientation: "horizontal", reasons };
    }
    if (hasGas && hasLiquid) {
      reasons.push("ordinary gas-liquid service uses a vertical preliminary default for a compact gas disengagement arrangement");
      if (!liquidFlow) reasons.push("confirm liquid flow and holdup inventory during process review");
      if (!gasFlow) reasons.push("confirm gas capacity during process review");
      return { decision: "vertical_preferred", geometryOrientation: "vertical", reasons };
    }
    if (hasGas && !hasLiquid) {
      reasons.push("gas-dominated duty with no liquid inventory requirement provisionally favours a compact vertical vessel");
      return { decision: "vertical_preferred", geometryOrientation: "vertical", reasons };
    }
    reasons.push("a horizontal preliminary default is used for this liquid-dominated screening basis");
    return { decision: "horizontal_preferred", geometryOrientation: "horizontal", reasons };
  }

  // API RP 12J 9th Edition comparison. The app collects only a light early-design
  // basis, so the complete three-case API sizing workflow remains fail-closed.
  function apiRp12jComparison(input, context) {
    const metadata = apiRp12jLibrary?.library_metadata || {};
    const source = metadata.source_basis || {};
    const phases = input.phases || [];
    const hasGas = phases.includes("gas");
    const hasTwoLiquids = phases.includes("light_liquid") && phases.includes("heavy_liquid");
    const serviceMap = { gas_liquid: "gas_liquid_separator", three_phase: "gas_oil_water_separator", liquid_surge: "gas_liquid_separator", compressor_protection: "gas_liquid_scrubber", flash: "gas_liquid_separator" };
    const serviceType = serviceMap[input.service];
    const inScope = Boolean(serviceType) && hasGas && (phases.includes("light_liquid") || phases.includes("heavy_liquid"));
    if (!apiRp12jLibrary) return { status: "library_not_loaded", message: "The API RP 12J 9th Edition rules library is not loaded. Regenerate the local data bundle before using the comparison.", source };
    if (!inScope) return { status: "not_applicable", message: "This selected vessel duty or phase configuration is outside the supported API RP 12J preliminary separator scope. No API comparison is made.", source, metadata };

    let orientation = "vertical", confidence = "preliminary default", orientationBasis = "Ordinary gas-liquid service uses a vertical preliminary default; confirm the selection during the full API operating-case review.";
    if (hasTwoLiquids) {
      orientation = "horizontal"; confidence = "high";
      orientationBasis = "Rule ORIENT-001: gas-oil-water three-phase separation has a horizontal preference.";
    } else if (input.service === "compressor_protection") {
      orientation = "vertical"; confidence = "medium";
      orientationBasis = "Rule ORIENT-003: compressor suction scrubbers are commonly vertical.";
    } else if (input.slugging_expected) {
      orientation = "horizontal"; confidence = "medium";
      orientationBasis = "Rule ORIENT-004: expected slug or surge volume has a horizontal preference.";
    }
    const solidsPresent = input.solids_loading !== "none";
    const inletDevice = (solidsPresent || ["high", "severe"].includes(input.fouling_tendency)) ? "Inlet vane diffuser — fouling review required" : "Inlet vane diffuser — default preliminary candidate";
    const mistEliminator = input.separation_quality === "bulk" ? "None — bulk separation selected" :
      ((solidsPresent || ["high", "severe"].includes(input.fouling_tendency)) ? "Technology supplier selection — open-geometry vane or cyclone candidate" : "Technology supplier selection — droplet target and gas-capacity basis required");
    const internals = [
      { name: inletDevice, reason: "Rules INLET-001 and INLET-005 govern fouling controls and the default inlet-device candidate." },
      { name: mistEliminator, reason: input.separation_quality === "bulk" ? "Fine-mist removal was not requested." : "Rules MIST-001 to MIST-007 require process performance, droplet and capacity data before a device is selected." }
    ];
    if (orientation === "horizontal" || hasTwoLiquids) internals.push({ name: "Distribution baffle", reason: "Distribution baffle rules apply to horizontal and liquid-liquid separation; establish effective settling length and obtain flow-distribution review." });
    if (hasTwoLiquids) internals.push({ name: "Three-phase interface arrangement", reason: "Select flooded weir, elevated oil outlet, bucket-and-weir or another approved configuration after control and density review." });
    if (input.pump_suction) internals.push({ name: "Vortex breaker", reason: "Retained as a preliminary liquid-outlet recommendation; final arrangement depends on the API nozzle and level-control workflow." });
    const missing = ["design, normal and minimum operating cases", "pressure, temperature, phase flow, density and viscosity for each case", "oil-water interfacial tension", "separation performance / droplet-size targets", "company standard vessel IDs and tangent lengths"];
    return { status: "input_incomplete_fail_closed", source, metadata, service_type: serviceType, phase_configuration: hasTwoLiquids ? "gas_oil_water" : "gas_liquid", orientation, confidence, orientation_basis: orientationBasis, internals, missing_inputs: missing, verification: ["Inlet momentum, nozzles, gas capacity and mist capacity: not run", "Liquid levels, retention, slug, degassing and settling: not run", "No candidate size is approved until all applicable operating cases pass"], warning: apiRp12jLibrary?.mandatory_disclaimer || "Final qualified process, mechanical and supplier review is required.", applied_rules: hasTwoLiquids ? ["ORIENT-001", "INLET-005", "MIST-001 to MIST-007"] : [input.service === "compressor_protection" ? "ORIENT-003" : input.slugging_expected ? "ORIENT-004" : "orientation engineering selection gate", "INLET-001 / INLET-005", "MIST-001 to MIST-007"] };
  }

  function apiInventoryCandidate(api, orientation) {
    const isThreePhase = ["gas_oil_water_separator", "liquid_liquid_separator"].includes(api.service_type);
    const hasGasPhase = api.service_type !== "liquid_liquid_separator";
    const flowM3s = (massKgH, densityKgM3) => Number.isFinite(massKgH) && Number.isFinite(densityKgM3) && densityKgM3 > 0 ? massKgH / densityKgM3 / 3600 : 0;
    const liquidCases = api.operating_cases.map(item => ({
      case_type: item.case_type,
      liquid_flow_m3_s: flowM3s(item.oil_mass_flow_kg_h, item.oil_density_kg_m3) + flowM3s(item.water_mass_flow_kg_h, item.water_density_kg_m3),
      gas_flow_m3_s: flowM3s(item.gas_mass_flow_kg_h, item.gas_density_kg_m3),
      oil_flow_m3_s: flowM3s(item.oil_mass_flow_kg_h, item.oil_density_kg_m3),
      water_flow_m3_s: flowM3s(item.water_mass_flow_kg_h, item.water_density_kg_m3)
    }));
    const retentionSeconds = api.required_liquid_retention_time_s || 0;
    const slugVolumeM3 = api.required_slug_volume_m3 || 0;
    const inventoryCases = liquidCases.map(item => ({ ...item, required_inventory_m3: item.liquid_flow_m3_s * retentionSeconds + slugVolumeM3 }));
    const governing = inventoryCases.reduce((largest, item) => item.required_inventory_m3 > largest.required_inventory_m3 ? item : largest);
    const candidates = [...api.standard_vessel_ids_m].sort((a, b) => a - b).flatMap(diameterM =>
      [...api.standard_tangent_lengths_m].sort((a, b) => a - b).map(lengthM => ({ diameter_m: diameterM, tangent_length_m: lengthM, gross_shell_volume_m3: Math.PI * diameterM ** 2 * lengthM / 4 }))
    ).sort((a, b) => a.gross_shell_volume_m3 - b.gross_shell_volume_m3);
    const selected = candidates.find(candidate => candidate.gross_shell_volume_m3 >= governing.required_inventory_m3) || null;
    const maxGas = liquidCases.reduce((largest, item) => item.gas_flow_m3_s > largest.gas_flow_m3_s ? item : largest);
    const maxOil = liquidCases.reduce((largest, item) => item.oil_flow_m3_s > largest.oil_flow_m3_s ? item : largest);
    const maxWater = liquidCases.reduce((largest, item) => item.water_flow_m3_s > largest.water_flow_m3_s ? item : largest);
    const diameterForFlow = (flowM3s, velocityMs) => Math.sqrt(4 * flowM3s / (Math.PI * velocityMs));
    return {
      status: selected ? "inventory_candidate" : "no_inventory_candidate",
      orientation,
      governing_case: governing.case_type,
      required_inventory_m3: governing.required_inventory_m3,
      selected_candidate: selected,
      nozzle_minimum_ids_m: {
        gas_outlet: hasGasPhase ? diameterForFlow(maxGas.gas_flow_m3_s, 20) : null,
        oil_outlet: diameterForFlow(maxOil.oil_flow_m3_s, 2),
        water_outlet: isThreePhase ? diameterForFlow(maxWater.water_flow_m3_s, 1) : null
      },
      calculation_notes: [
        "Phase volumetric flow is calculated from mass flow ÷ density.",
        "Required liquid inventory = liquid flow × entered retention time + entered slug volume.",
        "The selected standard vessel is the smallest gross shell-volume candidate meeting the inventory screen.",
        "Gas capacity, mist capacity, liquid levels, settling, inlet momentum and final nozzle selection remain mandatory API checks."
      ]
    };
  }

  // The detailed panel intentionally validates the API library's input contract
  // before any candidate-iteration calculation is allowed to proceed.
  function apiRp12jDetailedComparison(input) {
    const metadata = apiRp12jLibrary?.library_metadata || {};
    const source = metadata.source_basis || {};
    if (!apiRp12jLibrary) return { status: "library_not_loaded", message: "The API RP 12J rules library is not loaded.", source };
    const api = input.api_rp_12j || { enabled: false };
    if (!api.enabled) return { status: "not_requested", message: "Open the API RP 12J process-data panel to enter the three operating cases and enable this comparison.", source, metadata };
    const supported = new Set(apiRp12jLibrary.enumerations?.service_type || []);
    if (!supported.has(api.service_type)) return { status: "not_applicable", message: "Select an API RP 12J service type within the supported preliminary separator scope.", source, metadata };

    const missing = [];
    const fields = {
      gas_liquid_scrubber: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s"],
      gas_liquid_separator: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s"],
      gas_oil_water_separator: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "water_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "water_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s", "water_viscosity_pa_s", "oil_water_interfacial_tension_n_m"],
      liquid_liquid_separator: ["pressure_bara", "temperature_c", "oil_mass_flow_kg_h", "water_mass_flow_kg_h", "oil_density_kg_m3", "water_density_kg_m3", "oil_viscosity_pa_s", "water_viscosity_pa_s", "oil_water_interfacial_tension_n_m"],
      separator_with_solids: ["pressure_bara", "temperature_c", "gas_mass_flow_kg_h", "oil_mass_flow_kg_h", "gas_density_kg_m3", "oil_density_kg_m3", "gas_viscosity_pa_s", "oil_viscosity_pa_s"]
    }[api.service_type] || [];
    const positive = new Set(fields.filter(field => field !== "temperature_c" && !field.includes("mass_flow")));
    ["design", "normal", "minimum"].forEach(caseType => {
      const item = (api.operating_cases || []).find(candidate => candidate.case_type === caseType);
      if (!item) { missing.push(`${caseType} operating case`); return; }
      fields.forEach(field => {
        const value = item[field];
        const valid = field.includes("mass_flow") ? Number.isFinite(value) && value >= 0 : positive.has(field) ? Number.isFinite(value) && value > 0 : Number.isFinite(value);
        if (!valid) missing.push(`${caseType}: ${field.replaceAll("_", " ")}`);
      });
    });
    if (!api.standard_vessel_ids_m?.length) missing.push("company standard vessel IDs");
    if (!api.standard_tangent_lengths_m?.length) missing.push("company standard tangent lengths");
    if (![api.required_droplet_size_um, api.required_liquid_retention_time_s, api.required_slug_volume_m3].some(value => Number.isFinite(value) && value > 0)) missing.push("at least one separation performance, retention or slug-volume target");

    const isThreePhase = ["gas_oil_water_separator", "liquid_liquid_separator"].includes(api.service_type);
    let orientation = "vertical", confidence = "preliminary default", orientationBasis = "Ordinary gas-liquid service uses a vertical preliminary default; confirm the selection during the full API operating-case review.";
    if (isThreePhase) { orientation = "horizontal"; confidence = "high"; orientationBasis = "Rules ORIENT-001 / ORIENT-002: liquid-liquid separation has a horizontal preference."; }
    else if (api.compressor_suction_service) { orientation = "vertical"; confidence = "medium"; orientationBasis = "Rule ORIENT-003: compressor suction scrubber service commonly favours vertical orientation."; }
    else if (input.slugging_expected || (api.required_slug_volume_m3 || 0) > 0) { orientation = "horizontal"; confidence = "medium"; orientationBasis = "Rule ORIENT-004: slug or surge volume has a horizontal preference."; }
    const dirty = input.solids_loading !== "none" || ["high", "severe"].includes(input.fouling_tendency) || api.wax_or_asphaltenes_present;
    const internals = [
      { name: "Inlet vane diffuser", reason: dirty ? "Rules INLET-001 and INLET-005: retain open, cleanable geometry and obtain fouling review." : "Rule INLET-005: default preliminary inlet-device candidate." },
      { name: input.separation_quality === "bulk" ? "No mist eliminator — bulk separation only" : dirty ? "Open-geometry vane or cyclone candidate" : "Knitted-mesh mist eliminator candidate", reason: "Rules MIST-001 to MIST-007: final selection requires capacity, droplet-removal and pressure-drop checks." }
    ];
    if (orientation === "horizontal" || isThreePhase) internals.push({ name: "Distribution baffle", reason: "Establish effective settling length and obtain flow-distribution review." });
    if (isThreePhase) internals.push({ name: "Three-phase interface arrangement", reason: "Select the weir / outlet configuration after level-control and density review." });
    if (input.pump_suction) internals.push({ name: "Vortex breaker", reason: "Preliminary liquid-outlet recommendation; confirm during nozzle and level-control sizing." });
    const ready = missing.length === 0;
    const recommendation = ready ? apiInventoryCandidate(api, orientation) : null;
    return { status: ready ? "api_input_ready" : "input_incomplete_fail_closed", source, metadata, service_type: api.service_type, phase_configuration: isThreePhase ? "gas_oil_water" : "gas_liquid", orientation, confidence, orientation_basis: orientationBasis, internals, api_preliminary_recommendation: recommendation, missing_inputs: missing, verification: ready ? ["API process-input completeness gate passed", "Inventory-based standard-vessel candidate generated; complete all mandatory API checks before approval", "No final candidate is approved until all applicable operating cases pass"] : ["API input-completeness gate failed; detailed calculations are not run", "Complete the listed fields before API candidate iteration", "No candidate size is approved until all applicable operating cases pass"], warning: apiRp12jLibrary.mandatory_disclaimer, applied_rules: isThreePhase ? ["ORIENT-001 / ORIENT-002", "INLET-005", "MIST-001 to MIST-007"] : [api.compressor_suction_service ? "ORIENT-003" : (api.required_slug_volume_m3 || 0) > 0 ? "ORIENT-004" : "orientation engineering selection gate", "INLET-001 / INLET-005", "MIST-001 to MIST-007"] };
  }

  // Preliminary automation only: final process sizing still needs approved fluid properties and process criteria.
  function assess(input) {
    const errors = [], warnings = [];
    const apiAssessment = apiRp12jDetailedComparison(input);
    const apiCandidate = apiAssessment.api_preliminary_recommendation?.selected_candidate;
    const apiServiceMap = { gas_oil_water_separator: "three_phase", liquid_liquid_separator: "three_phase", gas_liquid_scrubber: "compressor_protection", gas_liquid_separator: "gas_liquid", separator_with_solids: "gas_liquid" };
    const apiPhases = apiAssessment.phase_configuration === "gas_oil_water" ? ["gas", "light_liquid", "heavy_liquid"] :
      apiAssessment.service_type === "liquid_liquid_separator" ? ["light_liquid", "heavy_liquid"] : ["gas", "light_liquid"];
    const usedApiFallback = Boolean(apiCandidate);
    const service = input.service || (usedApiFallback ? apiServiceMap[apiAssessment.service_type] : "");
    const phases = input.phases?.length ? input.phases : (usedApiFallback ? apiPhases : []);
    const capacity = safeNumber(input.required_volume_m3) || (usedApiFallback ? apiCandidate.gross_shell_volume_m3 : null);
    const liquidFlow = safeNumber(input.liquid_flow_m3_h);
    const holdupMinutes = safeNumber(input.holdup_minutes) || 5;
    const apiGasFlow = usedApiFallback ? Math.max(0, ...(input.api_rp_12j.operating_cases || []).map(item =>
      Number.isFinite(item.gas_mass_flow_kg_h) && Number.isFinite(item.gas_density_kg_m3) && item.gas_density_kg_m3 > 0 ? item.gas_mass_flow_kg_h / item.gas_density_kg_m3 : 0
    )) : null;
    const gasFlow = safeNumber(input.gas_flow_m3_h) || apiGasFlow;
    if (!labels[service]) errors.push(issue("E_SIZING_SERVICE", "blocking", "Select vessel duty", "Choose the primary vessel duty so the app can recommend a preliminary configuration."));
    if (!phases.length) errors.push(issue("E_SIZING_PHASES", "blocking", "Select phases", "Select the phases expected in the vessel."));
    if (!capacity && !liquidFlow) errors.push(issue("E_SIZING_VOLUME", "blocking", "Provide one sizing basis", "Enter preliminary working capacity or liquid flow. The app will estimate the other value."));
    if (errors.length) return { status: "blocked_input", severity: "blocking", errors, warnings, input };

    const workingVolumeM3 = capacity || liquidFlow * holdupMinutes / 60;
    const hasGas = phases.includes("gas"), hasTwoLiquids = phases.includes("light_liquid") && phases.includes("heavy_liquid"), hasLiquid = phases.includes("light_liquid") || phases.includes("heavy_liquid");
    const orientationAssessment = orientationRecommendation({ service, hasGas, hasTwoLiquids, hasLiquid, sluggingExpected: input.slugging_expected, liquidFlow, gasFlow, holdupMinutes });
    const orientation = orientationAssessment.geometryOrientation;
    const lengthToDiameter = orientation === "horizontal" ? 3 : 2.5;
    const diameterM = Math.cbrt((4 * workingVolumeM3) / (Math.PI * lengthToDiameter));
    const internals = [], add = (id, name, status, reason) => internals.push({ id, name, status, reason });
    const hardInlet = input.slugging_expected || input.fouling_tendency === "high" || input.solids_loading !== "none";
    add(hardInlet ? "INL-002" : "INL-001", hardInlet ? "Impingement / target plate" : "Simple inlet pipe extension or elbow", "Recommended", input.slugging_expected ? "Protects the vessel from expected slug momentum." : "Suitable initial inlet arrangement for this service basis.");
    if (hasGas && hasLiquid && input.separation_quality !== "bulk") {
      if (input.fouling_tendency === "severe") warnings.push(issue("W_DEMISTER_FOULING", "review", "Mist eliminator needs specialist review", "Severe fouling prevents automatic fine-mist device selection."));
      else add("GL-001", "Wire-mesh mist eliminator", "Recommended for confirmation", "Gas-liquid separation quality is above bulk removal.");
    }
    if (hasTwoLiquids) {
      if ((input.heavy_liquid_fraction || 0.5) <= 0.2) add("LL-002", "Water / heavy-liquid boot", "Recommended for confirmation", "Small heavy-liquid fraction is a preliminary boot candidate.");
      else add("LL-001", "Interface weir and underflow baffle", "Recommended for confirmation", "Two-liquid separation needs interface control and separate liquid outlets.");
    }
    if (input.slugging_expected) add("FLW-001", "Calming baffle", "Recommended", "Helps reduce liquid disturbance during slug arrival.");
    if (input.pump_suction) add("OUT-001", "Vortex breaker", "Recommended", "Pump suction from the vessel requires an anti-vortex arrangement.");
    if (["medium", "high"].includes(input.solids_loading)) add("SOL-001", "Solids sump / boot", "Recommended for confirmation", "Solids loading requires cleanout and drainage review.");
    if (service === "compressor_protection") warnings.push(issue("W_COMPRESSOR_VENDOR", "review", "Compressor protection review", "Confirm carryover limit, mist-eliminator pressure drop, drain reliability and high-high level trip with process and vendor specialists."));
    if (service === "flare") warnings.push(issue("W_FLARE_DEMISTER", "review", "Flare knockout review", "Do not automatically use a demister in flare service; confirm pressure drop, coking, fire case and maintenance basis."));
    if (!capacity) warnings.push(issue("W_VOLUME_ESTIMATED", "review", "Working capacity estimated", `The ${U.formatNumber(workingVolumeM3, 2)} m³ capacity is calculated from liquid flow and ${holdupMinutes} minutes holdup. Confirm the process inventory basis.`));
    if (!gasFlow && hasGas) warnings.push(issue("W_GAS_FLOW_REQUIRED", "review", "Gas capacity not verified", "Enter gas flow when available. Gas velocity and mist-eliminator sizing still require process-property confirmation."));
    if (usedApiFallback) warnings.push(issue("W_API_SIZING_BASIS", "review", "API RP 12J sizing basis used", "The complete API process-data panel supplied the duty, phases and standard-vessel volume for this preliminary recommendation."));
    if (orientationAssessment.decision === "vertical_preferred" && hasGas && hasLiquid) warnings.push(issue("W_ORIENTATION_DEFAULT", "review", "Vertical preliminary orientation selected", "Vertical is the app's preliminary default for ordinary gas-liquid service. Confirm gas capacity, liquid holdup and plot constraints during process review."));
    return { status: "preliminary_review", severity: "review", input, source: { sizing: sizingLibrary?.title || "Preliminary Refinery Vessel Sizing Logic", internals: internalsLibrary?.metadata?.title || "Vessel Preliminary Internals Logic" }, recommendation: { service_label: labels[service], orientation, orientation_decision: orientationAssessment.decision, orientation_reasons: orientationAssessment.reasons, working_volume_m3: workingVolumeM3, internal_diameter_mm: diameterM * 1000, tangent_length_mm: diameterM * lengthToDiameter * 1000, estimated_liquid_flow_m3_h: liquidFlow, gas_flow_m3_h: gasFlow, internals, derivation: { volume_basis: usedApiFallback ? "api_rp_12j_standard_vessel_candidate" : capacity ? "user_entered_working_capacity" : "liquid_flow_times_holdup", length_to_diameter_ratio: lengthToDiameter, diameter_formula: "D = cube root(4 × V / (π × L/D))", tangent_length_formula: "L = (L/D) × D" } }, api_rp_12j: apiAssessment, warnings, errors };
  }
  root.VesselSizingEngine = { assess, labels, apiWorkedExample };
})();
