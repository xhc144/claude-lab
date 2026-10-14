; Adds $INSTDIR\bin (which holds motif.cmd) to the user's PATH so `motif` works in terminals
; and AI agents can call it; removed again on uninstall. Only bin\ goes on PATH: with the
; install folder itself there, `motif` would resolve to Motif.exe (the GUI) first.
; An entry for the install folder left by earlier builds is cleaned up. ($$ escapes $ for NSIS.)
!macro customInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$p=[Environment]::GetEnvironmentVariable(\"Path\",\"User\"); $$e=@(($$p -split \";\") | Where-Object { $$_ -and $$_ -ne \"$INSTDIR\" -and $$_ -ne \"$INSTDIR\bin\" }); [Environment]::SetEnvironmentVariable(\"Path\", (@($$e) + \"$INSTDIR\bin\") -join \";\", \"User\")"'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$p=[Environment]::GetEnvironmentVariable(\"Path\",\"User\"); if($$p){[Environment]::SetEnvironmentVariable(\"Path\", (($$p -split \";\") | Where-Object { $$_ -and $$_ -ne \"$INSTDIR\" -and $$_ -ne \"$INSTDIR\bin\" }) -join \";\", \"User\")}"'
!macroend
