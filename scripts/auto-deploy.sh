#!/bin/bash
# VPS Auto-Deploy Script
# Dipanggil oleh cron untuk auto-pull & restart saat ada push ke GitHub
set -e

cd /opt/sps-backend
LOG="/var/log/sps-deploy.log"

echo "[$(date "+%Y-%m-%d %H:%M:%S")] Checking for updates..." >> "$LOG"

git fetch origin main 2>> "$LOG" || { echo "  ✗ git fetch failed" >> "$LOG"; exit 1; }

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "  ✓ Already up to date ($LOCAL)" >> "$LOG"
  exit 0
fi

echo "  ↓ New commits detected: $LOCAL -> $REMOTE" >> "$LOG"

git pull origin main 2>> "$LOG" || { echo "  ✗ git pull failed" >> "$LOG"; exit 1; }

# Check dependency changes
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -qE "^(package\.json|package-lock\.json)$"; then
  echo "  ⚠ Dependencies changed — running npm install..." >> "$LOG"
  npm install 2>> "$LOG" || { echo "  ✗ npm install failed" >> "$LOG"; exit 1; }
  echo "  ✓ npm install done" >> "$LOG"
fi

pm2 restart sps-backend --update-env >> "$LOG" 2>&1
echo "  ✓ PM2 restarted" >> "$LOG"

sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.spscorner.store/api/test-ping 2>/dev/null)
if [ "$HTTP_CODE" != "200" ]; then
  echo "  ✗ Health check FAILED (HTTP $HTTP_CODE)" >> "$LOG"
else
  echo "  ✓ Server healthy (HTTP $HTTP_CODE)" >> "$LOG"
fi

echo "  ✓ Deploy complete: $(git log --oneline -1)" >> "$LOG"
