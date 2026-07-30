# VesselM Phase 1 to Phase 6 Web Application

Version: 1.0.0

## Included capabilities

### Phase 1
Temperature-based pressure-vessel material screening from the modular Appendix H databanks.

### Phase 2
Temperature-envelope logic, service warnings, source-quality checks, multiple-option handling and override traceability.

### Phase 3
Responsive user interface, dark mode, result cards, searchable data libraries and print layout.

### Phase 4
Local browser storage, scenario comparison, audit JSON export, CSV export and feature controls.

### Phase 5
Built-in unit-conversion, decision-logic and formula test register.

### Phase 6
Preliminary internal-pressure calculations for:

- Cylindrical shells
- 2:1 ellipsoidal heads
- General ellipsoidal heads
- Torispherical 100-6 heads
- General torispherical heads
- Hemispherical heads
- Conical sections
- Thickness additions
- Available nominal-thickness adequacy
- Preliminary MAP and MAWP
- Historical hydrotest screening

## Important engineering boundary

The pressure-design formulas are based on the historical Pressure Vessel Design Manual, Third Edition. The public package does not contain a controlled allowable-stress library or current licensed code tables.

Before using Phase 6, the user must:

1. Enter the controlled code edition.
2. Confirm that the formulas have been verified against that edition.
3. Enter verified allowable-stress values.
4. Enter the controlled stress source reference.
5. Apply competent engineering review.

## Run directly

1. Extract the ZIP.
2. Double-click `index.html`.

The application uses `data/vesselm-data.js`, so it works from a local folder without a server.

## Recommended development mode

Double-click `run_local_server.bat`, or run:

```powershell
python -m http.server 8008 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8008/
```

## GitHub Pages

Upload the complete extracted folder contents to the repository root. Enable GitHub Pages from the `main` branch and root folder.

## Data maintenance

All Phase 1 to Phase 6 JSON files are stored under `data/`.

After changing any JSON file, run:

```powershell
python tools/update_data_bundle.py
```

or double-click:

```text
update_data_bundle.bat
```

This regenerates `data/vesselm-data.js` for direct local-browser use.

## File structure

```text
index.html
style.css
app.js
js/
  utils.js
  material-engine.js
  design-engine.js
  test-engine.js
  report-engine.js
data/
  phase_01_material_selection/
  phase_02_engineering_decision_logic/
  phase_03_ui_configuration/
  phase_04_mvp_product_configuration/
  phase_05_verification_and_testing/
  phase_06_preliminary_pressure_design/
  vesselsm-data.js
tools/
  update_data_bundle.py
run_local_server.bat
update_data_bundle.bat
samples/
```

## Excluded scope

External pressure, vacuum stability, MDMT, PWHT, impact testing, nozzle reinforcement, local loads, fatigue, vessel supports, transportation, erection and detailed mechanical-integrity assessment are not calculated in this Phase 1 to Phase 6 application.
