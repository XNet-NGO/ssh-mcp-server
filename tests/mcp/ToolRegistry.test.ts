import { describe, test, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/mcp/ToolRegistry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Tool Registration', () => {
    test('should register all 15 tools on initialization', () => {
      expect(registry.getToolCount()).toBe(15);
    });

    test('should register all connection tools', () => {
      expect(registry.hasTool('ssh_connect')).toBe(true);
      expect(registry.hasTool('ssh_disconnect')).toBe(true);
      expect(registry.hasTool('ssh_list_sessions')).toBe(true);
    });

    test('should register command execution tool', () => {
      expect(registry.hasTool('ssh_execute')).toBe(true);
    });

    test('should register all file transfer tools', () => {
      expect(registry.hasTool('sftp_upload')).toBe(true);
      expect(registry.hasTool('sftp_download')).toBe(true);
      expect(registry.hasTool('sftp_list')).toBe(true);
      expect(registry.hasTool('sftp_delete')).toBe(true);
    });

    test('should register all key management tools', () => {
      expect(registry.hasTool('ssh_keygen')).toBe(true);
      expect(registry.hasTool('ssh_list_keys')).toBe(true);
      expect(registry.hasTool('ssh_fingerprint')).toBe(true);
    });

    test('should register all port forwarding tools', () => {
      expect(registry.hasTool('ssh_port_forward')).toBe(true);
      expect(registry.hasTool('ssh_close_forward')).toBe(true);
    });

    test('should register all configuration tools', () => {
      expect(registry.hasTool('ssh_get_config')).toBe(true);
      expect(registry.hasTool('ssh_set_option')).toBe(true);
    });
  });

  describe('Tool Retrieval', () => {
    test('should retrieve tool schema by name', () => {
      const schema = registry.getTool('ssh_connect');
      expect(schema).toBeDefined();
      expect(schema?.name).toBe('ssh_connect');
      expect(schema?.description).toContain('SSH connection');
    });

    test('should return undefined for non-existent tool', () => {
      const schema = registry.getTool('non_existent_tool');
      expect(schema).toBeUndefined();
    });

    test('should retrieve all tools', () => {
      const tools = registry.getAllTools();
      expect(tools).toHaveLength(15);
      expect(tools.every((tool) => tool.name && tool.description && tool.inputSchema)).toBe(true);
    });

    test('should retrieve all tool names', () => {
      const names = registry.getToolNames();
      expect(names).toHaveLength(15);
      expect(names).toContain('ssh_connect');
      expect(names).toContain('ssh_execute');
      expect(names).toContain('sftp_upload');
    });
  });

  describe('Tool Schemas', () => {
    test('ssh_connect should have required fields', () => {
      const schema = registry.getTool('ssh_connect');
      expect(schema?.inputSchema.required).toEqual(['host', 'username']);
      expect(schema?.inputSchema.properties.host).toBeDefined();
      expect(schema?.inputSchema.properties.username).toBeDefined();
      expect(schema?.inputSchema.properties.port).toBeDefined();
      expect(schema?.inputSchema.properties.keyPath).toBeDefined();
      expect(schema?.inputSchema.properties.config).toBeDefined();
    });

    test('ssh_disconnect should have sessionId parameter', () => {
      const schema = registry.getTool('ssh_disconnect');
      expect(schema?.inputSchema.required).toEqual(['sessionId']);
      expect(schema?.inputSchema.properties.sessionId).toBeDefined();
    });

    test('ssh_list_sessions should have no required parameters', () => {
      const schema = registry.getTool('ssh_list_sessions');
      expect(schema?.inputSchema.required).toBeUndefined();
      expect(Object.keys(schema?.inputSchema.properties || {})).toHaveLength(0);
    });

    test('ssh_execute should have required parameters', () => {
      const schema = registry.getTool('ssh_execute');
      expect(schema?.inputSchema.required).toEqual(['sessionId', 'command']);
      expect(schema?.inputSchema.properties.sessionId).toBeDefined();
      expect(schema?.inputSchema.properties.command).toBeDefined();
      expect(schema?.inputSchema.properties.timeout).toBeDefined();
      expect(schema?.inputSchema.properties.env).toBeDefined();
    });

    test('sftp_upload should have required parameters', () => {
      const schema = registry.getTool('sftp_upload');
      expect(schema?.inputSchema.required).toEqual(['sessionId', 'localPath', 'remotePath']);
      expect(schema?.inputSchema.properties.sessionId).toBeDefined();
      expect(schema?.inputSchema.properties.localPath).toBeDefined();
      expect(schema?.inputSchema.properties.remotePath).toBeDefined();
    });

    test('sftp_download should have required parameters', () => {
      const schema = registry.getTool('sftp_download');
      expect(schema?.inputSchema.required).toEqual(['sessionId', 'remotePath', 'localPath']);
    });

    test('sftp_list should have required parameters', () => {
      const schema = registry.getTool('sftp_list');
      expect(schema?.inputSchema.required).toEqual(['sessionId', 'remotePath']);
    });

    test('sftp_delete should have required parameters', () => {
      const schema = registry.getTool('sftp_delete');
      expect(schema?.inputSchema.required).toEqual(['sessionId', 'remotePath']);
    });

    test('ssh_keygen should have required parameters', () => {
      const schema = registry.getTool('ssh_keygen');
      expect(schema?.inputSchema.required).toEqual(['algorithm', 'path']);
      expect(schema?.inputSchema.properties.algorithm).toBeDefined();
      expect(schema?.inputSchema.properties.bits).toBeDefined();
      expect(schema?.inputSchema.properties.passphrase).toBeDefined();
      expect(schema?.inputSchema.properties.path).toBeDefined();
    });

    test('ssh_list_keys should have optional directory parameter', () => {
      const schema = registry.getTool('ssh_list_keys');
      expect(schema?.inputSchema.required).toBeUndefined();
      expect(schema?.inputSchema.properties.directory).toBeDefined();
    });

    test('ssh_fingerprint should have required keyPath parameter', () => {
      const schema = registry.getTool('ssh_fingerprint');
      expect(schema?.inputSchema.required).toEqual(['keyPath']);
      expect(schema?.inputSchema.properties.keyPath).toBeDefined();
    });

    test('ssh_port_forward should have required parameters', () => {
      const schema = registry.getTool('ssh_port_forward');
      expect(schema?.inputSchema.required).toEqual(['sessionId', 'type']);
      expect(schema?.inputSchema.properties.sessionId).toBeDefined();
      expect(schema?.inputSchema.properties.type).toBeDefined();
      expect(schema?.inputSchema.properties.localPort).toBeDefined();
      expect(schema?.inputSchema.properties.remoteHost).toBeDefined();
      expect(schema?.inputSchema.properties.remotePort).toBeDefined();
    });

    test('ssh_close_forward should have required forwardId parameter', () => {
      const schema = registry.getTool('ssh_close_forward');
      expect(schema?.inputSchema.required).toEqual(['forwardId']);
      expect(schema?.inputSchema.properties.forwardId).toBeDefined();
    });

    test('ssh_get_config should have required hostname parameter', () => {
      const schema = registry.getTool('ssh_get_config');
      expect(schema?.inputSchema.required).toEqual(['hostname']);
      expect(schema?.inputSchema.properties.hostname).toBeDefined();
    });

    test('ssh_set_option should have required parameters', () => {
      const schema = registry.getTool('ssh_set_option');
      expect(schema?.inputSchema.required).toEqual(['key', 'value']);
      expect(schema?.inputSchema.properties.key).toBeDefined();
      expect(schema?.inputSchema.properties.value).toBeDefined();
    });
  });

  describe('Tool Schema Validation', () => {
    test('all tools should have name, description, and inputSchema', () => {
      const tools = registry.getAllTools();
      tools.forEach((tool) => {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    test('all tool names should be unique', () => {
      const names = registry.getToolNames();
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    test('all tool descriptions should be descriptive', () => {
      const tools = registry.getAllTools();
      tools.forEach((tool) => {
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Tool Categories', () => {
    test('should have 3 connection tools', () => {
      const connectionTools = ['ssh_connect', 'ssh_disconnect', 'ssh_list_sessions'];
      connectionTools.forEach((name) => {
        expect(registry.hasTool(name)).toBe(true);
      });
    });

    test('should have 1 command execution tool', () => {
      expect(registry.hasTool('ssh_execute')).toBe(true);
    });

    test('should have 4 file transfer tools', () => {
      const fileTools = ['sftp_upload', 'sftp_download', 'sftp_list', 'sftp_delete'];
      fileTools.forEach((name) => {
        expect(registry.hasTool(name)).toBe(true);
      });
    });

    test('should have 3 key management tools', () => {
      const keyTools = ['ssh_keygen', 'ssh_list_keys', 'ssh_fingerprint'];
      keyTools.forEach((name) => {
        expect(registry.hasTool(name)).toBe(true);
      });
    });

    test('should have 2 port forwarding tools', () => {
      const forwardTools = ['ssh_port_forward', 'ssh_close_forward'];
      forwardTools.forEach((name) => {
        expect(registry.hasTool(name)).toBe(true);
      });
    });

    test('should have 2 configuration tools', () => {
      const configTools = ['ssh_get_config', 'ssh_set_option'];
      configTools.forEach((name) => {
        expect(registry.hasTool(name)).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle case-sensitive tool names', () => {
      expect(registry.hasTool('SSH_CONNECT')).toBe(false);
      expect(registry.hasTool('ssh_connect')).toBe(true);
    });

    test('should handle empty string tool name', () => {
      expect(registry.hasTool('')).toBe(false);
      expect(registry.getTool('')).toBeUndefined();
    });

    test('should handle tool name with special characters', () => {
      expect(registry.hasTool('ssh-connect')).toBe(false);
      expect(registry.hasTool('ssh_connect')).toBe(true);
    });
  });
});
