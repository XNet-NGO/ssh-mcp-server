/**
 * Port Forwarding Tools
 *
 * Implements MCP tool handlers for SSH port forwarding operations:
 * - ssh_port_forward: Create SSH tunnel
 * - ssh_close_forward: Close SSH tunnel
 */

import { ConnectionManager } from '../core/ConnectionManager.js';
import { SSHWrapper } from '../core/SSHWrapper.js';
import { MCPResponse } from '../mcp/MCPProtocolHandler.js';
import { MCPErrorHandler } from '../mcp/MCPErrorHandler.js';
import { PortForwardConfig } from '../core/types.js';
import { ChildProcess } from 'child_process';

/**
 * Port Forwarding Tools Handler
 */
export class PortForwardingTools {
  private connectionManager: ConnectionManager;
  private sshWrapper: SSHWrapper;
  private forwardProcesses: Map<string, ChildProcess>;

  constructor(connectionManager: ConnectionManager, sshWrapper: SSHWrapper) {
    this.connectionManager = connectionManager;
    this.sshWrapper = sshWrapper;
    this.forwardProcesses = new Map();
  }

  /**
   * ssh_port_forward: Create SSH tunnel
   *
   * Creates a port forward (tunnel) using SSH.
   * Supports local, remote, and dynamic (SOCKS) forwarding.
   */
  async createForward(params: {
    sessionId: string;
    type: 'local' | 'remote' | 'dynamic';
    localPort?: number;
    remoteHost?: string;
    remotePort?: number;
  }): Promise<MCPResponse> {
    try {
      // Try to get existing session
      let session = this.connectionManager.getSession(params.sessionId);
      
      // If session doesn't exist (stateless mode), decode and recreate it
      if (!session) {
        try {
          const connectionParams = this.connectionManager.decodeSessionId(params.sessionId);
          session = this.connectionManager.createSession(connectionParams);
        } catch (decodeError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  MCPErrorHandler.invalidParams(
                    `Invalid session ID: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`
                  ),
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      // Update last used timestamp
      session.lastUsedAt = new Date();

      // Prepare port forward configuration
      const forwardConfig: PortForwardConfig = {
        type: params.type,
        localPort: params.localPort,
        remoteHost: params.remoteHost,
        remotePort: params.remotePort,
      };

      // Validate configuration based on type
      if (params.type === 'local') {
        if (!params.localPort || !params.remoteHost || !params.remotePort) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  MCPErrorHandler.invalidParams(
                    'Local forward requires localPort, remoteHost, and remotePort'
                  ),
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      } else if (params.type === 'remote') {
        if (!params.remotePort || !params.localPort) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  MCPErrorHandler.invalidParams(
                    'Remote forward requires remotePort and localPort'
                  ),
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      } else if (params.type === 'dynamic') {
        if (!params.localPort) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  MCPErrorHandler.invalidParams(
                    'Dynamic forward requires localPort'
                  ),
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      // Create port forward via SSH wrapper
      const process = await this.sshWrapper.createPortForward(
        session,
        forwardConfig
      );

      // Add to connection manager tracking
      const forward = this.connectionManager.addPortForward(
        params.sessionId,
        forwardConfig
      );

      // Store process for later cleanup
      this.forwardProcesses.set(forward.id, process);

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Port forward created successfully`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                forwardId: forward.id,
                sessionId: params.sessionId,
                type: params.type,
                localPort: params.localPort,
                remoteHost: params.remoteHost,
                remotePort: params.remotePort,
                createdAt: forward.createdAt,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // Map error to MCP error
      if (error instanceof Error) {
        const mcpError = MCPErrorHandler.fromError(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mcpError, null, 2),
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  /**
   * ssh_close_forward: Close SSH tunnel
   *
   * Closes an active port forward and cleans up resources.
   */
  async closeForward(params: { forwardId: string }): Promise<MCPResponse> {
    try {
      // Get port forward
      const forward = this.connectionManager.getPortForward(params.forwardId);
      if (!forward) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                MCPErrorHandler.invalidParams(
                  `Port forward not found: ${params.forwardId}`
                ),
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      // Get the process
      const process = this.forwardProcesses.get(params.forwardId);
      if (process) {
        // Close the port forward via SSH wrapper
        await this.sshWrapper.closePortForward(process);

        // Remove from process map
        this.forwardProcesses.delete(params.forwardId);
      }

      // Remove from connection manager tracking
      this.connectionManager.removePortForward(params.forwardId);

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Port forward closed successfully`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                forwardId: params.forwardId,
                success: true,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // Map error to MCP error
      if (error instanceof Error) {
        const mcpError = MCPErrorHandler.fromError(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mcpError, null, 2),
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  /**
   * List all active port forwards
   *
   * Returns all active port forwards with their details.
   */
  async listForwards(): Promise<MCPResponse> {
    try {
      const forwards = this.connectionManager.listPortForwards();

      // Map forwards to response format
      const forwardList = forwards.map((forward) => ({
        forwardId: forward.id,
        sessionId: forward.sessionId,
        type: forward.config.type,
        localPort: forward.config.localPort,
        remoteHost: forward.config.remoteHost,
        remotePort: forward.config.remotePort,
        createdAt: forward.createdAt,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Found ${forwards.length} active port forward(s)`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                forwards: forwardList,
                count: forwards.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // Map error to MCP error
      if (error instanceof Error) {
        const mcpError = MCPErrorHandler.fromError(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mcpError, null, 2),
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }
}
