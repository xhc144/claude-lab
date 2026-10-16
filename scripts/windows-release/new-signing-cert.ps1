<#
  生成一张自己用的“代码签名证书”（免费，自签名），并让这台电脑信任它。

  用法（在 Windows 上，右键“开始”→“终端”或“PowerShell”，进入本文件所在文件夹后运行）：
    powershell -ExecutionPolicy Bypass -File .\new-signing-cert.ps1
    powershell -ExecutionPolicy Bypass -File .\new-signing-cert.ps1 -Name "你的名字"

  它会做四件事：
    1. 生成证书（只能用来给软件盖章，不能冒充网站），有效期 10 年；
    2. 导出：
         code-signing.pfx            证书 + 私钥（最重要，谁拿到谁就能以你的名义盖章）
         code-signing.cer            只有公开部分，可以发给你别的电脑去信任
         WIN_CSC_LINK.txt            把 .pfx 转成一行文字，粘贴到 GitHub
         WIN_CSC_KEY_PASSWORD.txt    .pfx 的随机密码，粘贴到 GitHub
    3. 把证书加入这台电脑的“受信任的根证书”和“受信任的发布者”（Windows 会弹窗确认，点“是”）；
    4. 从系统证书库里删掉私钥，私钥只留在 code-signing.pfx 里。

  之后：
    - 打开 https://github.com/xhc144/claude-lab/settings/secrets/actions ，
      新建两个 Repository secret：名字分别是 WIN_CSC_LINK 和 WIN_CSC_KEY_PASSWORD，
      内容分别是两个 txt 文件里的全部文字。
    - 粘贴完就删掉这两个 txt 文件；code-signing.pfx 和密码另外备份（U 盘或密码管理器），不要提交到仓库、不要发给别人。
    - 其他想安装你软件的电脑：把 code-signing.cer 拷过去，运行 trust-signing-cert.ps1。
#>
param(
  [string]$Name = 'xhc144',
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('Desktop')) '代码签名证书'),
  # 只生成文件、不改这台电脑的信任设置（自动测试用）
  [switch]$SkipTrust
)

$ErrorActionPreference = 'Stop'

if ($Name -match '[,=+<>#;"\\]') { throw "名字里不要用这些符号：, = + < > # ; "" \" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$pfxPath = Join-Path $OutDir 'code-signing.pfx'
$cerPath = Join-Path $OutDir 'code-signing.cer'
if (Test-Path $pfxPath) { throw "$pfxPath 已经存在。如果要重新生成，请先把旧文件挪走（旧证书不要随便删，已经装好的软件要靠它来认新版本）。" }

Write-Host "正在生成证书：CN=$Name"
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=$Name" `
  -FriendlyName "$Name 代码签名（自签名）" `
  -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears(10)

# 随机密码：32 位字母和数字
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
$password = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
$secure = ConvertTo-SecureString -String $password -AsPlainText -Force

# TripleDES 格式的 .pfx：打包工具 electron-builder 读取它最稳妥
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure -CryptoAlgorithmOption TripleDES_SHA1 | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
[IO.File]::WriteAllText((Join-Path $OutDir 'WIN_CSC_LINK.txt'), [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath)))
[IO.File]::WriteAllText((Join-Path $OutDir 'WIN_CSC_KEY_PASSWORD.txt'), $password)

if (-not $SkipTrust) {
  Write-Host '正在让这台电脑信任它（会弹出确认窗口，请点“是”）…'
  Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
  Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null
}

# 私钥只留在 .pfx 文件里
Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -DeleteKey

Write-Host ''
Write-Host "完成。文件在：$OutDir"
Write-Host "  证书名字：CN=$Name"
Write-Host "  指纹：$($cert.Thumbprint)"
Write-Host ''
Write-Host '下一步：'
Write-Host '  1. 打开 https://github.com/xhc144/claude-lab/settings/secrets/actions'
Write-Host '  2. New repository secret → 名字 WIN_CSC_LINK，内容是 WIN_CSC_LINK.txt 里的全部文字'
Write-Host '  3. New repository secret → 名字 WIN_CSC_KEY_PASSWORD，内容是 WIN_CSC_KEY_PASSWORD.txt 里的文字'
Write-Host '  4. 删掉这两个 txt；把 code-signing.pfx 和密码另外备份好'
