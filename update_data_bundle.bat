@echo off
title Update VesselM Data Bundle
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python or run the update script from another environment.
  pause
  exit /b 1
)
python tools\update_data_bundle.py
pause
