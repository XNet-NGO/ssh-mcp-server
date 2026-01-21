# Docker Hub Integration Setup

**Date**: January 21, 2026  
**Status**: ✅ Repositories Created, Workflows Updated  
**Action Required**: Add GitHub Secrets

---

## Summary

Both MCP server projects now have Docker Hub repositories and updated GitHub workflows to automatically publish to both GitHub Container Registry (GHCR) and Docker Hub.

### Docker Hub Repositories Created

1. **openssh-mcp**: https://hub.docker.com/r/xnetadmin/openssh-mcp
2. **mcp-netbird**: https://hub.docker.com/r/xnetadmin/mcp-netbird

### GitHub Repositories Updated

1. **ssh-mcp-server**: `.github/workflows/release.yml` (local changes)
2. **mcp-netbird**: `.github/workflows/release.yml` (committed: 568831bd)

---

## What Was Configured

### Docker Hub Repositories

Both repositories are configured with:
- ✅ Public visibility
- ✅ Full description with features and links
- ✅ Links to GitHub repository
- ✅ Links to XNet website (https://xnet.ngo)
- ✅ Documentation links

### GitHub Workflows

Both workflows now:
- ✅ Build multi-arch images (linux/amd64, linux/arm64)
- ✅ Push to GitHub Container Registry (ghcr.io)
- ✅ Push to Docker Hub (docker.io/xnetadmin)
- ✅ Generate attestations and SBOM
- ✅ Sync README to Docker Hub automatically
- ✅ Update repository description on Docker Hub

---

## Required Action: Add GitHub Secrets

You need to add the `DOCKERHUB_TOKEN` secret to both GitHub repositories.

### Step 1: Get Your Docker Hub Token

Your Docker Hub Personal Access Token is stored in the environment variable `DOCKER_PAT`.
```
Username: xnetadmin
Token: (stored in $env:DOCKER_PAT)
```

### Step 2: Add Secret to ssh-mcp-server

1. Go to: https://github.com/XNet-NGO/ssh-mcp-server/settings/secrets/actions
2. Click "New repository secret"
3. Name: `DOCKERHUB_TOKEN`
4. Value: `<your-docker-hub-pat>`
5. Click "Add secret"

### Step 3: Add Secret to mcp-netbird

1. Go to: https://github.com/XNet-NGO/mcp-netbird/settings/secrets/actions
2. Click "New repository secret"
3. Name: `DOCKERHUB_TOKEN`
4. Value: `<your-docker-hub-pat>`
5. Click "Add secret"

### Using GitHub CLI (Alternative)

```bash
# For ssh-mcp-server
gh secret set DOCKERHUB_TOKEN --repo XNet-NGO/ssh-mcp-server --body "<your-docker-hub-pat>"

# For mcp-netbird
gh secret set DOCKERHUB_TOKEN --repo XNet-NGO/mcp-netbird --body "<your-docker-hub-pat>"
```

---

## How It Works

### On Release Tag Push

When you push a new version tag (e.g., `v0.2.1`):

1. **Build Phase**
   - Workflow builds multi-arch Docker images
   - Generates provenance attestation
   - Generates SBOM

2. **Push Phase**
   - Pushes to GHCR: `ghcr.io/xnet-ngo/<repo>:version`
   - Pushes to Docker Hub: `xnetadmin/<repo>:version`
   - Creates tags: `version`, `major.minor`, `major`, `latest`

3. **Documentation Phase**
   - Syncs README.md to Docker Hub
   - Updates repository description
   - Links are automatically clickable

### Image Tags

Both registries will have identical tags:

**GHCR (GitHub Container Registry)**:
- `ghcr.io/xnet-ngo/ssh-mcp-server:0.2.1`
- `ghcr.io/xnet-ngo/ssh-mcp-server:0.2`
- `ghcr.io/xnet-ngo/ssh-mcp-server:0`
- `ghcr.io/xnet-ngo/ssh-mcp-server:latest`

**Docker Hub**:
- `xnetadmin/openssh-mcp:0.2.1`
- `xnetadmin/openssh-mcp:0.2`
- `xnetadmin/openssh-mcp:0`
- `xnetadmin/openssh-mcp:latest`

Same pattern for mcp-netbird.

---

## Usage Examples

### Pull from Docker Hub

```bash
# SSH MCP Server
docker pull xnetadmin/openssh-mcp:latest
docker pull xnetadmin/openssh-mcp:0.2.1

# NetBird MCP Server
docker pull xnetadmin/mcp-netbird:latest
docker pull xnetadmin/mcp-netbird:0.2.1
```

### Pull from GHCR

```bash
# SSH MCP Server
docker pull ghcr.io/xnet-ngo/ssh-mcp-server:latest
docker pull ghcr.io/xnet-ngo/ssh-mcp-server:0.2.1

# NetBird MCP Server
docker pull ghcr.io/xnet-ngo/mcp-netbird:latest
docker pull ghcr.io/xnet-ngo/mcp-netbird:0.2.1
```

### Run Containers

```bash
# SSH MCP Server
docker run --rm -i \
  -v ~/.ssh:/root/.ssh:ro \
  xnetadmin/openssh-mcp:latest

# NetBird MCP Server
docker run --rm -i \
  -e NETBIRD_API_TOKEN=your-token \
  xnetadmin/mcp-netbird:latest
```

---

## Docker Hub Repository Links

### openssh-mcp

**Repository**: https://hub.docker.com/r/xnetadmin/openssh-mcp  
**Pull Command**: `docker pull xnetadmin/openssh-mcp:latest`

**Description**: Model Context Protocol server for comprehensive SSH operations. Developed by XNet Inc.

**Features**:
- Connection Management
- Command Execution
- File Operations (SFTP)
- Key Management
- Port Forwarding
- Configuration Management

**Links**:
- GitHub: https://github.com/XNet-NGO/ssh-mcp-server
- Website: https://xnet.ngo
- Documentation: https://github.com/XNet-NGO/ssh-mcp-server#readme

### mcp-netbird

**Repository**: https://hub.docker.com/r/xnetadmin/mcp-netbird  
**Pull Command**: `docker pull xnetadmin/mcp-netbird:latest`

**Description**: Model Context Protocol server for NetBird network management. Developed by XNet Inc.

**Features**:
- Full CRUD operations for all NetBird resources
- Advanced policy management with validation
- Group consolidation and dependency workflows
- Helper functions for common administrative tasks
- Comprehensive error handling and documentation

**Links**:
- GitHub: https://github.com/XNet-NGO/mcp-netbird
- Website: https://xnet.ngo
- Documentation: https://github.com/XNet-NGO/mcp-netbird#readme

---

## Workflow Changes

### ssh-mcp-server (.github/workflows/release.yml)

**Changes**:
1. ✅ Added Docker Hub login step
2. ✅ Added `xnetadmin/openssh-mcp` to image list
3. ✅ Added README sync step
4. ✅ Renamed attestation step for clarity

**Status**: Local changes (needs commit and push)

### mcp-netbird (.github/workflows/release.yml)

**Changes**:
1. ✅ Added Docker Hub login step
2. ✅ Added `xnetadmin/mcp-netbird` to image list
3. ✅ Added README sync step
4. ✅ Renamed attestation step for clarity

**Status**: Committed (568831bd09d284b07be2240c40171d6447d77809)

---

## Next Steps

### 1. Add GitHub Secrets ⚠️ REQUIRED

Add `DOCKERHUB_TOKEN` secret to both repositories (see instructions above).

### 2. Commit ssh-mcp-server Changes

```bash
cd /path/to/ssh-mcp-server
git add .github/workflows/release.yml
git commit -m "Add Docker Hub publishing and README sync to release workflow"
git push origin main
```

### 3. Create New Releases

After adding secrets and committing changes:

```bash
# ssh-mcp-server
cd /path/to/ssh-mcp-server
git tag v0.2.1
git push origin v0.2.1

# mcp-netbird
cd /path/to/mcp-netbird
git tag v0.2.1
git push origin v0.2.1
```

### 4. Verify Deployments

After releases complete:

**Check Docker Hub**:
- https://hub.docker.com/r/xnetadmin/openssh-mcp/tags
- https://hub.docker.com/r/xnetadmin/mcp-netbird/tags

**Check GHCR**:
- https://github.com/orgs/XNet-NGO/packages/container/package/ssh-mcp-server
- https://github.com/orgs/XNet-NGO/packages/container/package/mcp-netbird

**Test Pull**:
```bash
docker pull xnetadmin/openssh-mcp:0.2.1
docker pull xnetadmin/mcp-netbird:0.2.1
```

---

## Benefits

### Dual Registry Publishing

**GitHub Container Registry (GHCR)**:
- ✅ Integrated with GitHub
- ✅ Free for public repositories
- ✅ Attestations and SBOM
- ✅ Tight integration with GitHub Actions

**Docker Hub**:
- ✅ Most popular container registry
- ✅ Better discoverability
- ✅ Larger user base
- ✅ Official Docker ecosystem

### Automatic Documentation Sync

- ✅ README automatically synced to Docker Hub
- ✅ Repository description updated
- ✅ Links to GitHub and website
- ✅ Always up-to-date documentation

### Multi-Platform Support

- ✅ linux/amd64 (Intel/AMD)
- ✅ linux/arm64 (ARM/Apple Silicon)
- ✅ Works on all platforms
- ✅ Single pull command

---

## Troubleshooting

### Secret Not Found Error

**Error**: `Error: Input required and not supplied: password`

**Solution**: Add the `DOCKERHUB_TOKEN` secret to the repository (see Step 2 above).

### Authentication Failed

**Error**: `unauthorized: authentication required`

**Solution**: Verify the Docker Hub token is correct and has write permissions.

### README Not Syncing

**Error**: README not appearing on Docker Hub

**Solution**: 
1. Ensure `README.md` exists in repository root
2. Check workflow logs for errors
3. Verify `peter-evans/dockerhub-description@v4` step completed

### Image Not Found on Docker Hub

**Error**: `Error response from daemon: manifest for xnetadmin/openssh-mcp:0.2.1 not found`

**Solution**:
1. Check workflow completed successfully
2. Verify secret is added
3. Wait a few minutes for Docker Hub to index
4. Check Docker Hub repository page

---

## Summary

**Status**: ✅ Repositories created, workflows updated  
**Action Required**: Add `DOCKERHUB_TOKEN` secret to both GitHub repositories  
**Next Release**: Will publish to both GHCR and Docker Hub automatically

**Docker Hub Repositories**:
- https://hub.docker.com/r/xnetadmin/openssh-mcp
- https://hub.docker.com/r/xnetadmin/mcp-netbird

**GitHub Repositories**:
- https://github.com/XNet-NGO/ssh-mcp-server
- https://github.com/XNet-NGO/mcp-netbird

**Pull Commands**:
```bash
docker pull xnetadmin/openssh-mcp:latest
docker pull xnetadmin/mcp-netbird:latest
```

---

**Maintained by XNet Inc.**  
**Lead Developer: Joshua S. Doucette**  
**Website**: https://xnet.ngo
