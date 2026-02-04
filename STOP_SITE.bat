@echo off
title Arrêt du site - Dilemmes Moraux

echo ===============================
echo   ARRET DU SITE WEB
echo ===============================
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| find ":8000"') do (
    taskkill /PID %%a /F
)

echo.
echo Site arrêté.
pause
