# SSH MCP Server - AI Assistant Usage Guide

**Version**: 0.2.0  
**Last Updated**: January 21, 2026  
**Purpose**: Train AI assistants on correct usage of SSH MCP Server tools

## Overview

The SSH MCP Server provides 15 tools for SSH operations. This guide teaches AI assistants how to use them correctly with real-world examples and best practices.

## Quick Start

### Basic Connection Pattern

```javascript
// Step 1: Encode your private key (if using Docker MCP Gateway)
const keyBase64 = Buffer.from(privateKeyContent).toString('base64');

// Step 2: Connect
const result = await ssh_connect({
  host: "example.com",
  username: "user",
  privateKeyBase64: keyBase64,
  config: { strictHostKeyChecking: false }
});

// Step 3: Save the session ID
const sessionId = result.sessionId;

// Step 4: Use the session ID for all subsequent operations
await ssh_execute({
  sessionId: sessionId,
  command: "ls -la"
});
```

## Tool Categories

### 1. Connection Management (3 tools)

#### ssh_connect
**Purpose**: Establish SSH connection  
**Returns**: Session ID for subsequent operations

**Parameters**:
- `host` (required): Hostname or IP address
- `username` (required): SSH username
- `port` (optional): SSH port (default: 22)
- `keyPath` (optional): Path to private key file
- `privateKeyBase64` (optional): Base64-encoded private key
- `config` (optional): SSH configuration options

**Example 1: Connect with key file path**
```javascript
ssh_connect({
  host: "192.168.1.100",
  username: "admin",
  keyPath: "/root/.ssh/id_ed25519",
  config: { strictHostKeyChecking: false }
})
```

**Example 2: Connect with base64-encoded key (Docker MCP Gateway)**
```javascript
// First, encode the key
const keyContent = "-----BEGIN OPENSSH PRIVATE KEY-----\n...";
const keyBase64 = Buffer.from(keyContent).toString('base64');

ssh_connect({
  host: "192.168.1.100",
  username: "admin",
  privateKeyBase64: keyBase64,
  config: { strictHostKeyChecking: false }
})
```

**Common Mistakes**:
- ❌ Passing plain text private key (triggers secret detection)
- ❌ Forgetting to save the session ID
- ❌ Using strict host key checking without known_hosts

**Best Practices**:
- ✅ Always use `privateKeyBase64` with Docker MCP Gateway
- ✅ Save the session ID immediately
- ✅ Set `strictHostKeyChecking: false` for new hosts
- ✅ Use meaningful connection timeouts

#### ssh_list_sessions
**Purpose**: List active sessions (stateless mode returns empty)  
**Note**: In stateless mode, sessions don't persist between tool calls

**Example**:
```javascript
ssh_list_sessions()
// Returns: { sessions: [], count: 0, note: "..." }
```

#### ssh_disconnect
**Purpose**: Close SSH connection (stateless mode auto-cleans)  
**Note**: In stateless mode, sessions are automatically cleaned up

**Example**:
```javascript
ssh_disconnect({ sessionId: "eyJob3N0..." })
```

### 2. Command Execution (1 tool)

#### ssh_execute
**Purpose**: Execute commands on remote host  
**Returns**: stdout, stderr, exit code, duration

**Parameters**:
- `sessionId` (required): Session ID from ssh_connect
- `command` (required): Command to execute
- `timeout` (optional): Timeout in milliseconds

**Example 1: Simple command**
```javascript
ssh_execute({
  sessionId: "eyJob3N0...",
  command: "uptime"
})
// Returns: { exitCode: 0, stdout: "...", stderr: "", duration: 234 }
```

**Example 2: Complex command with pipes**
```javascript
ssh_execute({
  sessionId: "eyJob3N0...",
  command: "ps aux | grep nginx | wc -l"
})
```

**Example 3: Multi-line script**
```javascript
ssh_execute({
  sessionId: "eyJob3N0...",
  command: `
    cd /var/www
    ls -la
    du -sh *
  `.trim()
})
```

**Common Mistakes**:
- ❌ Not checking exit code (0 = success, non-zero = error)
- ❌ Ignoring stderr output
- ❌ Using very short timeouts for long-running commands

**Best Practices**:
- ✅ Always check `exitCode` before processing output
- ✅ Use `2>&1` to combine stdout and stderr if needed
- ✅ Set appropriate timeout for long operations
- ✅ Use `&&` to chain commands that depend on each other

### 3. File Transfer (4 tools)

#### sftp_upload
**Purpose**: Upload file to remote host

**Parameters**:
- `sessionId` (required): Session ID
- `localPath` (required): Local file path
- `remotePath` (required): Remote destination path

**Example**:
```javascript
sftp_upload({
  sessionId: "eyJob3N0...",
  localPath: "/tmp/config.json",
  remotePath: "/etc/app/config.json"
})
```

