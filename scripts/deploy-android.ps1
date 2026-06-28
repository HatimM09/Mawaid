<#
.SYNOPSIS
    Build and optionally deploy the Al-Mawaid Android app to Google Play Console.

.DESCRIPTION
    Builds the signed release Android App Bundle (AAB) and optionally uploads it
    to Google Play Console using fastlane supply or directly via the Google Play
    Developer API.

.PARAMETER SkipBuild
    Skip the Gradle build step. Useful if the AAB is already built.
    Default: $false

.PARAMETER Upload
    Upload the AAB to Google Play Console after building.
    Default: $false

.PARAMETER Track
    Google Play track to upload to (internal, alpha, beta, production).
    Default: "internal"

.PARAMETER Fastlane
    Use fastlane for uploading (requires Ruby + fastlane installed).
    Default: $true

.PARAMETER ServiceAccountKey
    Path to the Google Play service account JSON key.
    Default: "android/fastlane/play-service-account.json"

.PARAMETER AabPath
    Path to the AAB file to upload.
    Default: "android/app/build/outputs/bundle/release/app-release.aab"

.EXAMPLE
    .\scripts\deploy-android.ps1
    Build the signed release AAB only.

.EXAMPLE
    .\scripts\deploy-android.ps1 -Upload -Track internal
    Build and upload to Internal Testing track.

.EXAMPLE
    .\scripts\deploy-android.ps1 -Upload -Track production
    Build and upload to Production track (use with caution!).
#>

param(
    [switch]$SkipBuild = $false,
    [switch]$Upload = $false,
    [ValidateSet("internal", "alpha", "beta", "production")]
    [string]$Track = "internal",
    [switch]$Fastlane = $true,
    [string]$ServiceAccountKey = "android/fastlane/play-service-account.json",
    [string]$AabPath = "android/app/build/outputs/bundle/release/app-release.aab"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Al-Mawaid Android Deploy                      ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Package: com.almawaid.app                          ║" -ForegroundColor Cyan
Write-Host "║  Track:   $Track                                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build the AAB ─────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "▶ Step 1: Building signed release AAB..." -ForegroundColor Yellow

    # Ensure ANDROID_HOME is set
    if (-not (Get-ChildItem Env:ANDROID_HOME -ErrorAction SilentlyContinue)) {
        Write-Warning "ANDROID_HOME is not set. Attempting to detect from common paths..."
        $possiblePaths = @(
            "$env:LOCALAPPDATA\Android\Sdk",
            "$env:USERPROFILE\AppData\Local\Android\Sdk",
            "C:\Android\Sdk",
            "$env:ProgramFiles\Android\Sdk"
        )
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $env:ANDROID_HOME = $path
                Write-Host "  Found Android SDK at: $path" -ForegroundColor Green
                break
            }
        }
        if (-not $env:ANDROID_HOME) {
            Write-Error "Android SDK not found. Set ANDROID_HOME environment variable and try again."
            exit 1
        }
    }

    # Run gradle bundleRelease
    Push-Location (Join-Path $ProjectRoot "android")
    try {
        if ($IsWindows) {
            & ".\gradlew.bat" bundleRelease
        }
        else {
            & "./gradlew" bundleRelease
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Gradle build failed with exit code $LASTEXITCODE"
            exit 1
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "  ✅ Build complete!" -ForegroundColor Green
}
else {
    Write-Host "▶ Step 1: Skipping build (--SkipBuild flag set)" -ForegroundColor Gray
}

# ── Step 2: Upload to Google Play Console ────────────────────────────────
if ($Upload) {
    Write-Host "▶ Step 2: Uploading to Google Play Console ($Track track)..." -ForegroundColor Yellow

    $fullAabPath = Join-Path $ProjectRoot $AabPath
    if (-not (Test-Path $fullAabPath)) {
        Write-Error "AAB not found at: $fullAabPath. Build the app first or provide a valid path."
        exit 1
    }

    if ($Fastlane) {
        # ── Use fastlane supply ──────────────────────────────────────────
        Write-Host "  Using fastlane supply for upload..." -ForegroundColor Cyan

        # Check if fastlane is installed
        $fastlaneCheck = & "fastlane" "--version" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error @"
Fastlane is not installed. To install it:
  1. Install Ruby: https://rubyinstaller.org/
  2. Run: gem install fastlane
  3. Place your service account key at: android/fastlane/play-service-account.json
  Or use the Google Play Console web UI to upload manually.
"@
            exit 1
        }

        $serviceAccountFullPath = Join-Path $ProjectRoot $ServiceAccountKey
        if (-not (Test-Path $serviceAccountFullPath)) {
            Write-Warning "Service account key not found at: $serviceAccountFullPath"
            Write-Warning "Upload will fail until you place the JSON key file there."
            Write-Warning "See scripts/GOOGLE_PLAY_SETUP.md for instructions."
        }

        Push-Location (Join-Path $ProjectRoot "android")
        try {
            & "fastlane" "supply" `
                --aab $fullAabPath `
                --track $Track `
                --release_status "completed" `
                --skip_upload_apk `
                --skip_upload_metadata `
                --skip_upload_images `
                --skip_upload_screenshots `
                --timeout 600
        }
        finally {
            Pop-Location
        }
    }
    else {
        # ── Direct upload note (without fastlane) ────────────────────────
        Write-Host @"
  Direct API upload not available without fastlane.
  Options:
    - Use: .\scripts\deploy-android.ps1 -Upload -Fastlane
    - Or manually upload via Google Play Console:
      https://play.google.com/console/

  AAB path: $fullAabPath
"@ -ForegroundColor DarkYellow
    }

    Write-Host "  ✅ Upload complete!" -ForegroundColor Green
}
else {
    Write-Host "▶ Step 2: Skipping upload (use -Upload flag to enable)" -ForegroundColor Gray
}

# ── Summary ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Complete!                                          ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  AAB output: $AabPath" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
