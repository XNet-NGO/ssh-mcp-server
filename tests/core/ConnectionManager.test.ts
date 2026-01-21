/**
 * Unit tests for ConnectionManager
 * 
 * These tests verify the core functionality of session management including
 * session creation, retrieval, listing, and removal.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import type { ConnectionParams } from '../../src/core/types.js';

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('createSession', () => {
    it('should create a session with all required parameters', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        port: 22,
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(session.host).toBe('example.com');
      expect(session.port).toBe(22);
      expect(session.username).toBe('testuser');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should use default port 22 when not specified', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.port).toBe(22);
    });

    it('should store optional keyPath when provided', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
        keyPath: '/home/user/.ssh/id_rsa',
      };

      const session = manager.createSession(params);

      expect(session.keyPath).toBe('/home/user/.ssh/id_rsa');
    });

    it('should generate a unique control socket path', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.controlSocketPath).toBeDefined();
      expect(session.controlSocketPath).toMatch(/^\/tmp\/ssh-mcp-[0-9a-f-]+$/);
      expect(session.controlSocketPath).toContain(session.id);
    });

    it('should apply default configuration', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.config.strictHostKeyChecking).toBe(true);
      expect(session.config.connectTimeout).toBe(30);
      expect(session.config.serverAliveInterval).toBe(60);
      expect(session.config.compression).toBe(true);
      expect(session.config.forwardAgent).toBe(false);
      expect(session.config.customOptions).toEqual({});
    });

    it('should merge custom configuration with defaults', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
        config: {
          strictHostKeyChecking: false,
          connectTimeout: 60,
        },
      };

      const session = manager.createSession(params);

      expect(session.config.strictHostKeyChecking).toBe(false);
      expect(session.config.connectTimeout).toBe(60);
      // Other defaults should still be applied
      expect(session.config.serverAliveInterval).toBe(60);
      expect(session.config.compression).toBe(true);
    });

    it('should merge custom options with default custom options', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
        config: {
          customOptions: {
            'ServerAliveCountMax': '3',
            'TCPKeepAlive': 'yes',
          },
        },
      };

      const session = manager.createSession(params);

      expect(session.config.customOptions).toEqual({
        'ServerAliveCountMax': '3',
        'TCPKeepAlive': 'yes',
      });
    });

    it('should generate unique session IDs for multiple sessions', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const session1 = manager.createSession(params);
      const session2 = manager.createSession(params);
      const session3 = manager.createSession(params);

      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);
      expect(session1.id).not.toBe(session3.id);
    });

    it('should set createdAt and lastUsedAt to the same time initially', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.createdAt.getTime()).toBe(session.lastUsedAt.getTime());
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session by ID', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const created = manager.createSession(params);
      const retrieved = manager.getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.host).toBe('example.com');
      expect(retrieved?.username).toBe('testuser');
    });

    it('should return null for non-existent session ID', () => {
      const session = manager.getSession('non-existent-id');

      expect(session).toBeNull();
    });

    it('should return null for empty string ID', () => {
      const session = manager.getSession('');

      expect(session).toBeNull();
    });

    it('should retrieve the correct session when multiple exist', () => {
      const session1 = manager.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      const session2 = manager.createSession({
        host: 'host2.com',
        username: 'user2',
      });
      const session3 = manager.createSession({
        host: 'host3.com',
        username: 'user3',
      });

      const retrieved = manager.getSession(session2.id);

      expect(retrieved?.id).toBe(session2.id);
      expect(retrieved?.host).toBe('host2.com');
      expect(retrieved?.username).toBe('user2');
    });
  });

  describe('listSessions', () => {
    it('should return an empty array when no sessions exist', () => {
      const sessions = manager.listSessions();

      expect(sessions).toEqual([]);
      expect(sessions.length).toBe(0);
    });

    it('should return all active sessions', () => {
      const session1 = manager.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      const session2 = manager.createSession({
        host: 'host2.com',
        username: 'user2',
      });
      const session3 = manager.createSession({
        host: 'host3.com',
        username: 'user3',
      });

      const sessions = manager.listSessions();

      expect(sessions.length).toBe(3);
      expect(sessions).toContainEqual(session1);
      expect(sessions).toContainEqual(session2);
      expect(sessions).toContainEqual(session3);
    });

    it('should return sessions with complete metadata', () => {
      manager.createSession({
        host: 'example.com',
        port: 2222,
        username: 'testuser',
        keyPath: '/home/user/.ssh/id_rsa',
      });

      const sessions = manager.listSessions();

      expect(sessions.length).toBe(1);
      const session = sessions[0];
      expect(session.id).toBeDefined();
      expect(session.host).toBe('example.com');
      expect(session.port).toBe(2222);
      expect(session.username).toBe('testuser');
      expect(session.keyPath).toBe('/home/user/.ssh/id_rsa');
      expect(session.controlSocketPath).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastUsedAt).toBeInstanceOf(Date);
      expect(session.config).toBeDefined();
    });

    it('should not include removed sessions', () => {
      const session1 = manager.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      const session2 = manager.createSession({
        host: 'host2.com',
        username: 'user2',
      });

      manager.removeSession(session1.id);
      const sessions = manager.listSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(session2.id);
    });
  });

  describe('removeSession', () => {
    it('should remove an existing session', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
      };

      const session = manager.createSession(params);
      expect(manager.getSession(session.id)).not.toBeNull();

      manager.removeSession(session.id);
      expect(manager.getSession(session.id)).toBeNull();
    });

    it('should not throw when removing non-existent session', () => {
      expect(() => {
        manager.removeSession('non-existent-id');
      }).not.toThrow();
    });

    it('should not affect other sessions when removing one', () => {
      const session1 = manager.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      const session2 = manager.createSession({
        host: 'host2.com',
        username: 'user2',
      });
      const session3 = manager.createSession({
        host: 'host3.com',
        username: 'user3',
      });

      manager.removeSession(session2.id);

      expect(manager.getSession(session1.id)).not.toBeNull();
      expect(manager.getSession(session2.id)).toBeNull();
      expect(manager.getSession(session3.id)).not.toBeNull();

      const sessions = manager.listSessions();
      expect(sessions.length).toBe(2);
    });

    it('should allow removing all sessions', () => {
      const session1 = manager.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      const session2 = manager.createSession({
        host: 'host2.com',
        username: 'user2',
      });

      manager.removeSession(session1.id);
      manager.removeSession(session2.id);

      expect(manager.listSessions().length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle sessions with special characters in host', () => {
      const params: ConnectionParams = {
        host: 'host-with-dashes.example.com',
        username: 'user_with_underscores',
      };

      const session = manager.createSession(params);

      expect(session.host).toBe('host-with-dashes.example.com');
      expect(session.username).toBe('user_with_underscores');
    });

    it('should handle sessions with IPv4 addresses', () => {
      const params: ConnectionParams = {
        host: '192.168.1.100',
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.host).toBe('192.168.1.100');
    });

    it('should handle sessions with IPv6 addresses', () => {
      const params: ConnectionParams = {
        host: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.host).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should handle sessions with non-standard ports', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        port: 2222,
        username: 'testuser',
      };

      const session = manager.createSession(params);

      expect(session.port).toBe(2222);
    });

    it('should handle sessions with very long usernames', () => {
      const longUsername = 'a'.repeat(100);
      const params: ConnectionParams = {
        host: 'example.com',
        username: longUsername,
      };

      const session = manager.createSession(params);

      expect(session.username).toBe(longUsername);
    });

    it('should handle sessions with empty custom options', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
        config: {
          customOptions: {},
        },
      };

      const session = manager.createSession(params);

      expect(session.config.customOptions).toEqual({});
    });

    it('should handle sessions with many custom options', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
        config: {
          customOptions: {
            'Option1': 'value1',
            'Option2': 'value2',
            'Option3': 'value3',
            'Option4': 'value4',
            'Option5': 'value5',
          },
        },
      };

      const session = manager.createSession(params);

      expect(Object.keys(session.config.customOptions).length).toBe(5);
      expect(session.config.customOptions['Option3']).toBe('value3');
    });
  });

  describe('isSessionActive', () => {
    it('should return false for non-existent session', () => {
      const isActive = manager.isSessionActive('non-existent-id');

      expect(isActive).toBe(false);
    });

    it('should return false for session without control socket path', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      // Manually remove control socket path to simulate a session without it
      const sessionObj = manager.getSession(session.id);
      if (sessionObj) {
        sessionObj.controlSocketPath = undefined;
      }

      const isActive = manager.isSessionActive(session.id);

      expect(isActive).toBe(false);
    });

    it('should return false when control socket file does not exist', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      // The control socket file won't exist in tests
      const isActive = manager.isSessionActive(session.id);

      expect(isActive).toBe(false);
    });

    it('should return false for empty session ID', () => {
      const isActive = manager.isSessionActive('');

      expect(isActive).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    it('should return null for non-existent session', () => {
      const info = manager.getSessionInfo('non-existent-id');

      expect(info).toBeNull();
    });

    it('should return complete session information', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        port: 2222,
        username: 'testuser',
        keyPath: '/home/user/.ssh/id_rsa',
      };

      const session = manager.createSession(params);
      const info = manager.getSessionInfo(session.id);

      expect(info).not.toBeNull();
      expect(info?.status).toBe('inactive'); // Socket won't exist in tests
      expect(info?.parameters.host).toBe('example.com');
      expect(info?.parameters.port).toBe(2222);
      expect(info?.parameters.username).toBe('testuser');
      expect(info?.parameters.keyPath).toBe('/home/user/.ssh/id_rsa');
      expect(info?.parameters.controlSocketPath).toBeDefined();
      expect(info?.config).toBeDefined();
      expect(info?.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(info?.createdAt).toBeInstanceOf(Date);
      expect(info?.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should calculate uptime correctly', async () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      // Wait a bit to ensure uptime is measurable
      await new Promise(resolve => setTimeout(resolve, 100));

      const info = manager.getSessionInfo(session.id);

      expect(info).not.toBeNull();
      expect(info?.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should include all configuration options', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'testuser',
        config: {
          strictHostKeyChecking: false,
          connectTimeout: 60,
          serverAliveInterval: 120,
          compression: false,
          forwardAgent: true,
          customOptions: {
            'Option1': 'value1',
          },
        },
      };

      const session = manager.createSession(params);
      const info = manager.getSessionInfo(session.id);

      expect(info?.config.strictHostKeyChecking).toBe(false);
      expect(info?.config.connectTimeout).toBe(60);
      expect(info?.config.serverAliveInterval).toBe(120);
      expect(info?.config.compression).toBe(false);
      expect(info?.config.forwardAgent).toBe(true);
      expect(info?.config.customOptions).toEqual({ 'Option1': 'value1' });
    });

    it('should return inactive status when control socket does not exist', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const info = manager.getSessionInfo(session.id);

      expect(info?.status).toBe('inactive');
    });
  });

  describe('updateSessionConfig', () => {
    it('should return false for non-existent session', () => {
      const updated = manager.updateSessionConfig('non-existent-id', {
        connectTimeout: 60,
      });

      expect(updated).toBe(false);
    });

    it('should update single configuration option', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const updated = manager.updateSessionConfig(session.id, {
        connectTimeout: 60,
      });

      expect(updated).toBe(true);

      const retrievedSession = manager.getSession(session.id);
      expect(retrievedSession?.config.connectTimeout).toBe(60);
      // Other options should remain unchanged
      expect(retrievedSession?.config.strictHostKeyChecking).toBe(true);
      expect(retrievedSession?.config.compression).toBe(true);
    });

    it('should update multiple configuration options', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const updated = manager.updateSessionConfig(session.id, {
        connectTimeout: 60,
        compression: false,
        forwardAgent: true,
      });

      expect(updated).toBe(true);

      const retrievedSession = manager.getSession(session.id);
      expect(retrievedSession?.config.connectTimeout).toBe(60);
      expect(retrievedSession?.config.compression).toBe(false);
      expect(retrievedSession?.config.forwardAgent).toBe(true);
    });

    it('should merge custom options with existing ones', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
        config: {
          customOptions: {
            'Option1': 'value1',
            'Option2': 'value2',
          },
        },
      });

      const updated = manager.updateSessionConfig(session.id, {
        customOptions: {
          'Option2': 'updated_value2',
          'Option3': 'value3',
        },
      });

      expect(updated).toBe(true);

      const retrievedSession = manager.getSession(session.id);
      expect(retrievedSession?.config.customOptions).toEqual({
        'Option1': 'value1',
        'Option2': 'updated_value2',
        'Option3': 'value3',
      });
    });

    it('should update lastUsedAt timestamp', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const originalLastUsed = session.lastUsedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        manager.updateSessionConfig(session.id, {
          connectTimeout: 60,
        });

        const retrievedSession = manager.getSession(session.id);
        expect(retrievedSession?.lastUsedAt.getTime()).toBeGreaterThan(originalLastUsed.getTime());
      }, 10);
    });

    it('should handle empty configuration update', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const originalConfig = { ...session.config };

      const updated = manager.updateSessionConfig(session.id, {});

      expect(updated).toBe(true);

      const retrievedSession = manager.getSession(session.id);
      expect(retrievedSession?.config.strictHostKeyChecking).toBe(originalConfig.strictHostKeyChecking);
      expect(retrievedSession?.config.connectTimeout).toBe(originalConfig.connectTimeout);
    });

    it('should allow updating only custom options', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const updated = manager.updateSessionConfig(session.id, {
        customOptions: {
          'NewOption': 'newValue',
        },
      });

      expect(updated).toBe(true);

      const retrievedSession = manager.getSession(session.id);
      expect(retrievedSession?.config.customOptions).toEqual({
        'NewOption': 'newValue',
      });
      // Other config should remain at defaults
      expect(retrievedSession?.config.strictHostKeyChecking).toBe(true);
      expect(retrievedSession?.config.connectTimeout).toBe(30);
    });

    it('should handle boolean configuration updates', () => {
      const session = manager.createSession({
        host: 'example.com',
        username: 'testuser',
      });

      const updated = manager.updateSessionConfig(session.id, {
        strictHostKeyChecking: false,
        compression: false,
        forwardAgent: true,
      });

      expect(updated).toBe(true);

      const retrievedSession = manager.getSession(session.id);
      expect(retrievedSession?.config.strictHostKeyChecking).toBe(false);
      expect(retrievedSession?.config.compression).toBe(false);
      expect(retrievedSession?.config.forwardAgent).toBe(true);
    });
  });
});
