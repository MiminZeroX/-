@echo off
chcp 65001 >nul
title ระบบจองห้องประชุม - สำนักงานเขตบางรัก
cd /d "%~dp0"
rem เปิดแบบ HTTPS:  start-windows.bat --https   (สร้างใบรับรองด้วย mkcert ให้อัตโนมัติ)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   ไม่พบ Node.js ในเครื่องนี้
  echo   กรุณาดาวน์โหลดและติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org
  echo   ติดตั้งเสร็จแล้ว ให้ดับเบิลคลิกไฟล์นี้อีกครั้ง
  echo.
  start "" https://nodejs.org/
  pause
  exit /b 1
)

set "ARGS=%*"
set "HTTPS="
if not defined ARGS goto run
echo %ARGS% | findstr /i /c:"--https" >nul && set "HTTPS=1"
set "ARGS=%ARGS:--https=%"
if not defined HTTPS goto run

set "CERTDIR="
for /f "usebackq delims=" %%d in (`node scripts\https-cert.js %ARGS%`) do set "CERTDIR=%%d"
if not defined CERTDIR (
  pause
  exit /b 1
)
echo %ARGS% | findstr /i /c:"--port=" >nul || set "ARGS=%ARGS% --port=443"
set ARGS=%ARGS% "--tls-cert=%CERTDIR%\cert.pem" "--tls-key=%CERTDIR%\key.pem"

:run
node server.js %ARGS%
echo.
echo   ระบบหยุดทำงาน - จะเริ่มใหม่อัตโนมัติใน 5 วินาที (ปิดหน้าต่างนี้เพื่อหยุดถาวร)
timeout /t 5 >nul
goto run
