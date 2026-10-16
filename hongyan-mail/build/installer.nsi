; 鸿雁邮箱 — Windows installer (NSIS 3, Unicode).
; Compiled by scripts/dist-win.mjs:  makensis -DVERSION=x.y.z -DSRC=<win-unpacked> -DOUT=<setup.exe> installer.nsi
; Per-user install: no administrator rights required.

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!ifndef VERSION
  !define VERSION "1.1.0"
!endif
!define APPNAME "鸿雁邮箱"
!define APPNAME_EN "Hongyan Mail"
!define EXE "Hongyan Mail.exe"
!define PUBLISHER "Hongyan Mail"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\HongyanMail"
!define APP_KEY "Software\HongyanMail"

Name "${APPNAME}"
Caption "${APPNAME} ${VERSION} 安装程序"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME_EN}"
InstallDirRegKey HKCU "${APP_KEY}" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=2052 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=2052 "FileDescription" "${APPNAME} 安装程序"
VIAddVersionKey /LANG=2052 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "MIT License"
VIAddVersionKey /LANG=2052 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=2052 "ProductVersion" "${VERSION}"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "installer-sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "installer-sidebar.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "installer-header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "installer-header.bmp"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要取消安装${APPNAME}吗？"

!define MUI_WELCOMEPAGE_TITLE "欢迎安装${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "${APPNAME}是一个完全在本机运行的多账户邮件客户端：$\r$\n$\r$\n• 统一管理 Gmail、Outlook、QQ、网易、GMX 等邮箱$\r$\n• 新邮件实时推送，历史邮件完整同步$\r$\n• 凭据加密保存在本机，直接连接邮件服务器$\r$\n$\r$\n安装只需几秒钟，不需要管理员权限。点击「下一步」继续。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动${APPNAME}"
!define MUI_FINISHPAGE_TITLE "${APPNAME}已安装完成"
!define MUI_FINISHPAGE_TEXT "可以从开始菜单或桌面快捷方式打开${APPNAME}。"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

!macro CloseRunningApp
  ; Ask a running instance to exit, then make sure it is gone before files are replaced.
  nsExec::Exec 'taskkill /IM "${EXE}"'
  Sleep 800
  nsExec::Exec 'taskkill /F /T /IM "${EXE}"'
  Sleep 300
!macroend

Section "Install"
  SetShellVarContext current
  !insertmacro CloseRunningApp
  SetOutPath "$INSTDIR"
  ; Remove files of a previous version that the new one does not ship.
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SRC}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortCut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0 SW_SHOWNORMAL "" "${APPNAME} — 多账户邮件客户端"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0

  WriteRegStr HKCU "${APP_KEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  !insertmacro CloseRunningApp
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "${APP_KEY}"
  ; Login item registered by the app's "开机时自动启动" setting.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "HongyanMail"
  IfSilent done
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除本机保存的邮件缓存、账户与设置？$\r$\n$\r$\n选择「否」可在重新安装后继续使用。服务器上的邮件不受影响。" IDNO done
    RMDir /r "$APPDATA\${APPNAME_EN}"
  done:
SectionEnd
