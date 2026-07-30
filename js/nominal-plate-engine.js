(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};
  const library = window.VESSELM_NOMINAL_PLATE_THICKNESS_LIBRARY;

  function preferredSeries() {
    return library?.selection_policy?.series?.find(item => item.series_id === library.selection_policy.default_series_id)?.values_mm || [];
  }

  function select(requiredPurchaseThicknessMm) {
    const series = preferredSeries();
    if (!(Number.isFinite(requiredPurchaseThicknessMm) && requiredPurchaseThicknessMm > 0)) {
      return { status: "blocked", errors: ["A positive required purchase thickness is needed for nominal plate selection."] };
    }
    if (!series.length) return { status: "blocked", errors: ["The controlled nominal plate-thickness library is unavailable."] };
    const selectedNominalThicknessMm = series.find(value => value >= requiredPurchaseThicknessMm);
    if (!selectedNominalThicknessMm) {
      return { status: "blocked", errors: [`Required thickness ${requiredPurchaseThicknessMm.toFixed(2)} mm is above the ${series.at(-1)} mm FEED library maximum. Obtain vendor and engineering input.`] };
    }
    const record = library.records?.find(item => item.nominal_thickness_mm === selectedNominalThicknessMm) || null;
    return {
      status: "selected",
      requiredPurchaseThicknessMm,
      selectedNominalThicknessMm,
      thicknessMarginMm: selectedNominalThicknessMm - requiredPurchaseThicknessMm,
      selectionSeriesId: library.selection_policy.default_series_id,
      availabilityClass: record?.availability_class || "not recorded",
      procurementRisk: record?.procurement_risk || "not recorded",
      costRateBandId: record?.cost_rate_band_id || null,
      source: `${library.metadata.library_id} v${library.metadata.library_version}`
    };
  }

  root.NominalPlateEngine = { select, preferredSeries, library };
})();
