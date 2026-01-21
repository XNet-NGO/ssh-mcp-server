/**
 * File Transfer Tools
 *
 * Implements MCP tool handlers for SSH file transfer operations:
 * - sftp_upload: Upload file to remote system
 * - sftp_download: Download file from remote system
 * - sftp_list: List remote directory contents
 * - sftp_delete: Delete remote file
 */

import { ConnectionManager } from '../core/ConnectionManager.js';
import { SFTPHandler } from '../core/SFTPHandler.js';
import { MCPResponse } from '../mcp/MCPProtocolHandler.js';
import { MCPErrorHandler } from '../mcp/MCPErrorHandler.js';

/**
 * File Transfer Tools Handler
 */
export class FileTransferTools {
  private connectionManager: ConnectionManager;
  private sftpHandler: SFTPHandler;

  constructor(connectionManager: ConnectionManager, sftpHandler: SFTPHandler) {
    this.connectionManager = connectionManager;
    this.sftpHandler = sftpHandler;
  }

  /**
   * sftp_upload: Upload file to remote system
   *
   * Uploads a local file to a remote path using SFTP.
   */
  async upload(params: {
    sessionId: string;
    localPath: string;
    remotePath: string;
    timeout?: number;
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

      // Upload file via SFTP handler
      const result = await this.sftpHandler.uploadFile(
        session,
        params.localPath,
        params.remotePath,
        params.timeout
      );

      // Check if upload was successful
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `File upload failed`,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  duration: result.duration,
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
            text: `File uploaded successfully in ${result.duration}ms`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                localPath: params.localPath,
                remotePath: params.remotePath,
                bytesTransferred: result.bytesTransferred,
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

  /**
   * sftp_download: Download file from remote system
   *
   * Downloads a remote file to a local path using SFTP.
   */
  async download(params: {
    sessionId: string;
    remotePath: string;
    localPath: string;
    timeout?: number;
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

      // Download file via SFTP handler
      const result = await this.sftpHandler.downloadFile(
        session,
        params.remotePath,
        params.localPath,
        params.timeout
      );

      // Check if download was successful
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `File download failed`,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  duration: result.duration,
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
            text: `File downloaded successfully in ${result.duration}ms`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                remotePath: params.remotePath,
                localPath: params.localPath,
                bytesTransferred: result.bytesTransferred,
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

  /**
   * sftp_list: List remote directory contents
   *
   * Lists files and directories in a remote path using SFTP.
   */
  async list(params: {
    sessionId: string;
    remotePath: string;
    timeout?: number;
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

      // List directory via SFTP handler
      const files = await this.sftpHandler.listDirectory(
        session,
        params.remotePath,
        params.timeout
      );

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Found ${files.length} item(s) in ${params.remotePath}`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                path: params.remotePath,
                files,
                count: files.length,
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
   * sftp_delete: Delete remote file
   *
   * Deletes a file on the remote system using SFTP.
   */
  async delete(params: {
    sessionId: string;
    remotePath: string;
    timeout?: number;
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

      // Delete file via SFTP handler
      const result = await this.sftpHandler.deleteFile(
        session,
        params.remotePath,
        params.timeout
      );

      // Check if delete was successful
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `File deletion failed`,
            },
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  duration: result.duration,
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
            text: `File deleted successfully in ${result.duration}ms`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                remotePath: params.remotePath,
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
