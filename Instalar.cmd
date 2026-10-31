@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale o Node.js 24 LTS em https://nodejs.org e tente novamente.
 pause
 exit /b 1
)
call npm ci
if errorlevel 1 goto erro
call npm run build
if errorlevel 1 goto erro
echo.
echo Pronto! Abra Iniciar.cmd ou Iniciar-na-rede.cmd.
pause
exit /b 0
:erro
echo Nao foi possivel preparar o aplicativo. Veja a mensagem acima.
pause
exit /b 1
