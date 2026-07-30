# VesselM Material Compatibility JSON Library

## Source

Milton Roy Materials Bulletin 230, Material Selection Chart, effective 15 June 1993.

## Main data files

- `chemical_compatibility_matrix.json`: canonical chemical-by-material ratings
- `material_columns.json`: 19 chart material columns
- `rating_codes.json`: A, B, C, V, dash, blank and undefined N handling
- `chart_notes.json`: source notes 1 to 23
- `inline_qualifiers.json`: page-specific concentration qualifiers
- `chemical_index.json`: normalized search keys
- `chemical_aliases.json`: search aliases and source spelling issues
- `packing_selection.json`: page 8 packing-selection records
- `compatibility_lookup_rules.json`: fail-closed application logic
- `unresolved_items.json`: undefined N, blank cells and uncertain packing text
- `validation_report.json`: extraction counts and validation checks

## Recommended app role

Use this package as a service-compatibility screening and warning library.

Do not use it to:
- approve an ASME pressure-vessel material
- retrieve allowable stress
- determine corrosion allowance
- replace a corrosion/materials study
- automatically choose a material grade

## Rating interpretation

- A: source reports successful use, but engineering review remains required
- B: proceed with caution and engineering review
- C: should not be used
- V: varies; conditions are unresolved
- em dash: information lacking
- blank: no symbol printed
- N: printed in the source but not defined in the legend

## Maintenance

`chemical_compatibility_matrix.json` is the canonical data file.
Indexes and app bundles should be regenerated from it rather than edited separately.
