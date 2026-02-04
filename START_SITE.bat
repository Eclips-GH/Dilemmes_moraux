@echo off
title Démarrage du site - Dilemmes Moraux
cd /d "%~dp0"

set PORT=8000

echo ===============================
echo   DEMARRAGE DU SITE WEB
echo ===============================
echo.
echo Site accessible sur :
echo - Local : http://localhost:8000
echo - Internet : http://85.90.23.242:18473
echo.
node server.js
pause
