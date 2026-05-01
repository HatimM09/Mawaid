# Al-Mawaid Auto-Deploy & Sync
# This script will push to GitHub and then deploy to Vercel.

Write-Host "Syncing with GitHub..." -ForegroundColor Cyan
git add .
git commit -m "deploy: automatic sync before vercel push"
git push origin main

Write-Host "Checking for Vercel CLI..."
if (!(Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host "Adding Environment Variables..." -ForegroundColor Cyan
vercel env add VITE_SUPABASE_URL production "https://spciaktztqnjsttrtosu.supabase.co" --yes
vercel env add VITE_SUPABASE_ANON_KEY production "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwY2lha3R6dHFuanN0dHJ0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTkxMzQsImV4cCI6MjA5MTEzNTEzNH0.1RMezYllnPpgpEY7UKeD_6NlI6VliegWrQsNY4w6-0Y" --yes
vercel env add VITE_VAPID_KEY production "BI7o4xbJ7cSwM99ZzL3EMeZE3VUGYFVXKVL51EQfGd5gCoINzBex-KrcdgvxOmSzYPcLsg52-US0PtVZKSebXoo" --yes

# Firebase Variables - REMOVED

Write-Host "Redeploying to apply environment variables..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host "Deployment Complete!" -ForegroundColor Green
