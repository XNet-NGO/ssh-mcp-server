# SSH MCP Server - Quick Reference

**Version**: 0.2.0

## Connection

```javascript
// With base64 key (Docker MCP Gateway)
const keyBase64 = Buffer.from(keyContent).toString('base64');
ssh_connect({
  host: "server.com",
  username: "user",
  privateKeyBase64: keyBase64,
  config: { strictHostKeyChecking: false }
})
```

## Command Execution

```javascript
ssh_execute({
  sessionId: "eyJob3N0...",
  command: "ls -la",
  timeout: 10000
})
```

## File Operations

```javascript
// Upload
sftp_upload({ sessionId, localPath: "/local/file", remotePath: "/remote/file" })

// Download
sftp_download({ sessionId, remotePath: "/remote/file", localPath: "/local/file" })

// List
sftp_list({ sessionId, remotePath: "/remote/dir" })

// Delete
sftp_delete({ sessionId, remotePath: "/remote/file" })
```

## Key Management

```javascript
// Generate
ssh_keygen({ algorithm: "ed25519", bits: 256, path: "/tmp/key" })

// List
ssh_list_keys({ directory: "/root/.ssh" })

// Fingerprint
ssh_fingerprint({ keyPath: "/root/.ssh/id_ed25519" })
```

## Port Forwarding

```javascript
// Local forward
ssh_port_forward({
  sessionId,
  type: "local",
  localPort: 8080,
  remoteHost: "localhost",
  remotePort: 80
})

// Dynamic (SOCKS)
ssh_port_forward({ sessionId, type: "dynamic", localPort: 1080 })
```

## Common Patterns

### Execute Script
```javascript
// 1. Create script
ssh_execute({ sessionId, command: "cat > /tmp/script.sh << 'EOF'\n#!/bin/bash\necho 'Hello'\nEOF" })

// 2. Make executable
ssh_execute({ sessionId, command: "chmod +x /tmp/script.sh" })

// 3. Execute
ssh_execute({ sessionId, command: "/tmp/script.sh" })

// 4. Cleanup
ssh_execute({ sessionId, command: "rm /tmp/script.sh" })
```

### Check Exit Code
```javascript
const result = await ssh_execute({ sessionId, command: "test -f /path/to/file" })
if (result.exitCode === 0) {
  console.log("File exists")
} else {
  console.log("File does not exist")
}
```

### Chain Commands
```javascript
ssh_execute({
  sessionId,
  command: "cd /var/www && git pull && npm install && pm2 restart app"
})
```

## Error Handling

```javascript
try {
  const result = await ssh_execute({ sessionId, command: "risky-command" })
  if (result.exitCode !== 0) {
    console.error("Command failed:", result.stderr)
  }
} catch (error) {
  console.error("Connection error:", error.message)
}
```

## Best Practices

✅ **DO**:
- Use base64-encoded keys with Docker MCP Gateway
- Check exit codes before processing output
- Set appropriate timeouts
- Reuse session IDs for multiple operations
- Use absolute paths for file operations

❌ **DON'T**:
- Pass plain text private keys
- Ignore stderr output
- Use very short timeouts
- Reconnect for every operation
- Use relative paths

## Troubleshooting

| Error | Solution |
|-------|----------|
| Permission denied | Check key is correct and properly encoded |
| Host key verification failed | Set `strictHostKeyChecking: false` |
| Connection refused | Verify SSH service is running |
| Connection timeout | Check network and increase timeout |
| Command failed | Check stderr for error details |

## Session ID Format

Session IDs are base64-encoded JSON containing:
- host, port, username
- privateKey (if provided)
- config options

**Important**: Session IDs contain sensitive data - handle securely!

---

For detailed documentation, see `AI_USAGE_GUIDE.md`

