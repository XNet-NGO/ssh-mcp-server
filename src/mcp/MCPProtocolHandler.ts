/**
 * MCP Protocol Handler
 *
 * Handles MCP protocol request/response processing, parameter validation,
 * and routing to appropriate tool handlers.
 */

import Ajv, { ValidateFunction } from 'ajv';
import { ToolRegistry } from './ToolRegistry.js';

/**
 * MCP Request structure
 */
export interface MCPRequest {
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, any>;
  };
}

/**
 * MCP Response structure
 */
export interface MCPResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

/**
 * MCP Error structure
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (
  params: Record<string, any>
) => Promise<MCPResponse>;

/**
 * MCP Protocol Handler
 *
 * Manages MCP protocol operations including:
 * - Request validation
 * - Parameter validation against tool schemas
 * - Tool invocation routing
 * - Response formatting
 */
export class MCPProtocolHandler {
  private toolRegistry: ToolRegistry;
  private toolHandlers: Map<string, ToolHandler> = new Map();
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.compileValidators();
  }

  /**
   * Compile JSON schema validators for all tools
   */
  private compileValidators(): void {
    for (const tool of this.toolRegistry.getAllTools()) {
      const validator = this.ajv.compile(tool.inputSchema);
      this.validators.set(tool.name, validator);
    }
  }

  /**
   * Register a tool handler
   */
  registerToolHandler(toolName: string, handler: ToolHandler): void {
    if (!this.toolRegistry.hasTool(toolName)) {
      throw new Error(`Tool not found in registry: ${toolName}`);
    }
    this.toolHandlers.set(toolName, handler);
  }

  /**
   * Handle an MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse | MCPError> {
    try {
      // Validate request structure
      if (!request.method) {
        return this.createError(-32600, 'Invalid Request: missing method');
      }

      // Handle tools/list method
      if (request.method === 'tools/list') {
        return this.handleToolsList();
      }

      // Handle tools/call method
      if (request.method === 'tools/call') {
        return await this.handleToolCall(request);
      }

      // Unknown method
      return this.createError(-32601, `Method not found: ${request.method}`);
    } catch (error) {
      return this.createError(
        -32603,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(): MCPResponse {
    const tools = this.toolRegistry.getAllTools();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              tools: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(
    request: MCPRequest
  ): Promise<MCPResponse | MCPError> {
    // Validate params structure
    if (!request.params || !request.params.name) {
      return this.createError(
        -32602,
        'Invalid params: missing tool name'
      );
    }

    const toolName = request.params.name;
    const toolArgs = request.params.arguments || {};

    // Check if tool exists
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      return this.createError(-32602, `Tool not found: ${toolName}`);
    }

    // Validate parameters against schema
    const validationResult = this.validateParameters(toolName, toolArgs);
    if (!validationResult.valid) {
      return this.createError(
        -32602,
        'Invalid params',
        validationResult.errors
      );
    }

    // Check if handler is registered
    const handler = this.toolHandlers.get(toolName);
    if (!handler) {
      return this.createError(
        -32603,
        `Tool handler not registered: ${toolName}`
      );
    }

    // Execute tool handler
    try {
      const response = await handler(toolArgs);
      return response;
    } catch (error) {
      return this.createError(
        -32603,
        'Tool execution failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Validate parameters against tool schema
   */
  validateParameters(
    toolName: string,
    params: Record<string, any>
  ): { valid: boolean; errors?: string[] } {
    const validator = this.validators.get(toolName);
    if (!validator) {
      return {
        valid: false,
        errors: [`No validator found for tool: ${toolName}`],
      };
    }

    const valid = validator(params);
    if (!valid && validator.errors) {
      const errors = validator.errors.map(
        (err) => `${err.instancePath} ${err.message}`
      );
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Create an MCP-compliant success response
   */
  createSuccessResponse(data: any, text?: string): MCPResponse {
    const content: MCPResponse['content'] = [];

    if (text) {
      content.push({ type: 'text', text });
    }

    if (data !== undefined) {
      content.push({
        type: 'text',
        text: JSON.stringify(data, null, 2),
      });
    }

    return { content };
  }

  /**
   * Create an MCP-compliant error response
   */
  createError(code: number, message: string, data?: any): MCPError {
    const error: MCPError = { code, message };
    if (data !== undefined) {
      error.data = data;
    }
    return error;
  }

  /**
   * Format error as MCP response
   */
  formatErrorResponse(error: MCPError): MCPResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(error, null, 2),
        },
      ],
      isError: true,
    };
  }

  /**
   * Get all registered tool names
   */
  getRegisteredTools(): string[] {
    return this.toolRegistry.getToolNames();
  }

  /**
   * Get all registered handler names
   */
  getRegisteredHandlers(): string[] {
    return Array.from(this.toolHandlers.keys());
  }

  /**
   * Check if a tool handler is registered
   */
  hasHandler(toolName: string): boolean {
    return this.toolHandlers.has(toolName);
  }
}
