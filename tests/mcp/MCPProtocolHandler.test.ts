/**
 * Unit tests for MCP Protocol Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MCPProtocolHandler,
  MCPRequest,
  MCPResponse,
  MCPError,
  ToolHandler,
} from '../../src/mcp/MCPProtocolHandler.js';
import { ToolRegistry } from '../../src/mcp/ToolRegistry.js';

describe('MCPProtocolHandler', () => {
  let handler: MCPProtocolHandler;
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    handler = new MCPProtocolHandler(registry);
  });

  describe('Constructor', () => {
    it('should initialize with tool registry', () => {
      expect(handler).toBeDefined();
      expect(handler.getRegisteredTools().length).toBe(15);
    });

    it('should compile validators for all tools', () => {
      const tools = registry.getAllTools();
      for (const tool of tools) {
        const result = handler.validateParameters(tool.name, {});
        expect(result).toBeDefined();
      }
    });
  });

  describe('Tool Handler Registration', () => {
    it('should register a tool handler', () => {
      const mockHandler: ToolHandler = vi.fn();
      handler.registerToolHandler('ssh_connect', mockHandler);
      expect(handler.hasHandler('ssh_connect')).toBe(true);
    });

    it('should throw error when registering handler for non-existent tool', () => {
      const mockHandler: ToolHandler = vi.fn();
      expect(() => {
        handler.registerToolHandler('invalid_tool', mockHandler);
      }).toThrow('Tool not found in registry: invalid_tool');
    });

    it('should allow multiple handlers to be registered', () => {
      const handler1: ToolHandler = vi.fn();
      const handler2: ToolHandler = vi.fn();

      handler.registerToolHandler('ssh_connect', handler1);
      handler.registerToolHandler('ssh_execute', handler2);

      expect(handler.hasHandler('ssh_connect')).toBe(true);
      expect(handler.hasHandler('ssh_execute')).toBe(true);
    });

    it('should return all registered handler names', () => {
      const handler1: ToolHandler = vi.fn();
      const handler2: ToolHandler = vi.fn();

      handler.registerToolHandler('ssh_connect', handler1);
      handler.registerToolHandler('ssh_execute', handler2);

      const handlers = handler.getRegisteredHandlers();
      expect(handlers).toContain('ssh_connect');
      expect(handlers).toContain('ssh_execute');
      expect(handlers.length).toBe(2);
    });
  });

  describe('Request Validation', () => {
    it('should reject request without method', async () => {
      const request = {} as MCPRequest;
      const response = await handler.handleRequest(request);

      expect(response).toHaveProperty('code', -32600);
      expect(response).toHaveProperty('message');
      expect((response as MCPError).message).toContain('missing method');
    });

    it('should reject unknown method', async () => {
      const request: MCPRequest = {
        method: 'unknown/method',
      };
      const response = await handler.handleRequest(request);

      expect(response).toHaveProperty('code', -32601);
      expect((response as MCPError).message).toContain('Method not found');
    });

    it('should handle internal errors gracefully', async () => {
      const mockHandler: ToolHandler = vi.fn().mockRejectedValue(
        new Error('Internal error')
      );
      handler.registerToolHandler('ssh_connect', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com', username: 'user' },
        },
      };

      const response = await handler.handleRequest(request);
      expect(response).toHaveProperty('code', -32603);
      expect((response as MCPError).message).toContain('Tool execution failed');
    });
  });

  describe('tools/list Method', () => {
    it('should return list of all tools', async () => {
      const request: MCPRequest = {
        method: 'tools/list',
      };

      const response = (await handler.handleRequest(request)) as MCPResponse;

      expect(response).toHaveProperty('content');
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const data = JSON.parse(response.content[0].text!);
      expect(data).toHaveProperty('tools');
      expect(data.tools).toHaveLength(15);
    });

    it('should include tool names, descriptions, and schemas', async () => {
      const request: MCPRequest = {
        method: 'tools/list',
      };

      const response = (await handler.handleRequest(request)) as MCPResponse;
      const data = JSON.parse(response.content[0].text!);

      const tool = data.tools[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
    });
  });

  describe('tools/call Method', () => {
    it('should reject call without tool name', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {},
      };

      const response = await handler.handleRequest(request);
      expect(response).toHaveProperty('code', -32602);
      expect((response as MCPError).message).toContain('missing tool name');
    });

    it('should reject call for non-existent tool', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'invalid_tool',
          arguments: {},
        },
      };

      const response = await handler.handleRequest(request);
      expect(response).toHaveProperty('code', -32602);
      expect((response as MCPError).message).toContain('Tool not found');
    });

    it('should reject call when handler not registered', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com', username: 'user' },
        },
      };

      const response = await handler.handleRequest(request);
      expect(response).toHaveProperty('code', -32603);
      expect((response as MCPError).message).toContain(
        'Tool handler not registered'
      );
    });

    it('should execute tool handler with valid parameters', async () => {
      const mockHandler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      handler.registerToolHandler('ssh_connect', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com', username: 'user' },
        },
      };

      const response = (await handler.handleRequest(request)) as MCPResponse;

      expect(mockHandler).toHaveBeenCalledWith({
        host: 'example.com',
        username: 'user',
      });
      expect(response).toHaveProperty('content');
      expect(response.content[0].text).toBe('Success');
    });

    it('should use empty object for missing arguments', async () => {
      const mockHandler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      handler.registerToolHandler('ssh_list_sessions', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_list_sessions',
        },
      };

      await handler.handleRequest(request);
      expect(mockHandler).toHaveBeenCalledWith({});
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', () => {
      const result = handler.validateParameters('ssh_connect', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes('host'))).toBe(true);
      expect(result.errors!.some((e) => e.includes('username'))).toBe(true);
    });

    it('should accept valid parameters', () => {
      const result = handler.validateParameters('ssh_connect', {
        host: 'example.com',
        username: 'user',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should accept optional parameters', () => {
      const result = handler.validateParameters('ssh_connect', {
        host: 'example.com',
        username: 'user',
        port: 2222,
        keyPath: '/path/to/key',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate parameter types', () => {
      const result = handler.validateParameters('ssh_connect', {
        host: 'example.com',
        username: 'user',
        port: 'invalid', // Should be number
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should validate nested object parameters', () => {
      const result = handler.validateParameters('ssh_connect', {
        host: 'example.com',
        username: 'user',
        config: {
          strictHostKeyChecking: 'invalid', // Should be boolean
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject call with invalid parameters', async () => {
      const mockHandler: ToolHandler = vi.fn();
      handler.registerToolHandler('ssh_connect', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com' }, // Missing required username
        },
      };

      const response = await handler.handleRequest(request);
      expect(response).toHaveProperty('code', -32602);
      expect((response as MCPError).message).toContain('Invalid params');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Response Formatting', () => {
    it('should create success response with text', () => {
      const response = handler.createSuccessResponse(undefined, 'Operation successful');

      expect(response).toHaveProperty('content');
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toBe('Operation successful');
    });

    it('should create success response with data', () => {
      const data = { sessionId: '123', status: 'connected' };
      const response = handler.createSuccessResponse(data);

      expect(response).toHaveProperty('content');
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const parsed = JSON.parse(response.content[0].text!);
      expect(parsed).toEqual(data);
    });

    it('should create success response with both text and data', () => {
      const data = { sessionId: '123' };
      const response = handler.createSuccessResponse(data, 'Connected successfully');

      expect(response.content).toHaveLength(2);
      expect(response.content[0].text).toBe('Connected successfully');
      expect(JSON.parse(response.content[1].text!)).toEqual(data);
    });

    it('should create error with code and message', () => {
      const error = handler.createError(-32602, 'Invalid params');

      expect(error).toHaveProperty('code', -32602);
      expect(error).toHaveProperty('message', 'Invalid params');
    });

    it('should create error with additional data', () => {
      const error = handler.createError(-32602, 'Invalid params', {
        field: 'username',
        reason: 'required',
      });

      expect(error).toHaveProperty('code', -32602);
      expect(error).toHaveProperty('message', 'Invalid params');
      expect(error).toHaveProperty('data');
      expect(error.data).toEqual({ field: 'username', reason: 'required' });
    });

    it('should format error as MCP response', () => {
      const error = handler.createError(-32602, 'Invalid params');
      const response = handler.formatErrorResponse(error);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('isError', true);
      expect(response.content[0].type).toBe('text');

      const parsed = JSON.parse(response.content[0].text!);
      expect(parsed).toEqual(error);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tool with no required parameters', async () => {
      const mockHandler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Sessions listed' }],
      });
      handler.registerToolHandler('ssh_list_sessions', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_list_sessions',
          arguments: {},
        },
      };

      const response = (await handler.handleRequest(request)) as MCPResponse;
      expect(response.content[0].text).toBe('Sessions listed');
    });

    it('should handle tool with enum validation', () => {
      const result = handler.validateParameters('ssh_keygen', {
        algorithm: 'invalid_algo',
        path: '/path/to/key',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle tool with valid enum value', () => {
      const result = handler.validateParameters('ssh_keygen', {
        algorithm: 'ed25519',
        path: '/path/to/key',
      });

      expect(result.valid).toBe(true);
    });

    it('should handle handler that returns error response', async () => {
      const mockHandler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Error occurred' }],
        isError: true,
      });
      handler.registerToolHandler('ssh_connect', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com', username: 'user' },
        },
      };

      const response = (await handler.handleRequest(request)) as MCPResponse;
      expect(response.isError).toBe(true);
    });

    it('should handle handler that throws non-Error object', async () => {
      const mockHandler: ToolHandler = vi.fn().mockRejectedValue('String error');
      handler.registerToolHandler('ssh_connect', mockHandler);

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'ssh_connect',
          arguments: { host: 'example.com', username: 'user' },
        },
      };

      const response = await handler.handleRequest(request);
      expect(response).toHaveProperty('code', -32603);
      expect((response as MCPError).data).toBe('String error');
    });
  });

  describe('Integration with ToolRegistry', () => {
    it('should validate against all registered tool schemas', () => {
      const tools = registry.getAllTools();

      for (const tool of tools) {
        const result = handler.validateParameters(tool.name, {});
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe('boolean');
      }
    });

    it('should have validators for all 15 tools', () => {
      const toolNames = handler.getRegisteredTools();
      expect(toolNames).toHaveLength(15);

      for (const toolName of toolNames) {
        const result = handler.validateParameters(toolName, {});
        expect(result).toBeDefined();
      }
    });
  });
});
