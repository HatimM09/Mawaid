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
vercel env add VITE_SUPABASE_URL production "https://pquusffhuholbnlmuyen.supabase.co" --yes
vercel env add VITE_SUPABASE_ANON_KEY production "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzEzOTAsImV4cCI6MjA5OTM0NzM5MH0.lp8jDk4UalHg5dJHIxTinhqaCJ-OA1RVwcDjM3KxcTo" --yes

# Firebase Variables - REMOVED

Write-Host "Redeploying to apply environment variables..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host "Deployment Complete!" -ForegroundColor Green
