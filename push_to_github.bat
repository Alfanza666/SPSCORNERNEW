@echo off
echo Mengunggah file ke GitHub...
git add .
git commit -m "v4.6.8 - Update all files and documentation"
git push origin main
echo Selesai!
pause
