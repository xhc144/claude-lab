# 编译 SnapTool 并安装到当前用户的程序目录（不需要管理员权限）
#   安装位置：%LOCALAPPDATA%\Programs\SnapTool
#   快捷方式：桌面、开始菜单
#   在“设置 → 应用 → 已安装的应用”里可以卸载
$ErrorActionPreference = 'Stop'

$installDir = Join-Path $env:LOCALAPPDATA 'Programs\SnapTool'
$exe = Join-Path $installDir 'SnapTool.exe'
$project = Join-Path $PSScriptRoot 'SnapTool\SnapTool.csproj'

# 正在运行的话先关掉，否则 exe 被占用无法覆盖
Get-Process SnapTool -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

dotnet publish $project -c Release -r win-x64 --self-contained false `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none `
    -o $installDir -v q -nologo
if ($LASTEXITCODE -ne 0) { throw '编译失败' }

Copy-Item (Join-Path $PSScriptRoot 'uninstall.ps1') $installDir -Force

# 快捷方式
$ws = New-Object -ComObject WScript.Shell
$links = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SnapTool 截图.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'SnapTool 截图.lnk')
)
foreach ($lnk in $links) {
    $s = $ws.CreateShortcut($lnk)
    $s.TargetPath = $exe
    $s.WorkingDirectory = $installDir
    $s.IconLocation = "$exe,0"
    $s.Description = 'SnapTool 截图 · 长截图 · 标注 · 尺寸控制'
    $s.Save()
}

# 登记到“已安装的应用”
$version = (Get-Item $exe).VersionInfo.ProductVersion -replace '\+.*$', ''
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapTool'
New-Item -Path $key -Force | Out-Null
$uninstall = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$installDir\uninstall.ps1`""
$values = @{
    DisplayName     = 'SnapTool 截图'
    DisplayVersion  = $version
    Publisher       = 'SnapTool'
    DisplayIcon     = "$exe,0"
    InstallLocation = $installDir
    UninstallString = $uninstall
    NoModify        = 1
    NoRepair        = 1
    EstimatedSize   = [int]((Get-ChildItem $installDir -Recurse | Measure-Object Length -Sum).Sum / 1KB)
}
foreach ($k in $values.Keys) { Set-ItemProperty -Path $key -Name $k -Value $values[$k] }

# 如果开了开机自启，更新成新路径
$run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if (Get-ItemProperty -Path $run -Name SnapTool -ErrorAction SilentlyContinue) {
    Set-ItemProperty -Path $run -Name SnapTool -Value "`"$exe`" --tray"
}

Write-Host "已安装到 $installDir"
