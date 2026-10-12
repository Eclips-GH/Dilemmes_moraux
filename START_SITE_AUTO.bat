@echo off
cd /d "%~dp0"

REM Démarre (ou relance) le serveur en arrière-plan
pm2 startOrReload "%~dp0ecosystem.config.cjs" --only dilemmes --update-env
if errorlevel 1 exit /b 1

REM Sauvegarde l'état PM2
pm2 save

exit
