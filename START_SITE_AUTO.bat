@echo off
cd /d "%~dp0"

REM Démarre (ou relance) le serveur en arrière-plan
pm2 start "%~dp0server.js" --name dilemmes

REM Sauvegarde l'état PM2
pm2 save

exit
