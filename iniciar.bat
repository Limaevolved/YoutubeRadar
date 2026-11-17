@echo off
cd /d "%~dp0"
if exist id.txt goto run
set /p ID=Cole o Application ID do Discord e aperte Enter:
>id.txt echo %ID%
:run
set /p ID=<id.txt
powershell -NoExit -Command "$env:DISCORD_CLIENT_ID='%ID%'; node server.js"
