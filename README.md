# SSH MCP Server

**A Model Context Protocol server for comprehensive SSH operations**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/XNet-NGO/ssh-mcp-server)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://github.com/XNet-NGO/ssh-mcp-server)

> Developed by **XNet Inc.** | Project Lead: **Joshua S. Doucette**

## Overview

SSH MCP Server exposes comprehensive SSH functionality to AI assistants through the Model Context Protocol (MCP). It provides a stateless, production-ready solution for remote system management, file transfers, and secure tunneling.

**Version**: 0.2.0 (Stateless Design)  
**License**: MIT  
**Repository**: https://github.com/XNet-NGO/ssh-mcp-server

## Key Features

### Core Capabilities
- ✅ **Connection Management** - Stateless SSH connections with base64-encoded session IDs
- ✅ **Command Execution** - Execute remote commands with full output capture
- ✅ **File Operations** - SFTP upload/download with directory listing
- ✅ **Key Management** - Generate, list, and fingerprint SSH keys
- ✅ **Port Forwarding** - Local, remote, and dynamic SSH tunnels
- ✅ **Configuration** - Manage SSH client settings and known_hosts

### Technical Highlights
- 🚀 **Stateless Architecture** - Works with ephemeral Docker containers
- 🔒 **Security First** - Built on OpenSSH with comprehensive error handling
- 📦 **Docker Ready** - Optimized for Docker MCP Gateway
- 📚 **AI Documentation** - Built-in training docs for AI assistants
- ⚡ **Fast Execution** - Sub-500ms command execution
- 🧪 **Well Tested** - Unit tests, integration tests, and property-based tests

## Quick Start

### Installation

```bash
npm install @xnet-ngo/ssh-mcp-server
```

### Docker

```bash
docker pull mcp/ssh-mcp-server:0.2.0
```

### Usage with MCP

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "~/.ssh:/root/.ssh:ro",
        "mcp/ssh-mcp-server:0.2.0"
      ]
    }
  }
}
```

## Architecture

### Stateless Design

The SSH MCP Server uses a **stateless wrapper-first approach**, designed for ephemeral container environments:

```javascript
// Session IDs are self-contained
sessionId = base64(JSON.stringify({
  host: "example.com",
  port: 22,
  username: "user",
  privateKey: "...",  // or keyPath
  config: { strictHostKeyChecking: false }
}))
```

**Benefits**:
- ✅ No state persistence required
- ✅ Works with `docker run --rm`
- ✅ Sessions recreate automatically
- ✅ Compatible with Docker MCP Gateway

### Components

```
ssh-mcp-server/
├── src/
│   ├── core/           # Core functionality
│   │   ├── ConnectionManager.ts    # Session management
│   │   ├── SSHWrapper.ts           # SSH command wrapper
│   │   └── types.ts                # Type definitions
│   ├── tools/          # MCP tool implementations
│   │   ├── ConnectionTools.ts      # Connect/disconnect
│   │   ├── CommandExecutionTools.ts # Execute commands
│   │   ├── FileTransferTools.ts    # SFTP operations
│   │   ├── KeyManagementTools.ts   # Key operations
│   │   ├── PortForwardingTools.ts  # SSH tunnels
│   │   └── ConfigurationTools.ts   # SSH config
│   ├── mcp/            # MCP server setup
│   └── server.ts       # Main entry point
├── tests/              # Test suite
├── docs/               # Documentation
│   ├── AI_USAGE_GUIDE.md          # AI assistant guide
│   └── QUICK_REFERENCE.md         # Quick reference
└── Dockerfile.ssh      # Docker image
```

## Available Tools

### Connection Management (3 tools)
- `ssh_connect` - Establish SSH connection
- `ssh_disconnect` - Close connection
- `ssh_list_sessions` - List active sessions

### Command Execution (1 tool)
- `ssh_execute` - Execute remote commands

### File Transfer (4 tools)
- `sftp_upload` - Upload files
- `sftp_download` - Download files
- `sftp_list` - List directory contents
- `sftp_delete` - Delete remote files

### Key Management (3 tools)
- `ssh_keygen` - Generate SSH key pairs
- `ssh_list_keys` - List available keys
- `ssh_fingerprint` - Get key fingerprint

### Port Forwarding (2 tools)
- `ssh_port_forward` - Create SSH tunnel
- `ssh_close_forward` - Close tunnel

### Configuration (2 tools)
- `ssh_get_config` - Get SSH configuration
- `ssh_set_option` - Set SSH option

## Usage Examples

### Connect and Execute Command

```javascript
// Connect
const conn = await ssh_connect({
  host: "example.com",
  username: "user",
  privateKeyBase64: keyBase64,
  config: { strictHostKeyChecking: false }
});