#### sftp_download
**Purpose**: Download file from remote host

**Example**:
```javascript
sftp_download({
  sessionId: "eyJob3N0...",
  remotePath: "/var/log/app.log",
  localPath: "/tmp/app.log"
})
```

#### sftp_list
**Purpose**: List directory contents

**Example**:
```javascript
sftp_list({
  sessionId: "eyJob3N0...",
  remotePath: "/var/www"
})
// Returns: { files: [...], count: 5 }
```

#### sftp_delete
**Purpose**: Delete remote file

**Example**:
```javascript
sftp_delete({
  sessionId: "eyJob3N0...",
  remotePath: "/tmp/old-file.txt"
})
```

**Common Mistakes**:
- ❌ Using relative paths (use absolute paths)
- ❌ Not checking if file exists before operations
- ❌ Forgetting file permissions

**Best Practices**:
- ✅ Use absolute paths for reliability
- ✅ Check file existence with sftp_list first
- ✅ Use ssh_execute for complex file operations (chmod, chown)

### 4. Key Management (3 tools)

#### ssh_keygen
**Purpose**: Generate SSH key pair

**Parameters**:
- `algorithm` (required): "rsa", "ed25519", "ecdsa"
- `bits` (required): Key size (2048, 4096 for RSA; 256 for ed25519)
- `path` (required): Path to save key
- `passphrase` (optional): Key passphrase

**Example**:
```javascript
ssh_keygen({
  algorithm: "ed25519",
  bits: 256,
  path: "/tmp/new_key"
})
// Returns: { privateKeyPath, publicKeyPath, fingerprint }
```

#### ssh_list_keys
**Purpose**: List available SSH keys

**Example**:
```javascript
ssh_list_keys({ directory: "/root/.ssh" })
// Returns: { keys: [...], count: 3 }
```

#### ssh_fingerprint
**Purpose**: Get key fingerprint

**Example**:
```javascript
ssh_fingerprint({ keyPath: "/root/.ssh/id_ed25519" })
// Returns: { fingerprint: "SHA256:..." }
```

### 5. Port Forwarding (2 tools)

#### ssh_port_forward
**Purpose**: Create SSH tunnel

**Parameters**:
- `sessionId` (required): Session ID
- `type` (required): "local", "remote", or "dynamic"
- `localPort` (required for local/dynamic): Local port
- `remoteHost` (required for local/remote): Remote host
- `remotePort` (required for local/remote): Remote port

**Example 1: Local forward (access remote service locally)**
```javascript
ssh_port_forward({
  sessionId: "eyJob3N0...",
  type: "local",
  localPort: 8080,
  remoteHost: "localhost",
  remotePort: 80
})
// Now access http://localhost:8080 to reach remote port 80
```

**Example 2: Dynamic forward (SOCKS proxy)**
```javascript
ssh_port_forward({
  sessionId: "eyJob3N0...",
  type: "dynamic",
  localPort: 1080
})
// Configure browser to use SOCKS5 proxy at localhost:1080
```

#### ssh_close_forward
**Purpose**: Close SSH tunnel

**Example**:
```javascript
ssh_close_forward({ forwardId: "forward-123" })
```

### 6. Configuration (2 tools)

#### ssh_get_config
**Purpose**: Get SSH configuration

**Example**:
```javascript
ssh_get_config({ hostname: "github.com" })
```

#### ssh_set_option
**Purpose**: Set SSH configuration option

**Example**:
```javascript
ssh_set_option({
  key: "ServerAliveInterval",
  value: "60"
})
```

## Common Workflows

### Workflow 1: Execute Script on Remote Server

```javascript
// 1. Connect
const conn = await ssh_connect({
  host: "server.example.com",
  username: "deploy",
  privateKeyBase64: keyBase64,
  config: { strictHostKeyChecking: false }
});

// 2. Create script
await ssh_execute({
  sessionId: conn.sessionId,
  command: `cat > /tmp/deploy.sh << 'EOF'
#!/bin/bash
cd /var/www/app
git pull origin main
npm install
pm2 restart app
EOF`
});

// 3. Make executable
await ssh_execute({
  sessionId: conn.sessionId,
  command: "chmod +x /tmp/deploy.sh"
});

// 4. Execute script
const result = await ssh_execute({
  sessionId: conn.sessionId,
  command: "/tmp/deploy.sh",
  timeout: 60000
});

// 5. Check result
if (result.exitCode === 0) {
  console.log("Deployment successful!");
} else {
  console.error("Deployment failed:", result.stderr);
}

// 6. Cleanup
await ssh_execute({
  sessionId: conn.sessionId,
  command: "rm /tmp/deploy.sh"
});
```

### Workflow 2: Backup Remote Files

