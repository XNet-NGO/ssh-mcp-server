# SSH MCP Server - Installation Guide

Multiple installation methods are available for SSH MCP Server v0.2.0.

## Quick Install

### Linux (DEB-based: Ubuntu, Debian, Mint)

```bash
# Download and install (x64)
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server_0.2.0_amd64.deb
sudo dpkg -i ssh-mcp-server_0.2.0_amd64.deb

# Or ARM64
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server_0.2.0_arm64.deb
sudo dpkg -i ssh-mcp-server_0.2.0_arm64.deb

# Verify installation
ssh-mcp-server --version
```

### Linux (RPM-based: RHEL, CentOS, Fedora, Rocky)

```bash
# Download standalone binary (x64)
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-linux-x64
chmod +x ssh-mcp-server-linux-x64
sudo mv ssh-mcp-server-linux-x64 /usr/local/bin/ssh-mcp-server

# Or ARM64
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-linux-arm64
chmod +x ssh-mcp-server-linux-arm64
sudo mv ssh-mcp-server-linux-arm64 /usr/local/bin/ssh-mcp-server

# Verify installation
ssh-mcp-server --version
```

### Linux (Standalone Binary)

```bash
# Download binary (x64)
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-linux-x64
chmod +x ssh-mcp-server-linux-x64
sudo mv ssh-mcp-server-linux-x64 /usr/local/bin/ssh-mcp-server

# Or ARM64
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-linux-arm64
chmod +x ssh-mcp-server-linux-arm64
sudo mv ssh-mcp-server-linux-arm64 /usr/local/bin/ssh-mcp-server

# Verify installation
ssh-mcp-server --version
```

### Linux (TAR.GZ Archive)

```bash
# Download and extract (x64)
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-linux-x64.tar.gz
tar -xzf ssh-mcp-server-0.2.0-linux-x64.tar.gz
cd ssh-mcp-server-0.2.0-linux-x64
sudo mv ssh-mcp-server /usr/local/bin/

# Or ARM64
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-linux-arm64.tar.gz
tar -xzf ssh-mcp-server-0.2.0-linux-arm64.tar.gz
cd ssh-mcp-server-0.2.0-linux-arm64
sudo mv ssh-mcp-server /usr/local/bin/

# Verify installation
ssh-mcp-server --version
```

### Linux (ZIP Archive)

```bash
# Download and extract (x64)
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-linux-x64.zip
unzip ssh-mcp-server-0.2.0-linux-x64.zip
cd ssh-mcp-server-0.2.0-linux-x64
sudo mv ssh-mcp-server /usr/local/bin/

# Or ARM64
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-linux-arm64.zip
unzip ssh-mcp-server-0.2.0-linux-arm64.zip
cd ssh-mcp-server-0.2.0-linux-arm64
sudo mv ssh-mcp-server /usr/local/bin/

# Verify installation
ssh-mcp-server --version
```

### Windows

```powershell
# Download binary
Invoke-WebRequest -Uri "https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-win-x64.exe" -OutFile "ssh-mcp-server.exe"

# Move to a directory in PATH (optional)
Move-Item ssh-mcp-server.exe C:\Windows\System32\

# Verify installation
ssh-mcp-server --version
```

### Windows (ZIP Archive)

```powershell
# Download and extract
Invoke-WebRequest -Uri "https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-windows-x64.zip" -OutFile "ssh-mcp-server.zip"
Expand-Archive ssh-mcp-server.zip -DestinationPath .
cd ssh-mcp-server-0.2.0-windows-x64

# Move to a directory in PATH (optional)
Move-Item ssh-mcp-server.exe C:\Windows\System32\

# Verify installation
ssh-mcp-server --version
```

### macOS

```bash
# Download binary (Intel)
curl -L https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-macos-x64 -o ssh-mcp-server
chmod +x ssh-mcp-server
sudo mv ssh-mcp-server /usr/local/bin/

# Or Apple Silicon (M1/M2/M3)
curl -L https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-macos-arm64 -o ssh-mcp-server
chmod +x ssh-mcp-server
sudo mv ssh-mcp-server /usr/local/bin/

# Verify installation
ssh-mcp-server --version
```

### macOS (TAR.GZ Archive)

