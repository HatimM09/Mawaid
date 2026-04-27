# Vercel Deployment Script
# This script will deploy the project to Vercel and set up the necessary environment variables.

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

# Firebase Variables
vercel env add VITE_FIREBASE_API_KEY production "AIzaSyDKLqH2nXvMHCD_WK9PvMOjs49mgXzMU7g" --yes
vercel env add VITE_FIREBASE_AUTH_DOMAIN production "al-mawaid-d1801.firebaseapp.com" --yes
vercel env add VITE_FIREBASE_PROJECT_ID production "al-mawaid-d1801" --yes
vercel env add VITE_FIREBASE_STORAGE_BUCKET production "al-mawaid-d1801.firebasestorage.app" --yes
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production "167074939367" --yes
vercel env add VITE_FIREBASE_APP_ID production "1:167074939367:web:9667ddea023fae9396fd42" --yes
vercel env add VITE_FIREBASE_VAPID_KEY production "BI7o4xbJ7cSwM99ZzL3EMeZE3VUGYFVXKVL51EQfGd5gCoINzBex-KrcdgvxOmSzYPcLsg52-US0PtVZKSebXoo" --yes

Write-Host "Redeploying to apply environment variables..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host "Deployment Complete!" -ForegroundColor Green