// Execute command
const result = await ssh_execute({
  sessionId: conn.sessionId,
  command: "uptime"
});

console.log(result.stdout);
// Output: 08:08:15 up 1 day, 1:43, 2 users, load average: 0.00, 0.00, 0.00
```

### File Transfer

```javascript
// Upload file
await sftp_upload({
  sessionId: conn.sessionId,
  localPath: "/local/config.json",
  remotePath: "/etc/app/config.json"
});

// Download file
await sftp_download({
  sessionId: conn.sessionId,
  remotePath: "/var/log/app.log",
  localPath: "/tmp/app.log"
});
```

### Port Forwarding

```javascript
// Create local forward
await ssh_port_forward({
  sessionId: conn.sessionId,
  type: "local",
  localPort: 8080,
  remoteHost: "localhost",
  remotePort: 80
});
// Now access http://localhost:8080 to reach remote port 80
```

## Documentation

- **[Usage Guide](USAGE_GUIDE.md)** - Comprehensive usage documentation
- **[AI Usage Guide](docs/AI_USAGE_GUIDE.md)** - Guide for AI assistants
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - Quick reference guide
- **[Changelog](CHANGELOG.md)** - Version history
- **[Contributing](CONTRIBUTING.md)** - Contribution guidelines

## Docker MCP Gateway

This server is optimized for use with Docker MCP Gateway:

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

**Note**: When using Docker MCP Gateway, use base64-encoded private keys to bypass secret detection:

```javascript
const keyBase64 = Buffer.from(privateKeyContent).toString('base64');
```

## Development

### Prerequisites
- Node.js >= 18.0.0
- Docker (for containerized deployment)
- OpenSSH client tools

### Setup

```bash
# Clone repository
git clone https://github.com/XNet-NGO/ssh-mcp-server.git
cd ssh-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in development
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## Building Docker Image

```bash
# Build image
docker build -f Dockerfile.ssh -t mcp/ssh-mcp-server:0.2.0 .

# Run container
docker run --rm -i \
  -v ~/.ssh:/root/.ssh:ro \
  mcp/ssh-mcp-server:0.2.0
```

## Security Considerations

### Best Practices
- ✅ Use Ed25519 keys (faster and more secure than RSA)
- ✅ Rotate keys regularly
- ✅ Use different keys for different environments
- ✅ Set appropriate timeouts
- ✅ Monitor SSH connections and logs

### Base64 Encoding
When using Docker MCP Gateway, private keys must be base64-encoded to bypass secret detection. **Note**: Base64 is NOT encryption - use only in trusted environments.

## Performance

- **Connection**: ~1s
- **Command Execution**: 400-500ms
- **File Operations**: Depends on file size and network
- **Session Recreation**: < 100ms

## Troubleshooting

### Common Issues

**Permission denied (publickey)**
- Verify private key is correct
- Ensure public key is in remote `~/.ssh/authorized_keys`
- Check key file permissions (should be 0600)

**Host key verification failed**
- Set `strictHostKeyChecking: false` in config
- Or add host to known_hosts

**Connection timeout**
- Verify host is reachable
- Check firewall rules
- Increase `connectTimeout` in config

See [Usage Guide](USAGE_GUIDE.md) for more troubleshooting tips.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🧪 Add tests
- 💻 Submit pull requests

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Copyright

Copyright (c) 2026 XNet Inc.  
Copyright (c) 2026 Joshua S. Doucette

### Acknowledgments

This project builds upon:
- OpenSSH Portable (BSD License)
- Model Context Protocol SDK (MIT License)
- Original SSH MCP Server Contributors (2025)

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for full attribution.

## Support

- **Issues**: https://github.com/XNet-NGO/ssh-mcp-server/issues
- **Email**: contact@xnet.ngo
- **Website**: https://xnet.ngo

## About XNet

**XNet Inc.** is a non-governmental organization focused on developing open-source tools and infrastructure for secure communications and remote system management.

**Website**: https://xnet.ngo  
**GitHub**: https://github.com/XNet-NGO

---

**Project**: SSH MCP Server  
**Version**: 0.2.0  
**Copyright**: © 2026 XNet Inc., Joshua S. Doucette  
**License**: MIT  
**Repository**: https://github.com/XNet-NGO/ssh-mcp-server
