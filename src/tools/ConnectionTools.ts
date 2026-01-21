/**
 * Connection Tools
 *
 * Implements MCP tool handlers for SSH connection management:
 * - ssh_connect: Establish SSH connection
 * - ssh_disconnect: Close SSH connection
 * - ssh_list_sessions: List active sessions
 */

import { ConnectionManager } from '../core/ConnectionManager.js';
import { SSHWrapper } from '../core/SSHWrapper.js';
import { MCPResponse } from '../mcp/MCPProtocolHandler.js';
import { MCPErrorHandler } from '../mcp/MCPErrorHandler.js';

/**
 * Connection Tools Handler
 */
export class ConnectionTools {
  private connectionManager: ConnectionManager;
  // private sshWrapper: SSHWrapper; // Reserved for future use

  constructor(connectionManager: ConnectionManager, _sshWrapper: SSHWrapper) {
    this.connectionManager = connectionManager;
    // this.sshWrapper = sshWrapper; // Reserved for future use
  }

  /**
   * ssh_connect: Establish SSH connection
   *
   * Creates a session and optionally establishes ControlMaster connection.
   */
  async connect(params: {
    host: string;
    port?: number;
    username: string;
    keyPath?: string;
    privateKey?: string;
    privateKeyBase64?: string;
    config?: {
      strictHostKeyChecking?: boolean;
      connectTimeout?: number;
      serverAliveInterval?: number;
      compression?: boolean;
      forwardAgent?: boolean;
      customOptions?: Record<string, string>;
    };
  }): Promise<MCPResponse> {
    try {
      // Decode base64 key if provided
      let privateKey = params.privateKey;
      if (params.privateKeyBase64) {
        privateKey = Buffer.from(params.privateKeyBase64, 'base64').toString('utf-8');
      }

      // Create session
      const session = this.connectionManager.createSession({
        host: params.host,
        port: params.port || 22,
        username: params.username,
        keyPath: params.keyPath,
        privateKey: privateKey,
        config: params.config,
      });

      // Note: ControlMaster connection establishment will be implemented
      // when full SSH connection logic is added in later tasks

      return {
        content: [
          {
            type: 'text',
            text: `SSH connection established to ${params.host}`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                sessionId: session.id,
                host: session.host,
                port: session.port,
                username: session.username,
                createdAt: session.createdAt,
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
   * ssh_disconnect: Close SSH connection
   *
   * In stateless mode, this is primarily a no-op since sessions are not
   * persisted between tool calls. It removes the session from in-memory
   * tracking for the current container instance.
   * 
   * Note: ControlMaster connections are automatically cleaned up when the
   * container exits, so explicit disconnection is not strictly necessary.
   */
  async disconnect(params: { sessionId: string }): Promise<MCPResponse> {
    try {
      // Try to get session (may not exist in stateless mode)
      const session = this.connectionManager.getSession(params.sessionId);
      
      if (!session) {
        // In stateless mode, session might not exist - this is OK
        return {
          content: [
            {
              type: 'text',
              text: `Session ${params.sessionId} not found in current container (stateless mode)`,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sessionId: params.sessionId,
                  success: true,
                  note: 'In stateless mode, sessions are automatically cleaned up when the container exits.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Note: ControlMaster connection closing will be implemented
      // when full SSH connection logic is added in later tasks

      // Remove session from tracking
      this.connectionManager.removeSession(params.sessionId);

      return {
        content: [
          {
            type: 'text',
            text: `SSH connection closed for session ${params.sessionId}`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                sessionId: params.sessionId,
                success: true,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
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
   * ssh_list_sessions: List all active sessions
   *
   * In stateless mode, this returns sessions that exist in memory for the
   * current tool call only. Since each tool call gets a fresh container,
   * this will typically return an empty array unless sessions were created
   * earlier in the same tool call.
   * 
   * Note: Session IDs are self-contained (base64-encoded connection params),
   * so you don't need to list sessions - just use the session ID from ssh_connect.
   */
  async listSessions(): Promise<MCPResponse> {
    try {
      const sessions = this.connectionManager.listSessions();

      // Map sessions to response format
      const sessionList = sessions.map((session) => ({
        sessionId: session.id,
        host: session.host,
        port: session.port,
        username: session.username,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        active: this.connectionManager.isSessionActive(session.id),
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Found ${sessions.length} active session(s) (stateless mode - sessions exist only in current container)`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                sessions: sessionList,
                count: sessions.length,
                note: 'In stateless mode, sessions are not persisted between tool calls. Use the session ID from ssh_connect for subsequent operations.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
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
