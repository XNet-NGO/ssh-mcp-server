# SSH MCP Server - Usage Guide

**Version**: 0.2.0 (Stateless Design)

## Quick Start

The SSH MCP Server is now installed and configured for Kiro IDE. You can interact with it through natural language commands to your AI assistant.

## Important: Stateless Design (v0.2.0)

The SSH MCP Server uses a **stateless design** optimized for ephemeral Docker containers:

- **Session IDs are self-contained**: Each session ID encodes all connection parameters (base64 JSON)
- **No persistence between tool calls**: Sessions are recreated on-demand from the session ID
- **Use the session ID from ssh_connect**: Save the session ID returned by `ssh_connect` and use it for subsequent operations
- **ssh_list_sessions returns empty**: Since each tool call gets a fresh container, listing sessions typically returns an empty array
- **ssh_disconnect is optional**: Sessions are automatically cleaned up when containers exit

### Session ID Format

Session IDs look like this:
```
eyJob3N0IjoiZXhhbXBsZS5jb20iLCJwb3J0IjoyMiwidXNlcm5hbWUiOiJ1c2VyIiwia2V5UGF0aCI6Ii90bXAvYXdzX2tleSIsImNvbmZpZyI6eyJzdHJpY3RIb3N0S2V5Q2hlY2tpbmciOnRydWUsImNvbm5lY3RUaW1lb3V0IjozMCwic2VydmVyQWxpdmVJbnRlcnZhbCI6NjAsImNvbXByZXNzaW9uIjp0cnVlLCJmb3J3YXJkQWdlbnQiOmZhbHNlLCJjdXN0b21PcHRpb25zIjp7fX19
```

This is a base64-encoded JSON containing host, port, username, keyPath, and SSH configuration.

## Available Operations

### 1. SSH Key Management

**List all SSH keys:**
```
"Show me all my SSH keys"
"List available SSH keys"
```

**Get key fingerprint:**
```
"What's the fingerprint of my id_ed25519 key?"
"Get fingerprint for C:\Users\xnet-admin\.ssh\id_rsa_mcp"
```

**Generate new SSH key:**
```
"Generate a new ed25519 SSH key"
"Create an RSA 4096 key pair"
```

### 2. SSH Connections

**Connect to a server:**
```
"Connect to example.com as user admin"
"SSH to 192.168.1.100 on port 2222 as root"
"Connect to myserver.com using my id_ed25519 key"
```

**List active sessions:**
```
"Show me all active SSH sessions"
"List my SSH connections"
```

**Disconnect:**
```
"Disconnect from session [session-id]"
"Close all SSH connections"
```

### 3. Remote Command Execution

**Execute commands:**
```
"Run 'ls -la /var/log' on the remote server"
"Execute 'df -h' on session [session-id]"
"Check disk space on the remote host"
```

### 4. File Transfer

**Upload files:**
```
"Upload config.json to /etc/myapp/ on the remote server"
"Copy local file data.csv to remote /tmp/"
```

**Download files:**
```
"Download /var/log/app.log from the remote server"
"Get the remote file /etc/config.yaml"
```

**List remote directory:**
```
"List files in /var/www on the remote server"
"Show me what's in /home/user/documents"
```

**Delete remote file:**
```
"Delete /tmp/old-file.txt on the remote server"
"Remove the file /var/log/old.log"
```

### 5. Port Forwarding

**Create SSH tunnel:**
```
"Create a local port forward from 8080 to remote 80"
"Set up a SOCKS proxy on port 1080"
"Forward remote port 3306 to local 3307"
```

**Close tunnel:**
```
"Close port forward [forward-id]"
"Stop the SSH tunnel"
```

### 6. SSH Configuration

**Get configuration:**
```
"Show SSH config for github.com"
"What's my SSH configuration for example.com?"
```

**Set option:**
```
"Set SSH option StrictHostKeyChecking to yes"
"Configure ConnectTimeout to 30"
```

## Example Workflows

### Workflow 1: Deploy Configuration File

```
1. "Connect to production.example.com as deploy"
2. "Upload local config.yaml to /etc/app/config.yaml"
3. "Execute 'systemctl restart app' on the remote server"
4. "Disconnect from the session"
```

