@echo off
title VesselM Phase 1 to Phase 6
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found.
  echo You can still double-click index.html to run VesselM.
  pause
  exit /b 1
)
start "" http://127.0.0.1:8008/
python -m http.server 8008 --bind 127.0.0.1
