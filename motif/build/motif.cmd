@echo off
rem Motif command line (also used by AI agents: Skill / MCP). Runs the bundled CLI with the
rem app's own runtime, so no separate Node.js installation is needed. Lives in bin\ so that
rem `motif` on PATH resolves here and not to Motif.exe (.EXE comes before .CMD in PATHEXT).
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\Motif.exe" "%~dp0..\resources\app.asar.unpacked\dist\cli.mjs" %*
exit /b %ERRORLEVEL%