### Workflow 2: Retrieve Logs

```
1. "Connect to server.example.com as admin using id_rsa_mcp key"
2. "List files in /var/log/app"
3. "Download /var/log/app/error.log to local ./logs/"
4. "Disconnect"
```

### Workflow 3: Database Tunnel

```
1. "Connect to db-server.example.com as dbadmin"
2. "Create a local port forward from 3307 to remote 3306"
3. (Now you can connect to localhost:3307 to access the remote database)
```

### Workflow 4: Key Management

```
1. "List all my SSH keys"
2. "Get fingerprint for id_ed25519"
3. "Generate a new ed25519 key at ~/.ssh/id_ed25519_new"
```

## Tips

1. **Session IDs (v0.2.0)**: 
   - Session IDs are now base64-encoded connection parameters (much longer than before)
   - Save the session ID returned by `ssh_connect` for subsequent operations
   - The same session ID works across multiple tool calls (containers)
   - You don't need to call `ssh_list_sessions` - just use the session ID from `ssh_connect`

2. **Key Paths**: Use full paths for SSH keys on Windows:
   - `C:\Users\username\.ssh\id_ed25519`
   - Or use the tilde shorthand: `~/.ssh/id_ed25519`

3. **Error Messages**: If something fails, the server provides detailed error messages to help troubleshoot.

4. **Security**: 
   - Host key verification is enabled by default
   - Private keys are never exposed in responses
   - Passphrases are scrubbed from error messages

5. **Performance**:
   - ControlMaster is enabled by default for connection multiplexing
   - Each tool call creates a fresh container (stateless design)
   - Sessions are lightweight and recreated on-demand

## Troubleshooting

### Server Not Responding
1. Check if server is running: `ssh-mcp-server --help`
2. Verify MCP configuration: `.kiro/settings/mcp.json`
3. Restart Kiro IDE

### Connection Failures
1. Test SSH manually: `ssh user@host`
2. Check SSH configuration: `~/.ssh/config`
3. Verify known_hosts: `~/.ssh/known_hosts`
4. Check firewall rules

### Key Issues
1. Verify key exists: `ls ~/.ssh/`
2. Check key permissions: Should be 600 for private keys
3. Test key manually: `ssh -i ~/.ssh/id_ed25519 user@host`

### File Transfer Issues
1. Check file paths (use full paths on Windows)
2. Verify remote directory exists
3. Check permissions on both local and remote

## Advanced Usage

### Custom SSH Options

You can configure SSH options through the `ssh_set_option` tool:

```
"Set SSH option ConnectTimeout to 60"
"Configure StrictHostKeyChecking to no"
"Set ServerAliveInterval to 30"
```

### Debug Mode

For troubleshooting, you can enable verbose SSH output by configuring debug level in the server.

### Multiple Sessions

You can maintain multiple SSH sessions simultaneously by using different session IDs:

```
1. "Connect to server1.com as user1" → session-id-1 (base64-encoded)
2. "Connect to server2.com as user2" → session-id-2 (base64-encoded)
3. "Execute 'hostname' using session-id-1"
4. "Execute 'hostname' using session-id-2"
```

**Note**: In v0.2.0, each session ID is self-contained and can be used across multiple tool calls.

## Security Best Practices

1. **Use Key-Based Authentication**: Prefer SSH keys over passwords
2. **Enable StrictHostKeyChecking**: Verify host keys (enabled by default)
3. **Rotate Keys Regularly**: Generate new keys periodically
4. **Use Strong Keys**: Prefer ed25519 or RSA 4096
5. **Protect Private Keys**: Use passphrases on private keys
6. **Monitor Sessions**: Regularly check active sessions
7. **Disconnect When Done**: Close sessions after use

## Getting Help

- **Documentation**: See README.md, DEPLOYMENT.md, QUICKSTART.md
- **Smoke Test Results**: See SMOKE_TEST_RESULTS.md
- **Design Details**: See .kiro/specs/ssh-mcp-server/design.md
- **Requirements**: See .kiro/specs/ssh-mcp-server/requirements.md

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the smoke test results
3. Check server logs (stderr output)
4. Report issues with detailed error messages

---

**Happy SSH-ing! 🚀**
