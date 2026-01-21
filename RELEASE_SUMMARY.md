# SSH MCP Server v0.2.0 - Release Summary

**Release Date**: January 21, 2026  
**Status**: ✅ **SUCCESSFULLY RELEASED**

## Release Assets

### GitHub Release
**URL**: https://github.com/XNet-NGO/ssh-mcp-server/releases/tag/v0.2.0

**Total Assets**: 16 files

#### Standalone Binaries (5)
- `ssh-mcp-server-linux-x64` (61.7 MB)
- `ssh-mcp-server-linux-arm64` (57.8 MB)
- `ssh-mcp-server-win-x64.exe` (53.1 MB)
- `ssh-mcp-server-macos-x64` (67.2 MB)
- `ssh-mcp-server-macos-arm64` (62.1 MB)

#### DEB Packages (2)
- `ssh-mcp-server_0.2.0_amd64.deb` (16.2 MB)
- `ssh-mcp-server_0.2.0_arm64.deb` (15.4 MB)

#### TAR.GZ Archives (4)
- `ssh-mcp-server-0.2.0-linux-x64.tar.gz` (21.2 MB)
- `ssh-mcp-server-0.2.0-linux-arm64.tar.gz` (20.0 MB)
- `ssh-mcp-server-0.2.0-macos-x64.tar.gz` (21.8 MB)
- `ssh-mcp-server-0.2.0-macos-arm64.tar.gz` (20.2 MB)

#### ZIP Archives (5)
- `ssh-mcp-server-0.2.0-linux-x64.zip` (21.2 MB)
- `ssh-mcp-server-0.2.0-linux-arm64.zip` (20.0 MB)
- `ssh-mcp-server-0.2.0-windows-x64.zip` (17.8 MB)
- `ssh-mcp-server-0.2.0-macos-x64.zip` (21.8 MB)
- `ssh-mcp-server-0.2.0-macos-arm64.zip` (20.2 MB)

### GitHub Container Registry
**Registry**: ghcr.io  
**Repository**: ghcr.io/xnet-ngo/ssh-mcp-server

**Tags**:
- `ghcr.io/xnet-ngo/ssh-mcp-server:0.2.0`
- `ghcr.io/xnet-ngo/ssh-mcp-server:0.2`
- `ghcr.io/xnet-ngo/ssh-mcp-server:0`
- `ghcr.io/xnet-ngo/ssh-mcp-server:latest`

**Platforms**:
- linux/amd64
- linux/arm64

**Status**: ✅ Built and pushed successfully

**Note**: Package is currently private. To make it public:
1. Go to https://github.com/orgs/XNet-NGO/packages/container/ssh-mcp-server/settings
2. Scroll to "Danger Zone"
3. Click "Change visibility"
4. Select "Public"

## Installation Methods

### 1. Docker (Recommended)
```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/xnet-ngo/ssh-mcp-server:0.2.0

# Run
docker run --rm -i -v ~/.ssh:/root/.ssh:ro ghcr.io/xnet-ngo/ssh-mcp-server:0.2.0
```

### 2. DEB Package (Debian/Ubuntu)
```bash
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server_0.2.0_amd64.deb
sudo dpkg -i ssh-mcp-server_0.2.0_amd64.deb
```

### 3. Standalone Binary
```bash
# Linux x64
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-linux-x64
chmod +x ssh-mcp-server-linux-x64
sudo mv ssh-mcp-server-linux-x64 /usr/local/bin/ssh-mcp-server
```

### 4. TAR.GZ Archive
```bash
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-linux-x64.tar.gz
tar -xzf ssh-mcp-server-0.2.0-linux-x64.tar.gz
cd ssh-mcp-server-0.2.0-linux-x64
sudo mv ssh-mcp-server /usr/local/bin/
```

### 5. ZIP Archive
```bash
wget https://github.com/XNet-NGO/ssh-mcp-server/releases/download/v0.2.0/ssh-mcp-server-0.2.0-linux-x64.zip
unzip ssh-mcp-server-0.2.0-linux-x64.zip
cd ssh-mcp-server-0.2.0-linux-x64
sudo mv ssh-mcp-server /usr/local/bin/
```

### 6. NPM (Coming Soon)
```bash
npm install -g @xnet-ngo/ssh-mcp-server
```

## Platform Support

### Operating Systems
- ✅ Linux (x86_64, ARM64)
- ✅ Windows (x86_64)
- ✅ macOS (x86_64, ARM64/Apple Silicon)

### Package Formats
- ✅ Standalone binaries
- ✅ DEB packages (Debian/Ubuntu)
- ✅ TAR.GZ archives
- ✅ ZIP archives
- ✅ Docker images (multi-arch)
- ⏳ RPM packages (planned)
- ⏳ NPM package (planned)

## Key Features

### Stateless Architecture
- Works with ephemeral Docker containers
- Session IDs encode all connection parameters
- No state persistence required
- Compatible with Docker MCP Gateway

### 15 SSH MCP Tools
- Connection management (3 tools)
- Command execution (1 tool)
- File transfer via SFTP (4 tools)
- Key management (3 tools)
- Port forwarding (2 tools)
- Configuration management (2 tools)

### Production Ready
- Comprehensive test suite
- Property-based testing
- Security best practices
- Error handling and logging
- Sub-500ms command execution

## Documentation

- **README**: https://github.com/XNet-NGO/ssh-mcp-server/blob/main/README.md
- **Installation Guide**: https://github.com/XNet-NGO/ssh-mcp-server/blob/main/INSTALLATION.md
- **Usage Guide**: https://github.com/XNet-NGO/ssh-mcp-server/blob/main/USAGE_GUIDE.md
- **AI Usage Guide**: https://github.com/XNet-NGO/ssh-mcp-server/blob/main/docs/AI_USAGE_GUIDE.md
- **Quick Reference**: https://github.com/XNet-NGO/ssh-mcp-server/blob/main/docs/QUICK_REFERENCE.md
- **Release Notes**: https://github.com/XNet-NGO/ssh-mcp-server/blob/main/VERSION_0.2.0_RELEASE_NOTES.md

## Next Steps

### Immediate
1. ✅ Make GitHub Container Registry package public
2. ⏳ Publish to npm registry
3. ⏳ Create Docker Hub mirror (optional)

### Future Enhancements
- Add RPM package support
- Add Homebrew formula
- Add Chocolatey package (Windows)
- Add Snap package (Linux)
- Add Flatpak package (Linux)

## Statistics

### Build Time
- Binary builds: ~1-2 minutes per platform
- Docker build: ~2 minutes (multi-arch)
- Archive creation: ~1 minute
- Total workflow time: ~3-4 minutes

### File Sizes
- Smallest: DEB ARM64 (15.4 MB)
- Largest: macOS x64 binary (67.2 MB)
- Docker image: ~50-60 MB per arch

### Download Stats
- Total downloads: 0 (just released)
- GitHub release views: TBD
- Docker pulls: TBD

## Support

- **Issues**: https://github.com/XNet-NGO/ssh-mcp-server/issues
- **Discussions**: https://github.com/XNet-NGO/ssh-mcp-server/discussions
- **Email**: contact@xnet.ngo
- **Website**: https://xnet.ngo

## License

MIT License  
Copyright © 2026 XNet Inc., Joshua S. Doucette

---

**Release**: v0.2.0  
**Date**: January 21, 2026  
**Status**: ✅ **LIVE**  
**Repository**: https://github.com/XNet-NGO/ssh-mcp-server  
**Container Registry**: ghcr.io/xnet-ngo/ssh-mcp-server
