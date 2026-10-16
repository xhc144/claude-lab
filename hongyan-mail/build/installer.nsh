; Extra NSIS steps for the electron-builder installer (electron-builder.yml → nsis.include).

!macro customInstall
  ; Versions up to 1.1.0 used a hand-written installer with its own uninstaller and registry key.
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HongyanMail"
  DeleteRegKey HKCU "Software\HongyanMail"
  Delete "$INSTDIR\Uninstall.exe"
!macroend

!macro customUnInstall
  ; An update runs the old uninstaller silently with --updated; keep settings and mail then.
  ${ifNot} ${isUpdated}
    ; login item registered by the app's "开机时自动启动" setting
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "HongyanMail"
    ${ifNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除本机保存的邮件缓存、账户与设置？$\r$\n$\r$\n选择「否」可在重新安装后继续使用。服务器上的邮件不受影响。" IDNO hy_keep_data
        RMDir /r "$APPDATA\Hongyan Mail"
      hy_keep_data:
    ${endIf}
  ${endIf}
!macroend