```bash
# Download and extract (Intel)
curl -L https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-macos-x64.tar.gz -o ssh-mcp-server.tar.gz
tar -xzf ssh-mcp-server.tar.gz
cd ssh-mcp-server-0.2.0-macos-x64
sudo mv ssh-mcp-server /usr/local/bin/

# Or Apple Silicon (M1/M2/M3)
curl -L https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-macos-arm64.tar.gz -o ssh-mcp-server.tar.gz
tar -xzf ssh-mcp-server.tar.gz
cd ssh-mcp-server-0.2.0-macos-arm64
sudo mv ssh-mcp-server /usr/local/bin/

# Verify installation
ssh-mcp-server --version
```

### macOS (ZIP Archive)

```bash
# Download and extract (Intel)
curl -L https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-macos-x64.zip -o ssh-mcp-server.zip
unzip ssh-mcp-server.zip
cd ssh-mcp-server-0.2.0-macos-x64
sudo mv ssh-mcp-server /usr/local/bin/

# Or Apple Silicon (M1/M2/M3)
curl -L https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-macos-arm64.zip -o ssh-mcp-server.zip
unzip ssh-mcp-server.zip
cd ssh-mcp-server-0.2.0-macos-arm64
sudo mv ssh-mcp-server /usr/local/bin/

# Verify installation
ssh-mcp-server --version
```

## NPM Installation

```bash
# Global installation
npm install -g @xnet-ngo/ssh-mcp-server

# Verify installation
ssh-mcp-server --version
```

## Docker Installation

```bash
# Pull image from GitHub Container Registry
docker pull ghcr.io/xnet-ngo/ssh-mcp-server:0.2.0

# Or use latest
docker pull ghcr.io/xnet-ngo/ssh-mcp-server:latest

# Run server
docker run --rm -i \
  -v ~/.ssh:/root/.ssh:ro \
  ghcr.io/xnet-ngo/ssh-mcp-server:0.2.0
```

## From Source

```bash
# Clone repository
git clone https://github.com/XNet-NGO/ssh-mcp-server.git
cd ssh-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

## Configuration

### MCP Configuration

Add to your MCP configuration file:

**Using Binary:**
```json
{
  "mcpServers": {
    "ssh": {
      "command": "ssh-mcp-server"
    }
  }
}
```

**Using Docker:**
```json
{
  "mcpServers": {
    "ssh": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "~/.ssh:/root/.ssh:ro",
        "ghcr.io/xnet-ngo/ssh-mcp-server:0.2.0"
      ]
    }
  }
}
```

**Using Docker MCP Gateway:**
```json
{
  "mcpServers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": [
        "mcp", "gateway", "run",
        "--servers=ssh-mcp-server"
      ],
      "autoApprove": ["*"]
    }
  }
}
```

## Verification

Test the installation:

```bash
# Check version
ssh-mcp-server --version

# Test connection (requires MCP client)
# The server will start and wait for MCP protocol messages on stdin
```

## Uninstallation

### DEB Package
```bash
sudo dpkg -r ssh-mcp-server
```

### Binary
```bash
sudo rm /usr/local/bin/ssh-mcp-server
```

### NPM
```bash
npm uninstall -g @xnet-ngo/ssh-mcp-server
```

## Troubleshooting

### Permission Denied

If you get permission denied errors:

```bash
# Linux/macOS
chmod +x ssh-mcp-server
```

### Command Not Found

Ensure the binary is in your PATH:

```bash
# Linux/macOS
export PATH=$PATH:/usr/local/bin

# Windows (PowerShell)
$env:Path += ";C:\path\to\binary"
```

### OpenSSH Not Found

SSH MCP Server requires OpenSSH client tools:

```bash
# Ubuntu/Debian
sudo apt-get install openssh-client

# RHEL/CentOS/Fedora
sudo yum install openssh-clients

# macOS (usually pre-installed)
brew install openssh

# Windows
# Download from: https://github.com/PowerShell/Win32-OpenSSH/releases
```

## System Requirements

- **Operating System**: Linux, Windows, macOS
- **Architecture**: x86_64 (x64) or ARM64
- **OpenSSH**: Client tools must be installed
- **Memory**: 50MB minimum
- **Disk**: 100MB for binary + dependencies

## Support

- **Documentation**: https://github.com/XNet-NGO/ssh-mcp-server
- **Issues**: https://github.com/XNet-NGO/ssh-mcp-server/issues
- **Email**: contact@xnet.ngo

---

**Version**: 0.2.0  
**Copyright**: © 2026 XNet Inc., Joshua S. Doucette  
**License**: MIT
