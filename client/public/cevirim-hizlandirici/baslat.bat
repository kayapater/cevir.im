@echo off
title Cevir.im Entegre Donanim Hizlandirici
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Hata olustu! Lutfen bu pencereyi ekran goruntusu alarak bildirin.
    pause
)
