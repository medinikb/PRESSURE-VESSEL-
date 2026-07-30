(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const library = window.VESSELM_ASME_VIII1_TEST_PRESSURE_LIBRARY;

  function roundUp(value, increment) {
    return Math.ceil(value / increment) * increment;
  }

  function assess(input) {
    if (!input?.enabled) return { status: "not_requested" };
    const errors = [];
    if (!library) errors.push("The controlled ASME VIII-1 test-pressure logic library is unavailable.");
    if (!(Number.isFinite(input?.mawpMpa) && input.mawpMpa > 0)) errors.push("Calculated MAWP is required for the UG-99(b) preliminary hydrotest pressure.");
    if (!(Number.isFinite(input?.allowableStressDesignMpa) && input.allowableStressDesignMpa > 0)) errors.push("Design-temperature allowable stress is required.");
    if (!(Number.isFinite(input?.allowableStressTestMpa) && input.allowableStressTestMpa > 0)) errors.push("Test-temperature allowable stress is required.");
    if (errors.length) return { status: "blocked", errors };

    const lowestStressRatio = input.allowableStressTestMpa / input.allowableStressDesignMpa;
    const rawPressureMpa = library.hydrostaticTestFactor * input.mawpMpa * lowestStressRatio;
    const roundedPressureMpa = roundUp(rawPressureMpa, library.roundingIncrementMpa);
    return {
      status: "preliminary_review_required",
      methodId: library.methodId,
      codeReference: library.codeReference,
      pressureBasisMpa: input.mawpMpa,
      allowableStressDesignMpa: input.allowableStressDesignMpa,
      allowableStressTestMpa: input.allowableStressTestMpa,
      lowestStressRatio,
      rawPressureMpa,
      roundedPressureMpa,
      testMedium: library.defaultTestMedium,
      assumptions: [
        "Single pressure-chamber vessel",
        "Hydrostatic water test",
        "Gauge and vessel reference elevation assumed the same; hydrostatic-head correction not applied",
        "Ambient allowable stress is used as the preliminary test-temperature stress"
      ],
      warnings: [
        "Confirm the test-temperature allowable stress from a controlled code-compatible material record.",
        "Final test pressure, test supports, temporary closures, vents, bolting, test temperature and inspection remain for mechanical-engineering review."
      ]
    };
  }

  root.AsmeTestPressureEngine = { assess, library };
})();
