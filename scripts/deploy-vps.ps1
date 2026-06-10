param(
  [switch]$SkipLint,
  [switch]$SkipBuild
)

$VPS = "root@45.158.126.76"
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

Write-Host ">>> Copying server.ts to VPS..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no "$LOCAL_DIR\server.ts" "${VPS}:${REMOTE_DIR}/server.ts" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "SCP server.ts FAILED!" -ForegroundColor Red
  exit 1
}
Write-Host "server.ts copied" -ForegroundColor Green

Write-Host ">>> Copying service & route modules..." -ForegroundColor Yellow
scp -r -o StrictHostKeyChecking=no "$LOCAL_DIR\src\routes\*" "${VPS}:${REMOTE_DIR}/src/routes/" 2>&1
scp -r -o StrictHostKeyChecking=no "$LOCAL_DIR\src\services\*" "${VPS}:${REMOTE_DIR}/src/services/" 2>&1
scp -r -o StrictHostKeyChecking=no "$LOCAL_DIR\src\middleware\*" "${VPS}:${REMOTE_DIR}/src/middleware/" 2>&1
Write-Host "Modules copied" -ForegroundColor Green

Write-Host ">>> Checking dependency changes..." -ForegroundColor Yellow
$localPkgHash = (Get-FileHash "$LOCAL_DIR\package-lock.json" -Algorithm MD5).Hash
$remotePkgHash = ssh -o StrictHostKeyChecking=no $VPS "md5sum ${REMOTE_DIR}/package-lock.json 2>/dev/null | cut -d' ' -f1" 2>&1

if ($localPkgHash -ne $remotePkgHash) {
  Write-Host "Dependencies changed - installing..." -ForegroundColor Yellow
  scp -o StrictHostKeyChecking=no "$LOCAL_DIR\package.json" "${VPS}:${REMOTE_DIR}/package.json" 2>&1
  scp -o StrictHostKeyChecking=no "$LOCAL_DIR\package-lock.json" "${VPS}:${REMOTE_DIR}/package-lock.json" 2>&1
  ssh -o StrictHostKeyChecking=no $VPS "cd ${REMOTE_DIR} && npm install" 2>&1
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
ssh -o StrictHostKeyChecking=no $VPS "pm2 flush" 2>&1

Write-Host ">>> Restarting PM2..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no $VPS "pm2 restart sps-backend --update-env" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "PM2 restart FAILED!" -ForegroundColor Red
  exit 1
}
Write-Host "PM2 restarted" -ForegroundColor Green

Write-Host ">>> Waiting for server..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
  $response = Invoke-RestMethod -Uri "https://api.spscorner.store/api/test-ping" -TimeoutSec 10
  $responseJson = $response | ConvertTo-Json -Compress
  Write-Host "Server is healthy - response: $responseJson" -ForegroundColor Green
}
catch {
  Write-Host "Server health check FAILED!" -ForegroundColor Red
  ssh -o StrictHostKeyChecking=no $VPS "pm2 logs sps-backend --lines 20 --nostream --err" 2>&1
  exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Deploy to VPS completed!             " -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
