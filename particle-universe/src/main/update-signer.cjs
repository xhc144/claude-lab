'use strict';
// Signature check for downloaded updates that also works on computers that do not trust the
// self-signed certificate.
//
// electron-updater accepts an installer only when Windows reports its signature as Valid, which for
// a self-signed certificate is true only on computers where the certificate was imported. Everywhere
// else the status is UnknownError ("terminated in a root certificate which is not trusted") and the
// update would be refused. This module keeps electron-updater's check and, when it fails, accepts the
// installer only if it is signed by exactly the same certificate as the program that is running now
// (same SHA-1 thumbprint), the signature itself verifies against that certificate, and the file has
// not been modified since it was signed (Windows reports HashMismatch otherwise). An unsigned file,
// a file signed with any other key, or an altered file is still refused.
//
// The canonical copy is scripts/windows-release/update-signer.cjs; every app carries an identical
// copy next to its updater (scripts/windows-release/check-copies.mjs keeps them in sync).
const { execFile } = require('node:child_process');

// Runs in Windows PowerShell 5.1. Paths come in through environment variables, never through the
// command line, so file names cannot inject commands.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
function Read-SignerThumbprint([string]$path) {
  $fs = [IO.File]::OpenRead($path)
  try {
    $br = New-Object IO.BinaryReader($fs)
    $fs.Position = 0x3c; $pe = $br.ReadInt32()
    $fs.Position = $pe; if ($br.ReadUInt32() -ne 0x4550) { throw 'not a PE file' }
    $fs.Position = $pe + 24; $magic = $br.ReadUInt16()
    if ($magic -eq 0x20b) { $dirs = $pe + 24 + 112 } elseif ($magic -eq 0x10b) { $dirs = $pe + 24 + 96 } else { throw 'unknown optional header' }
    $fs.Position = $dirs + 32; $off = [int64]$br.ReadUInt32(); $size = [int64]$br.ReadUInt32()
    if ($off -eq 0 -or $size -lt 8 -or $off + $size -gt $fs.Length) { throw 'no embedded signature' }
    $fs.Position = $off; $len = [int64]$br.ReadUInt32(); [void]$br.ReadUInt16(); $type = $br.ReadUInt16()
    if ($type -ne 2 -or $len -le 8 -or $len -gt $size) { throw 'unexpected certificate table entry' }
    $raw = $br.ReadBytes([int]($len - 8))
  } finally { $fs.Dispose() }
  if ($raw[0] -ne 0x30) { throw 'signature is not DER' }
  $n = [int]$raw[1]
  if ($n -lt 0x80) { $total = 2 + $n } else { $k = $n - 0x80; $l = 0; for ($i = 0; $i -lt $k; $i++) { $l = $l * 256 + [int]$raw[2 + $i] }; $total = 2 + $k + $l }
  if ($total -gt $raw.Length) { throw 'truncated signature' }
  $der = New-Object byte[] $total; [Array]::Copy($raw, $der, $total)
  $cms = New-Object System.Security.Cryptography.Pkcs.SignedCms
  $cms.Decode($der)
  $cms.CheckSignature($true)
  return $cms.SignerInfos[0].Certificate.Thumbprint
}
$r = @{}
$cur = Get-AuthenticodeSignature -LiteralPath $env:UPD_CURRENT
$new = Get-AuthenticodeSignature -LiteralPath $env:UPD_CANDIDATE
$r.currentStatus = [string]$cur.Status
$r.currentThumbprint = if ($cur.SignerCertificate) { $cur.SignerCertificate.Thumbprint } else { $null }
$r.candidateStatus = [string]$new.Status
$r.candidateThumbprint = if ($new.SignerCertificate) { $new.SignerCertificate.Thumbprint } else { $null }
$r.candidateSubject = if ($new.SignerCertificate) { $new.SignerCertificate.Subject } else { $null }
try { $r.cmsThumbprint = Read-SignerThumbprint $env:UPD_CANDIDATE } catch { $r.cmsError = $_.Exception.Message }
$r | ConvertTo-Json -Compress
`;

// Statuses Windows reports for an intact file whose signature is fine but whose certificate this
// computer does not (fully) trust. HashMismatch, NotSigned and the rest are always refused.
const INTACT = new Set(['Valid', 'UnknownError', 'NotTrusted']);

/** Pure decision on the PowerShell report; exported for tests. */
function judge(r) {
  if (!r || typeof r !== 'object') return { ok: false, reason: 'no signature report' };
  const cur = String(r.currentThumbprint || '').toUpperCase();
  const cand = String(r.candidateThumbprint || '').toUpperCase();
  const cms = String(r.cmsThumbprint || '').toUpperCase();
  if (!cur) return { ok: false, reason: `the running program is not signed (${r.currentStatus}), so there is no certificate to compare with` };
  if (r.currentStatus === 'HashMismatch') return { ok: false, reason: 'the running program has been modified since it was signed' };
  if (!INTACT.has(r.candidateStatus)) return { ok: false, reason: `update signature status is ${r.candidateStatus}` };
  if (!cand) return { ok: false, reason: 'update has no signer certificate' };
  if (!cms) return { ok: false, reason: `update signature does not verify: ${r.cmsError || 'unknown error'}` };
  if (cand !== cur || cms !== cur) return { ok: false, reason: `update is signed by ${r.candidateSubject || 'another certificate'} (${cand}), not by the certificate of this program (${cur})` };
  return { ok: true, thumbprint: cur, subject: r.candidateSubject };
}

/** Runs the check; resolves to { ok, reason?, thumbprint? }. */
function verifySameSigner(currentExe, candidateFile, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      env: { ...process.env, UPD_CURRENT: currentExe, UPD_CANDIDATE: candidateFile, PSModulePath: '' },
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) return resolve({ ok: false, reason: `signature check failed to run: ${String(stderr || error.message).trim().split('\n')[0]}` });
      let report;
      try {
        report = JSON.parse(String(stdout).trim().split('\n').filter(Boolean).pop());
      } catch {
        return resolve({ ok: false, reason: `unreadable signature report: ${String(stdout).slice(0, 200)}` });
      }
      resolve(judge(report));
    });
  });
}

/**
 * Wraps autoUpdater.verifyUpdateCodeSignature: electron-updater's own check first, the same-certificate
 * check when that fails. `log(level, message)` receives the decision.
 */
function installSameSignerFallback(autoUpdater, log = () => {}) {
  const original = autoUpdater && autoUpdater.verifyUpdateCodeSignature;
  if (typeof original !== 'function') return false;
  autoUpdater.verifyUpdateCodeSignature = async (publisherNames, file) => {
    const refused = await original(publisherNames, file);
    if (refused == null) return null;
    const r = await verifySameSigner(process.execPath, file);
    if (r.ok) {
      log('info', `update accepted: signed by the same certificate as this program (${r.thumbprint}); Windows on this computer does not trust that certificate, which is expected for a self-signed one`);
      return null;
    }
    log('warn', `update refused: ${r.reason}`);
    return `${refused}\nsame-certificate check: ${r.reason}`;
  };
  return true;
}

module.exports = { installSameSignerFallback, verifySameSigner, judge, SCRIPT };
