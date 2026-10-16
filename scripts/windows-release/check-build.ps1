# Checks a packaged Windows build before anything is tested or released (used by every app workflow).
#
#   check-build.ps1 -Release release -Setup 'Phonica-Setup-*.exe' -Exe 'win-unpacked\Phonica.exe' [-RequireSigning]
#
# - latest.yml and resources\app-update.yml exist, so installed copies can update.
# - With the WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD secrets present (or -RequireSigning), the installer
#   and the program are signed with exactly that certificate, and update-signer.cjs, the check the
#   installed app runs on a downloaded update, accepts the real installer and refuses a copy with one
#   changed byte and a file signed by someone else. The runner does not trust the self-signed
#   certificate, the same situation as a user's computer that never imported it.
# - Writes SHA256SUMS.txt and the step outputs signed=true|false and thumbprint=<sha1>.
param(
  [Parameter(Mandatory = $true)][string]$Release,
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Exe,
  [switch]$RequireSigning
)
$ErrorActionPreference = 'Stop'
$signerModule = Join-Path $PSScriptRoot 'update-signer.cjs'

Get-ChildItem $Release -File | Format-Table Name, Length | Out-String | Write-Host
foreach ($f in (Join-Path $Release 'latest.yml'), (Join-Path $Release 'win-unpacked\resources\app-update.yml')) {
  if (-not (Test-Path $f)) { throw "$f missing: installed copies could not update" }
  Write-Host "--- $f"; Get-Content $f | Write-Host
}
$setupFile = Get-ChildItem (Join-Path $Release $Setup) | Select-Object -First 1
if (-not $setupFile) { throw "no installer matches $Setup" }
$exeFile = Get-Item (Join-Path $Release $Exe)

$expected = $null
if ($env:WIN_CSC_LINK) {
  $pfx = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String($env:WIN_CSC_LINK), $env:WIN_CSC_KEY_PASSWORD)
  $expected = $pfx.Thumbprint
  Write-Host "signing certificate: $($pfx.Subject) $expected valid until $($pfx.NotAfter.ToString('yyyy-MM-dd'))"
  if ($pfx.NotAfter -lt (Get-Date).AddDays(30)) { Write-Host "::warning::the signing certificate expires on $($pfx.NotAfter.ToString('yyyy-MM-dd'))" }
} elseif ($RequireSigning) {
  throw 'WIN_CSC_LINK is not available to this run, and a release must be signed'
} else {
  Write-Host '::warning::WIN_CSC_LINK not set: this build is unsigned and will not be released'
}

foreach ($f in $setupFile, $exeFile) {
  $sig = Get-AuthenticodeSignature -LiteralPath $f.FullName
  $thumb = if ($sig.SignerCertificate) { $sig.SignerCertificate.Thumbprint } else { '' }
  Write-Host "$($f.Name): $($sig.Status) $($sig.SignerCertificate.Subject) $thumb"
  if ($expected) {
    if ($sig.Status -notin 'Valid', 'UnknownError', 'NotTrusted') { throw "$($f.Name): signature status $($sig.Status)" }
    if ($thumb -ne $expected) { throw "$($f.Name) is signed by '$thumb', not by the WIN_CSC_LINK certificate $expected" }
  }
}

if ($expected) {
  # The fallback the installed app uses when Windows does not trust the certificate.
  $env:SIGNER_MODULE = $signerModule
  $check = @'
const { verifySameSigner } = require(process.env.SIGNER_MODULE);
const [cur, cand, want] = process.argv.slice(1);
verifySameSigner(cur, cand).then((r) => {
  console.log(JSON.stringify(r));
  process.exit(r.ok === (want === 'accept') ? 0 : 1);
});
'@
  $tmp = Join-Path $env:RUNNER_TEMP 'signer-check'
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  node -e $check $exeFile.FullName $setupFile.FullName accept
  if ($LASTEXITCODE) { throw 'update-signer.cjs refused the real installer' }

  $tampered = Join-Path $tmp 'tampered.exe'
  Copy-Item $setupFile.FullName $tampered -Force
  $fs = [IO.File]::Open($tampered, 'Open', 'ReadWrite')
  try { $fs.Position = [int64]($fs.Length / 2); $b = $fs.ReadByte(); $fs.Position = [int64]($fs.Length / 2); $fs.WriteByte(($b + 1) % 256) } finally { $fs.Dispose() }
  node -e $check $exeFile.FullName $tampered refuse
  if ($LASTEXITCODE) { throw 'update-signer.cjs accepted an installer with a changed byte' }
  Remove-Item $tampered -Force

  node -e $check $exeFile.FullName "$env:WINDIR\System32\notepad.exe" refuse
  if ($LASTEXITCODE) { throw 'update-signer.cjs accepted a file signed by another publisher' }
  Write-Host 'update signature check: accepts this installer, refuses a modified copy and another publisher'
}

$sums = Get-ChildItem $Release -File | Where-Object { ($_.Name -match '\.(exe|zip)$' -and $_.Name -notlike '__*') -or $_.Name -eq 'latest.yml' } | Sort-Object Name |
  ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)" }
$sums | Set-Content -Path (Join-Path $Release 'SHA256SUMS.txt') -Encoding ascii
$sums | Write-Host

if ($env:GITHUB_OUTPUT) {
  "signed=$(if ($expected) { 'true' } else { 'false' })" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
  "thumbprint=$expected" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
}
