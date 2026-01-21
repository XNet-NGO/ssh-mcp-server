# SSH MCP Server v0.2.0 Release Notes

**Release Date**: January 21, 2026

## 🎉 Major Release: Stateless Design

Version 0.2.0 introduces a complete architectural redesign to work seamlessly with Docker MCP Gateway's ephemeral container model.

## 🚀 What's New

### Stateless Architecture

The SSH MCP Server now uses a **stateless design** where session IDs encode all connection parameters:

```javascript
// Session ID format (base64-encoded JSON)
sessionId = base64(JSON.stringify({
  host: "example.com",
  port: 22,
  username: "user",
  keyPath: "/path/to/key",
  config: { /* SSH options */ }
}))
```

### Key Benefits

1. **✅ Works with Ephemeral Containers**: Compatible with Docker MCP Gateway's `docker run --rm` model
2. **✅ No Persistence Complexity**: Sessions are recreated on-demand from encoded IDs
3. **✅ Self-Contained Session IDs**: All connection info encoded in the session ID
4. **✅ Reliable**: No race conditions with container cleanup
5. **✅ Simpler Architecture**: Removed StateManager and all persistence logic

## 📋 Breaking Changes

### Session ID Format

- **Before (v0.1.0)**: UUID format (36 chars)
  ```
  550e8400-e29b-41d4-a716-446655440000
  ```

- **After (v0.2.0)**: Base64-encoded JSON (300+ chars)
  ```
  eyJob3N0IjoiZXhhbXBsZS5jb20iLCJwb3J0IjoyMiwidXNlcm5hbWUiOiJ1c2VyIiwia2V5UGF0aCI6Ii90bXAvYXdzX2tleSIsImNvbmZpZyI6eyJzdHJpY3RIb3N0S2V5Q2hlY2tpbmciOnRydWUsImNvbm5lY3RUaW1lb3V0IjozMCwic2VydmVyQWxpdmVJbnRlcnZhbCI6NjAsImNvbXByZXNzaW9uIjp0cnVlLCJmb3J3YXJkQWdlbnQiOmZhbHNlLCJjdXN0b21PcHRpb25zIjp7fX19
  ```

### Session Behavior

- **ssh_list_sessions**: Now typically returns empty array (sessions only exist in current container)
- **ssh_disconnect**: Now mostly a no-op (cleanup happens automatically when container exits)
- **Session persistence**: Sessions are not persisted between tool calls (but this never worked in v0.1.0 anyway)

## 🔧 Technical Changes

### Files Modified

1. **src/core/ConnectionManager.ts**
   - Added `encodeSessionId()` and `decodeSessionId()` methods
   - Updated `createSession()` to use encoded IDs
   - Removed StateManager dependencies

2. **src/tools/CommandExecutionTools.ts**
   - Added session recreation logic from encoded IDs

3. **src/tools/FileTransferTools.ts**
   - Updated all methods to decode and recreate sessions

4. **src/tools/PortForwardingTools.ts**
   - Updated `createForward()` to decode and recreate sessions

5. **src/tools/ConnectionTools.ts**
   - Updated `listSessions()` and `disconnect()` for stateless behavior

### Files Deleted

- **src/core/StateManager.ts** - No longer needed

## 📦 Installation

### Docker

```bash
docker pull mcp/ssh-mcp-server:0.2.0
```

### NPM

```bash
npm install -g ssh-mcp-server@0.2.0
```

### From Source

```bash
git clone <repository-url>
cd ssh-mcp-server
git checkout v0.2.0
npm install
npm run build
```

## 🧪 Testing

The stateless implementation has been tested and verified:

```bash
$ node test-stateless.js

=== Testing Stateless SSH MCP Server ===

Test 1: Creating SSH connection...
✓ Session ID is base64-encoded (304 chars)

Test 2: Executing command with encoded session ID (new container)...
✓ Session decoded and recreated successfully

Test 3: Executing another command with same session ID (another new container)...
✓ Session decoded and recreated successfully

=== All tests passed! ===
```

## 📚 Documentation Updates

- ✅ README.md - Added stateless design explanation
- ✅ USAGE_GUIDE.md - Updated with v0.2.0 session ID information
- ✅ CHANGELOG.md - Complete version history
- ✅ STATELESS_IMPLEMENTATION_COMPLETE.md - Implementation details

## 🔄 Migration Guide

### For Users

**Good news**: No migration needed! The old persistence approach in v0.1.0 never worked with Docker MCP Gateway, so you're not losing any functionality.

**What to do:**
1. Update to v0.2.0
2. Use the session ID returned by `ssh_connect` for subsequent operations
3. Don't worry about `ssh_list_sessions` or `ssh_disconnect` - they're optional now

**Example workflow:**
```javascript
// 1. Connect and save session ID
const connectResponse = await ssh_connect({
  host: "example.com",
  username: "user",
  keyPath: "/path/to/key"
});
const sessionId = connectResponse.sessionId; // Save this!

// 2. Use session ID for subsequent operations
await ssh_execute({
  sessionId: sessionId,  // Use the saved session ID
  command: "hostname"
});

await sftp_upload({
  sessionId: sessionId,  // Same session ID works across tool calls
  localPath: "/local/file",
  remotePath: "/remote/file"
});
```

### For Developers

**Changes needed:**
1. Update tests to work with base64-encoded session IDs
2. Session IDs are now self-contained - no need to track them separately
3. All tool handlers now decode and recreate sessions automatically

## 🐛 Bug Fixes

- Fixed session persistence issues with Docker MCP Gateway
- Fixed race conditions with container cleanup
- Fixed StateManager write failures due to container termination

## 🎯 What's Next

- Update test suite to work with encoded session IDs
- Add session ID validation and error handling improvements
- Consider session ID compression for shorter IDs
- Add session ID caching for frequently used connections

## 📞 Support

- **Documentation**: [README.md](README.md), [USAGE_GUIDE.md](USAGE_GUIDE.md)
- **Issues**: Report on GitHub with detailed error messages
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## 🙏 Acknowledgments

Thanks to the Docker MCP Gateway team for the ephemeral container model that inspired this redesign!

---

**Upgrade today and enjoy reliable SSH sessions! 🚀**
