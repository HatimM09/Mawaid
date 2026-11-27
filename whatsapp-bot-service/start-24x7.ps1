# Al-Mawaid Royal WhatsApp Bot — 24/7 Self-Healing Watchdog (Zero 3rd-Party)
$ErrorActionPreference = 'Continue'
$BotDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $BotDir 'bot-24x7.log'
$MaxLogBytes = 5MB

Set-Location $BotDir
Write-Host "🌙 Starting Al-Mawaid Royal WhatsApp Bot (24/7 Watchdog)..." -ForegroundColor Green
Write-Host "🌐 Control Panel: http://localhost:3000" -ForegroundColor Cyan

while ($true) {
  if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt $MaxLogBytes)) {
    Move-Item -Path $LogFile -Destination "$LogFile.old" -Force
  }

  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  Add-Content -Path $LogFile -Value "[$ts] Starting node bot.js..."

  node bot.js 2>&1 | Tee-Object -FilePath $LogFile -Append

  $exitCode = $LASTEXITCODE
  $tsEnd = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  Add-Content -Path $LogFile -Value "[$tsEnd] bot.js exited with code $exitCode. Restarting in 3s..."
  Start-Sleep -Seconds 3
}
