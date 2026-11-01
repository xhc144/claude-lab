@echo off
setlocal
cd /d "%~dp0"
where pythonw.exe >nul 2>nul
if errorlevel 1 (
  echo Python 3 with Tk is required. Please install Python or use the desktop shortcut.
  pause
  exit /b 1
)
start "" pythonw.exe "%~dp0desktop_accounts.py" gui
