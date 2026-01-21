# SSH MCP Server - Deployment Guide

This guide covers how to package and deploy the SSH MCP Server for production use.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- OpenSSH client tools installed on the target system:
  - `ssh`
  - `sftp`
  - `scp`
  - `ssh-keygen`
  - `ssh-add`

## Building for Production

### 1. Install Dependencies

```bash
npm install --production
```

### 2. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 3. Verify the Build

```bash
# Check that dist/ contains compiled files
ls -la dist/

# Test the server
node dist/server.js --help
```

## Deployment Options

### Option 1: NPM Package (Recommended)

Package the server as an npm package for easy distribution:

```bash
# Create a tarball
npm pack

# This creates ssh-mcp-server-0.1.0.tgz
```

Install on target system:

```bash
npm install -g ssh-mcp-server-0.1.0.tgz
```

### Option 2: Direct Deployment

Copy the built files to your target system:

```bash
# Create deployment package
mkdir -p deploy/ssh-mcp-server
cp -r dist/ deploy/ssh-mcp-server/
cp package.json deploy/ssh-mcp-server/
cp package-lock.json deploy/ssh-mcp-server/

# On target system
cd deploy/ssh-mcp-server
npm install --production
```

### Option 3: Docker Container

Create a Docker image for containerized deployment:

```dockerfile
# See Dockerfile in project root
docker build -t ssh-mcp-server:0.1.0 .
docker run -it ssh-mcp-server:0.1.0
```

## Configuration for AI Assistants

### Claude Desktop (MCP Configuration)

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/path/to/ssh-mcp-server/dist/server.js"]
    }
  }
}
```

Or if installed globally via npm:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "ssh-mcp-server"
    }
  }
}
```

### Kiro IDE

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["./dist/server.js"],
      "cwd": "/path/to/ssh-mcp-server",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Other MCP Clients

The server uses stdio transport and follows the MCP protocol specification. Configure your client to:

1. Execute: `node /path/to/dist/server.js`
2. Communicate via stdin/stdout
3. Use JSON-RPC 2.0 message format

## Environment Configuration

### SSH Configuration

The server respects standard SSH configuration:

- **Config file**: `~/.ssh/config`
- **Known hosts**: `~/.ssh/known_hosts`
- **Keys**: `~/.ssh/id_*`

### Custom Binary Paths

If OpenSSH binaries are not in PATH, configure custom paths:

```typescript
// In your integration code
import { ConfigurationManager } from 'ssh-mcp-server';

const configManager = new ConfigurationManager({
  binaryPaths: {
    ssh: '/usr/local/bin/ssh',
    sftp: '/usr/local/bin/sftp',
    scp: '/usr/local/bin/scp',
    sshKeygen: '/usr/local/bin/ssh-keygen',
    sshAdd: '/usr/local/bin/ssh-add',
  },
});
```

## Security Considerations

### 1. File Permissions

Ensure proper permissions on SSH files:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_*
chmod 644 ~/.ssh/id_*.pub
chmod 644 ~/.ssh/known_hosts
chmod 600 ~/.ssh/config
```

### 2. Key Management

- Use strong key algorithms (ed25519 or RSA 4096)
- Protect private keys with passphrases
- Rotate keys regularly
- Use ssh-agent for passphrase management

### 3. Network Security

- Use StrictHostKeyChecking=yes in production
- Maintain known_hosts file
- Use SSH certificates when possible
- Implement connection timeouts

### 4. Access Control

- Run server with minimal privileges
- Use dedicated service accounts
- Implement audit logging
- Monitor failed authentication attempts

## Monitoring and Logging

### Enable Debug Logging

Set debug mode in server configuration:

```typescript
const server = new MCPServer({ debug: true });
```

### Log Locations

- Server logs: stderr
- SSH operations: System logs (via OpenSSH)
- Security events: Application logs

### Health Checks

Monitor server health:

```bash
# Check if server is responding
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/server.js
```

## Troubleshooting

### Server Won't Start

1. Check Node.js version: `node --version` (must be >= 18.0.0)
2. Verify dependencies: `npm list`
3. Check file permissions
4. Review error logs

### SSH Operations Fail

1. Verify OpenSSH binaries: `which ssh sftp scp ssh-keygen`
2. Test SSH manually: `ssh user@host`
3. Check SSH configuration: `~/.ssh/config`
4. Verify known_hosts: `~/.ssh/known_hosts`

### Connection Issues

1. Check network connectivity
2. Verify firewall rules
3. Test SSH port: `nc -zv host 22`
4. Review SSH server logs

### Performance Issues

1. Monitor active sessions: Use `ssh_list_sessions` tool
2. Check ControlMaster sockets: `ls /tmp/ssh-mcp-*`
3. Review timeout settings
4. Monitor system resources

## Upgrading

### From Previous Version

1. Backup configuration files
2. Stop the server
3. Install new version
4. Rebuild: `npm run build`
5. Test in development
6. Deploy to production
7. Restart server

### Database Migrations

Not applicable - server uses in-memory session storage.

## Backup and Recovery

### What to Backup

- SSH configuration: `~/.ssh/config`
- SSH keys: `~/.ssh/id_*`
- Known hosts: `~/.ssh/known_hosts`
- Server configuration files

### Recovery Procedure

1. Restore configuration files
2. Verify file permissions
3. Test SSH connectivity
4. Restart server

## Production Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] OpenSSH client tools installed
- [ ] Project built successfully
- [ ] Dependencies installed (production only)
- [ ] SSH configuration verified
- [ ] File permissions correct
- [ ] Server starts without errors
- [ ] Tools respond correctly
- [ ] Security settings configured
- [ ] Monitoring enabled
- [ ] Backup procedures in place
- [ ] Documentation updated

## Support

For issues and questions:

- GitHub Issues: [project-url]/issues
- Documentation: See README.md and design.md
- Security Issues: Report privately to maintainers

## License

MIT - See LICENSE file for details
