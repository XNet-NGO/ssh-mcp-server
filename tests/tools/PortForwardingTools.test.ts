/**
 * Unit Tests for Port Forwarding Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortForwardingTools } from '../../src/tools/PortForwardingTools.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import { ChildProcess } from 'child_process';

describe('PortForwardingTools', () => {
  let portForwardingTools: PortForwardingTools;
  let connectionManager: ConnectionManager;
  let sshWrapper: SSHWrapper;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    connectionManager = new ConnectionManager();
    sshWrapper = new SSHWrapper(configManager);
    portForwardingTools = new PortForwardingTools(connectionManager, sshWrapper);
  });

  describe('ssh_port_forward', () => {
    it('should create local port forward', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward to return a mock process
      const mockProcess = {
        pid: 12345,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);

      const response = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check forward details (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.forwardId).toBeDefined();
        expect(data.sessionId).toBe(session.id);
        expect(data.type).toBe('local');
        expect(data.localPort).toBe(8080);
        expect(data.remoteHost).toBe('localhost');
        expect(data.remotePort).toBe(80);
      }

      // Verify forward was added to connection manager
      const forwards = connectionManager.listPortForwards();
      expect(forwards.length).toBe(1);
    });

    it('should create remote port forward', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward
      const mockProcess = {
        pid: 12346,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);

      const response = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'remote',
        remotePort: 8080,
        localPort: 3000,
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.type).toBe('remote');
        expect(data.remotePort).toBe(8080);
        expect(data.localPort).toBe(3000);
      }
    });

    it('should create dynamic SOCKS proxy', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward
      const mockProcess = {
        pid: 12347,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);

      const response = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'dynamic',
        localPort: 1080,
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.type).toBe('dynamic');
        expect(data.localPort).toBe(1080);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await portForwardingTools.createForward({
        sessionId: 'nonexistent-id',
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    it('should validate local forward parameters', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Missing remoteHost
      const response = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remotePort: 80,
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('requires localPort, remoteHost, and remotePort');
    });

    it('should validate remote forward parameters', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Missing localPort
      const response = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'remote',
        remotePort: 8080,
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('requires remotePort and localPort');
    });

    it('should validate dynamic forward parameters', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Missing localPort
      const response = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'dynamic',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('requires localPort');
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

      // Mock createPortForward
      const mockProcess = {
        pid: 12348,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);

      await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      // Verify lastUsedAt was updated
      expect(session.lastUsedAt.getTime()).toBeGreaterThan(
        originalLastUsed.getTime()
      );
    });
  });

  describe('ssh_close_forward', () => {
    it('should close port forward', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward
      const mockProcess = {
        pid: 12349,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);

      // Create a forward
      const createResponse = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      // Extract forward ID
      const dataContent = createResponse.content[1];
      const forwardId = dataContent?.text
        ? JSON.parse(dataContent.text).forwardId
        : '';

      // Mock closePortForward
      vi.spyOn(sshWrapper, 'closePortForward').mockResolvedValue();

      // Close the forward
      const response = await portForwardingTools.closeForward({ forwardId });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Verify forward was removed
      const forwards = connectionManager.listPortForwards();
      expect(forwards.length).toBe(0);
    });

    it('should return error for non-existent forward', async () => {
      const response = await portForwardingTools.closeForward({
        forwardId: 'nonexistent-id',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Port forward not found');
    });

    it('should handle close errors gracefully', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward
      const mockProcess = {
        pid: 12350,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);

      // Create a forward
      const createResponse = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      const dataContent = createResponse.content[1];
      const forwardId = dataContent?.text
        ? JSON.parse(dataContent.text).forwardId
        : '';

      // Mock closePortForward to throw error
      vi.spyOn(sshWrapper, 'closePortForward').mockRejectedValue(
        new Error('Failed to close')
      );

      // Close should still succeed (error is caught)
      const response = await portForwardingTools.closeForward({ forwardId });

      // The error should be returned
      expect(response.isError).toBe(true);
    });
  });

  describe('listForwards', () => {
    it('should list all active port forwards', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward
      const mockProcess1 = { pid: 12351, exitCode: null } as ChildProcess;
      const mockProcess2 = { pid: 12352, exitCode: null } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward')
        .mockResolvedValueOnce(mockProcess1)
        .mockResolvedValueOnce(mockProcess2);

      // Create multiple forwards
      await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });

      await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'dynamic',
        localPort: 1080,
      });

      // List forwards
      const response = await portForwardingTools.listForwards();

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.forwards).toHaveLength(2);
        expect(data.count).toBe(2);
        expect(data.forwards[0].type).toBe('local');
        expect(data.forwards[1].type).toBe('dynamic');
      }
    });

    it('should return empty list when no forwards exist', async () => {
      const response = await portForwardingTools.listForwards();

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.forwards).toHaveLength(0);
        expect(data.count).toBe(0);
      }
    });
  });

  describe('multiple operations', () => {
    it('should handle create, list, and close operations', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock createPortForward
      const mockProcess = {
        pid: 12353,
        exitCode: null,
      } as ChildProcess;
      vi.spyOn(sshWrapper, 'createPortForward').mockResolvedValue(mockProcess);
      vi.spyOn(sshWrapper, 'closePortForward').mockResolvedValue();

      // Create forward
      const createResponse = await portForwardingTools.createForward({
        sessionId: session.id,
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      });
      expect(createResponse.isError).toBeUndefined();

      const forwardId = JSON.parse(createResponse.content[1].text!).forwardId;

      // List forwards
      const listResponse = await portForwardingTools.listForwards();
      expect(listResponse.isError).toBeUndefined();
      const listData = JSON.parse(listResponse.content[1].text!);
      expect(listData.count).toBe(1);

      // Close forward
      const closeResponse = await portForwardingTools.closeForward({ forwardId });
      expect(closeResponse.isError).toBeUndefined();

      // List again - should be empty
      const listResponse2 = await portForwardingTools.listForwards();
      const listData2 = JSON.parse(listResponse2.content[1].text!);
      expect(listData2.count).toBe(0);
    });
  });
});
