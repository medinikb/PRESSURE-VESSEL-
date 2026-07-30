# VesselM ASME 2021 Allowable Stress JSON Library

Version: 0.1.0

## Scope

This package contains machine-extracted maximum allowable stress values for
VesselM material specifications using:

- ASME BPVC Section II, Part D, Properties (Metric), 2021 Edition
- Table 1A for ferrous materials
- Table 1B for nonferrous materials
- Table 3 for bolting materials
- ASME Section VIII Division 1 applicability fields

The material coverage is driven by the VesselM Temperature Material Library.

## Lookup rule

The ASME temperature headings state "metal temperature, degC, not exceeding."
The app shall therefore select the smallest published temperature column greater
than or equal to the design temperature after resolving the exact material row.

This is a published upper-bound-column lookup, not interpolation.

## Fail-closed controls

The app shall return:

- `multiple_material_records_require_engineering_selection` when more than one
  row remains after product form, grade, class, condition and size filtering.
- `allowable_stress_not_resolved` when no exact row remains.

The app shall not select the first row or the highest stress value.

## Verification status

The JSON syntax, record uniqueness, source-row traceability, temperature order,
blank-cell handling and conversion logic were machine-validated.

Independent engineering verification against the controlled PDF is still
pending. Do not enable this library for final pressure-vessel design until the
data owner, materials engineer and pressure-vessel engineer approve the release.

## Public repository control

The package contains extracted numerical data from a controlled copyrighted
source. Public distribution or GitHub publication requires licensing and data
owner review. The source PDF is not included.
