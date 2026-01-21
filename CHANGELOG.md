# Changelog

All notable changes to the SSH MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-21

### Changed - BREAKING

- **Stateless Design**: Complete architectural redesign to work with ephemeral Docker containers
  - Session IDs are now base64-encoded JSON containing all connection parameters (instead of UUIDs)
  - Sessions are recreated on-demand from encoded session IDs (no persistence between tool calls)
  - Session ID format: `base64(JSON.stringify({host, port, username, keyPath, config}))`
  - Session IDs are now ~300 characters long (vs ~36 for UUIDs)

### Added

- `ConnectionManager.encodeSessionId()` - Encode connection params as base64 JSON
- `ConnectionManager.decodeSessionId()` - Decode session IDs back to connection params
- Session recreation logic in all tool handlers (CommandExecutionTools, FileTransferTools, PortForwardingTools)
- Comprehensive stateless design documentation

### Removed

- `StateManager` class - No longer needed in stateless design
- All file-based persistence logic
- `saveState()` calls throughout codebase

### Fixed

- Compatibility with Docker MCP Gateway's ephemeral container model (`docker run --rm`)
- Session persistence issues caused by container lifecycle

### Documentation

- Updated README.md with stateless design explanation
- Updated USAGE_GUIDE.md with v0.2.0 session ID information
- Added STATELESS_IMPLEMENTATION_COMPLETE.md
- Added CHANGELOG.md

### Migration Guide

**For Users:**
- Session IDs are now much longer (base64-encoded JSON instead of UUIDs)
- Save the session ID returned by `ssh_connect` for subsequent operations
- `ssh_list_sessions` will typically return empty array (sessions only exist in current container)
- `ssh_disconnect` is now mostly a no-op (cleanup happens automatically when container exits)
- No action required - the old persistence approach never worked with Docker MCP Gateway

**For Developers:**
- All tool handlers now decode session IDs and recreate sessions if not found in memory
- Session IDs encode all connection parameters, eliminating need for persistence
- Tests need to be updated to work with encoded session IDs

## [0.1.0] - 2026-01-20

### Added

- Initial release with comprehensive SSH functionality
- Connection management (ssh_connect, ssh_disconnect, ssh_list_sessions)
- Remote command execution (ssh_execute)
- File transfer operations (sftp_upload, sftp_download, sftp_list, sftp_delete)
- SSH key management (ssh_keygen, ssh_list_keys, ssh_fingerprint)
- Port forwarding (ssh_port_forward, ssh_close_forward)
- Configuration management (ssh_get_config, ssh_set_option)
- Comprehensive test suite with 978 tests (98.7% passing)
- Property-based testing for 36 correctness properties
- Docker containerization
- MCP protocol integration
- Security features (error handling, logging, input validation)

### Known Issues

- Session persistence did not work with Docker MCP Gateway (fixed in 0.2.0)
- StateManager attempted to save state but containers were killed before writes completed (fixed in 0.2.0)

---

## Version History

- **0.2.0** (2026-01-21): Stateless design for ephemeral containers
- **0.1.0** (2026-01-20): Initial release with stateful design

## Upgrade Notes

### From 0.1.0 to 0.2.0

This is a **breaking change** due to the new session ID format. However, since the persistence in 0.1.0 never worked with Docker MCP Gateway, no actual migration is needed.

**What to expect:**
1. Session IDs will be much longer (base64-encoded JSON)
2. Sessions work correctly across multiple tool calls (containers)
3. No need to worry about persistence - it's handled automatically

**What to do:**
1. Update to version 0.2.0
2. Use the session ID returned by `ssh_connect` for subsequent operations
3. Enjoy working SSH sessions! 🎉

## Future Plans

- [ ] Update tests to work with encoded session IDs
- [ ] Add session ID validation and error handling improvements
- [ ] Consider session ID compression for shorter IDs
- [ ] Add session ID caching for frequently used connections
- [ ] Implement session ID expiration/rotation for security

## Links

- [GitHub Repository](https://github.com/xnet/ssh-mcp-server)
- [Documentation](README.md)
- [Usage Guide](USAGE_GUIDE.md)
- [Deployment Guide](DEPLOYMENT.md)
