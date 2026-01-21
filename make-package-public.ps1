#!/usr/bin/env pwsh
# Make GitHub Container Registry package public

Write-Host "=== Making ssh-mcp-server package public ===" -ForegroundColor Cyan
Write-Host ""

$packageName = "ssh-mcp-server"
$org = "XNet-NGO"

Write-Host "Checking if package exists..." -ForegroundColor Yellow

# Try to find the package
$packages = gh api "/orgs/$org/packages?package_type=container" | ConvertFrom-Json

$package = $packages | Where-Object { $_.name -eq $packageName }

if (-not $package) {
    Write-Host "Package not found in organization. Checking user packages..." -ForegroundColor Yellow
    $userPackages = gh api "/user/packages?package_type=container" | ConvertFrom-Json
    $package = $userPackages | Where-Object { $_.name -eq $packageName }
}

if (-not $package) {
    Write-Host ""
    Write-Host "Package '$packageName' not found yet." -ForegroundColor Red
    Write-Host "This is normal - it can take a few minutes for GitHub to index the package." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please wait a few minutes and try again, or make it public manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/orgs/$org/packages/container/$packageName/settings" -ForegroundColor White
    Write-Host "2. Scroll to 'Danger Zone'" -ForegroundColor White
    Write-Host "3. Click 'Change visibility' -> Select 'Public'" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Found package: $($package.name)" -ForegroundColor Green
Write-Host "Current visibility: $($package.visibility)" -ForegroundColor White
Write-Host ""

if ($package.visibility -eq "public") {
    Write-Host "Package is already public!" -ForegroundColor Green
    exit 0
}

Write-Host "Making package public..." -ForegroundColor Yellow

# Determine the API endpoint based on owner type
if ($package.owner.type -eq "Organization") {
    $endpoint = "/orgs/$($package.owner.login)/packages/container/$packageName"
} else {
    $endpoint = "/user/packages/container/$packageName"
}

# Update visibility
try {
    gh api --method PATCH $endpoint -f visibility=public | Out-Null
    Write-Host ""
    Write-Host "=== Success! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package is now public!" -ForegroundColor Green
    Write-Host "Anyone can now pull the image with:" -ForegroundColor White
    Write-Host "  docker pull ghcr.io/$($org.ToLower())/$packageName:0.2.0" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "Failed to make package public via API." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make it public manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/orgs/$org/packages/container/$packageName/settings" -ForegroundColor White
    Write-Host "2. Scroll to 'Danger Zone'" -ForegroundColor White
    Write-Host "3. Click 'Change visibility' -> Select 'Public'" -ForegroundColor White
    Write-Host ""
    exit 1
}
