Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TimeTrack Pro - He Thong Quan Ly Cham Cong va Nhan Su" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
Write-Host "Dang khoi chay may chu web..." -ForegroundColor Green
python main.py
