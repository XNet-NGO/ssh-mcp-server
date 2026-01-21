# Build MCP Server Containers
# This script builds Docker containers for SSH and Netbird MCP servers

Write-Host "Building MCP Server Containers..." -ForegroundColor Cyan

# Build SSH MCP Server
Write-Host "`nBuilding SSH MCP Server..." -ForegroundColor Yellow
if (Test-Path "dist") {
    docker build -f Dockerfile.ssh -t mcp/ssh-mcp-server:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ SSH MCP Server built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to build SSH MCP Server" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ dist/ directory not found. Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

# Build Netbird MCP Server
Write-Host "`nBuilding Netbird MCP Server..." -ForegroundColor Yellow
$netbirdBinary = "$env:USERPROFILE\go\bin\mcp-netbird.exe"
if (Test-Path $netbirdBinary) {
    # Copy binary to current directory for Docker build
    Copy-Item $netbirdBinary "mcp-netbird" -Force
    
    docker build -f Dockerfile.netbird -t mcp/netbird-mcp-server:latest .
    
    # Clean up copied binary
    Remove-Item "mcp-netbird" -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Netbird MCP Server built successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to build Netbird MCP Server" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ Netbird MCP binary not found at $netbirdBinary" -ForegroundColor Red
    Write-Host "  Please ensure mcp-netbird is installed" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✓ All MCP containers built successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Copy mcp-catalog-custom.yaml to ~/.docker/mcp/catalogs/" -ForegroundColor White
Write-Host "2. Update ~/.docker/mcp/config.yaml with server configurations" -ForegroundColor White
Write-Host "3. Restart Kiro to load the new MCP servers" -ForegroundColor White
