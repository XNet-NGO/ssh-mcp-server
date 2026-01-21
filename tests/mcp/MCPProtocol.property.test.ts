/**
 * Property-Based Tests for MCP Protocol
 *
 * Tests Properties 33, 34, and 35 from the design document.
 */

import { describe, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ToolRegistry } from '../../src/mcp/ToolRegistry.js';
import { MCPProtocolHandler, MCPResponse, MCPError } from '../../src/mcp/MCPProtocolHandler.js';

describe('MCP Protocol Properties', () => {
  let toolRegistry: ToolRegistry;
  let protocolHandler: MCPProtocolHandler;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    protocolHandler = new MCPProtocolHandler(toolRegistry);
  });

  describe('Property 33: Tool parameters are validated against schema', () => {
    // Feature: ssh-mcp-server, Property 33: Tool parameters are validated against schema
    it('should reject parameters that do not match tool schema', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate tool name from available tools (excluding those with no required params)
          fc.constantFrom(
            ...toolRegistry.getToolNames().filter(name => {
              const tool = toolRegistry.getTool(name);
              return tool && tool.inputSchema.required && tool.inputSchema.required.length > 0;
            })
          ),
          // Generate invalid parameters (missing required fields or wrong types)
          fc.record({
            invalidField: fc.string(),
            wrongType: fc.boolean(),
          }),
          async (toolName, invalidParams) => {
            const tool = toolRegistry.getTool(toolName);
            if (!tool) return true;

            // Register a dummy handler
            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => ({
                content: [{ type: 'text', text: 'success' }],
              }));
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: invalidParams,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Should return an error for invalid parameters
            if (!('code' in response)) {
              throw new Error('Expected error response for invalid parameters');
            }
            if (response.code !== -32602) {
              throw new Error(`Expected error code -32602, got ${response.code}`);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 33: Tool parameters are validated against schema
    it('should accept parameters that match tool schema', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
          }),
          async (params) => {
            const toolName = 'ssh_connect';

            // Register a handler that returns success
            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => ({
                content: [{ type: 'text', text: 'Connected' }],
              }));
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Should not return a validation error for valid parameters
            if ('code' in response && response.code === -32602) {
              throw new Error(`Unexpected validation error for valid params: ${JSON.stringify(params)}`);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 33: Tool parameters are validated against schema
    it('should reject parameters with missing required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Missing 'host' and 'username' which are required for ssh_connect
            port: fc.integer({ min: 1, max: 65535 }),
          }),
          async (params) => {
            const toolName = 'ssh_connect';

            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => ({
                content: [{ type: 'text', text: 'success' }],
              }));
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Should return validation error
            if (!('code' in response)) {
              throw new Error('Expected error response for missing required fields');
            }
            if (response.code !== -32602) {
              throw new Error(`Expected error code -32602, got ${response.code}`);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 34: Tool results are MCP-compliant', () => {
    // Feature: ssh-mcp-server, Property 34: Tool results are MCP-compliant
    it('should return MCP-compliant response structure for successful execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          }),
          fc.string(),
          async (params, resultText) => {
            const toolName = 'ssh_connect';

            // Register handler that returns a result
            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => ({
                content: [{ type: 'text', text: resultText }],
              }));
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Should not be an error
            if ('code' in response) {
              throw new Error(`Unexpected error response: ${JSON.stringify(response)}`);
            }

            // Should have MCP-compliant structure
            const mcpResponse = response as MCPResponse;
            if (!mcpResponse.content) {
              throw new Error('Response missing content field');
            }
            if (!Array.isArray(mcpResponse.content)) {
              throw new Error('Response content is not an array');
            }
            if (mcpResponse.content.length === 0) {
              throw new Error('Response content array is empty');
            }

            // Each content item should have a type
            for (const item of mcpResponse.content) {
              if (!item.type) {
                throw new Error('Content item missing type field');
              }
              if (typeof item.type !== 'string') {
                throw new Error('Content item type is not a string');
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 34: Tool results are MCP-compliant
    it('should include appropriate content type in response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          }),
          async (params) => {
            const toolName = 'ssh_connect';

            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => ({
                content: [
                  { type: 'text', text: 'Connection established' },
                ],
              }));
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            if (!('code' in response)) {
              const mcpResponse = response as MCPResponse;
              // Content should have 'text' type
              const hasTextContent = mcpResponse.content.some(
                (item) => item.type === 'text'
              );
              if (!hasTextContent) {
                throw new Error('Response missing text content type');
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 34: Tool results are MCP-compliant
    it('should return valid JSON-serializable content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          }),
          fc.anything(),
          async (params, data) => {
            const toolName = 'ssh_connect';

            // Try to create a response with arbitrary data
            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => {
                try {
                  // Ensure data is JSON-serializable
                  JSON.stringify(data);
                  return {
                    content: [{ type: 'text', text: JSON.stringify(data) }],
                  };
                } catch {
                  // If not serializable, return simple text
                  return {
                    content: [{ type: 'text', text: 'success' }],
                  };
                }
              });
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Response should be JSON-serializable
            try {
              JSON.stringify(response);
            } catch (e) {
              throw new Error(`Response is not JSON-serializable: ${e}`);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 35: Error responses are MCP-compliant', () => {
    // Feature: ssh-mcp-server, Property 35: Error responses are MCP-compliant
    it('should return MCP-compliant error structure for failed execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          }),
          fc.string({ minLength: 1 }),
          async (params, errorMessage) => {
            const toolName = 'ssh_connect';

            // Register handler that throws an error
            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => {
                throw new Error(errorMessage);
              });
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: params,
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Should be an error response
            if (!('code' in response)) {
              throw new Error('Expected error response for failed execution');
            }

            const errorResponse = response as MCPError;
            if (typeof errorResponse.code !== 'number') {
              throw new Error('Error code is not a number');
            }
            if (!errorResponse.message) {
              throw new Error('Error response missing message');
            }
            if (typeof errorResponse.message !== 'string') {
              throw new Error('Error message is not a string');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 35: Error responses are MCP-compliant
    it('should include appropriate error code for different error types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'invalid_tool',
            'missing_params',
            'invalid_method'
          ),
          async (errorType) => {
            let request;

            switch (errorType) {
              case 'invalid_tool':
                request = {
                  method: 'tools/call',
                  params: {
                    name: 'nonexistent_tool',
                    arguments: {},
                  },
                };
                break;
              case 'missing_params':
                request = {
                  method: 'tools/call',
                  params: {},
                };
                break;
              case 'invalid_method':
                request = {
                  method: 'invalid/method',
                };
                break;
            }

            const response = await protocolHandler.handleRequest(request);

            // Should be an error
            if (!('code' in response)) {
              throw new Error('Expected error response');
            }

            const errorResponse = response as MCPError;
            // Error code should be in valid range
            if (errorResponse.code > -32000 || errorResponse.code < -32700) {
              throw new Error(`Error code ${errorResponse.code} out of valid range`);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 35: Error responses are MCP-compliant
    it('should include error message in all error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          async (errorMessage) => {
            const toolName = 'ssh_connect';

            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => {
                throw new Error(errorMessage);
              });
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: {
                  host: 'example.com',
                  username: 'user',
                },
              },
            };

            const response = await protocolHandler.handleRequest(request);

            if ('code' in response) {
              const errorResponse = response as MCPError;
              if (!errorResponse.message) {
                throw new Error('Error response missing message');
              }
              if (errorResponse.message.length === 0) {
                throw new Error('Error message is empty');
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 35: Error responses are MCP-compliant
    it('should return JSON-serializable error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          async (errorMessage) => {
            const toolName = 'ssh_connect';

            if (!protocolHandler.hasHandler(toolName)) {
              protocolHandler.registerToolHandler(toolName, async () => {
                throw new Error(errorMessage);
              });
            }

            const request = {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: {
                  host: 'example.com',
                  username: 'user',
                },
              },
            };

            const response = await protocolHandler.handleRequest(request);

            // Error response should be JSON-serializable
            try {
              JSON.stringify(response);
            } catch (e) {
              throw new Error(`Error response is not JSON-serializable: ${e}`);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
