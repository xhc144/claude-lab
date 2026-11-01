$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
python -m PyInstaller --noconfirm --clean --onefile --windowed --name WeChatCustomerControl --icon assets/app.ico --add-data 'remote_helper.py;.' --add-data 'assets;assets' --exclude-module tkinter --exclude-module PyQt5 --exclude-module PyQt6 app.py
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
