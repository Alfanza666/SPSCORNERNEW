<#
.SYNOPSIS
  Deploy CEPAT ke VPS - untuk perubahan backend-only (file .ts/.js di server.ts, src/routes, src/services, dll).

.DESCRIPTION
  Perbedaan dengan deploy-vps.ps1 (full):
    - TIDAK build frontend, TIDAK upload dist/  (hemat 60-90% waktu)
    - Kirim file via tar streaming (1 koneksi SSH), bukan SCP berulang
    - SSH ControlMaster: handshake sekali, dipakai ulang semua perintah
    - npm install hanya jika package-lock.json berubah

  Kapan pakai:
    - Kamu hanya mengubah kode backend (server.ts, src/routes/**, src/services/**,
      src/middleware/**, src/utils/**) dan frontend TIDAK berubah.
  Kapan JANGAN pakai:
    - Jika mengubah file frontend (src/pages, src/components, dll) -> pakai deploy-vps.ps1
      atau jalankan dengan -WithBuild.

.PARAMETER WithBuild
  Paksa build frontend + upload dist/ (gunakan jika frontend ikut berubah).

.PARAMETER SkipLint
  Lewati type check (npm run lint).

.PARAMETER Files
  (Opsional) Daftar file spesifik yang mau dikirim. Default: seluruh folder backend inti.

.EXAMPLE
  .\scripts\deploy-fast.ps1
  .\scripts\deploy-fast.ps1 -SkipLint
  .\scripts\deploy-fast.ps1 -WithBuild          # frontend berubah juga
  .\scripts\deploy-fast.ps1 -Files "server.ts","src/routes/payments.ts"
#>
param(
  [switch]$WithBuild,
  [switch]$SkipLint,
  [string[]]$Files,
  [string]$VpsHost = "root@103.193.179.217",
  [string]$HealthUrl = "https://api.spscorner.store/api/test-ping"
)

$ErrorActionPreference = 'Stop'
$VPS = $VpsHost
$REMOTE_DIR = "/opt/sps-backend"
$LOCAL_DIR = (Get-Location).Path
# CATATAN: ControlMaster/ControlPath TIDAK dipakai - OpenSSH Windows tidak mendukung
# Unix socket untuk koneksi persisten (memicu error 'getsockname failed: Not a socket').
# Kecepatan tetap didapat dari: 1 arsip tar (bukan 8x scp) + skip build/dist.
$SshOpts = @('-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=15')

$sw = [System.Diagnostics.Stopwatch]::StartNew()
function Step($msg){ Write-Host "`n>>> $msg" -ForegroundColor Yellow }
function Ok($msg){ Write-Host "    $msg" -ForegroundColor Green }
function Die($msg){ Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  SPS Corner - FAST Deploy (backend)  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# -- 1. Type check (kecuali di-skip) --
if (-not $SkipLint) {
  Step "Type check..."
  & npm run lint 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Type check gagal. Perbaiki dulu, atau gunakan -SkipLint" }
  Ok "Lint lulus ($($sw.ElapsedMilliseconds)ms)"
} else { Step "Skip lint" }

# -- 2. (Opsional) Build frontend --
if ($WithBuild) {
  Step "Build frontend..."
  & npm run build 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Build frontend gagal" }
  Ok "Build selesai"
}

# -- 3. Siapkan daftar file backend yang dikirim --
if (-not $Files -or $Files.Count -eq 0) {
  # Default: seluruh folder backend inti + server.ts
  $Files = @('server.ts')
  foreach ($d in @('src\routes','src\services','src\middleware','src\utils')) {
    if (Test-Path "$LOCAL_DIR\$d") {
      $Files += (Get-ChildItem "$LOCAL_DIR\$d" -Recurse -File | ForEach-Object { $_.FullName.Substring($LOCAL_DIR.Length+1) })
    }
  }
}
# Normalisasi path ke forward-slash untuk tar/remote
$Files = $Files | ForEach-Object { $_ -replace '\\','/' }
Step "Mengirim $($Files.Count) file backend via tar streaming (1 koneksi)..."
$Files | ForEach-Object { Write-Host "      - $_" -ForegroundColor DarkGray }

# -- 4. Buat arsip tar + kirim lewat 1 koneksi SSH --
$tarFile = "$env:TEMP\sps-deploy-backend.tar"
if (Test-Path $tarFile) { Remove-Item $tarFile -Force }
# tar Windows (bsdtar) - buat arsip dari daftar file relatif
& tar -cf $tarFile -C $LOCAL_DIR $Files 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Gagal membuat arsip tar" }
$tarSize = [math]::Round((Get-Item $tarFile).Length/1KB,1)
Ok "Arsip dibuat ($tarSize KB)"

Step "Upload arsip ke VPS (1 file)..."
# Kirim 1 arsip via scp (lebih andal dari stdin binary yang memicu 'getsockname'
# di PowerShell 5.1 + ControlMaster). Tetap 1 file, jauh lebih cepat dari 8x scp.
$remoteTar = "/tmp/sps-deploy-backend.tar"
& scp @SshOpts $tarFile "${VPS}:${remoteTar}" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Upload arsip gagal" }
Ok "Arsip terkirim"

Step "Ekstrak di VPS..."
& ssh @SshOpts $VPS "mkdir -p $REMOTE_DIR && tar -xf $remoteTar -C $REMOTE_DIR && rm -f $remoteTar" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Ekstrak di VPS gagal" }
Ok "File terekstrak di $REMOTE_DIR"
Remove-Item $tarFile -Force -ErrorAction SilentlyContinue

# -- 5. (Opsional) Upload dist/ jika build --
if ($WithBuild) {
  Step "Upload dist/ via tar (1 arsip)..."
  $distTar = "$env:TEMP\sps-deploy-dist.tar"
  if (Test-Path $distTar) { Remove-Item $distTar -Force }
  & tar -cf $distTar -C $LOCAL_DIR dist 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Gagal membuat arsip dist" }
  $distSize = [math]::Round((Get-Item $distTar).Length/1KB,1)
  $remoteDistTar = "/tmp/sps-deploy-dist.tar"
  & scp @SshOpts $distTar "${VPS}:${remoteDistTar}" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Upload dist gagal" }
  & ssh @SshOpts $VPS "mkdir -p $REMOTE_DIR && tar -xf $remoteDistTar -C $REMOTE_DIR && rm -f $remoteDistTar" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Ekstrak dist gagal" }
  Ok "dist/ terkirim ($distSize KB)"
  Remove-Item $distTar -Force -ErrorAction SilentlyContinue
}

# -- 6. Install dependency HANYA jika package-lock berubah --
Step "Cek perubahan dependency..."
$localHash = (Get-FileHash "$LOCAL_DIR\package-lock.json" -Algorithm MD5).Hash
$remoteHash = (& ssh @SshOpts $VPS "md5sum $REMOTE_DIR/package-lock.json 2>/dev/null | cut -d' ' -f1" 2>&1).Trim()
if ($localHash -ne $remoteHash) {
  Step "package-lock berubah -> install dependency..."
  & scp @SshOpts "$LOCAL_DIR\package.json" "${VPS}:${REMOTE_DIR}/package.json" 2>&1 | Out-Null
  & scp @SshOpts "$LOCAL_DIR\package-lock.json" "${VPS}:${REMOTE_DIR}/package-lock.json" 2>&1 | Out-Null
  # --ignore-scripts: cegah hook 'prepare' memanggil husky (devDependency, tidak terpasang
  # di production --omit=dev) yang menyebabkan 'sh: husky: not found'.
  & ssh @SshOpts $VPS "cd $REMOTE_DIR && npm install --omit=dev --no-audit --no-fund --ignore-scripts" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "npm install gagal" }
  Ok "Dependency terpasang"
} else { Ok "Tidak ada perubahan dependency (skip install)" }

# -- 7. Restart PM2 --
Step "Restart PM2..."
& ssh @SshOpts $VPS "cd $REMOTE_DIR && if pm2 describe sps-backend >/dev/null 2>&1; then pm2 restart sps-backend --update-env; else env NODE_ENV=production pm2 start npm --name sps-backend -- start; pm2 save; fi" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Die "PM2 restart gagal" }
Ok "PM2 direstart"

# -- 8. Health check --
Step "Health check..."
Start-Sleep -Seconds 4
try {
  $resp = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 12
  Ok "Server sehat: $($resp | ConvertTo-Json -Compress)"
} catch {
  Write-Host "Health check GAGAL - log error:" -ForegroundColor Red
  & ssh @SshOpts $VPS "pm2 logs sps-backend --lines 20 --nostream --err" 2>&1
  Die "Server tidak merespons"
}

$sw.Stop()
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  FAST Deploy selesai dalam $([math]::Round($sw.Elapsed.TotalSeconds,1)) detik" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
