@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
 echo Execute Instalar.cmd primeiro.
 pause
 exit /b 1
)
call npm start
pause
