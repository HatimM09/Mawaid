# GitHub Sync Script
# This script will stage all changes, commit them, and push to your GitHub repository.

$commitMessage = Read-Host -Prompt 'Enter commit message (default: "Update project files")'
if ($commitMessage -eq "") { $commitMessage = "Update project files" }

Write-Host "Staging changes..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
$branch = git branch --show-current
if ($branch -eq "") { $branch = "main" }
git push origin $branch

Write-Host "GitHub Sync Complete!" -ForegroundColor Green
