param(
  [Parameter(Mandatory=$true)][string]$GithubRepo
)

$ErrorActionPreference = "Stop"

if (!(Test-Path ".git")) {
  git init
}

git branch -M main
git add .
git commit -m "Deploy Lisa Anatasha store"
git remote remove origin 2>$null
git remote add origin $GithubRepo
git push -u origin main

Write-Host ""
Write-Host "GitHub push selesai."
Write-Host "Lanjut Railway:"
Write-Host "  npm i -g @railway/cli"
Write-Host "  railway login"
Write-Host "  railway init"
Write-Host "  railway up"
