Set-Location -Path $PSScriptRoot
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Mausu'ah Ikhtiyarat Ibn Hazm al-Fiqhiyyah - Al-Muhalla" -ForegroundColor Green
Write-Host "  Membuka browser di: http://127.0.0.1:4560" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Start-Process "http://127.0.0.1:4560"
node scripts/local-server.js
