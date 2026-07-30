(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};

  // FEED allowance based on the underground pump-installation arrangement:
  // a 24 in vessel nozzle/riser, 14 mm wall, 150 lb top flange allowance.
  const rule = {
    vesselNozzleNominalSizeIn: 24,
    vesselNozzleOutsideDiameterMm: 609.6,
    wallThicknessMm: 14,
    minimumProjectionAboveShellMm: 2000,
    steelDensityKgM3: 7850,
    flangeAndAttachmentAllowanceFraction: 0.2
  };

  function assess(input) {
    if (!input?.required) return { status: "not_applicable" };
    if (input.installationLocation !== "underground") {
      return { status: "blocked", errors: ["The automatic submersible-pump nozzle allowance applies to an underground vessel only."] };
    }
    const insideDiameterMm = rule.vesselNozzleOutsideDiameterMm - 2 * rule.wallThicknessMm;
    const steelAreaMm2 = Math.PI / 4 * (rule.vesselNozzleOutsideDiameterMm ** 2 - insideDiameterMm ** 2);
    const riserShellWeightKg = steelAreaMm2 * rule.minimumProjectionAboveShellMm / 1e9 * rule.steelDensityKgM3;
    const flangeAndAttachmentWeightKg = riserShellWeightKg * rule.flangeAndAttachmentAllowanceFraction;
    return {
      status: "preliminary_review_required",
      nozzleSizeIn: rule.vesselNozzleNominalSizeIn,
      wallThicknessMm: rule.wallThicknessMm,
      projectionAboveShellMm: rule.minimumProjectionAboveShellMm,
      riserShellWeightKg,
      flangeAndAttachmentWeightKg,
      totalWeightKg: riserShellWeightKg + flangeAndAttachmentWeightKg,
      message: "24 in NB vessel pump nozzle/riser with 150 lb top-flange allowance."
    };
  }

  root.PumpNozzleEngine = { assess, rule };
})();
