# Installs Al-Mawaid WhatsApp Bot 24/7 auto-start in the current user's Windows Startup folder (no admin required) and starts it now
$BotDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Watchdog = Join-Path $BotDir 'start-24x7.ps1'
$StartupDir = [Environment]::GetFolderPath('Startup')
$VbsPath = Join-Path $StartupDir 'AlMawaid-WhatsApp-Bot-24x7.vbs'

$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$Watchdog""", 0, False
"@

Set-Content -Path $VbsPath -Value $VbsContent -Encoding ASCII
Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Watchdog`"" -WorkingDirectory $BotDir
Write-Host "✅ Installed 24/7 Startup launcher: $VbsPath" -ForegroundColor Green
Write-Host "🌐 Open http://localhost:3000 to scan QR or check status." -ForegroundColor Cyan
