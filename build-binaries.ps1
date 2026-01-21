#!/usr/bin/env pwsh
# Build script for SSH MCP Server binaries
# Builds cross-platform executables for Linux, Windows, and macOS

Write-Host "=== SSH MCP Server Binary Builder ===" -ForegroundColor Cyan
Write-Host ""

# Check if pkg is installed
Write-Host "Checking for pkg..." -ForegroundColor Yellow
$pkgInstalled = Get-Command pkg -ErrorAction SilentlyContinue
if (-not $pkgInstalled) {
    Write-Host "Installing pkg globally..." -ForegroundColor Yellow
    npm install -g pkg
}

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "binaries") {
    Remove-Item -Recurse -Force binaries
}
New-Item -ItemType Directory -Path binaries | Out-Null

# Build TypeScript
Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript build failed!" -ForegroundColor Red
    exit 1
}

# Build binaries
Write-Host ""
Write-Host "Building binaries..." -ForegroundColor Cyan
Write-Host ""

$targets = @(
    @{name="Linux x64"; target="node18-linux-x64"; output="ssh-mcp-server-linux-x64"},
    @{name="Linux ARM64"; target="node18-linux-arm64"; output="ssh-mcp-server-linux-arm64"},
    @{name="Windows x64"; target="node18-win-x64"; output="ssh-mcp-server-win-x64.exe"},
    @{name="macOS x64"; target="node18-macos-x64"; output="ssh-mcp-server-macos-x64"},
    @{name="macOS ARM64"; target="node18-macos-arm64"; output="ssh-mcp-server-macos-arm64"}
)

foreach ($target in $targets) {
    Write-Host "Building $($target.name)..." -ForegroundColor Yellow
    pkg . --targets $target.target --output "binaries/$($target.output)"
    
    if ($LASTEXITCODE -eq 0) {
        $size = (Get-Item "binaries/$($target.output)").Length / 1MB
        Write-Host "  ✓ Built: $($target.output) ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to build $($target.name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Binaries created in ./binaries/" -ForegroundColor Green
Write-Host ""

# List all binaries
Get-ChildItem binaries | ForEach-Object {
    $size = $_.Length / 1MB
    Write-Host "  $($_.Name) - $([math]::Round($size, 2)) MB" -ForegroundColor White
}

Write-Host ""
Write-Host "To test a binary:" -ForegroundColor Yellow
Write-Host "  ./binaries/ssh-mcp-server-linux-x64" -ForegroundColor White
Write-Host "  ./binaries/ssh-mcp-server-win-x64.exe" -ForegroundColor White
Write-Host ""
