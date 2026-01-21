/**
 * Unit Tests for Command Execution Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandExecutionTools } from '../../src/tools/CommandExecutionTools.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import { CommandResult } from '../../src/core/types.js';

describe('CommandExecutionTools', () => {
  let commandTools: CommandExecutionTools;
  let connectionManager: ConnectionManager;
  let sshWrapper: SSHWrapper;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    connectionManager = new ConnectionManager();
    sshWrapper = new SSHWrapper(configManager);
    commandTools = new CommandExecutionTools(connectionManager, sshWrapper);
  });

  describe('ssh_execute', () => {
    it('should execute command and return result', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand to return success
      const mockResult: CommandResult = {
        stdout: 'Hello World\n',
        stderr: '',
        exitCode: 0,
        duration: 123,
      };
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue(mockResult);

      const response = await commandTools.execute({
        sessionId: session.id,
        command: 'echo "Hello World"',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);

      // Parse the response to check command result
      const dataContent = response.content.find((c) =>
        c.text?.includes('exitCode')
      );
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.exitCode).toBe(0);
        expect(data.stdout).toBe('Hello World\n');
        expect(data.stderr).toBe('');
        expect(data.duration).toBe(123);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await commandTools.execute({
        sessionId: 'nonexistent-id',
        command: 'echo "test"',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    it('should handle command timeout', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand to return timeout result
      const mockResult: CommandResult = {
        stdout: '',
        stderr: 'Command timed out',
        exitCode: 124,
        duration: 5000,
      };
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue(mockResult);

      const response = await commandTools.execute({
        sessionId: session.id,
        command: 'sleep 60',
        timeout: 5,
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('exitCode')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.exitCode).toBe(124);
        expect(data.stderr).toContain('timed out');
      }
    });

    it('should pass environment variables to SSH wrapper', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand
      const mockResult: CommandResult = {
        stdout: 'test-value\n',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };
      const executeSpy = vi
        .spyOn(sshWrapper, 'executeCommand')
        .mockResolvedValue(mockResult);

      await commandTools.execute({
        sessionId: session.id,
        command: 'echo $TEST_VAR',
        env: { TEST_VAR: 'test-value' },
      });

      // Verify executeCommand was called with env options
      expect(executeSpy).toHaveBeenCalledWith(
        session,
        'echo $TEST_VAR',
        expect.objectContaining({
          env: { TEST_VAR: 'test-value' },
        })
      );
    });

    it('should handle working directory', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand
      const mockResult: CommandResult = {
        stdout: '/home/user/project\n',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };
      const executeSpy = vi
        .spyOn(sshWrapper, 'executeCommand')
        .mockResolvedValue(mockResult);

      // Mock escapeCommand
      vi.spyOn(sshWrapper, 'escapeCommand').mockImplementation((cmd) => `'${cmd}'`);

      await commandTools.execute({
        sessionId: session.id,
        command: 'pwd',
        workingDir: '/home/user/project',
      });

      // Verify executeCommand was called with cd command
      expect(executeSpy).toHaveBeenCalledWith(
        session,
        expect.stringContaining("cd '/home/user/project' && pwd"),
        expect.any(Object)
      );
    });

    it('should handle PTY allocation', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand
      const mockResult: CommandResult = {
        stdout: 'interactive output\n',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };
      const executeSpy = vi
        .spyOn(sshWrapper, 'executeCommand')
        .mockResolvedValue(mockResult);

      await commandTools.execute({
        sessionId: session.id,
        command: 'top -n 1',
        pty: true,
      });

      // Verify executeCommand was called with pty option
      expect(executeSpy).toHaveBeenCalledWith(
        session,
        'top -n 1',
        expect.objectContaining({
          pty: true,
        })
      );
    });

    it('should handle command execution errors', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand to return error
      const mockResult: CommandResult = {
        stdout: '',
        stderr: 'command not found: invalid-command',
        exitCode: 127,
        duration: 50,
      };
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue(mockResult);

      // Mock parseSSHError
      vi.spyOn(sshWrapper, 'parseSSHError').mockReturnValue({
        type: 'UNKNOWN',
        message: 'Command not found',
        rawOutput: 'command not found: invalid-command',
      });

      const response = await commandTools.execute({
        sessionId: session.id,
        command: 'invalid-command',
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('exitCode')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.exitCode).toBe(127);
        expect(data.error).toBeDefined();
        expect(data.error.type).toBe('UNKNOWN');
      }
    });

    it('should update session lastUsedAt timestamp', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      const originalLastUsed = session.lastUsedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Mock executeCommand
      const mockResult: CommandResult = {
        stdout: 'test\n',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue(mockResult);

      await commandTools.execute({
        sessionId: session.id,
        command: 'echo test',
      });

      // Verify lastUsedAt was updated
      expect(session.lastUsedAt.getTime()).toBeGreaterThan(
        originalLastUsed.getTime()
      );
    });

    it('should handle SSH connection errors', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand to return connection error
      const mockResult: CommandResult = {
        stdout: '',
        stderr: 'ssh: connect to host example.com port 22: Connection refused',
        exitCode: 255,
        duration: 1000,
      };
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue(mockResult);

      // Mock parseSSHError
      vi.spyOn(sshWrapper, 'parseSSHError').mockReturnValue({
        type: 'CONNECTION_REFUSED',
        message: 'Remote host refused connection',
        rawOutput: 'ssh: connect to host example.com port 22: Connection refused',
      });

      const response = await commandTools.execute({
        sessionId: session.id,
        command: 'echo test',
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('exitCode')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.error.type).toBe('CONNECTION_REFUSED');
      }
    });

    it('should handle authentication errors', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand to return auth error
      const mockResult: CommandResult = {
        stdout: '',
        stderr: 'Permission denied (publickey).',
        exitCode: 255,
        duration: 500,
      };
      vi.spyOn(sshWrapper, 'executeCommand').mockResolvedValue(mockResult);

      // Mock parseSSHError
      vi.spyOn(sshWrapper, 'parseSSHError').mockReturnValue({
        type: 'AUTH_FAILED',
        message: 'Public key authentication failed',
        rawOutput: 'Permission denied (publickey).',
      });

      const response = await commandTools.execute({
        sessionId: session.id,
        command: 'echo test',
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('exitCode')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.error.type).toBe('AUTH_FAILED');
      }
    });

    it('should handle multiple commands with different options', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock executeCommand
      const mockResult: CommandResult = {
        stdout: 'result\n',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };
      const executeSpy = vi
        .spyOn(sshWrapper, 'executeCommand')
        .mockResolvedValue(mockResult);

      // Execute first command with timeout
      await commandTools.execute({
        sessionId: session.id,
        command: 'command1',
        timeout: 30,
      });

      // Execute second command with env
      await commandTools.execute({
        sessionId: session.id,
        command: 'command2',
        env: { VAR: 'value' },
      });

      // Execute third command with pty
      await commandTools.execute({
        sessionId: session.id,
        command: 'command3',
        pty: true,
      });

      // Verify all three commands were executed
      expect(executeSpy).toHaveBeenCalledTimes(3);
    });
  });
});
