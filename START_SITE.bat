@echo off
title ON - Dilemmes Moraux
cd /d "%~dp0"

REM Assure le port attendu par le routeur
set PORT=8000

REM Démarre (ou redémarre proprement) via PM2
pm2 start server.js --name dilemmes
pm2 save

echo.
echo ✅ Site ALLUME
echo Local   : http://localhost:8000
echo Internet: http://85.90.23.242:18473
echo.
pause
