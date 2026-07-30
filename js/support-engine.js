(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};

  // These transparent FEED rules are derived from the controlled skirt/saddle
  // library. They deliberately avoid presenting a final support design.
  const rules = {
    steelDensityKgM3: 7850,
    horizontal: {
      saddleCount: 2,
      tangentFraction: 0.2,
      maximumTangentDistanceDiameterFactor: 0.5,
      longSpanReviewMm: 4000,
      minimumSaddleWidthMm: 400,
      saddleWidthDiameterFactor: 0.2,
      minimumSaddleHeightMm: 300,
      maximumSaddleHeightMm: 1200,
      saddleHeightDiameterFactor: 0.25,
      basePlateThicknessMm: 20,
      minimumWebThicknessMm: 10,
      miscellaneousFraction: 0.1
    },
    vertical: {
      minimumSkirtHeightMm: 1500,
      skirtHeightDiameterFactor: 0.35,
      minimumSkirtThicknessMm: 8,
      minimumBaseRingThicknessMm: 20,
      miscellaneousFraction: 0.05
    }
  };

  function finitePositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  function roundUp(value, increment) {
    return Math.ceil(value / increment) * increment;
  }

  function massFromVolumeMm3(volumeMm3) {
    return volumeMm3 / 1e9 * rules.steelDensityKgM3;
  }

  function selectVerticalSkirt(input) {
    const rule = rules.vertical;
    const skirtHeightMm = roundUp(Math.max(rule.minimumSkirtHeightMm, rule.skirtHeightDiameterFactor * input.diameterMm), 50);
    const skirtThicknessMm = roundUp(Math.max(rule.minimumSkirtThicknessMm, Math.min(input.shellThicknessMm, 20)), 2);
    const baseRingThicknessMm = roundUp(Math.max(rule.minimumBaseRingThicknessMm, 1.25 * skirtThicknessMm), 2);
    const skirtMassKg = massFromVolumeMm3(Math.PI * input.diameterMm * skirtHeightMm * skirtThicknessMm);
    const baseRingOuterDiameterMm = input.diameterMm + 300;
    const baseRingInnerDiameterMm = Math.max(0, input.diameterMm - 100);
    const baseRingMassKg = massFromVolumeMm3(Math.PI / 4 * (baseRingOuterDiameterMm ** 2 - baseRingInnerDiameterMm ** 2) * baseRingThicknessMm);
    const structuralWeightKg = skirtMassKg + baseRingMassKg;
    const miscellaneousWeightKg = structuralWeightKg * rule.miscellaneousFraction;
    return {
      status: "preliminary_review_required",
      supportType: "Skirt support",
      supportCount: 1,
      installedWeightKg: structuralWeightKg + miscellaneousWeightKg,
      details: [
        `Skirt height: ${Math.round(skirtHeightMm)} mm`,
        `Skirt plate: ${Math.round(skirtThicknessMm)} mm`,
        `Base ring: ${Math.round(baseRingThicknessMm)} mm`,
        `Includes ${Math.round(rule.miscellaneousFraction * 100)}% attachments allowance`
      ],
      message: "One skirt support is automatically allowed for this vertical vessel."
    };
  }

  function selectHorizontalSaddles(input) {
    const rule = rules.horizontal;
    const distanceFromTangentMm = roundUp(Math.min(rule.tangentFraction * input.tangentLengthMm, rule.maximumTangentDistanceDiameterFactor * input.diameterMm), 50);
    const saddleSpacingMm = input.tangentLengthMm - 2 * distanceFromTangentMm;
    const saddleWidthMm = roundUp(Math.max(rule.minimumSaddleWidthMm, rule.saddleWidthDiameterFactor * input.diameterMm), 50);
    const saddleHeightMm = roundUp(Math.min(rule.maximumSaddleHeightMm, Math.max(rule.minimumSaddleHeightMm, rule.saddleHeightDiameterFactor * input.diameterMm)), 50);
    const webThicknessMm = roundUp(Math.max(rule.minimumWebThicknessMm, 0.75 * input.shellThicknessMm), 2);
    const basePlateThicknessMm = roundUp(Math.max(rule.basePlateThicknessMm, 1.25 * webThicknessMm), 2);
    const baseWidthMm = roundUp(Math.max(0.9 * input.diameterMm, 0.6 * input.diameterMm + 200), 50);
    const baseLengthMm = saddleWidthMm + 200;
    const wrapArcMm = Math.PI * input.diameterMm / 3;
    const wearPlateMassKg = massFromVolumeMm3(wrapArcMm * (saddleWidthMm + 100) * Math.max(10, input.shellThicknessMm));
    const twoWebsMassKg = massFromVolumeMm3(2 * 0.5 * (0.6 * input.diameterMm + baseWidthMm) * saddleHeightMm * webThicknessMm);
    const basePlateMassKg = massFromVolumeMm3(baseWidthMm * baseLengthMm * basePlateThicknessMm);
    const gussetMassKg = massFromVolumeMm3(4 * 0.5 * saddleHeightMm * (0.3 * baseLengthMm) * Math.max(8, 0.75 * webThicknessMm));
    const singleSaddleStructuralWeightKg = wearPlateMassKg + twoWebsMassKg + basePlateMassKg + gussetMassKg;
    const fixedSaddleWeightKg = singleSaddleStructuralWeightKg * 1.05;
    const slidingSaddleWeightKg = singleSaddleStructuralWeightKg * 1.02 + massFromVolumeMm3(baseWidthMm * baseLengthMm * 3);
    const subtotalKg = fixedSaddleWeightKg + slidingSaddleWeightKg;
    const miscellaneousWeightKg = subtotalKg * rule.miscellaneousFraction;
    const longSpanReview = saddleSpacingMm > rule.longSpanReviewMm;
    return {
      status: "preliminary_review_required",
      supportType: "Two saddles — one fixed and one sliding",
      supportCount: rule.saddleCount,
      installedWeightKg: subtotalKg + miscellaneousWeightKg,
      saddleSpacingMm,
      distanceFromTangentMm,
      longSpanReview,
      details: [
        `Fixed saddle: ${Math.round(distanceFromTangentMm)} mm from left tangent line`,
        `Sliding saddle: ${Math.round(distanceFromTangentMm)} mm from right tangent line`,
        `Saddle centre-to-centre spacing: ${Math.round(saddleSpacingMm)} mm`,
        `Preliminary saddle width: ${Math.round(saddleWidthMm)} mm`,
        `Includes ${Math.round(rule.miscellaneousFraction * 100)}% attachments allowance`
      ],
      message: "Two saddles are automatically allowed for this horizontal vessel so normal thermal movement can be accommodated."
    };
  }

  function estimate(input) {
    const errors = [];
    if (!["vertical", "horizontal"].includes(input?.orientation)) errors.push("Select vessel orientation to estimate supports.");
    if (!finitePositive(input?.diameterMm)) errors.push("A vessel diameter is needed to estimate supports.");
    if (!finitePositive(input?.shellThicknessMm)) errors.push("A selected nominal shell thickness is needed to estimate supports.");
    if (input?.orientation === "horizontal" && !finitePositive(input?.tangentLengthMm)) errors.push("A tangent-line length is needed to estimate two saddles.");
    if (errors.length) return { status: "blocked", errors };
    return input.orientation === "horizontal" ? selectHorizontalSaddles(input) : selectVerticalSkirt(input);
  }

  root.SupportEngine = { estimate, rules };
})();
