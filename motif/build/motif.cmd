@echo off
rem Motif command line (also used by AI agents: Skill / MCP). Runs the bundled CLI with the
rem app's own runtime, so no separate Node.js installation is needed.
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0Motif.exe" "%~dp0resources\app.asar.unpacked\dist\cli.mjs" %*
exit /b %ERRORLEVEL%
