@echo off
cd /d "%~dp0"

if exist id.txt goto run
:pedir
set "ID="
set /p "ID=Cole o Application ID do Discord e aperte Enter: "
if not defined ID goto pedir
>id.txt echo %ID%

:run
set /p ID=<id.txt
REM roda pelo powershell pq em alguns PCs o cmd nao acha o node
powershell -NoExit -Command "if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Node.js nao encontrado. Instale em https://nodejs.org'; return }; if (-not (Test-Path node_modules)) { Write-Host 'Instalando dependencias, so na primeira vez...'; npm install }; $env:DISCORD_CLIENT_ID='%ID%'; node server.js"
