/**
 * Key Management Tools
 *
 * Implements MCP tool handlers for SSH key management operations:
 * - ssh_keygen: Generate SSH key pair
 * - ssh_list_keys: List available SSH keys
 * - ssh_fingerprint: Get key fingerprint
 */

import { KeyManager, KeyGenerationOptions } from '../core/KeyManager.js';
import { MCPResponse } from '../mcp/MCPProtocolHandler.js';
import { MCPErrorHandler } from '../mcp/MCPErrorHandler.js';

/**
 * Key Management Tools Handler
 */
export class KeyManagementTools {
  private keyManager: KeyManager;

  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
  }

  /**
   * ssh_keygen: Generate SSH key pair
   *
   * Generates a new SSH key pair using ssh-keygen.
   */
  async generateKey(params: {
    algorithm: string;
    bits: number;
    passphrase?: string;
    path?: string;
    comment?: string;
  }): Promise<MCPResponse> {
    try {
      // Prepare key generation options
      const options: KeyGenerationOptions = {
        algorithm: params.algorithm,
        bits: params.bits,
        passphrase: params.passphrase,
        path: params.path,
        comment: params.comment,
      };

      // Generate key via KeyManager
      const keyPair = await this.keyManager.generateKey(options);

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `SSH key pair generated successfully`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                privateKeyPath: keyPair.privateKeyPath,
                publicKeyPath: keyPair.publicKeyPath,
                fingerprint: keyPair.fingerprint,
                algorithm: keyPair.algorithm,
                bits: keyPair.bits,
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
   * ssh_list_keys: List available SSH keys
   *
   * Lists all SSH keys in the specified directory (defaults to ~/.ssh).
   */
  async listKeys(params?: { directory?: string }): Promise<MCPResponse> {
    try {
      // List keys via KeyManager
      const keys = await this.keyManager.listKeys(params?.directory);

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Found ${keys.length} SSH key(s)`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                keys,
                count: keys.length,
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
   * ssh_fingerprint: Get key fingerprint
   *
   * Computes the fingerprint of an SSH key.
   */
  async getFingerprint(params: { keyPath: string }): Promise<MCPResponse> {
    try {
      // Get fingerprint via KeyManager
      const fingerprint = await this.keyManager.getFingerprint(params.keyPath);

      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Key fingerprint computed successfully`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                keyPath: params.keyPath,
                fingerprint,
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
