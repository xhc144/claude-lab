; Adds the install directory (which contains motif.cmd) to the user's PATH so `motif` works in
; terminals and AI agents can call it; removed again on uninstall. ($$ escapes a literal $ for NSIS.)
!macro customInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$p=[Environment]::GetEnvironmentVariable(\"Path\",\"User\"); if(-not $$p){$$p=\"\"}; if(($$p -split \";\") -notcontains \"$INSTDIR\"){[Environment]::SetEnvironmentVariable(\"Path\", ($$p.TrimEnd(\";\") + \";$INSTDIR\").TrimStart(\";\"), \"User\")}"'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$p=[Environment]::GetEnvironmentVariable(\"Path\",\"User\"); if($$p){[Environment]::SetEnvironmentVariable(\"Path\", (($$p -split \";\") | Where-Object { $$_ -and $$_ -ne \"$INSTDIR\" }) -join \";\", \"User\")}"'
!macroend
