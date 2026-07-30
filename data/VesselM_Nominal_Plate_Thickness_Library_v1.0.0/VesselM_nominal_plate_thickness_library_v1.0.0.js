window.VESSELM_NOMINAL_PLATE_THICKNESS_LIBRARY = {
  "metadata": {
    "library_id": "VESSELM_NOMINAL_PLATE_THICKNESS_LIBRARY",
    "library_version": "1.0.0",
    "product": "VesselM",
    "purpose": "Preliminary nominal plate-thickness selection, weight estimation and cost-rate banding for pressure-vessel FEED.",
    "geographic_basis": "India",
    "estimate_stage": "FEED",
    "generated_utc": "2026-07-30T09:35:41.862178+00:00",
    "construction_use_allowed": false,
    "purchase_order_use_allowed_without_vendor_confirmation": false,
    "engineering_review_required": true,
    "default_unit": "mm"
  },
  "scope": {
    "primary_use": [
      "carbon-steel and low-alloy pressure-vessel shell plate",
      "formed-head blank preliminary selection",
      "external-pressure trial-thickness iteration",
      "vessel weight estimation",
      "plate cost-rate band assignment"
    ],
    "not_intended_for": [
      "final plate availability commitment",
      "final mill tolerance deduction",
      "final head forming allowance",
      "final procurement dimensions",
      "automatic material specification selection",
      "cladding-layer thickness selection"
    ]
  },
  "source_basis": [
    {
      "source_id": "AMNS_INDIA_HEAVY_PLATES_2026",
      "organization": "AM/NS India",
      "source_type": "official_manufacturer_capability",
      "thickness_range_mm": {
        "minimum": 6,
        "maximum": 150
      },
      "maximum_width_mm": 4900,
      "maximum_length_mm": 25000,
      "maximum_unit_plate_weight_kg": 17000,
      "application_includes": "boilers_and_pressure_vessels",
      "source_url": "https://www.amns.in/products/heavy-plates",
      "library_use": "broad Indian heavy-plate capability envelope"
    },
    {
      "source_id": "SAIL_RSP_NEW_PLATE_MILL_2026",
      "organization": "Steel Authority of India Limited",
      "source_type": "official_manufacturer_capability",
      "thickness_range_mm": {
        "minimum": 10,
        "maximum": 100
      },
      "width_range_mm": {
        "minimum": 1500,
        "maximum": 4100
      },
      "length_range_mm": {
        "minimum": 6000,
        "maximum": 12000
      },
      "source_url": "https://www.sail.co.in/en/mild-steel-plate-mill-plates-rsp",
      "library_use": "commercial availability cross-check"
    },
    {
      "source_id": "SAIL_BHILAI_PLATE_MILL_2026",
      "organization": "Steel Authority of India Limited",
      "source_type": "official_manufacturer_capability",
      "thickness_range_mm": {
        "minimum": 8,
        "maximum": 120
      },
      "width_range_mm": {
        "minimum": 1500,
        "maximum": 3270
      },
      "length_range_mm": {
        "minimum": 5000,
        "maximum": 12500
      },
      "source_url": "https://sail.co.in/en/plants/bhilai-steel-plant/facilities",
      "library_use": "commercial availability cross-check"
    }
  ],
  "important_interpretation": {
    "preferred_series_status": "VesselM FEED rounding convention, not a universal mill standard.",
    "mill_availability_rule": "A thickness within a published mill range is not automatically available for every material grade, heat-treatment condition, width, length, unit weight or order quantity.",
    "vendor_confirmation_required_when": [
      "nominal thickness is above 80 mm",
      "plate width exceeds 3000 mm",
      "normalized, normalized-rolled, TMCP, quenched-and-tempered or special condition is required",
      "special ASME grade or supplementary requirements apply",
      "head blank size or forming route is not established",
      "single plate weight is high",
      "delivery schedule is critical"
    ]
  },
  "selection_policy": {
    "default_series_id": "india_FEED_preferred",
    "series": [
      {
        "series_id": "india_FEED_preferred",
        "description": "Preferred discrete nominal thicknesses for preliminary vessel weight and cost estimation.",
        "values_mm": [
          6,
          8,
          10,
          12,
          14,
          16,
          18,
          20,
          22,
          25,
          28,
          30,
          32,
          35,
          40,
          45,
          50,
          55,
          60,
          65,
          70,
          75,
          80,
          90,
          100,
          110,
          120,
          130,
          140,
          150
        ]
      },
      {
        "series_id": "engineering_iteration_extended",
        "description": "Fine candidate series for numerical thickness iteration. Final result must be rounded to the preferred series or a vendor-confirmed custom thickness.",
        "values_mm": [
          6,
          7,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          16,
          17,
          18,
          19,
          20,
          21,
          22,
          23,
          24,
          25,
          26,
          27,
          28,
          29,
          30,
          31,
          32,
          33,
          34,
          35,
          36,
          37,
          38,
          39,
          40,
          42,
          44,
          46,
          48,
          50,
          52,
          54,
          56,
          58,
          60,
          65,
          70,
          75,
          80,
          85,
          90,
          95,
          100,
          110,
          120,
          130,
          140,
          150
        ]
      }
    ],
    "rounding_logic": {
      "input": "minimum_required_purchase_thickness_mm",
      "default_action": "Select the smallest preferred nominal thickness greater than or equal to the minimum required purchase thickness.",
      "custom_thickness_action": "Permit a custom result only when user enables custom rolling and records vendor confirmation.",
      "above_library_maximum_action": "vendor_engineering_input_required",
      "below_library_minimum_action": "Select 6 mm for the pressure-boundary FEED estimate unless the project minimum is higher."
    },
    "minimum_practical_FEED_thickness_mm": {
      "default": 6,
      "project_override_allowed": true,
      "note": "This is a VesselM estimating default, not an ASME universal minimum."
    }
  },
  "component_rules": {
    "cylindrical_shell": {
      "candidate_basis": "maximum of internal-pressure requirement, external-pressure requirement, structural-load requirement, project minimum and corrosion-adjusted requirement",
      "forming_allowance_default_mm": 0,
      "rounding_series": "india_FEED_preferred"
    },
    "formed_head_blank": {
      "candidate_basis": "required minimum thickness after forming plus corrosion allowance and forming thinning allowance",
      "forming_thinning_input_required": true,
      "default_FEED_forming_thinning_percent": {
        "two_to_one_ellipsoidal": 10,
        "torispherical": 15,
        "hemispherical": 10,
        "conical": 5
      },
      "warning": "Default thinning percentages are estimating assumptions only and must be replaced by vendor or fabricator data for final design.",
      "purchase_thickness_formula": "t_blank_min = (t_required_after_forming + corrosion_allowance + other_deductions) / (1 - forming_thinning_percent/100)",
      "rounding_series": "india_FEED_preferred"
    },
    "clad_plate_base_backing": {
      "rule": "Select carbon-steel backing thickness using the pressure-boundary rules. Add cladding thickness separately unless a controlled composite-strength calculation is approved."
    }
  },
  "mill_tolerance_policy": {
    "automatic_deduction_default": false,
    "reason": "Plate thickness tolerance treatment depends on the governing material specification, ordering basis, Code rules and project requirements.",
    "required_inputs_when_enabled": [
      "material_specification",
      "ordered_thickness_basis",
      "governing_tolerance_standard",
      "negative_tolerance_mm_or_percent",
      "engineering_approval_reference"
    ],
    "manufacturer_reference_profile_not_for_automatic_design": [
      {
        "nominal_min_mm": 6,
        "nominal_max_exclusive_mm": 8,
        "example_tolerance_mm": 0.3
      },
      {
        "nominal_min_mm": 8,
        "nominal_max_exclusive_mm": 15,
        "example_tolerance_mm": 0.4
      },
      {
        "nominal_min_mm": 15,
        "nominal_max_exclusive_mm": 25,
        "example_tolerance_mm": 0.5
      },
      {
        "nominal_min_mm": 25,
        "nominal_max_exclusive_mm": 40,
        "example_tolerance_mm": 0.6
      },
      {
        "nominal_min_mm": 40,
        "nominal_max_exclusive_mm": 60,
        "example_tolerance_mm": 0.8
      },
      {
        "nominal_min_mm": 60,
        "nominal_max_exclusive_mm": 80,
        "example_tolerance_mm": 1.0
      },
      {
        "nominal_min_mm": 80,
        "nominal_max_exclusive_mm": 100,
        "example_tolerance_mm": 1.2
      },
      {
        "nominal_min_mm": 100,
        "nominal_max_exclusive_mm": 150,
        "example_tolerance_mm": 1.6
      }
    ]
  },
  "cost_rate_bands": [
    {
      "rate_band_id": "PV_PLATE_006_012",
      "thickness_min_mm": 6,
      "thickness_max_mm": 12,
      "rate_input_required": true
    },
    {
      "rate_band_id": "PV_PLATE_014_020",
      "thickness_min_mm": 14,
      "thickness_max_mm": 20,
      "rate_input_required": true
    },
    {
      "rate_band_id": "PV_PLATE_022_040",
      "thickness_min_mm": 22,
      "thickness_max_mm": 40,
      "rate_input_required": true
    },
    {
      "rate_band_id": "PV_PLATE_045_060",
      "thickness_min_mm": 45,
      "thickness_max_mm": 60,
      "rate_input_required": true
    },
    {
      "rate_band_id": "PV_PLATE_065_080",
      "thickness_min_mm": 65,
      "thickness_max_mm": 80,
      "rate_input_required": true
    },
    {
      "rate_band_id": "PV_PLATE_090_100",
      "thickness_min_mm": 90,
      "thickness_max_mm": 100,
      "rate_input_required": true
    },
    {
      "rate_band_id": "PV_PLATE_110_150_VENDOR",
      "thickness_min_mm": 110,
      "thickness_max_mm": 150,
      "rate_input_required": true,
      "vendor_quote_preferred": true
    }
  ],
  "weight_formulas": {
    "plate_weight_kg": "area_m2 * nominal_thickness_mm / 1000 * density_kg_m3",
    "unit_area_weight_kg_m2": "nominal_thickness_mm / 1000 * density_kg_m3",
    "carbon_steel_shortcut": "unit_area_weight_kg_m2 = 7.85 * nominal_thickness_mm"
  },
  "required_output_fields": [
    "required_net_thickness_mm",
    "corrosion_allowance_mm",
    "forming_allowance_mm",
    "other_deductions_mm",
    "minimum_required_purchase_thickness_mm",
    "selected_nominal_thickness_mm",
    "selection_series_id",
    "availability_class",
    "procurement_risk",
    "cost_rate_band_id",
    "unit_area_weight_kg_m2",
    "vendor_confirmation_required",
    "warnings"
  ],
  "validation_rules": [
    {
      "rule_id": "PLATE_001",
      "condition": "minimum_required_purchase_thickness_mm <= 0",
      "result": "blocked",
      "message": "Required purchase thickness must be positive."
    },
    {
      "rule_id": "PLATE_002",
      "condition": "minimum_required_purchase_thickness_mm > 150",
      "result": "manual_vendor_engineering",
      "message": "Thickness exceeds the embedded Indian heavy-plate capability envelope."
    },
    {
      "rule_id": "PLATE_003",
      "condition": "selected_thickness_not_in_preferred_series",
      "result": "warning",
      "message": "Custom rolling or special-order thickness requires vendor confirmation."
    },
    {
      "rule_id": "PLATE_004",
      "condition": "nominal_thickness_mm > 80",
      "result": "warning",
      "message": "Heavy plate procurement, heat treatment, forming and delivery require early vendor confirmation."
    },
    {
      "rule_id": "PLATE_005",
      "condition": "forming_head_and_forming_thinning_not_defined",
      "result": "blocked",
      "message": "Head blank selection requires forming-thinning allowance."
    }
  ],
  "records": [
    {
      "nominal_thickness_mm": 6,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 47.1,
        "stainless_steel_density_8000_kg_m3": 48.0,
        "alloy_625_density_8440_kg_m3": 50.64,
        "titanium_gr2_density_4510_kg_m3": 27.06
      }
    },
    {
      "nominal_thickness_mm": 7,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 54.95,
        "stainless_steel_density_8000_kg_m3": 56.0,
        "alloy_625_density_8440_kg_m3": 59.08,
        "titanium_gr2_density_4510_kg_m3": 31.57
      }
    },
    {
      "nominal_thickness_mm": 8,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 62.8,
        "stainless_steel_density_8000_kg_m3": 64.0,
        "alloy_625_density_8440_kg_m3": 67.52,
        "titanium_gr2_density_4510_kg_m3": 36.08
      }
    },
    {
      "nominal_thickness_mm": 9,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 70.65,
        "stainless_steel_density_8000_kg_m3": 72.0,
        "alloy_625_density_8440_kg_m3": 75.96,
        "titanium_gr2_density_4510_kg_m3": 40.59
      }
    },
    {
      "nominal_thickness_mm": 10,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 78.5,
        "stainless_steel_density_8000_kg_m3": 80.0,
        "alloy_625_density_8440_kg_m3": 84.4,
        "titanium_gr2_density_4510_kg_m3": 45.1
      }
    },
    {
      "nominal_thickness_mm": 11,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 86.35,
        "stainless_steel_density_8000_kg_m3": 88.0,
        "alloy_625_density_8440_kg_m3": 92.84,
        "titanium_gr2_density_4510_kg_m3": 49.61
      }
    },
    {
      "nominal_thickness_mm": 12,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_006_012",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 94.2,
        "stainless_steel_density_8000_kg_m3": 96.0,
        "alloy_625_density_8440_kg_m3": 101.28,
        "titanium_gr2_density_4510_kg_m3": 54.12
      }
    },
    {
      "nominal_thickness_mm": 13,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 102.05,
        "stainless_steel_density_8000_kg_m3": 104.0,
        "alloy_625_density_8440_kg_m3": 109.72,
        "titanium_gr2_density_4510_kg_m3": 58.63
      }
    },
    {
      "nominal_thickness_mm": 14,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 109.9,
        "stainless_steel_density_8000_kg_m3": 112.0,
        "alloy_625_density_8440_kg_m3": 118.16,
        "titanium_gr2_density_4510_kg_m3": 63.14
      }
    },
    {
      "nominal_thickness_mm": 15,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 117.75,
        "stainless_steel_density_8000_kg_m3": 120.0,
        "alloy_625_density_8440_kg_m3": 126.6,
        "titanium_gr2_density_4510_kg_m3": 67.65
      }
    },
    {
      "nominal_thickness_mm": 16,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 125.6,
        "stainless_steel_density_8000_kg_m3": 128.0,
        "alloy_625_density_8440_kg_m3": 135.04,
        "titanium_gr2_density_4510_kg_m3": 72.16
      }
    },
    {
      "nominal_thickness_mm": 17,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 133.45,
        "stainless_steel_density_8000_kg_m3": 136.0,
        "alloy_625_density_8440_kg_m3": 143.48,
        "titanium_gr2_density_4510_kg_m3": 76.67
      }
    },
    {
      "nominal_thickness_mm": 18,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 141.3,
        "stainless_steel_density_8000_kg_m3": 144.0,
        "alloy_625_density_8440_kg_m3": 151.92,
        "titanium_gr2_density_4510_kg_m3": 81.18
      }
    },
    {
      "nominal_thickness_mm": 19,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 149.15,
        "stainless_steel_density_8000_kg_m3": 152.0,
        "alloy_625_density_8440_kg_m3": 160.36,
        "titanium_gr2_density_4510_kg_m3": 85.69
      }
    },
    {
      "nominal_thickness_mm": 20,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_014_020",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 157.0,
        "stainless_steel_density_8000_kg_m3": 160.0,
        "alloy_625_density_8440_kg_m3": 168.8,
        "titanium_gr2_density_4510_kg_m3": 90.2
      }
    },
    {
      "nominal_thickness_mm": 21,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 164.85,
        "stainless_steel_density_8000_kg_m3": 168.0,
        "alloy_625_density_8440_kg_m3": 177.24,
        "titanium_gr2_density_4510_kg_m3": 94.71
      }
    },
    {
      "nominal_thickness_mm": 22,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 172.7,
        "stainless_steel_density_8000_kg_m3": 176.0,
        "alloy_625_density_8440_kg_m3": 185.68,
        "titanium_gr2_density_4510_kg_m3": 99.22
      }
    },
    {
      "nominal_thickness_mm": 23,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 180.55,
        "stainless_steel_density_8000_kg_m3": 184.0,
        "alloy_625_density_8440_kg_m3": 194.12,
        "titanium_gr2_density_4510_kg_m3": 103.73
      }
    },
    {
      "nominal_thickness_mm": 24,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 188.4,
        "stainless_steel_density_8000_kg_m3": 192.0,
        "alloy_625_density_8440_kg_m3": 202.56,
        "titanium_gr2_density_4510_kg_m3": 108.24
      }
    },
    {
      "nominal_thickness_mm": 25,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 196.25,
        "stainless_steel_density_8000_kg_m3": 200.0,
        "alloy_625_density_8440_kg_m3": 211.0,
        "titanium_gr2_density_4510_kg_m3": 112.75
      }
    },
    {
      "nominal_thickness_mm": 26,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 204.1,
        "stainless_steel_density_8000_kg_m3": 208.0,
        "alloy_625_density_8440_kg_m3": 219.44,
        "titanium_gr2_density_4510_kg_m3": 117.26
      }
    },
    {
      "nominal_thickness_mm": 27,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 211.95,
        "stainless_steel_density_8000_kg_m3": 216.0,
        "alloy_625_density_8440_kg_m3": 227.88,
        "titanium_gr2_density_4510_kg_m3": 121.77
      }
    },
    {
      "nominal_thickness_mm": 28,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 219.8,
        "stainless_steel_density_8000_kg_m3": 224.0,
        "alloy_625_density_8440_kg_m3": 236.32,
        "titanium_gr2_density_4510_kg_m3": 126.28
      }
    },
    {
      "nominal_thickness_mm": 29,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 227.65,
        "stainless_steel_density_8000_kg_m3": 232.0,
        "alloy_625_density_8440_kg_m3": 244.76,
        "titanium_gr2_density_4510_kg_m3": 130.79
      }
    },
    {
      "nominal_thickness_mm": 30,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 235.5,
        "stainless_steel_density_8000_kg_m3": 240.0,
        "alloy_625_density_8440_kg_m3": 253.2,
        "titanium_gr2_density_4510_kg_m3": 135.3
      }
    },
    {
      "nominal_thickness_mm": 31,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 243.35,
        "stainless_steel_density_8000_kg_m3": 248.0,
        "alloy_625_density_8440_kg_m3": 261.64,
        "titanium_gr2_density_4510_kg_m3": 139.81
      }
    },
    {
      "nominal_thickness_mm": 32,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 251.2,
        "stainless_steel_density_8000_kg_m3": 256.0,
        "alloy_625_density_8440_kg_m3": 270.08,
        "titanium_gr2_density_4510_kg_m3": 144.32
      }
    },
    {
      "nominal_thickness_mm": 33,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 259.05,
        "stainless_steel_density_8000_kg_m3": 264.0,
        "alloy_625_density_8440_kg_m3": 278.52,
        "titanium_gr2_density_4510_kg_m3": 148.83
      }
    },
    {
      "nominal_thickness_mm": 34,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 266.9,
        "stainless_steel_density_8000_kg_m3": 272.0,
        "alloy_625_density_8440_kg_m3": 286.96,
        "titanium_gr2_density_4510_kg_m3": 153.34
      }
    },
    {
      "nominal_thickness_mm": 35,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 274.75,
        "stainless_steel_density_8000_kg_m3": 280.0,
        "alloy_625_density_8440_kg_m3": 295.4,
        "titanium_gr2_density_4510_kg_m3": 157.85
      }
    },
    {
      "nominal_thickness_mm": 36,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 282.6,
        "stainless_steel_density_8000_kg_m3": 288.0,
        "alloy_625_density_8440_kg_m3": 303.84,
        "titanium_gr2_density_4510_kg_m3": 162.36
      }
    },
    {
      "nominal_thickness_mm": 37,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 290.45,
        "stainless_steel_density_8000_kg_m3": 296.0,
        "alloy_625_density_8440_kg_m3": 312.28,
        "titanium_gr2_density_4510_kg_m3": 166.87
      }
    },
    {
      "nominal_thickness_mm": 38,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 298.3,
        "stainless_steel_density_8000_kg_m3": 304.0,
        "alloy_625_density_8440_kg_m3": 320.72,
        "titanium_gr2_density_4510_kg_m3": 171.38
      }
    },
    {
      "nominal_thickness_mm": 39,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 306.15,
        "stainless_steel_density_8000_kg_m3": 312.0,
        "alloy_625_density_8440_kg_m3": 329.16,
        "titanium_gr2_density_4510_kg_m3": 175.89
      }
    },
    {
      "nominal_thickness_mm": 40,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_common",
      "procurement_risk": "low_to_medium",
      "cost_rate_band_id": "PV_PLATE_022_040",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 314.0,
        "stainless_steel_density_8000_kg_m3": 320.0,
        "alloy_625_density_8440_kg_m3": 337.6,
        "titanium_gr2_density_4510_kg_m3": 180.4
      }
    },
    {
      "nominal_thickness_mm": 42,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 329.7,
        "stainless_steel_density_8000_kg_m3": 336.0,
        "alloy_625_density_8440_kg_m3": 354.48,
        "titanium_gr2_density_4510_kg_m3": 189.42
      }
    },
    {
      "nominal_thickness_mm": 44,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 345.4,
        "stainless_steel_density_8000_kg_m3": 352.0,
        "alloy_625_density_8440_kg_m3": 371.36,
        "titanium_gr2_density_4510_kg_m3": 198.44
      }
    },
    {
      "nominal_thickness_mm": 46,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 361.1,
        "stainless_steel_density_8000_kg_m3": 368.0,
        "alloy_625_density_8440_kg_m3": 388.24,
        "titanium_gr2_density_4510_kg_m3": 207.46
      }
    },
    {
      "nominal_thickness_mm": 48,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 376.8,
        "stainless_steel_density_8000_kg_m3": 384.0,
        "alloy_625_density_8440_kg_m3": 405.12,
        "titanium_gr2_density_4510_kg_m3": 216.48
      }
    },
    {
      "nominal_thickness_mm": 50,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_heavy",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 392.5,
        "stainless_steel_density_8000_kg_m3": 400.0,
        "alloy_625_density_8440_kg_m3": 422.0,
        "titanium_gr2_density_4510_kg_m3": 225.5
      }
    },
    {
      "nominal_thickness_mm": 52,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 408.2,
        "stainless_steel_density_8000_kg_m3": 416.0,
        "alloy_625_density_8440_kg_m3": 438.88,
        "titanium_gr2_density_4510_kg_m3": 234.52
      }
    },
    {
      "nominal_thickness_mm": 54,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 423.9,
        "stainless_steel_density_8000_kg_m3": 432.0,
        "alloy_625_density_8440_kg_m3": 455.76,
        "titanium_gr2_density_4510_kg_m3": 243.54
      }
    },
    {
      "nominal_thickness_mm": 56,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 439.6,
        "stainless_steel_density_8000_kg_m3": 448.0,
        "alloy_625_density_8440_kg_m3": 472.64,
        "titanium_gr2_density_4510_kg_m3": 252.56
      }
    },
    {
      "nominal_thickness_mm": 58,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 455.3,
        "stainless_steel_density_8000_kg_m3": 464.0,
        "alloy_625_density_8440_kg_m3": 489.52,
        "titanium_gr2_density_4510_kg_m3": 261.58
      }
    },
    {
      "nominal_thickness_mm": 60,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_heavy",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_045_060",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 471.0,
        "stainless_steel_density_8000_kg_m3": 480.0,
        "alloy_625_density_8440_kg_m3": 506.4,
        "titanium_gr2_density_4510_kg_m3": 270.6
      }
    },
    {
      "nominal_thickness_mm": 65,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_heavy",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_065_080",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 510.25,
        "stainless_steel_density_8000_kg_m3": 520.0,
        "alloy_625_density_8440_kg_m3": 548.6,
        "titanium_gr2_density_4510_kg_m3": 293.15
      }
    },
    {
      "nominal_thickness_mm": 70,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_heavy",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_065_080",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 549.5,
        "stainless_steel_density_8000_kg_m3": 560.0,
        "alloy_625_density_8440_kg_m3": 590.8,
        "titanium_gr2_density_4510_kg_m3": 315.7
      }
    },
    {
      "nominal_thickness_mm": 75,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_heavy",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_065_080",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 588.75,
        "stainless_steel_density_8000_kg_m3": 600.0,
        "alloy_625_density_8440_kg_m3": 633.0,
        "titanium_gr2_density_4510_kg_m3": 338.25
      }
    },
    {
      "nominal_thickness_mm": 80,
      "preferred_FEED_selection": true,
      "availability_class": "preferred_heavy",
      "procurement_risk": "medium",
      "cost_rate_band_id": "PV_PLATE_065_080",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 628.0,
        "stainless_steel_density_8000_kg_m3": 640.0,
        "alloy_625_density_8440_kg_m3": 675.2,
        "titanium_gr2_density_4510_kg_m3": 360.8
      }
    },
    {
      "nominal_thickness_mm": 85,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium_to_high",
      "cost_rate_band_id": "PV_PLATE_090_100",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 667.25,
        "stainless_steel_density_8000_kg_m3": 680.0,
        "alloy_625_density_8440_kg_m3": 717.4,
        "titanium_gr2_density_4510_kg_m3": 383.35
      }
    },
    {
      "nominal_thickness_mm": 90,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "medium_to_high",
      "cost_rate_band_id": "PV_PLATE_090_100",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 706.5,
        "stainless_steel_density_8000_kg_m3": 720.0,
        "alloy_625_density_8440_kg_m3": 759.6,
        "titanium_gr2_density_4510_kg_m3": 405.9
      }
    },
    {
      "nominal_thickness_mm": 95,
      "preferred_FEED_selection": false,
      "availability_class": "custom_rolling_or_special_order",
      "procurement_risk": "medium_to_high",
      "cost_rate_band_id": "PV_PLATE_090_100",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 745.75,
        "stainless_steel_density_8000_kg_m3": 760.0,
        "alloy_625_density_8440_kg_m3": 801.8,
        "titanium_gr2_density_4510_kg_m3": 428.45
      }
    },
    {
      "nominal_thickness_mm": 100,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "medium_to_high",
      "cost_rate_band_id": "PV_PLATE_090_100",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 785.0,
        "stainless_steel_density_8000_kg_m3": 800.0,
        "alloy_625_density_8440_kg_m3": 844.0,
        "titanium_gr2_density_4510_kg_m3": 451.0
      }
    },
    {
      "nominal_thickness_mm": 110,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "high_vendor_confirmation_required",
      "cost_rate_band_id": "PV_PLATE_110_150_VENDOR",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 863.5,
        "stainless_steel_density_8000_kg_m3": 880.0,
        "alloy_625_density_8440_kg_m3": 928.4,
        "titanium_gr2_density_4510_kg_m3": 496.1
      }
    },
    {
      "nominal_thickness_mm": 120,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "high_vendor_confirmation_required",
      "cost_rate_band_id": "PV_PLATE_110_150_VENDOR",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 942.0,
        "stainless_steel_density_8000_kg_m3": 960.0,
        "alloy_625_density_8440_kg_m3": 1012.8,
        "titanium_gr2_density_4510_kg_m3": 541.2
      }
    },
    {
      "nominal_thickness_mm": 130,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "high_vendor_confirmation_required",
      "cost_rate_band_id": "PV_PLATE_110_150_VENDOR",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 1020.5,
        "stainless_steel_density_8000_kg_m3": 1040.0,
        "alloy_625_density_8440_kg_m3": 1097.2,
        "titanium_gr2_density_4510_kg_m3": 586.3
      }
    },
    {
      "nominal_thickness_mm": 140,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "high_vendor_confirmation_required",
      "cost_rate_band_id": "PV_PLATE_110_150_VENDOR",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 1099.0,
        "stainless_steel_density_8000_kg_m3": 1120.0,
        "alloy_625_density_8440_kg_m3": 1181.6,
        "titanium_gr2_density_4510_kg_m3": 631.4
      }
    },
    {
      "nominal_thickness_mm": 150,
      "preferred_FEED_selection": true,
      "availability_class": "heavy_plate_vendor_confirmation",
      "procurement_risk": "high_vendor_confirmation_required",
      "cost_rate_band_id": "PV_PLATE_110_150_VENDOR",
      "unit_area_weight_kg_m2": {
        "carbon_steel_density_7850_kg_m3": 1177.5,
        "stainless_steel_density_8000_kg_m3": 1200.0,
        "alloy_625_density_8440_kg_m3": 1266.0,
        "titanium_gr2_density_4510_kg_m3": 676.5
      }
    }
  ],
  "example": {
    "input": {
      "component_type": "cylindrical_shell",
      "required_net_thickness_mm": 17.6,
      "corrosion_allowance_mm": 3.0,
      "forming_allowance_mm": 0,
      "other_deductions_mm": 0
    },
    "minimum_required_purchase_thickness_mm": 20.6,
    "selected_nominal_thickness_mm": 22,
    "selection_series_id": "india_FEED_preferred",
    "carbon_steel_unit_area_weight_kg_m2": 172.7
  },
  "file_integrity": {
    "algorithm": "SHA-256",
    "canonicalization": "UTF-8 JSON with sorted keys and compact separators; file_integrity excluded",
    "sha256": "b53f27787df33f6d792bad7aeeab85789602edeba78fa9009c9be4311ab9f2c5"
  }
};
