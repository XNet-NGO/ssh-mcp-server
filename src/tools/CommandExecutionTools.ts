/**
 * Command Execution Tools
 *
 * Implements MCP tool handlers for SSH command execution:
 * - ssh_execute: Execute remote command via SSH
 */

import { ConnectionManager } from '../core/ConnectionManager.js';
import { SSHWrapper } from '../core/SSHWrapper.js';
import { MCPResponse } from '../mcp/MCPProtocolHandler.js';
import { MCPErrorHandler } from '../mcp/MCPErrorHandler.js';

/**
 * Command Execution Tools Handler
 */
export class CommandExecutionTools {
  private connectionManager: ConnectionManager;
  private sshWrapper: SSHWrapper;

  constructor(connectionManager: ConnectionManager, sshWrapper: SSHWrapper) {
    this.connectionManager = connectionManager;
    this.sshWrapper = sshWrapper;
  }

  /**
   * ssh_execute: Execute remote command via SSH
   *
   * Executes a command on a remote host using an established session.
   * In stateless mode, decodes the sessionId to get connection parameters
   * and recreates the session if needed.
   * 
   * Supports timeout, environment variables, working directory, and PTY allocation.
   */
  async execute(params: {
    sessionId: string;
    command: string;
    timeout?: number;
    env?: Record<string, string>;
    workingDir?: string;
    pty?: boolean;
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

      // Prepare command with working directory if specified
      let finalCommand = params.command;
      if (params.workingDir) {
        // Change to working directory before executing command
        // Escape the working directory path to handle spaces and special characters
        const escapedWorkingDir = this.sshWrapper.escapeCommand(params.workingDir);
        finalCommand = `cd ${escapedWorkingDir} && ${params.command}`;
      }

      // Execute command via SSH wrapper
      const result = await this.sshWrapper.executeCommand(
        session,
        finalCommand,
        {
          timeout: params.timeout,
          env: params.env,
          pty: params.pty,
        }
      );

      // Check if command failed
      if (result.exitCode !== 0) {
        // Parse SSH error if stderr contains error information
        const errorInfo = this.sshWrapper.parseSSHError(
          result.stderr,
          params.sessionId,
          session.host,
          session.username
        );

        return {
          content: [
            {
              type: 'text',
              text: `Command failed with exit code ${result.exitCode}`,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  exitCode: result.exitCode,
                  stdout: result.stdout,
                  stderr: result.stderr,
                  duration: result.duration,
                  error: errorInfo,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Command executed successfully in ${result.duration}ms`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                duration: result.duration,
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
