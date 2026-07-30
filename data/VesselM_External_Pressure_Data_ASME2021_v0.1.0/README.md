# VesselM External Pressure Data - ASME 2021 Reference Preview

This package supplies the missing external-pressure datasets for the current VesselM material library:

- complete Table G data for Figure G
- nine external-pressure charts used by the current 148-record material library
- Tables TM-1 through TM-5 modulus-of-elasticity data
- material-to-chart and material-to-modulus assignments
- a single browser-ready JSON bundle and JavaScript bundle

## Important boundary

The source data are ASME Section II Part D 2021. The user's current design basis is ASME Section VIII Division 1 2023. Therefore this package is enabled only for reference-preview/FEED screening and must remain blocked for engineering-production or construction use.

Table Y-1 temperature-dependent yield-strength data are not included. CS-3 curve selection at temperatures requiring a temperature-dependent yield value, and the Do/t < 10 route, shall require a manually verified yield-strength-at-temperature input or remain blocked.

All extracted numerical data require independent verification against the licensed source before controlled engineering release.