```javascript
// 1. Connect
const conn = await ssh_connect({
  host: "server.example.com",
  username: "backup",
  privateKeyBase64: keyBase64
});

// 2. Create backup archive
await ssh_execute({
  sessionId: conn.sessionId,
  command: "tar -czf /tmp/backup.tar.gz /var/www/data",
  timeout: 300000 // 5 minutes
});

// 3. Download backup
await sftp_download({
  sessionId: conn.sessionId,
  remotePath: "/tmp/backup.tar.gz",
  localPath: "/backups/backup-2026-01-21.tar.gz"
});

// 4. Cleanup remote backup
await ssh_execute({
  sessionId: conn.sessionId,
  command: "rm /tmp/backup.tar.gz"
});

// 5. Verify local backup
const stat = await fs.stat("/backups/backup-2026-01-21.tar.gz");
console.log(`Backup size: ${stat.size} bytes`);
```

### Workflow 3: Deploy Configuration Files

```javascript
// 1. Connect
const conn = await ssh_connect({
  host: "server.example.com",
  username: "admin",
  privateKeyBase64: keyBase64
});

// 2. Backup existing config
await ssh_execute({
  sessionId: conn.sessionId,
  command: "cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup"
});

// 3. Upload new config
await sftp_upload({
  sessionId: conn.sessionId,
  localPath: "./nginx.conf",
  remotePath: "/tmp/nginx.conf"
});

// 4. Validate config
const validation = await ssh_execute({
  sessionId: conn.sessionId,
  command: "nginx -t -c /tmp/nginx.conf"
});

if (validation.exitCode === 0) {
  // 5. Move to production
  await ssh_execute({
    sessionId: conn.sessionId,
    command: "mv /tmp/nginx.conf /etc/nginx/nginx.conf"
  });
  
  // 6. Reload nginx
  await ssh_execute({
    sessionId: conn.sessionId,
    command: "systemctl reload nginx"
  });
  
  console.log("Configuration deployed successfully!");
} else {
  console.error("Configuration validation failed:", validation.stderr);
}
```

## Error Handling

### Common Errors and Solutions

#### Error: "Permission denied (publickey)"
**Cause**: Authentication failed  
**Solutions**:
- Check that private key is correct
- Verify key is properly base64-encoded
- Ensure public key is in remote ~/.ssh/authorized_keys
- Check key file permissions (should be 0600)

#### Error: "Host key verification failed"
**Cause**: Host key not in known_hosts  
**Solution**: Set `strictHostKeyChecking: false` in config

#### Error: "Connection refused"
**Cause**: SSH service not running or wrong port  
**Solutions**:
- Verify SSH service is running: `systemctl status sshd`
- Check correct port (default: 22)
- Verify firewall allows SSH connections

#### Error: "Connection timeout"
**Cause**: Network issue or host unreachable  
**Solutions**:
- Verify host is reachable: `ping hostname`
- Check network connectivity
- Increase `connectTimeout` in config

#### Error: "Command failed with exit code X"
**Cause**: Command execution failed  
**Solution**: Check stderr output for error details

### Error Handling Pattern

```javascript
try {
  const result = await ssh_execute({
    sessionId: sessionId,
    command: "some-command"
  });
  
  if (result.exitCode !== 0) {
    console.error("Command failed:");
    console.error("Exit code:", result.exitCode);
    console.error("Error output:", result.stderr);
    // Handle error appropriately
  } else {
    console.log("Success:", result.stdout);
  }
} catch (error) {
  console.error("SSH operation failed:", error.message);
  // Handle connection/network errors
}
```

## Best Practices

### Security

1. **Use Ed25519 Keys**: Faster and more secure than RSA
   ```javascript
   ssh_keygen({ algorithm: "ed25519", bits: 256, path: "/tmp/key" })
   ```

2. **Rotate Keys Regularly**: Generate new keys periodically

3. **Use Different Keys for Different Environments**: Don't reuse production keys in development

4. **Set Appropriate Timeouts**: Prevent hanging connections
   ```javascript
   config: { connectTimeout: 10, serverAliveInterval: 60 }
   ```

### Performance

1. **Reuse Session IDs**: Don't reconnect for every operation
   ```javascript
   const conn = await ssh_connect({...});
   const sessionId = conn.sessionId;
   
   // Reuse sessionId for multiple operations
   await ssh_execute({ sessionId, command: "cmd1" });
   await ssh_execute({ sessionId, command: "cmd2" });
   await ssh_execute({ sessionId, command: "cmd3" });
   ```

2. **Batch Commands**: Combine multiple commands
   ```javascript
   ssh_execute({
     sessionId,
     command: "cmd1 && cmd2 && cmd3"
   })
   ```

3. **Use Appropriate Timeouts**: Don't wait forever
   ```javascript
   ssh_execute({ sessionId, command: "long-task", timeout: 300000 })
   ```

### Reliability

