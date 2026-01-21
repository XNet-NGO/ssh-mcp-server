/**
 * Unit tests for ConfigurationTools
 *
 * Tests MCP tool handlers for SSH configuration management.
 *
 * Validates: Requirements 7.1, 7.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationTools } from '../../src/tools/ConfigurationTools.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';

describe('ConfigurationTools', () => {
  let configTools: ConfigurationTools;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    configTools = new ConfigurationTools(configManager);
  });

  describe('getConfig', () => {
    it('should return host configuration for a hostname', async () => {
      // Arrange
      const hostname = 'example.com';

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBeUndefined();
      expect(response.content).toHaveLength(2);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('SSH configuration for');
      expect(response.content[1].type).toBe('text');

      // Parse JSON response
      const data = JSON.parse(response.content[1].text);
      expect(data.hostname).toBe(hostname);
      expect(data.hostConfig).toBeDefined();
      expect(data.knownHostsPath).toBeDefined();
      expect(data.debugLevel).toBeDefined();
      expect(data.binaryPaths).toBeDefined();
    });

    it('should include host-specific configuration', async () => {
      // Arrange
      const configContent = `
Host example.com
  HostName 192.168.1.100
  Port 2222
  User testuser
  IdentityFile ~/.ssh/id_rsa
`;
      configManager.loadConfig(configContent);
      const hostname = 'example.com';

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.hostConfig.hostname).toBe('192.168.1.100');
      expect(data.hostConfig.port).toBe(2222);
      expect(data.hostConfig.user).toBe('testuser');
      expect(data.hostConfig.identityFile).toContain('~/.ssh/id_rsa');
    });

    it('should include wildcard pattern matches', async () => {
      // Arrange
      const configContent = `
Host *.example.com
  Port 2222
  User wildcard-user
`;
      configManager.loadConfig(configContent);
      const hostname = 'server.example.com';

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.hostConfig.port).toBe(2222);
      expect(data.hostConfig.user).toBe('wildcard-user');
    });

    it('should include known_hosts path', async () => {
      // Arrange
      const hostname = 'example.com';
      const knownHostsPath = '/custom/known_hosts';
      configManager.setKnownHostsPath(knownHostsPath);

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.knownHostsPath).toBe(knownHostsPath);
    });

    it('should include debug level', async () => {
      // Arrange
      const hostname = 'example.com';
      configManager.setDebugLevel(2);

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.debugLevel).toBe(2);
    });

    it('should include binary paths', async () => {
      // Arrange
      const hostname = 'example.com';
      configManager.setBinaryPath('ssh', '/custom/ssh');

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.binaryPaths.ssh).toBe('/custom/ssh');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const hostname = 'example.com';
      vi.spyOn(configManager, 'getHostConfig').mockImplementation(() => {
        throw new Error('Configuration error');
      });

      // Act
      const response = await configTools.getConfig({ hostname });

      // Assert
      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      const error = JSON.parse(response.content[0].text);
      expect(error.code).toBeDefined();
      expect(error.message).toContain('Configuration error');
    });
  });

  describe('setOption', () => {
    it('should set a valid configuration option', async () => {
      // Arrange
      const key = 'ConnectTimeout';
      const value = '60';

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBeUndefined();
      expect(response.content).toHaveLength(2);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('Configuration option set');
      expect(response.content[1].type).toBe('text');

      // Parse JSON response
      const data = JSON.parse(response.content[1].text);
      expect(data.key).toBe(key);
      expect(data.value).toBe(value);
      expect(data.success).toBe(true);

      // Verify option was set
      const config = configManager.getConfig();
      expect(config.globalOptions[key]).toBe(value);
    });

    it('should set boolean option with yes/no', async () => {
      // Arrange
      const key = 'Compression';
      const value = 'yes';

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.success).toBe(true);

      // Verify option was set
      const config = configManager.getConfig();
      expect(config.globalOptions[key]).toBe(value);
    });

    it('should set string option', async () => {
      // Arrange
      const key = 'User';
      const value = 'testuser';

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBeUndefined();
      const data = JSON.parse(response.content[1].text);
      expect(data.success).toBe(true);

      // Verify option was set
      const config = configManager.getConfig();
      expect(config.globalOptions[key]).toBe(value);
    });

    it('should reject invalid option name', async () => {
      // Arrange
      const key = 'InvalidOption';
      const value = 'somevalue';

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      const error = JSON.parse(response.content[0].text);
      expect(error.message).toContain('Invalid configuration option');
    });

    it('should reject invalid option value for number type', async () => {
      // Arrange
      const key = 'Port';
      const value = 'not-a-number';

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      const error = JSON.parse(response.content[0].text);
      expect(error.message).toContain('Invalid configuration option');
    });

    it('should reject invalid option value for boolean type', async () => {
      // Arrange
      const key = 'Compression';
      const value = 'maybe';

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      const error = JSON.parse(response.content[0].text);
      expect(error.message).toContain('Invalid configuration option');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const key = 'ConnectTimeout';
      const value = '60';
      vi.spyOn(configManager, 'setOption').mockImplementation(() => {
        throw new Error('Set option error');
      });

      // Act
      const response = await configTools.setOption({ key, value });

      // Assert
      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      const error = JSON.parse(response.content[0].text);
      expect(error.code).toBeDefined();
      expect(error.message).toContain('Set option error');
    });
  });
});
