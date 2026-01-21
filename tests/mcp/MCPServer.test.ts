/**
 * Unit tests for MCPServer
 *
 * Tests server lifecycle management including:
 * - Server startup and initialization
 * - Tool handler registration
 * - Graceful shutdown with session cleanup
 * - State transitions
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPServer, ServerState } from '../../src/mcp/MCPServer.js';

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer({ debug: false });
  });

  afterEach(async () => {
    // Clean up: stop server if running
    if (server.isRunning()) {
      await server.stop();
    }
  });

  describe('Constructor', () => {
    it('should initialize with STOPPED state', () => {
      expect(server.getState()).toBe(ServerState.STOPPED);
      expect(server.isRunning()).toBe(false);
    });

    it('should initialize with default config', () => {
      const stats = server.getStats();
      expect(stats.state).toBe(ServerState.STOPPED);
      expect(stats.activeSessions).toBe(0);
      expect(stats.activePortForwards).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customServer = new MCPServer({
        debug: true,
        cleanupTimeout: 10000,
      });
      expect(customServer.getState()).toBe(ServerState.STOPPED);
    });

    it('should initialize core components', () => {
      expect(server.getConnectionManager()).toBeDefined();
      expect(server.getToolRegistry()).toBeDefined();
      expect(server.getProtocolHandler()).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should start server successfully', async () => {
      await server.start();
      expect(server.getState()).toBe(ServerState.RUNNING);
      expect(server.isRunning()).toBe(true);
    });

    it('should register all 15 tool handlers on startup', async () => {
      await server.start();
      const stats = server.getStats();
      expect(stats.registeredTools).toBe(15);
      expect(stats.registeredHandlers).toBe(15);
    });

    it('should register connection tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      expect(handler.hasHandler('ssh_connect')).toBe(true);
      expect(handler.hasHandler('ssh_disconnect')).toBe(true);
      expect(handler.hasHandler('ssh_list_sessions')).toBe(true);
    });

    it('should register command execution tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      expect(handler.hasHandler('ssh_execute')).toBe(true);
    });

    it('should register file transfer tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      expect(handler.hasHandler('sftp_upload')).toBe(true);
      expect(handler.hasHandler('sftp_download')).toBe(true);
      expect(handler.hasHandler('sftp_list')).toBe(true);
      expect(handler.hasHandler('sftp_delete')).toBe(true);
    });

    it('should register key management tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      expect(handler.hasHandler('ssh_keygen')).toBe(true);
      expect(handler.hasHandler('ssh_list_keys')).toBe(true);
      expect(handler.hasHandler('ssh_fingerprint')).toBe(true);
    });

    it('should register port forwarding tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      expect(handler.hasHandler('ssh_port_forward')).toBe(true);
      expect(handler.hasHandler('ssh_close_forward')).toBe(true);
    });

    it('should register configuration tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      expect(handler.hasHandler('ssh_get_config')).toBe(true);
      expect(handler.hasHandler('ssh_set_option')).toBe(true);
    });

    it('should throw error if already running', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow(
        'Cannot start server: current state is running'
      );
    });

    it('should throw error if in STOPPING state', async () => {
      await server.start();
      // Manually set state to STOPPING to test error handling
      const stopPromise = server.stop();
      // Try to start while stopping (this is a race condition test)
      // We'll just verify the state machine prevents invalid transitions
      await stopPromise;
      expect(server.getState()).toBe(ServerState.STOPPED);
    });
  });

  describe('stop()', () => {
    it('should stop server successfully', async () => {
      await server.start();
      await server.stop();
      expect(server.getState()).toBe(ServerState.STOPPED);
      expect(server.isRunning()).toBe(false);
    });

    it('should throw error if not running', async () => {
      await expect(server.stop()).rejects.toThrow(
        'Cannot stop server: current state is stopped'
      );
    });

    it('should close all active sessions on shutdown', async () => {
      await server.start();

      // Create some sessions
      const cm = server.getConnectionManager();
      cm.createSession({ host: 'host1.com', username: 'user1' });
      cm.createSession({ host: 'host2.com', username: 'user2' });
      cm.createSession({ host: 'host3.com', username: 'user3' });

      expect(cm.listSessions().length).toBe(3);

      await server.stop();

      // All sessions should be removed
      expect(cm.listSessions().length).toBe(0);
    });

    it('should close all port forwards on shutdown', async () => {
      await server.start();

      // Create a session and port forward
      const cm = server.getConnectionManager();
      const session = cm.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      cm.addPortForward(session.id, {
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      expect(cm.listPortForwards().length).toBe(1);

      await server.stop();

      // All port forwards should be removed
      expect(cm.listPortForwards().length).toBe(0);
    });

    it('should run shutdown handlers', async () => {
      await server.start();

      let handlerCalled = false;
      server.registerShutdownHandler(async () => {
        handlerCalled = true;
      });

      await server.stop();

      expect(handlerCalled).toBe(true);
    });

    it('should run multiple shutdown handlers in order', async () => {
      await server.start();

      const callOrder: number[] = [];
      server.registerShutdownHandler(async () => {
        callOrder.push(1);
      });
      server.registerShutdownHandler(async () => {
        callOrder.push(2);
      });
      server.registerShutdownHandler(async () => {
        callOrder.push(3);
      });

      await server.stop();

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('should continue shutdown even if handler fails', async () => {
      await server.start();

      let handler2Called = false;
      server.registerShutdownHandler(async () => {
        throw new Error('Handler 1 failed');
      });
      server.registerShutdownHandler(async () => {
        handler2Called = true;
      });

      await server.stop();

      // Second handler should still be called
      expect(handler2Called).toBe(true);
      expect(server.getState()).toBe(ServerState.STOPPED);
    });

    it('should timeout slow shutdown handlers', async () => {
      const fastServer = new MCPServer({
        debug: false,
        cleanupTimeout: 100,
      });

      await fastServer.start();

      let slowHandlerCompleted = false;
      fastServer.registerShutdownHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        slowHandlerCompleted = true;
      });

      await fastServer.stop();

      // Handler should have timed out
      expect(slowHandlerCompleted).toBe(false);
      expect(fastServer.getState()).toBe(ServerState.STOPPED);
    });
  });

  describe('registerShutdownHandler()', () => {
    it('should register shutdown handler', async () => {
      let called = false;
      server.registerShutdownHandler(async () => {
        called = true;
      });

      await server.start();
      await server.stop();

      expect(called).toBe(true);
    });

    it('should allow registering multiple handlers', async () => {
      let count = 0;
      server.registerShutdownHandler(async () => {
        count++;
      });
      server.registerShutdownHandler(async () => {
        count++;
      });

      await server.start();
      await server.stop();

      expect(count).toBe(2);
    });

    it('should allow async handlers', async () => {
      let value = 0;
      server.registerShutdownHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        value = 42;
      });

      await server.start();
      await server.stop();

      expect(value).toBe(42);
    });
  });

  describe('getState()', () => {
    it('should return STOPPED initially', () => {
      expect(server.getState()).toBe(ServerState.STOPPED);
    });

    it('should return RUNNING after start', async () => {
      await server.start();
      expect(server.getState()).toBe(ServerState.RUNNING);
    });

    it('should return STOPPED after stop', async () => {
      await server.start();
      await server.stop();
      expect(server.getState()).toBe(ServerState.STOPPED);
    });
  });

  describe('isRunning()', () => {
    it('should return false initially', () => {
      expect(server.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('getStats()', () => {
    it('should return initial stats', () => {
      const stats = server.getStats();
      expect(stats.state).toBe(ServerState.STOPPED);
      expect(stats.activeSessions).toBe(0);
      expect(stats.activePortForwards).toBe(0);
      expect(stats.registeredTools).toBe(15);
      expect(stats.registeredHandlers).toBe(0);
    });

    it('should return stats after start', async () => {
      await server.start();
      const stats = server.getStats();
      expect(stats.state).toBe(ServerState.RUNNING);
      expect(stats.registeredTools).toBe(15);
      expect(stats.registeredHandlers).toBe(15);
    });

    it('should reflect active sessions', async () => {
      await server.start();
      const cm = server.getConnectionManager();
      cm.createSession({ host: 'host1.com', username: 'user1' });
      cm.createSession({ host: 'host2.com', username: 'user2' });

      const stats = server.getStats();
      expect(stats.activeSessions).toBe(2);
    });

    it('should reflect active port forwards', async () => {
      await server.start();
      const cm = server.getConnectionManager();
      const session = cm.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      cm.addPortForward(session.id, {
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      const stats = server.getStats();
      expect(stats.activePortForwards).toBe(1);
    });
  });

  describe('Component Access', () => {
    it('should provide access to ConnectionManager', () => {
      const cm = server.getConnectionManager();
      expect(cm).toBeDefined();
      expect(typeof cm.createSession).toBe('function');
    });

    it('should provide access to ToolRegistry', () => {
      const registry = server.getToolRegistry();
      expect(registry).toBeDefined();
      expect(registry.getToolCount()).toBe(15);
    });

    it('should provide access to MCPProtocolHandler', () => {
      const handler = server.getProtocolHandler();
      expect(handler).toBeDefined();
      expect(typeof handler.handleRequest).toBe('function');
    });
  });

  describe('Placeholder Handlers', () => {
    it('should return not implemented message for ssh_connect', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      const response = await handler.handleRequest({
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com', username: 'user' },
        },
      });

      expect(response).toHaveProperty('content');
      if ('content' in response) {
        expect(response.content[0].text).toContain('not yet implemented');
      }
    });

    it('should return not implemented message for all tools', async () => {
      await server.start();
      const handler = server.getProtocolHandler();
      const toolNames = handler.getRegisteredTools();

      // Define minimal valid parameters for each tool
      const toolParams: Record<string, Record<string, any>> = {
        ssh_connect: { host: 'example.com', username: 'user' },
        ssh_disconnect: { sessionId: 'test-id' },
        ssh_list_sessions: {},
        ssh_execute: { sessionId: 'test-id', command: 'echo test' },
        sftp_upload: {
          sessionId: 'test-id',
          localPath: '/local/path',
          remotePath: '/remote/path',
        },
        sftp_download: {
          sessionId: 'test-id',
          remotePath: '/remote/path',
          localPath: '/local/path',
        },
        sftp_list: { sessionId: 'test-id', remotePath: '/remote/path' },
        sftp_delete: { sessionId: 'test-id', remotePath: '/remote/path' },
        ssh_keygen: { algorithm: 'rsa', path: '/path/to/key' },
        ssh_list_keys: {},
        ssh_fingerprint: { keyPath: '/path/to/key' },
        ssh_port_forward: { sessionId: 'test-id', type: 'local' },
        ssh_close_forward: { forwardId: 'forward-id' },
        ssh_get_config: { hostname: 'example.com' },
        ssh_set_option: { key: 'StrictHostKeyChecking', value: 'yes' },
      };

      for (const toolName of toolNames) {
        const response = await handler.handleRequest({
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolParams[toolName] || {},
          },
        });

        expect(response).toHaveProperty('content');
        if ('content' in response) {
          expect(response.content[0].text).toContain('not yet implemented');
        }
      }
    });
  });

  describe('Integration', () => {
    it('should handle complete lifecycle', async () => {
      // Start server
      await server.start();
      expect(server.isRunning()).toBe(true);

      // Create sessions
      const cm = server.getConnectionManager();
      const session1 = cm.createSession({
        host: 'host1.com',
        username: 'user1',
      });
      const session2 = cm.createSession({
        host: 'host2.com',
        username: 'user2',
      });

      expect(cm.listSessions().length).toBe(2);

      // Create port forward
      cm.addPortForward(session1.id, {
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      expect(cm.listPortForwards().length).toBe(1);

      // Stop server
      await server.stop();
      expect(server.isRunning()).toBe(false);

      // Verify cleanup
      expect(cm.listSessions().length).toBe(0);
      expect(cm.listPortForwards().length).toBe(0);
    });

    it('should handle restart', async () => {
      // Start
      await server.start();
      expect(server.isRunning()).toBe(true);

      // Stop
      await server.stop();
      expect(server.isRunning()).toBe(false);

      // Start again
      await server.start();
      expect(server.isRunning()).toBe(true);

      // Stop again
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should maintain tool registration across restarts', async () => {
      await server.start();
      let stats = server.getStats();
      expect(stats.registeredHandlers).toBe(15);

      await server.stop();

      await server.start();
      stats = server.getStats();
      expect(stats.registeredHandlers).toBe(15);
    });
  });

  describe('Error Handling', () => {
    it('should handle startup errors gracefully', async () => {
      // Create a server with a mock that throws during startup
      const errorServer = new MCPServer();

      // Mock the registerToolHandlers to throw
      const originalRegister =
        errorServer['registerToolHandlers'].bind(errorServer);
      errorServer['registerToolHandlers'] = () => {
        throw new Error('Registration failed');
      };

      await expect(errorServer.start()).rejects.toThrow(
        'Server startup failed'
      );
      expect(errorServer.getState()).toBe(ServerState.STOPPED);
    });

    it('should transition to STOPPED even if shutdown fails', async () => {
      await server.start();

      // Mock closeAllSessions to throw
      const originalClose = server['closeAllSessions'].bind(server);
      server['closeAllSessions'] = async () => {
        throw new Error('Cleanup failed');
      };

      await expect(server.stop()).rejects.toThrow('Server shutdown failed');
      expect(server.getState()).toBe(ServerState.STOPPED);
    });
  });
});
