# SSH MCP Server - Quick Start Guide

Get the SSH MCP Server up and running in 5 minutes.

## Prerequisites

- Node.js 18 or higher
- OpenSSH client tools (ssh, sftp, scp, ssh-keygen)
- An SSH server to connect to (for testing)

## Installation

### Option 1: From Source (Development)

```bash
# Clone the repository
git clone <repository-url>
cd ssh-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start
```

### Option 2: From NPM Package (Production)

```bash
# Install globally
npm install -g ssh-mcp-server

# Run the server
ssh-mcp-server
```

### Option 3: Docker

```bash
# Build the image
docker build -t ssh-mcp-server .

# Run the container
docker run -it \
  -v ~/.ssh:/root/.ssh:ro \
  ssh-mcp-server
```

## Configuration

### For Claude Desktop

Edit your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/absolute/path/to/ssh-mcp-server/dist/server.js"]
    }
  }
}
```

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["C:\\path\\to\\ssh-mcp-server\\dist\\server.js"]
    }
  }
}
```

### For Kiro IDE

Create or edit `.kiro/settings/mcp.json` in your workspace:

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

## Testing the Server

### Manual Test

```bash
# Start the server
node dist/server.js

# In another terminal, send a test request
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/server.js
```

You should see a list of available tools.

### Using with an AI Assistant

Once configured, you can use natural language commands:

**Example prompts:**

- "Connect to my server at example.com as user admin"
- "List all files in /var/log on the remote server"
- "Upload config.json to /etc/myapp/ on the server"
- "Generate a new ed25519 SSH key"
- "Create a local port forward from 8080 to remote 80"

## Available Tools

The server provides 15 SSH tools:

### Connection Management
- `ssh_connect` - Establish SSH connection
- `ssh_disconnect` - Close SSH connection
- `ssh_list_sessions` - List active sessions

### Command Execution
- `ssh_execute` - Execute remote commands

### File Transfer
- `sftp_upload` - Upload files
- `sftp_download` - Download files
- `sftp_list` - List directory contents
- `sftp_delete` - Delete remote files

### Key Management
- `ssh_keygen` - Generate SSH keys
- `ssh_list_keys` - List available keys
- `ssh_fingerprint` - Get key fingerprint

### Port Forwarding
- `ssh_port_forward` - Create SSH tunnel
- `ssh_close_forward` - Close SSH tunnel

### Configuration
- `ssh_get_config` - Get SSH configuration
- `ssh_set_option` - Set configuration option

## Example Usage

### Connect to a Server

```json
{
  "tool": "ssh_connect",
  "arguments": {
    "host": "example.com",
    "port": 22,
    "username": "admin",
    "keyPath": "~/.ssh/id_ed25519"
  }
}
```

### Execute a Command

```json
{
  "tool": "ssh_execute",
  "arguments": {
    "sessionId": "session-uuid-here",
    "command": "ls -la /var/log"
  }
}
```

### Upload a File

```json
{
  "tool": "sftp_upload",
  "arguments": {
    "sessionId": "session-uuid-here",
    "localPath": "./config.json",
    "remotePath": "/etc/myapp/config.json"
  }
}
```

## Troubleshooting

### Server Won't Start

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check if OpenSSH is installed
which ssh sftp scp ssh-keygen

# Check for errors
node dist/server.js 2>&1 | tee server.log
```

### Can't Connect to SSH Server

```bash
# Test SSH manually first
ssh user@host

# Check SSH configuration
cat ~/.ssh/config

# Verify known_hosts
cat ~/.ssh/known_hosts
```

### Tools Not Showing in AI Assistant

1. Restart the AI assistant application
2. Check the configuration file path
3. Verify the server path is correct
4. Check server logs for errors

## Next Steps

- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- See [README.md](README.md) for detailed documentation
- Check [design.md](.kiro/specs/ssh-mcp-server/design.md) for architecture details
- Review [requirements.md](.kiro/specs/ssh-mcp-server/requirements.md) for feature specifications

## Getting Help

- Check the logs: Server writes to stderr
- Test SSH manually: `ssh user@host`
- Verify configuration: Review your MCP config file
- Report issues: Create a GitHub issue with logs

## Security Notes

- Never share private keys
- Use strong passphrases
- Enable StrictHostKeyChecking in production
- Regularly rotate SSH keys
- Monitor failed authentication attempts

## License

MIT - See LICENSE file
