<#
  让另一台电脑信任你的自签名证书（只需要 code-signing.cer，不需要 .pfx 和密码）。

  用法：把 code-signing.cer 和本文件放在同一个文件夹，然后运行
    powershell -ExecutionPolicy Bypass -File .\trust-signing-cert.ps1
  只对当前 Windows 用户生效；加 -AllUsers 则对这台电脑的所有用户生效（需要用“以管理员身份运行”打开 PowerShell）。

  信任之后：这台电脑上，用这张证书盖章的软件会显示你的名字，软件自动更新时也能确认新版本确实是你发布的。
  不再需要时，运行  certmgr.msc  在“受信任的根证书颁发机构”和“受信任的发布者”里删掉同名证书即可。
#>
param(
  [string]$CerPath = (Join-Path $PSScriptRoot 'code-signing.cer'),
  [switch]$AllUsers
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $CerPath)) { throw "找不到 $CerPath" }

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 (Resolve-Path $CerPath).Path
if ($cert.HasPrivateKey) { throw '这是带私钥的文件，请用 .cer 文件' }
$isCodeSigning = $cert.Extensions |
  Where-Object { $_ -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension] } |
  ForEach-Object { $_.EnhancedKeyUsages } |
  Where-Object { $_.Value -eq '1.3.6.1.5.5.7.3.3' }
if (-not $isCodeSigning) { throw '这张证书不是代码签名证书，已停止' }

Write-Host "证书：$($cert.Subject)"
Write-Host "指纹：$($cert.Thumbprint)"
Write-Host "有效期至：$($cert.NotAfter)"
$scope = if ($AllUsers) { 'LocalMachine' } else { 'CurrentUser' }
Import-Certificate -FilePath $CerPath -CertStoreLocation "Cert:\$scope\Root" | Out-Null
Import-Certificate -FilePath $CerPath -CertStoreLocation "Cert:\$scope\TrustedPublisher" | Out-Null
Write-Host "已信任（$scope）。"
