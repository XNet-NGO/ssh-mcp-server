#!/usr/bin/env pwsh
# Create GitHub Release for SSH MCP Server v0.2.0

Write-Host "=== Creating GitHub Release v0.2.0 ===" -ForegroundColor Cyan
Write-Host ""

$owner = "XNet-NGO"
$repo = "ssh-mcp-server"
$tag = "v0.2.0"

# Get the latest successful workflow run
Write-Host "Finding latest successful workflow run..." -ForegroundColor Yellow
$runs = gh run list --repo "$owner/$repo" --workflow "release.yml" --status success --limit 1 --json databaseId,conclusion | ConvertFrom-Json

if ($runs.Count -eq 0) {
    Write-Host "No successful workflow runs found!" -ForegroundColor Red
    exit 1
}

$runId = $runs[0].databaseId
Write-Host "Found run ID: $runId" -ForegroundColor Green
Write-Host ""

# Download artifacts
Write-Host "Downloading artifacts..." -ForegroundColor Yellow
if (Test-Path "release-artifacts") {
    Remove-Item -Recurse -Force release-artifacts
}
New-Item -ItemType Directory -Path release-artifacts | Out-Null

gh run download $runId --repo "$owner/$repo" --dir release-artifacts

Write-Host "Artifacts downloaded successfully!" -ForegroundColor Green
Write-Host ""

# Create release
Write-Host "Creating GitHub release..." -ForegroundColor Yellow

$releaseNotes = Get-Content VERSION_0.2.0_RELEASE_NOTES.md -Raw

# Check if release already exists
$existingRelease = gh release view $tag --repo "$owner/$repo" 2>$null

if ($existingRelease) {
    Write-Host "Release $tag already exists. Deleting..." -ForegroundColor Yellow
    gh release delete $tag --repo "$owner/$repo" --yes
}

# Create new release
gh release create $tag `
    --repo "$owner/$repo" `
    --title "SSH MCP Server v0.2.0 - Stateless Architecture" `
    --notes "$releaseNotes" `
    release-artifacts/ssh-mcp-server-linux-x64/ssh-mcp-server-linux-x64 `
    release-artifacts/ssh-mcp-server-linux-arm64/ssh-mcp-server-linux-arm64 `
    release-artifacts/ssh-mcp-server-win-x64.exe/ssh-mcp-server-win-x64.exe `
    release-artifacts/ssh-mcp-server-macos-x64/ssh-mcp-server-macos-x64 `
    release-artifacts/ssh-mcp-server-macos-arm64/ssh-mcp-server-macos-arm64 `
    release-artifacts/ssh-mcp-server_0.2.0_amd64.deb/ssh-mcp-server_0.2.0_amd64.deb `
    release-artifacts/ssh-mcp-server_0.2.0_arm64.deb/ssh-mcp-server_0.2.0_arm64.deb `
    release-artifacts/tar-archives/ssh-mcp-server-0.2.0-linux-x64.tar.gz `
    release-artifacts/tar-archives/ssh-mcp-server-0.2.0-linux-arm64.tar.gz `
    release-artifacts/tar-archives/ssh-mcp-server-0.2.0-macos-x64.tar.gz `
    release-artifacts/tar-archives/ssh-mcp-server-0.2.0-macos-arm64.tar.gz `
    release-artifacts/zip-archives/ssh-mcp-server-0.2.0-linux-x64.zip `
    release-artifacts/zip-archives/ssh-mcp-server-0.2.0-linux-arm64.zip `
    release-artifacts/zip-archives/ssh-mcp-server-0.2.0-windows-x64.zip `
    release-artifacts/zip-archives/ssh-mcp-server-0.2.0-macos-x64.zip `
    release-artifacts/zip-archives/ssh-mcp-server-0.2.0-macos-arm64.zip

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Release Created Successfully! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Release URL: https://github.com/$owner/$repo/releases/tag/$tag" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Failed to create release!" -ForegroundColor Red
    exit 1
}
