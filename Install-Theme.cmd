@echo off
cd /d "%~dp0"
node install.cjs install
if errorlevel 1 goto failed
node install.cjs enable-terminal
if errorlevel 1 goto failed
echo CLI and Windows Terminal appearance installed.
pause
exit /b 0
:failed
echo Installation refused or failed. Read the message above.
pause
exit /b 1