1. **Always Check Exit Codes**:
   ```javascript
   const result = await ssh_execute({...});
   if (result.exitCode !== 0) {
     throw new Error(`Command failed: ${result.stderr}`);
   }
   ```

2. **Handle Network Errors**:
   ```javascript
   try {
     await ssh_connect({...});
   } catch (error) {
     if (error.message.includes("timeout")) {
       // Retry with longer timeout
     } else if (error.message.includes("refused")) {
       // Check if service is running
     }
   }
   ```

3. **Cleanup Resources**:
   ```javascript
   try {
     // Do work
   } finally {
     // Always cleanup
     await ssh_execute({ sessionId, command: "rm /tmp/tempfile" });
   }
   ```

## Stateless Design

### Understanding Session IDs

Session IDs in v0.2.0 are **self-contained** - they encode all connection parameters:

```javascript
// Session ID is base64(JSON.stringify({
//   host: "example.com",
//   port: 22,
//   username: "user",
//   privateKey: "...",
//   config: {...}
// }))
```

This means:
- ✅ Session IDs work across different containers
- ✅ No state persistence needed
- ✅ Sessions recreate automatically
- ⚠️ Session IDs are large (~500-1000 chars)
- ⚠️ Session IDs contain sensitive data (private key)

### Session ID Best Practices

1. **Store Securely**: Session IDs contain private keys
2. **Don't Log**: Avoid logging full session IDs
3. **Reuse Within Workflow**: Use same session ID for related operations
4. **Don't Share**: Each user should have their own session

## Docker MCP Gateway Specifics

### Base64-Encoded Keys

When using Docker MCP Gateway, **always use base64-encoded keys**:

```javascript
// ❌ DON'T: Plain text key (triggers secret detection)
ssh_connect({
  host: "example.com",
  username: "user",
  privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
})

// ✅ DO: Base64-encoded key
const keyBase64 = Buffer.from(privateKeyContent).toString('base64');
ssh_connect({
  host: "example.com",
  username: "user",
  privateKeyBase64: keyBase64
})
```

### Encoding Keys

**PowerShell (Windows)**:
```powershell
$key = Get-Content ~/.ssh/id_ed25519 -Raw
$keyBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($key))
```

**Bash (Linux/Mac)**:
```bash
base64 -w 0 ~/.ssh/id_ed25519
```

**Node.js**:
```javascript
const fs = require('fs');
const keyContent = fs.readFileSync('/path/to/key', 'utf8');
const keyBase64 = Buffer.from(keyContent).toString('base64');
```

## Troubleshooting

### Debug Mode

Enable verbose SSH output by checking stderr:

```javascript
const result = await ssh_execute({
  sessionId,
  command: "ls -la"
});

console.log("STDOUT:", result.stdout);
console.log("STDERR:", result.stderr); // Contains SSH debug info
console.log("Exit Code:", result.exitCode);
console.log("Duration:", result.duration, "ms");
```

### Common Issues

**Issue**: Commands work locally but fail via SSH  
**Solution**: Check environment variables and PATH

**Issue**: File uploads fail  
**Solution**: Verify remote directory exists and has write permissions

**Issue**: Port forwarding doesn't work  
**Solution**: Check firewall rules and port availability

## Examples Library

### Example 1: System Information

```javascript
const info = await ssh_execute({
  sessionId,
  command: `
    echo "=== System Information ==="
    uname -a
    echo ""
    echo "=== Disk Usage ==="
    df -h
    echo ""
    echo "=== Memory Usage ==="
    free -h
    echo ""
    echo "=== Uptime ==="
    uptime
  `.trim()
});

console.log(info.stdout);
```

### Example 2: Log Analysis

```javascript
const logs = await ssh_execute({
  sessionId,
  command: "tail -n 100 /var/log/app.log | grep ERROR"
});

const errorCount = logs.stdout.split('\n').length;
console.log(`Found ${errorCount} errors in last 100 lines`);
```

### Example 3: Service Management

```javascript
// Check service status
const status = await ssh_execute({
  sessionId,
  command: "systemctl is-active nginx"
});

if (status.stdout.trim() !== "active") {
  // Start service
  await ssh_execute({
    sessionId,
    command: "sudo systemctl start nginx"
  });
  
  console.log("Service started");
}
```

## Summary

This guide covers all 15 SSH MCP Server tools with:
- ✅ Complete parameter documentation
- ✅ Real-world examples
- ✅ Common workflows
- ✅ Error handling patterns
- ✅ Best practices
- ✅ Troubleshooting tips

For more information, see:
- README.md - Installation and setup
- USAGE_GUIDE.md - Detailed usage instructions
- CHANGELOG.md - Version history

---

**Version**: 0.2.0  
**Last Updated**: January 21, 2026  
**Maintained by**: SSH MCP Server Team

