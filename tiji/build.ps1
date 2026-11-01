# 把源码打包成 ..\题记.exe（改了代码以后在这个目录运行： powershell -ExecutionPolicy Bypass -File build.ps1）
$ErrorActionPreference = 'Stop'
$src  = $PSScriptRoot
$dest = Split-Path $src -Parent
$work = Join-Path $env:TEMP 'tiji-build'          # 短路径，避开 Windows 路径长度限制
$venv = Join-Path $work 'venv'
$py   = Join-Path $venv 'Scripts\python.exe'

if (-not (Test-Path $py)) {
    New-Item -ItemType Directory -Force $work | Out-Null
    python -m venv $venv
    & $py -m pip install -q -r (Join-Path $src 'requirements.txt')
}

& $py -m PyInstaller --noconfirm --clean --windowed --name '题记' `
    --icon (Join-Path $src 'static\tiji.ico') `
    --add-data "$(Join-Path $src 'static');static" `
    --add-data "$(Join-Path $src 'tex');tex" `
    --collect-all webview `
    --distpath (Join-Path $work 'dist') --workpath (Join-Path $work 'build') --specpath $work `
    (Join-Path $src 'app.py')

# 只替换程序本身，data / exports 不动
Remove-Item -Recurse -Force (Join-Path $dest '_internal') -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $work 'dist\题记\*') $dest
Write-Host "已生成 $(Join-Path $dest '题记.exe')"
