@echo off
cd /d "%~dp0\.."
REM customtkinter lives on Python 3.14 (same as GGen App Update)
py -3.14 scripts\load_perf_dashboard_app.py
if errorlevel 1 pause
