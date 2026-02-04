@echo off
title START - Dilemmes Moraux
cd /d "%~dp0"

REM Démarre (ou relance) le serveur en arrière-plan
pm2 start "%~dp0server.js" --name dilemmes

REM Sauvegarde l'état PM2 (utile si tu utilises pm2 resurrect plus tard)
pm2 save

echo.
echo ✅ Site ON (en arriere-plan)
echo Local   : http://localhost:8000
echo LAN     : http://192.168.22.30:8000
echo Internet: http://85.90.23.242:18473
echo.
pause
