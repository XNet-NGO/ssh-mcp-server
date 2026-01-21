/**
 * Configuration Tools
 *
 * Implements MCP tool handlers for SSH configuration management:
 * - ssh_get_config: Get SSH configuration for a host
 * - ssh_set_option: Set SSH configuration option
 */

import { ConfigurationManager } from '../core/ConfigurationManager.js';
import { MCPResponse } from '../mcp/MCPProtocolHandler.js';
import { MCPErrorHandler } from '../mcp/MCPErrorHandler.js';

/**
 * Configuration Tools Handler
 */
export class ConfigurationTools {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  /**
   * ssh_get_config: Get SSH configuration for a host
   *
   * Retrieves the SSH configuration for a specific hostname, including
   * host-specific settings and global options.
   */
  async getConfig(params: { hostname: string }): Promise<MCPResponse> {
    try {
      // Get host configuration
      const hostConfig = this.configManager.getHostConfig(params.hostname);

      // Get known_hosts path for this host
      const knownHostsPath =
        this.configManager.getKnownHostsPathForHost(params.hostname);

      // Get debug level
      const debugLevel = this.configManager.getDebugLevel();

      // Get binary paths
      const binaryPaths = this.configManager.getBinaryPaths();

      return {
        content: [
          {
            type: 'text',
            text: `SSH configuration for ${params.hostname}`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                hostname: params.hostname,
                hostConfig: {
                  pattern: hostConfig.pattern,
                  hostname: hostConfig.hostname,
                  port: hostConfig.port,
                  user: hostConfig.user,
                  identityFile: hostConfig.identityFile,
                  options: hostConfig.options,
                },
                knownHostsPath,
                debugLevel,
                binaryPaths,
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
   * ssh_set_option: Set SSH configuration option
   *
   * Sets a global SSH configuration option. The option is validated
   * before being set.
   */
  async setOption(params: {
    key: string;
    value: string;
  }): Promise<MCPResponse> {
    try {
      // Validate and set option
      this.configManager.setOption(params.key, params.value);

      return {
        content: [
          {
            type: 'text',
            text: `Configuration option set: ${params.key}=${params.value}`,
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                key: params.key,
                value: params.value,
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
}
