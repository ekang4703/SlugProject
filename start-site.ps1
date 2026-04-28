$port = 4173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "SlugRide is starting..." -ForegroundColor Green
Write-Host "Open http://127.0.0.1:$port in your browser." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

Set-Location $root
& C:\Python314\python.exe -m http.server $port
