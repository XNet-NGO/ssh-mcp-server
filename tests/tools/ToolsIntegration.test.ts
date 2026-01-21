/**
 * Integration tests for all MCP tools
 *
 * Tests the integration of all tool handlers with their underlying components.
 * Validates that tools work correctly with ConnectionManager, SSHWrapper,
 * SFTPHandler, KeyManager, and ConfigurationManager.
 *
 * Validates: All requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { SFTPHandler } from '../../src/core/SFTPHandler.js';
import { KeyManager } from '../../src/core/KeyManager.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import { ConnectionTools } from '../../src/tools/ConnectionTools.js';
import { CommandExecutionTools } from '../../src/tools/CommandExecutionTools.js';
import { FileTransferTools } from '../../src/tools/FileTransferTools.js';
import { KeyManagementTools } from '../../src/tools/KeyManagementTools.js';
import { PortForwardingTools } from '../../src/tools/PortForwardingTools.js';
import { ConfigurationTools } from '../../src/tools/ConfigurationTools.js';

describe('Tools Integration', () => {
  let connectionManager: ConnectionManager;
  let sshWrapper: SSHWrapper;
  let sftpHandler: SFTPHandler;
  let keyManager: KeyManager;
  let configManager: ConfigurationManager;

  let connectionTools: ConnectionTools;
  let commandTools: CommandExecutionTools;
  let fileTools: FileTransferTools;
  let keyTools: KeyManagementTools;
  let portTools: PortForwardingTools;
  let configTools: ConfigurationTools;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    sshWrapper = new SSHWrapper(connectionManager, configManager);
    sftpHandler = new SFTPHandler(connectionManager, configManager);
    keyManager = new KeyManager(configManager);
    configManager = new ConfigurationManager();

    connectionTools = new ConnectionTools(connectionManager, sshWrapper);
    commandTools = new CommandExecutionTools(
      connectionManager,
      sshWrapper
    );
    fileTools = new FileTransferTools(connectionManager, sftpHandler);
    keyTools = new KeyManagementTools(keyManager);
    portTools = new PortForwardingTools(connectionManager, sshWrapper);
    configTools = new ConfigurationTools(configManager);
  });

  describe('Connection Tools Integration', () => {
    it('should create session with valid parameters', async () => {
      const response = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toHaveLength(2);

      const data = JSON.parse(response.content[1].text);
      expect(data.sessionId).toBeDefined();
      expect(data.host).toBe('example.com');
      expect(data.port).toBe(22);
      expect(data.username).toBe('testuser');

      // Verify session is tracked
      const sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(data.sessionId);
    });

    it('should disconnect and remove session', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const connectData = JSON.parse(connectResponse.content[1].text);
      const sessionId = connectData.sessionId;

      // Disconnect
      const disconnectResponse = await connectionTools.disconnect({
        sessionId,
      });

      expect(disconnectResponse.isError).toBeUndefined();
      const disconnectData = JSON.parse(disconnectResponse.content[1].text);
      expect(disconnectData.success).toBe(true);

      // Verify session is removed
      const sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should list all active sessions', async () => {
      // Create multiple sessions
      await connectionTools.connect({
        host: 'host1.com',
        port: 22,
        username: 'user1',
      });
      await connectionTools.connect({
        host: 'host2.com',
        port: 2222,
        username: 'user2',
      });

      // List sessions
      const response = await connectionTools.listSessions();

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.sessions).toHaveLength(2);
      expect(data.count).toBe(2);
    });
  });

  describe('Command Execution Tools Integration', () => {
    it('should execute command with valid session', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // Mock SSH execution
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue({
        stdout: 'command output',
        stderr: '',
        exitCode: 0,
        duration: 100,
      });

      // Execute command
      const response = await commandTools.execute({
        sessionId,
        command: 'echo test',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.stdout).toBe('command output');
      expect(data.exitCode).toBe(0);
    });

    it('should handle command execution with non-zero exit code', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // Mock SSH execution with non-zero exit code
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
        duration: 50,
      });

      // Execute command - non-zero exit code is not an error, just a result
      const response = await commandTools.execute({
        sessionId,
        command: 'invalid-command',
      });

      // The tool should return the result, not treat it as an error
      // Non-zero exit codes are valid command results
      const data = JSON.parse(response.content[1].text);
      expect(data.exitCode).toBe(127);
      expect(data.stderr).toContain('command not found');
    });
  });

  describe('File Transfer Tools Integration', () => {
    it('should upload file with valid session', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // Mock SFTP upload
      vi.spyOn(sftpHandler, 'uploadFile').mockResolvedValue({
        success: true,
        bytesTransferred: 1024,
        duration: 200,
      });

      // Upload file
      const response = await fileTools.upload({
        sessionId,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.success).toBe(true);
      expect(data.bytesTransferred).toBe(1024);
    });

    it('should download file with valid session', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // Mock SFTP download
      vi.spyOn(sftpHandler, 'downloadFile').mockResolvedValue({
        success: true,
        bytesTransferred: 2048,
        duration: 300,
      });

      // Download file
      const response = await fileTools.download({
        sessionId,
        remotePath: '/remote/file.txt',
        localPath: '/local/file.txt',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.success).toBe(true);
      expect(data.bytesTransferred).toBe(2048);
    });

    it('should list directory with valid session', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // Mock SFTP list
      vi.spyOn(sftpHandler, 'listDirectory').mockResolvedValue([
        {
          name: 'file1.txt',
          path: '/remote/file1.txt',
          size: 1024,
          permissions: '-rw-r--r--',
          owner: 'user',
          group: 'group',
          modifiedAt: new Date('2024-01-01'),
          isDirectory: false,
        },
      ]);

      // List directory
      const response = await fileTools.list({
        sessionId,
        remotePath: '/remote',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.files).toHaveLength(1);
      expect(data.files[0].name).toBe('file1.txt');
    });
  });

  describe('Key Management Tools Integration', () => {
    it('should generate key with valid parameters', async () => {
      // Mock key generation
      vi.spyOn(keyManager, 'generateKey').mockResolvedValue({
        privateKeyPath: '/path/to/key',
        publicKeyPath: '/path/to/key.pub',
        fingerprint: 'SHA256:abc123',
        algorithm: 'rsa',
        bits: 2048,
      });

      // Generate key
      const response = await keyTools.generateKey({
        algorithm: 'rsa',
        bits: 2048,
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.privateKeyPath).toBe('/path/to/key');
      expect(data.fingerprint).toBe('SHA256:abc123');
    });

    it('should list keys in directory', async () => {
      // Mock key listing
      vi.spyOn(keyManager, 'listKeys').mockResolvedValue([
        {
          path: '/path/to/key1',
          type: 'rsa',
          bits: 2048,
          fingerprint: 'SHA256:abc123',
          comment: 'key1',
        },
        {
          path: '/path/to/key2',
          type: 'ed25519',
          bits: 256,
          fingerprint: 'SHA256:def456',
          comment: 'key2',
        },
      ]);

      // List keys
      const response = await keyTools.listKeys({
        directory: '/path/to',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.keys).toHaveLength(2);
      expect(data.count).toBe(2);
    });

    it('should get key fingerprint', async () => {
      // Mock fingerprint computation
      vi.spyOn(keyManager, 'getFingerprint').mockResolvedValue(
        'SHA256:abc123def456'
      );

      // Get fingerprint
      const response = await keyTools.getFingerprint({
        keyPath: '/path/to/key',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.fingerprint).toBe('SHA256:abc123def456');
    });
  });

  describe('Port Forwarding Tools Integration', () => {
    it('should create local port forward', async () => {
      // Create session
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // Mock port forward creation
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue({
        forwardId: 'forward-123',
        process: {} as any,
      });

      // Create forward
      const response = await portTools.createForward({
        sessionId,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.forwardId).toBeDefined();
      expect(data.type).toBe('local');
    });

    it('should close port forward', async () => {
      // Create session and forward
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue({
        forwardId: 'forward-123',
        process: {} as any,
      });

      const createResponse = await portTools.createForward({
        sessionId,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });
      const forwardId = JSON.parse(createResponse.content[1].text).forwardId;

      // Mock close
      vi.spyOn(sshWrapper, 'closePortForward').mockResolvedValue();

      // Close forward
      const response = await portTools.closeForward({ forwardId });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.success).toBe(true);
    });
  });

  describe('Configuration Tools Integration', () => {
    it('should get host configuration', async () => {
      // Load config
      const configContent = `
Host example.com
  HostName 192.168.1.100
  Port 2222
  User testuser
`;
      configManager.loadConfig(configContent);

      // Get config
      const response = await configTools.getConfig({
        hostname: 'example.com',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.hostConfig.hostname).toBe('192.168.1.100');
      expect(data.hostConfig.port).toBe(2222);
      expect(data.hostConfig.user).toBe('testuser');
    });

    it('should set configuration option', async () => {
      // Set option
      const response = await configTools.setOption({
        key: 'ConnectTimeout',
        value: '60',
      });

      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.success).toBe(true);

      // Verify option was set
      const config = configManager.getConfig();
      expect(config.globalOptions['ConnectTimeout']).toBe('60');
    });
  });

  describe('Tool Chaining', () => {
    it('should chain connect → execute → disconnect', async () => {
      // 1. Connect
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      expect(connectResponse.isError).toBeUndefined();
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // 2. Execute command
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue({
        stdout: 'test output',
        stderr: '',
        exitCode: 0,
        duration: 100,
      });

      const executeResponse = await commandTools.execute({
        sessionId,
        command: 'echo test',
      });
      expect(executeResponse.isError).toBeUndefined();

      // 3. Disconnect
      const disconnectResponse = await connectionTools.disconnect({
        sessionId,
      });
      expect(disconnectResponse.isError).toBeUndefined();

      // Verify session is removed
      const sessions = connectionManager.listSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should chain connect → upload → download → disconnect', async () => {
      // 1. Connect
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // 2. Upload file
      vi.spyOn(sftpHandler, 'uploadFile').mockResolvedValue({
        success: true,
        bytesTransferred: 1024,
        duration: 200,
      });

      const uploadResponse = await fileTools.upload({
        sessionId,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });
      expect(uploadResponse.isError).toBeUndefined();

      // 3. Download file
      vi.spyOn(sftpHandler, 'downloadFile').mockResolvedValue({
        success: true,
        bytesTransferred: 1024,
        duration: 200,
      });

      const downloadResponse = await fileTools.download({
        sessionId,
        remotePath: '/remote/file.txt',
        localPath: '/local/downloaded.txt',
      });
      expect(downloadResponse.isError).toBeUndefined();

      // 4. Disconnect
      await connectionTools.disconnect({ sessionId });
    });

    it('should chain connect → port forward → execute → close forward → disconnect', async () => {
      // 1. Connect
      const connectResponse = await connectionTools.connect({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });
      const sessionId = JSON.parse(connectResponse.content[1].text).sessionId;

      // 2. Create port forward
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue({
        forwardId: 'forward-123',
        process: {} as any,
      });

      const forwardResponse = await portTools.createForward({
        sessionId,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });
      const forwardId = JSON.parse(forwardResponse.content[1].text).forwardId;

      // 3. Execute command
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue({
        stdout: 'test output',
        stderr: '',
        exitCode: 0,
        duration: 100,
      });

      await commandTools.execute({
        sessionId,
        command: 'echo test',
      });

      // 4. Close forward
      vi.spyOn(sshWrapper, 'closePortForward').mockResolvedValue();
      await portTools.closeForward({ forwardId });

      // 5. Disconnect
      await connectionTools.disconnect({ sessionId });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid session ID across tools', async () => {
      const invalidSessionId = 'invalid-session-id';

      // Try to execute command with invalid session
      const executeResponse = await commandTools.execute({
        sessionId: invalidSessionId,
        command: 'echo test',
      });
      expect(executeResponse.isError).toBe(true);

      // Try to upload file with invalid session
      const uploadResponse = await fileTools.upload({
        sessionId: invalidSessionId,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });
      expect(uploadResponse.isError).toBe(true);

      // Try to create port forward with invalid session
      const forwardResponse = await portTools.createForward({
        sessionId: invalidSessionId,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });
      expect(forwardResponse.isError).toBe(true);
    });

    it('should handle configuration errors gracefully', async () => {
      // Try to set invalid option
      const response = await configTools.setOption({
        key: 'InvalidOption',
        value: 'somevalue',
      });

      expect(response.isError).toBe(true);
      const error = JSON.parse(response.content[0].text);
      expect(error.message).toContain('Invalid configuration option');
    });
  });
});
