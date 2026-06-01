@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set VPS=root@45.158.126.76
set REMOTE_DIR=/opt/sps-backend

echo ======================================
echo   SPS Corner - Deploy Backend to VPS
echo ======================================
echo.

echo [1/5] Copying server.ts to VPS...
scp -o StrictHostKeyChecking=no server.ts %VPS%:%REMOTE_DIR%/server.ts
if %errorlevel% neq 0 (
  echo FAILED: SCP server.ts
  pause
  exit /b 1
)
echo OK

echo [2/5] Copying frontend files...
scp -r -o StrictHostKeyChecking=no src\pages\dashboard\seller\ %VPS%:%REMOTE_DIR%/src/pages/dashboard/seller/ 2>nul
scp -r -o StrictHostKeyChecking=no src\pages\dashboard\admin\ %VPS%:%REMOTE_DIR%/src/pages/dashboard/admin/ 2>nul
scp -r -o StrictHostKeyChecking=no src\routes\ %VPS%:%REMOTE_DIR%/src/routes/ 2>nul
scp -r -o StrictHostKeyChecking=no src\middleware\ %VPS%:%REMOTE_DIR%/src/middleware/ 2>nul
echo OK

echo [3/5] Restarting PM2...
ssh -o StrictHostKeyChecking=no %VPS% "pm2 restart sps-backend --update-env"
if %errorlevel% neq 0 (
  echo FAILED: PM2 restart
  pause
  exit /b 1
)
echo OK

echo [4/5] Waiting 5 seconds...
ping 127.0.0.1 -n 6 >nul

echo [5/5] Verifying server...
curl -s -o nul -w "HTTP %%{http_code}" https://api.spscorner.store/api/test-ping
echo.
echo Done!

pause
