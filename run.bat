@echo off
title TimeTrack Pro - He Thong Quan Ly Cham Cong
echo ========================================================
echo   TimeTrack Pro - He Thong Quan Ly Cham Cong va Nhan Su
echo ========================================================
echo.
cd /d "%~dp0"

echo Dang kiem tra va khoi dong may chu Web...
python main.py

if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi dong may chu.
    echo Vui long kiem tra Python da duoc cai dat day du cac thu vien:
    echo   pip install -r requirements.txt
    echo.
)

pause
