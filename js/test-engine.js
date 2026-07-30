(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const U = root.Utils;
  const DE = root.DesignEngine;
  const ME = root.MaterialEngine;
  const EPE = root.ExternalPressureEngine;
  const SE = root.SupportEngine;
  const PNE = root.PumpNozzleEngine;
  const NPE = root.NominalPlateEngine;
  const ATPE = root.AsmeTestPressureEngine;

  const unitTests = U.getPath("phase_05_verification_and_testing/unit_conversion_test_cases.json")?.test_cases || [];
  const logicTests = U.getPath("phase_05_verification_and_testing/decision_logic_test_cases.json")?.test_cases || [];
  const formulaTests = U.getPath("phase_06_preliminary_pressure_design/formula_test_cases.json")?.test_cases || [];

  function closeEnough(actual, expected, tolerance) {
    return Number.isFinite(actual) &&
      Math.abs(actual - expected) <= Math.max(tolerance, Math.abs(expected) * tolerance);
  }

  function runUnitTests() {
    return unitTests.map(test => {
      let actual = null;
      const i = test.input;
      if (["degC", "degF"].includes(i.from) && ["degC", "degF"].includes(i.to)) {
        actual = U.convertTemperature(i.value, i.from, i.to);
      } else if (U.pressureToMPa[i.from] && U.pressureToMPa[i.to]) {
        actual = U.convertPressure(i.value, i.from, i.to);
      } else if (U.lengthToMM[i.from] && U.lengthToMM[i.to]) {
        actual = U.convertLength(i.value, i.from, i.to);
      }
      return {
        id: test.id,
        group: "Unit conversion",
        passed: closeEnough(actual, test.expected, 1e-8),
        expected: test.expected,
        actual
      };
    });
  }

  function runDisplayPrecisionTests() {
    return [{
      id: "display-values-use-two-decimal-places-maximum",
      group: "Display precision",
      passed: U.formatNumber(15.806, 6) === "15.81" && U.formatNumber(12.34567, 3) === "12.35",
      expected: "15.806 displays as 15.81; no displayed value exceeds two decimals",
      actual: `${U.formatNumber(15.806, 6)}; ${U.formatNumber(12.34567, 3)}`
    }];
  }

  function normalizeLogicInput(input) {
    const unit = input.temperature_unit || "degF";
    return {
      equipment_tag: input.equipment_tag || "",
      minimum_temperature_f: Number.isFinite(input.minimum_design_temperature) ?
        U.convertTemperature(input.minimum_design_temperature, unit, "degF") : null,
      maximum_temperature_f: Number.isFinite(input.maximum_design_temperature) ?
        U.convertTemperature(input.maximum_design_temperature, unit, "degF") : null,
      selected_components: input.selected_components || [],
      service_flags: input.service_flags || [],
      override: input.override || { enabled: false }
    };
  }

  function runLogicTests() {
    return logicTests.map(test => {
      const result = ME.assess(normalizeLogicInput(test.input));
      let passed = true;
      const notes = [];

      if (test.expected_status && result.status !== test.expected_status) {
        passed = false;
        notes.push(`status ${result.status}`);
      }
      if (test.expected_message) {
        const has = [...(result.errors || []), ...(result.warnings || [])]
          .some(item => item.code === test.expected_message);
        if (!has) {
          passed = false;
          notes.push(`missing ${test.expected_message}`);
        }
      }
      if (test.expected_audit_events) {
        const events = (result.audit_events || []).map(item => item.type);
        for (const expected of test.expected_audit_events) {
          if (!events.includes(expected)) {
            passed = false;
            notes.push(`missing event ${expected}`);
          }
        }
      }
      return {
        id: test.id,
        group: "Decision logic",
        passed,
        expected: test.expected_status || test.expected_message || "configured outcome",
        actual: notes.length ? notes.join("; ") : result.status
      };
    });
  }

  function runFormulaTests() {
    return formulaTests.map(test => {
      const actual = DE.evaluateFormula(test.formula_id, test.inputs);
      return {
        id: test.id,
        group: "Formula",
        formula_id: test.formula_id,
        passed: closeEnough(actual, test.expected, 1e-6),
        expected: test.expected,
        actual
      };
    });
  }

  function runExternalPressureTests() {
    const referenceInput = {
      external_pressure_check_enabled: true,
      external_design_pressure_mpa: 0.101325,
      available_nominal_thickness: 20,
      external_unsupported_length_mm: 6000,
      diameter: 2000,
      diameter_basis: "inside",
      corrosion_allowance: 3,
      design_temperature: 200,
      material_specification: "SA-516",
      material_grade: "70"
    };
    const preview = EPE?.assess(referenceInput);
    const outOfRange = EPE?.assess({ ...referenceInput, external_unsupported_length_mm: 200000 });
    return [
      {
        id: "external-pressure-reference-preview-sa516-70",
        group: "External pressure",
        passed: preview?.status === "preliminary_pass_demonstration_only" && closeEnough(preview.allowableExternalPressureMpa, 0.4520929684, 1e-6),
        expected: "ASME 2021 reference-preview pass; Pa 0.452093 MPa",
        actual: preview ? `${preview.status}; Pa ${preview.allowableExternalPressureMpa}` : "engine unavailable"
      },
      {
        id: "external-pressure-no-figure-g-extrapolation",
        group: "External pressure",
        passed: outOfRange?.status === "blocked" && (outOfRange.errors || []).some(error => error.includes("will not extrapolate")),
        expected: "out-of-range Figure G input is blocked",
        actual: outOfRange?.status || "engine unavailable"
      }
    ];
  }

  function runExternalPressureWarningSuppressionTest() {
    const result = DE.calculate({
      controlled_code_edition: "ASME VIII-1 2023",
      allowable_stress_source_reference: "Regression check",
      design_pressure: 1,
      static_head_pressure: 0,
      pressure_unit: "MPa",
      allowable_stress_design: 120,
      allowable_stress_ambient: 120,
      stress_unit: "MPa",
      joint_efficiency: 1,
      corrosion_allowance: 3,
      forming_allowance: 0,
      other_allowance: 0,
      length_unit: "mm",
      component_type: "cylindrical_shell",
      diameter_basis: "inside",
      diameter: 2000,
      available_nominal_thickness: 25,
      external_pressure_check_enabled: true,
      enable_map_mawp: false,
      enable_hydrotest: false
    });
    return [{
      id: "external-pressure-warning-suppressed-when-check-selected",
      group: "External pressure",
      passed: !(result.warnings || []).some(item => item.code === "W_EXTERNAL_PRESSURE_NOT_CHECKED"),
      expected: "generic external-pressure-not-checked warning is absent",
      actual: (result.warnings || []).map(item => item.code).join(", ") || "no warnings"
    }];
  }

  function runAsmeHydrotestTests() {
    const result = ATPE?.assess({ enabled: true, mawpMpa: 1, allowableStressDesignMpa: 120, allowableStressTestMpa: 138 });
    const blocked = ATPE?.assess({ enabled: true, mawpMpa: null, allowableStressDesignMpa: 120, allowableStressTestMpa: 138 });
    return [
      {
        id: "asme-viii1-ug99b-preliminary-hydrotest",
        group: "ASME hydrotest",
        passed: result?.status === "preliminary_review_required" && closeEnough(result.roundedPressureMpa, 1.495, 1e-9),
        expected: "UG-99(b): 1.3 × 1.0 MPa × 138/120 = 1.495 MPa",
        actual: result ? `${result.roundedPressureMpa} MPa` : "engine unavailable"
      },
      {
        id: "asme-viii1-ug99b-requires-calculated-mawp",
        group: "ASME hydrotest",
        passed: blocked?.status === "blocked" && (blocked.errors || []).some(item => item.includes("Calculated MAWP")),
        expected: "calculation blocks without calculated MAWP",
        actual: blocked?.status || "engine unavailable"
      }
    ];
  }

  function runHeadFormingThinningTests() {
    const result = DE.calculate({
      controlled_code_edition: "ASME VIII-1 2023",
      formula_basis_confirmed: true,
      allowable_stress_source_reference: "Regression check",
      design_pressure: 13.5,
      static_head_pressure: 0,
      pressure_unit: "kgf_per_cm2",
      stress_unit: "MPa",
      allowable_stress_design: 128.24,
      allowable_stress_ambient: 128.24,
      joint_efficiency: 0.85,
      corrosion_allowance: 3,
      forming_allowance: 0,
      other_allowance: 0,
      head_forming_thinning_percent: 10,
      length_unit: "mm",
      component_type: "torispherical_generic_head",
      diameter_basis: "inside",
      diameter: 1150,
      crown_radius: 940,
      knuckle_radius: 175,
      available_nominal_thickness: 14,
      enable_map_mawp: false,
      enable_hydrotest: false
    });
    return [{
      id: "head-forming-thinning-percentage",
      group: "Head forming",
      passed: result.status === "preliminary_result_review_required" && closeEnough(result.minimum_required_new_thickness_mm, 11.7754941128, 1e-6) && closeEnough(result.additions_mm.retained_formed_thickness_fraction, 0.9, 1e-8),
      expected: "10% head thinning uses retained thickness fraction 0.90",
      actual: `${result.status}; required ${result.minimum_required_new_thickness_mm} mm`
    }];
  }

  function runSupportAllowanceTests() {
    const horizontal = SE?.estimate({ orientation: "horizontal", diameterMm: 2000, tangentLengthMm: 7000, shellThicknessMm: 16 });
    const vertical = SE?.estimate({ orientation: "vertical", diameterMm: 2000, tangentLengthMm: 7000, shellThicknessMm: 16 });
    return [
      {
        id: "support-horizontal-two-saddles-long-span-review",
        group: "Support allowance",
        passed: horizontal?.supportType.includes("Two saddles") && horizontal?.longSpanReview === true && horizontal?.installedWeightKg > 0,
        expected: "two saddles with a review message above 4 m spacing",
        actual: horizontal ? `${horizontal.supportType}; ${horizontal.saddleSpacingMm} mm` : "engine unavailable"
      },
      {
        id: "support-vertical-skirt",
        group: "Support allowance",
        passed: vertical?.supportType === "Skirt support" && vertical?.installedWeightKg > 0,
        expected: "one skirt support with positive FEED weight",
        actual: vertical ? `${vertical.supportType}; ${vertical.installedWeightKg} kg` : "engine unavailable"
      }
    ];
  }

  function runPumpNozzleAllowanceTests() {
    const estimate = PNE?.assess({ required: true, installationLocation: "underground" });
    return [{
      id: "pump-nozzle-underground-feed-allowance",
      group: "Pump nozzle allowance",
      passed: estimate?.nozzleSizeIn === 24 && estimate?.wallThicknessMm === 14 && estimate?.projectionAboveShellMm === 2000 && estimate?.totalWeightKg > 0,
      expected: "24 in NB, 14 mm wall, 2.0 m underground pump-nozzle allowance",
      actual: estimate ? `${estimate.nozzleSizeIn} in; ${estimate.wallThicknessMm} mm; ${estimate.projectionAboveShellMm} mm` : "engine unavailable"
    }];
  }

  function runNominalPlateSelectionTests() {
    const example = NPE?.select(20.6);
    const heavy = NPE?.select(80.1);
    return [
      {
        id: "nominal-plate-library-rounds-20-6-to-22",
        group: "Nominal plate selection",
        passed: example?.status === "selected" && example.selectedNominalThicknessMm === 22 && example.costRateBandId === "PV_PLATE_022_040",
        expected: "20.6 mm selects 22 mm in the VesselM FEED series",
        actual: example ? `${example.selectedNominalThicknessMm} mm; ${example.costRateBandId}` : "engine unavailable"
      },
      {
        id: "nominal-plate-library-rounds-above-80-to-90",
        group: "Nominal plate selection",
        passed: heavy?.status === "selected" && heavy.selectedNominalThicknessMm === 90,
        expected: "80.1 mm selects 90 mm in the VesselM FEED series",
        actual: heavy ? `${heavy.selectedNominalThicknessMm} mm` : "engine unavailable"
      }
    ];
  }

  function runNominalPlateWarningTests() {
    const result = DE.calculate({
      controlled_code_edition: "ASME VIII-1 2023",
      allowable_stress_source_reference: "Regression check",
      design_pressure: 1,
      static_head_pressure: 0,
      pressure_unit: "MPa",
      allowable_stress_design: 120,
      allowable_stress_ambient: 120,
      stress_unit: "MPa",
      joint_efficiency: 1,
      corrosion_allowance: 3,
      forming_allowance: 0,
      other_allowance: 0,
      length_unit: "mm",
      component_type: "cylindrical_shell",
      diameter_basis: "inside",
      diameter: 2000,
      available_nominal_thickness: null,
      enable_map_mawp: false,
      enable_hydrotest: false
    });
    return [{
      id: "nominal-plate-library-missing-warning-removed",
      group: "Nominal plate selection",
      passed: !(result.warnings || []).some(item => item.code === "W_NOMINAL_THICKNESS_LIBRARY_MISSING"),
      expected: "no obsolete nominal-library-missing warning",
      actual: (result.warnings || []).map(item => item.code).join(", ") || "no warnings"
    }];
  }

  function runAll() {
    const results = [
      ...runUnitTests(),
      ...runDisplayPrecisionTests(),
      ...runLogicTests(),
      ...runFormulaTests(),
      ...runExternalPressureTests(),
      ...runExternalPressureWarningSuppressionTest(),
      ...runAsmeHydrotestTests(),
      ...runHeadFormingThinningTests(),
      ...runSupportAllowanceTests(),
      ...runPumpNozzleAllowanceTests(),
      ...runNominalPlateSelectionTests(),
      ...runNominalPlateWarningTests()
    ];
    return {
      generated_at: U.timestamp(),
      total: results.length,
      passed: results.filter(item => item.passed).length,
      failed: results.filter(item => !item.passed).length,
      results
    };
  }

  root.TestEngine = {
    runUnitTests,
    runDisplayPrecisionTests,
    runLogicTests,
    runFormulaTests,
    runExternalPressureTests,
    runExternalPressureWarningSuppressionTest,
    runAsmeHydrotestTests,
    runHeadFormingThinningTests,
    runSupportAllowanceTests,
    runPumpNozzleAllowanceTests,
    runNominalPlateSelectionTests,
    runNominalPlateWarningTests,
    runAll
  };
})();
