param(
  [switch]$SkipLint,
  [switch]$SkipBuild,
  [string]$VpsHost = "root@103.193.179.217",
  [string]$HealthUrl = "https://api.spscorner.store/api/test-ping"
)

$VPS = $VpsHost
$REMOTE_DIR = "/opt/sps-backend"
$LOCAL_DIR = (Get-Location).Path

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  SPS Corner - Deploy Backend to VPS  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipLint) {
  Write-Host ">>> Running type check..." -ForegroundColor Yellow
  $lintResult = & npm run lint 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Type check FAILED! Fix errors first, or use -SkipLint" -ForegroundColor Red
    Write-Host $lintResult
    exit 1
  }
  Write-Host "Type check passed" -ForegroundColor Green
}
else {
  Write-Host ">>> Skipping type check" -ForegroundColor DarkYellow
}

if (-not $SkipBuild) {
  Write-Host ">>> Building frontend..." -ForegroundColor Yellow
  & npm run build 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Build FAILED! Fix errors first, or use -SkipBuild" -ForegroundColor Red
    exit 1
  }
Write-Host "Build successful" -ForegroundColor Green
}
else {
  Write-Host ">>> Skipping frontend build" -ForegroundColor DarkYellow
}

Write-Host ">>> Preparing remote directories..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=accept-new $VPS "mkdir -p ${REMOTE_DIR}/dist ${REMOTE_DIR}/scripts ${REMOTE_DIR}/src/routes ${REMOTE_DIR}/src/services ${REMOTE_DIR}/src/middleware ${REMOTE_DIR}/src/utils" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Remote directory preparation FAILED!" -ForegroundColor Red
  exit 1
}

Write-Host ">>> Copying server.ts to VPS..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\server.ts" "${VPS}:${REMOTE_DIR}/server.ts" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "SCP server.ts FAILED!" -ForegroundColor Red
  exit 1
}
Write-Host "server.ts copied" -ForegroundColor Green

Write-Host ">>> Copying production environment (values hidden)..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\.env" "${VPS}:${REMOTE_DIR}/.env" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "SCP .env FAILED!" -ForegroundColor Red
  exit 1
}
ssh -o StrictHostKeyChecking=accept-new $VPS "chmod 600 ${REMOTE_DIR}/.env" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Setting .env permissions FAILED!" -ForegroundColor Red
  exit 1
}
Write-Host ".env copied with mode 600" -ForegroundColor Green

scp -r -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\src\routes\*" "${VPS}:${REMOTE_DIR}/src/routes/" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "SCP routes FAILED!" -ForegroundColor Red; exit 1 }
scp -r -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\src\services\*" "${VPS}:${REMOTE_DIR}/src/services/" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "SCP services FAILED!" -ForegroundColor Red; exit 1 }
scp -r -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\src\middleware\*" "${VPS}:${REMOTE_DIR}/src/middleware/" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "SCP middleware FAILED!" -ForegroundColor Red; exit 1 }
scp -r -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\src\utils\*" "${VPS}:${REMOTE_DIR}/src/utils/" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "SCP utils FAILED!" -ForegroundColor Red; exit 1 }
scp -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\scripts\verify-pending-ipaymu.ts" "${VPS}:${REMOTE_DIR}/scripts/verify-pending-ipaymu.ts" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "SCP iPaymu verifier FAILED!" -ForegroundColor Red; exit 1 }
scp -r -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\dist" "${VPS}:${REMOTE_DIR}/" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "SCP modules/dist FAILED!" -ForegroundColor Red
  exit 1
}
Write-Host "Modules and frontend build copied" -ForegroundColor Green

Write-Host ">>> Checking dependency changes..." -ForegroundColor Yellow
$localPkgHash = (Get-FileHash "$LOCAL_DIR\package-lock.json" -Algorithm MD5).Hash
$remotePkgHash = ssh -o StrictHostKeyChecking=accept-new $VPS "md5sum ${REMOTE_DIR}/package-lock.json 2>/dev/null | cut -d' ' -f1" 2>&1

if ($localPkgHash -ne $remotePkgHash) {
  Write-Host "Dependencies changed - installing..." -ForegroundColor Yellow
    scp -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\package.json" "${VPS}:${REMOTE_DIR}/package.json" 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "SCP package.json FAILED!" -ForegroundColor Red; exit 1 }
    scp -o StrictHostKeyChecking=accept-new "$LOCAL_DIR\package-lock.json" "${VPS}:${REMOTE_DIR}/package-lock.json" 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "SCP package-lock.json FAILED!" -ForegroundColor Red; exit 1 }
    ssh -o StrictHostKeyChecking=accept-new $VPS "cd ${REMOTE_DIR} && npm install" 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install FAILED!" -ForegroundColor Red
    exit 1
  }
  Write-Host "Dependencies installed" -ForegroundColor Green
}
else {
  Write-Host "No dependency changes" -ForegroundColor Green
}

Write-Host ">>> Flushing old PM2 logs..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=accept-new $VPS "pm2 flush" 2>&1

Write-Host ">>> Restarting PM2..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=accept-new $VPS "cd ${REMOTE_DIR} && if pm2 describe sps-backend >/dev/null 2>&1; then pm2 restart sps-backend --update-env; else env NODE_ENV=production pm2 start npm --name sps-backend -- start; pm2 save; fi" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "PM2 restart FAILED!" -ForegroundColor Red
  exit 1
}
Write-Host "PM2 restarted" -ForegroundColor Green

Write-Host ">>> Waiting for server..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
  $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
  $responseJson = $response | ConvertTo-Json -Compress
  Write-Host "Server is healthy - response: $responseJson" -ForegroundColor Green
}
catch {
  Write-Host "Server health check FAILED!" -ForegroundColor Red
    ssh -o StrictHostKeyChecking=accept-new $VPS "pm2 logs sps-backend --lines 20 --nostream --err" 2>&1
  exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Deploy to VPS completed!             " -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
