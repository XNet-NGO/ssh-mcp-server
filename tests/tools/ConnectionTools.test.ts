/**
 * Unit Tests for Connection Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionTools } from '../../src/tools/ConnectionTools.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';

describe('ConnectionTools', () => {
  let connectionTools: ConnectionTools;
  let connectionManager: ConnectionManager;
  let sshWrapper: SSHWrapper;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    connectionManager = new ConnectionManager();
    sshWrapper = new SSHWrapper(configManager);
    connectionTools = new ConnectionTools(connectionManager, sshWrapper);
  });

  describe('ssh_connect', () => {
    it('should create session and return session details', async () => {
      const params = {
        host: 'example.com',
        username: 'testuser',
        port: 22,
      };

      const response = await connectionTools.connect(params);

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.isError).toBeUndefined();

      // Parse the response to check session details
      const dataContent = response.content.find((c) => c.text?.includes('sessionId'));
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.sessionId).toBeDefined();
        expect(data.host).toBe('example.com');
        expect(data.username).toBe('testuser');
        expect(data.port).toBe(22);
      }
    });

    it('should use default port 22 if not specified', async () => {
      const params = {
        host: 'example.com',
        username: 'testuser',
      };

      const response = await connectionTools.connect(params);

      const dataContent = response.content.find((c) => c.text?.includes('sessionId'));
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.port).toBe(22);
      }
    });

    it('should include key path in session if provided', async () => {
      const params = {
        host: 'example.com',
        username: 'testuser',
        keyPath: '/path/to/key',
      };

      const response = await connectionTools.connect(params);

      // Verify session was created with key path
      const sessions = connectionManager.listSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].keyPath).toBe('/path/to/key');
    });

    it('should include configuration options if provided', async () => {
      const params = {
        host: 'example.com',
        username: 'testuser',
        config: {
          strictHostKeyChecking: false,
          connectTimeout: 60,
        },
      };

      const response = await connectionTools.connect(params);

      // Verify session was created with config
      const sessions = connectionManager.listSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].config.strictHostKeyChecking).toBe(false);
      expect(sessions[0].config.connectTimeout).toBe(60);
    });

    // Note: Connection error handling will be tested when full SSH connection
    // logic is implemented in later tasks. For now, connections succeed at the
    // session creation level.
  });

  describe('ssh_disconnect', () => {
    it('should disconnect session and remove from tracking', async () => {
      // First create a session
      const connectParams = {
        host: 'example.com',
        username: 'testuser',
      };
      const connectResponse = await connectionTools.connect(connectParams);

      // Extract session ID
      const dataContent = connectResponse.content.find((c) =>
        c.text?.includes('sessionId')
      );
      const sessionId = dataContent?.text
        ? JSON.parse(dataContent.text).sessionId
        : '';

      // Disconnect
      const response = await connectionTools.disconnect({ sessionId });

      expect(response.content).toBeDefined();
      expect(response.isError).toBeUndefined();

      // Verify session was removed
      const sessions = connectionManager.listSessions();
      expect(sessions.length).toBe(0);
    });

    it('should return error for non-existent session', async () => {
      const response = await connectionTools.disconnect({
        sessionId: 'nonexistent-id',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    // Note: Connection close error handling will be tested when full SSH
    // connection logic is implemented in later tasks.
  });

  describe('ssh_list_sessions', () => {
    it('should return empty list when no sessions exist', async () => {
      const response = await connectionTools.listSessions();

      expect(response.content).toBeDefined();
      expect(response.isError).toBeUndefined();

      const dataContent = response.content.find((c) => c.text?.includes('sessions'));
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.sessions).toEqual([]);
        expect(data.count).toBe(0);
      }
    });

    it('should list all active sessions', async () => {
      // Create multiple sessions
      await connectionTools.connect({
        host: 'host1.example.com',
        username: 'user1',
      });
      await connectionTools.connect({
        host: 'host2.example.com',
        username: 'user2',
      });

      const response = await connectionTools.listSessions();

      const dataContent = response.content.find((c) => c.text?.includes('sessions'));
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.sessions).toHaveLength(2);
        expect(data.count).toBe(2);

        // Verify session details
        expect(data.sessions[0].host).toBeDefined();
        expect(data.sessions[0].username).toBeDefined();
        expect(data.sessions[0].sessionId).toBeDefined();
        expect(data.sessions[0].createdAt).toBeDefined();
      }
    });

    it('should include session status in listing', async () => {
      await connectionTools.connect({
        host: 'example.com',
        username: 'testuser',
      });

      const response = await connectionTools.listSessions();

      const dataContent = response.content.find((c) => c.text?.includes('sessions'));
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.sessions[0].active).toBeDefined();
        expect(typeof data.sessions[0].active).toBe('boolean');
      }
    });

    it('should include lastUsedAt timestamp', async () => {
      await connectionTools.connect({
        host: 'example.com',
        username: 'testuser',
      });

      const response = await connectionTools.listSessions();

      const dataContent = response.content.find((c) => c.text?.includes('sessions'));
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.sessions[0].lastUsedAt).toBeDefined();
      }
    });
  });
});
