# 卸载 SnapTool：删除程序、快捷方式、开机自启和“已安装的应用”登记。
# 保存的截图和设置（%APPDATA%\SnapTool）不会删除。
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\SnapTool'

Get-Process SnapTool -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SnapTool 截图.lnk') -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'SnapTool 截图.lnk') -ErrorAction SilentlyContinue
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name SnapTool -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapTool' -Recurse -ErrorAction SilentlyContinue

# 本脚本就在安装目录里，交给一个独立进程稍后删除整个目录
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command',
    "Start-Sleep 2; Remove-Item -LiteralPath '$installDir' -Recurse -Force"
