@echo off
rem Double-click to install Overture into the Vivaldi on this PC. Arguments are passed through (e.g. -Uninstall).
setlocal
set "ARGS=%*"
if not "%~1"=="" goto run
if not exist "%APPDATA%\Opera Software\Opera Stable" goto run
echo Opera was found on this PC.
choice /c YN /m "Copy its workspaces, sidebar selection and icons into Vivaldi (stays on this PC)"
if errorlevel 2 goto run
set "ARGS=-FromOpera"
:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %ARGS%
set "CODE=%ERRORLEVEL%"
pause
exit /b %CODE%
