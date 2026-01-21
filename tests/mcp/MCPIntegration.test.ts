/**
 * Unit Tests for MCP Integration
 *
 * Tests tool registration, parameter validation, response formatting,
 * and error handling for the MCP protocol integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/mcp/ToolRegistry.js';
import { MCPProtocolHandler } from '../../src/mcp/MCPProtocolHandler.js';
import { MCPServer } from '../../src/mcp/MCPServer.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';

describe('MCP Integration', () => {
  describe('Tool Registration', () => {
    let toolRegistry: ToolRegistry;

    beforeEach(() => {
      toolRegistry = new ToolRegistry();
    });

    it('should register all 15 SSH tools', () => {
      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(15);
    });

    it('should register connection tools', () => {
      expect(toolRegistry.hasTool('ssh_connect')).toBe(true);
      expect(toolRegistry.hasTool('ssh_disconnect')).toBe(true);
      expect(toolRegistry.hasTool('ssh_list_sessions')).toBe(true);
    });

    it('should register command execution tools', () => {
      expect(toolRegistry.hasTool('ssh_execute')).toBe(true);
    });

    it('should register file transfer tools', () => {
      expect(toolRegistry.hasTool('sftp_upload')).toBe(true);
      expect(toolRegistry.hasTool('sftp_download')).toBe(true);
      expect(toolRegistry.hasTool('sftp_list')).toBe(true);
      expect(toolRegistry.hasTool('sftp_delete')).toBe(true);
    });

    it('should register key management tools', () => {
      expect(toolRegistry.hasTool('ssh_keygen')).toBe(true);
      expect(toolRegistry.hasTool('ssh_list_keys')).toBe(true);
      expect(toolRegistry.hasTool('ssh_fingerprint')).toBe(true);
    });

    it('should register port forwarding tools', () => {
      expect(toolRegistry.hasTool('ssh_port_forward')).toBe(true);
      expect(toolRegistry.hasTool('ssh_close_forward')).toBe(true);
    });

    it('should register configuration tools', () => {
      expect(toolRegistry.hasTool('ssh_get_config')).toBe(true);
      expect(toolRegistry.hasTool('ssh_set_option')).toBe(true);
    });

    it('should provide tool schemas with descriptions', () => {
      const tool = toolRegistry.getTool('ssh_connect');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('ssh_connect');
      expect(tool?.description).toBeDefined();
      expect(tool?.description.length).toBeGreaterThan(0);
    });

    it('should provide tool schemas with input schemas', () => {
      const tool = toolRegistry.getTool('ssh_connect');
      expect(tool?.inputSchema).toBeDefined();
      expect(tool?.inputSchema.type).toBe('object');
      expect(tool?.inputSchema.properties).toBeDefined();
    });

    it('should define required parameters for tools', () => {
      const tool = toolRegistry.getTool('ssh_connect');
      expect(tool?.inputSchema.required).toBeDefined();
      expect(tool?.inputSchema.required).toContain('host');
      expect(tool?.inputSchema.required).toContain('username');
    });

    it('should return undefined for non-existent tools', () => {
      const tool = toolRegistry.getTool('nonexistent_tool');
      expect(tool).toBeUndefined();
    });

    it('should provide tool count', () => {
      expect(toolRegistry.getToolCount()).toBe(15);
    });

    it('should provide all tool names', () => {
      const names = toolRegistry.getToolNames();
      expect(names).toHaveLength(15);
      expect(names).toContain('ssh_connect');
      expect(names).toContain('ssh_execute');
      expect(names).toContain('sftp_upload');
    });
  });

  describe('Parameter Validation', () => {
    let toolRegistry: ToolRegistry;
    let protocolHandler: MCPProtocolHandler;

    beforeEach(() => {
      toolRegistry = new ToolRegistry();
      protocolHandler = new MCPProtocolHandler(toolRegistry);
    });

    it('should reject missing required parameters', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'success' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            // Missing required 'host' and 'username'
            port: 22,
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32602); // Invalid params
      }
    });

    it('should reject invalid parameter types', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'success' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
            port: 'invalid', // Should be number
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32602);
      }
    });

    it('should accept valid parameters', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'Connected' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
            port: 22,
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(false);
      expect('content' in response).toBe(true);
    });

    it('should validate enum values', async () => {
      protocolHandler.registerToolHandler('ssh_keygen', async () => ({
        content: [{ type: 'text', text: 'Key generated' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_keygen',
          arguments: {
            algorithm: 'invalid_algorithm', // Should be one of: rsa, ed25519, ecdsa, dsa
            path: '/tmp/key',
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32602);
      }
    });

    it('should accept optional parameters', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'Connected' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
            keyPath: '/path/to/key', // Optional parameter
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(false);
    });

    it('should validate nested object parameters', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'Connected' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
            config: {
              strictHostKeyChecking: 'invalid', // Should be boolean
            },
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32602);
      }
    });
  });

  describe('Response Formatting', () => {
    let toolRegistry: ToolRegistry;
    let protocolHandler: MCPProtocolHandler;

    beforeEach(() => {
      toolRegistry = new ToolRegistry();
      protocolHandler = new MCPProtocolHandler(toolRegistry);
    });

    it('should format successful responses with content array', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'Connected successfully' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('content' in response).toBe(true);
      if ('content' in response) {
        expect(Array.isArray(response.content)).toBe(true);
        expect(response.content.length).toBeGreaterThan(0);
      }
    });

    it('should include content type in responses', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => ({
        content: [{ type: 'text', text: 'Connected' }],
      }));

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      if ('content' in response) {
        expect(response.content[0].type).toBe('text');
      }
    });

    it('should format tools/list response', async () => {
      const request = {
        method: 'tools/list',
      };

      const response = await protocolHandler.handleRequest(request);
      expect('content' in response).toBe(true);
      if ('content' in response) {
        expect(response.content[0].type).toBe('text');
        const data = JSON.parse(response.content[0].text!);
        expect(data.tools).toBeDefined();
        expect(Array.isArray(data.tools)).toBe(true);
        expect(data.tools.length).toBe(15);
      }
    });

    it('should include tool schemas in tools/list response', async () => {
      const request = {
        method: 'tools/list',
      };

      const response = await protocolHandler.handleRequest(request);
      if ('content' in response) {
        const data = JSON.parse(response.content[0].text!);
        const tool = data.tools.find((t: any) => t.name === 'ssh_connect');
        expect(tool).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it('should create success response with data', () => {
      const data = { sessionId: 'test-123', status: 'connected' };
      const response = protocolHandler.createSuccessResponse(data);

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      const content = JSON.parse(response.content[0].text!);
      expect(content.sessionId).toBe('test-123');
      expect(content.status).toBe('connected');
    });

    it('should create success response with text and data', () => {
      const data = { result: 'success' };
      const text = 'Operation completed';
      const response = protocolHandler.createSuccessResponse(data, text);

      expect(response.content.length).toBe(2);
      expect(response.content[0].text).toBe(text);
      expect(JSON.parse(response.content[1].text!).result).toBe('success');
    });
  });

  describe('Error Handling', () => {
    let toolRegistry: ToolRegistry;
    let protocolHandler: MCPProtocolHandler;

    beforeEach(() => {
      toolRegistry = new ToolRegistry();
      protocolHandler = new MCPProtocolHandler(toolRegistry);
    });

    it('should return error for missing method', async () => {
      const request = {
        method: '',
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32600); // Invalid Request
      }
    });

    it('should return error for unknown method', async () => {
      const request = {
        method: 'unknown/method',
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32601); // Method not found
      }
    });

    it('should return error for missing tool name', async () => {
      const request = {
        method: 'tools/call',
        params: {
          arguments: {},
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32602); // Invalid params
      }
    });

    it('should return error for non-existent tool', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32602);
      }
    });

    it('should return error for unregistered handler', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32603); // Internal error
      }
    });

    it('should return error when handler throws', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => {
        throw new Error('Connection failed');
      });

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32603);
        expect(response.data).toContain('Connection failed');
      }
    });

    it('should create error with code and message', () => {
      const error = protocolHandler.createError(-32602, 'Invalid parameters');
      expect(error.code).toBe(-32602);
      expect(error.message).toBe('Invalid parameters');
    });

    it('should create error with additional data', () => {
      const error = protocolHandler.createError(
        -32602,
        'Invalid parameters',
        { field: 'host', reason: 'required' }
      );
      expect(error.code).toBe(-32602);
      expect(error.data).toBeDefined();
      expect(error.data.field).toBe('host');
    });

    it('should format error as MCP response', () => {
      const error = protocolHandler.createError(-32602, 'Invalid parameters');
      const response = protocolHandler.formatErrorResponse(error);

      expect(response.content).toBeDefined();
      expect(response.isError).toBe(true);
      const errorData = JSON.parse(response.content[0].text!);
      expect(errorData.code).toBe(-32602);
      expect(errorData.message).toBe('Invalid parameters');
    });

    it('should handle internal errors gracefully', async () => {
      protocolHandler.registerToolHandler('ssh_connect', async () => {
        throw new TypeError('Unexpected error');
      });

      const request = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: {
            host: 'example.com',
            username: 'user',
          },
        },
      };

      const response = await protocolHandler.handleRequest(request);
      expect('code' in response).toBe(true);
      if ('code' in response) {
        expect(response.code).toBe(-32603);
        expect(response.message).toBeDefined();
      }
    });
  });

  describe('Server Integration', () => {
    let server: MCPServer;

    beforeEach(() => {
      server = new MCPServer();
    });

    it('should initialize with all components', () => {
      expect(server.getConnectionManager()).toBeInstanceOf(ConnectionManager);
      expect(server.getToolRegistry()).toBeInstanceOf(ToolRegistry);
      expect(server.getProtocolHandler()).toBeInstanceOf(MCPProtocolHandler);
    });

    it('should start server and register handlers', async () => {
      await server.start();
      const stats = server.getStats();
      expect(stats.state).toBe('running');
      expect(stats.registeredHandlers).toBe(15);
      await server.stop();
    });

    it('should stop server and cleanup sessions', async () => {
      await server.start();
      await server.stop();
      const stats = server.getStats();
      expect(stats.state).toBe('stopped');
    });

    it('should provide server statistics', async () => {
      await server.start();
      const stats = server.getStats();
      expect(stats.state).toBeDefined();
      expect(stats.activeSessions).toBeDefined();
      expect(stats.activePortForwards).toBeDefined();
      expect(stats.registeredHandlers).toBe(15);
      await server.stop();
    });

    it('should not start server twice', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow('Cannot start server');
      await server.stop();
    });

    it('should not stop server that is not running', async () => {
      await expect(server.stop()).rejects.toThrow('Cannot stop server');
    });
  });

  describe('Handler Registration', () => {
    let toolRegistry: ToolRegistry;
    let protocolHandler: MCPProtocolHandler;

    beforeEach(() => {
      toolRegistry = new ToolRegistry();
      protocolHandler = new MCPProtocolHandler(toolRegistry);
    });

    it('should register tool handler', () => {
      const handler = async () => ({
        content: [{ type: 'text', text: 'success' }],
      });

      protocolHandler.registerToolHandler('ssh_connect', handler);
      expect(protocolHandler.hasHandler('ssh_connect')).toBe(true);
    });

    it('should throw error when registering handler for non-existent tool', () => {
      const handler = async () => ({
        content: [{ type: 'text', text: 'success' }],
      });

      expect(() => {
        protocolHandler.registerToolHandler('nonexistent_tool', handler);
      }).toThrow('Tool not found in registry');
    });

    it('should list registered handlers', () => {
      const handler = async () => ({
        content: [{ type: 'text', text: 'success' }],
      });

      protocolHandler.registerToolHandler('ssh_connect', handler);
      protocolHandler.registerToolHandler('ssh_execute', handler);

      const handlers = protocolHandler.getRegisteredHandlers();
      expect(handlers).toContain('ssh_connect');
      expect(handlers).toContain('ssh_execute');
    });

    it('should check if handler is registered', () => {
      const handler = async () => ({
        content: [{ type: 'text', text: 'success' }],
      });

      expect(protocolHandler.hasHandler('ssh_connect')).toBe(false);
      protocolHandler.registerToolHandler('ssh_connect', handler);
      expect(protocolHandler.hasHandler('ssh_connect')).toBe(true);
    });
  });
});
