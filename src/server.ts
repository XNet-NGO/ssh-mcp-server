#!/usr/bin/env node
/**
 * SSH MCP Server - Standalone Server Entry Point
 *
 * This file provides a standalone server that can be run directly
 * or used as an MCP server in AI assistant configurations.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ConnectionManager } from './core/ConnectionManager.js';
import { SSHWrapper } from './core/SSHWrapper.js';
import { SFTPHandler } from './core/SFTPHandler.js';
import { KeyManager } from './core/KeyManager.js';
import { ConfigurationManager } from './core/ConfigurationManager.js';
import { ConnectionTools } from './tools/ConnectionTools.js';
import { CommandExecutionTools } from './tools/CommandExecutionTools.js';
import { FileTransferTools } from './tools/FileTransferTools.js';
import { KeyManagementTools } from './tools/KeyManagementTools.js';
import { PortForwardingTools } from './tools/PortForwardingTools.js';
import { ConfigurationTools } from './tools/ConfigurationTools.js';

/**
 * Shared core components - initialized once and reused across all requests
 * This ensures state persists across MCP Gateway invocations within a single container lifecycle.
 * 
 * Note: In stateless mode, sessions don't persist across container restarts.
 * Session IDs encode connection parameters for self-contained operation.
 */
const connectionManager = new ConnectionManager();
const configManager = new ConfigurationManager();
const sshWrapper = new SSHWrapper(); // Use default debug level (0)
const sftpHandler = new SFTPHandler();
const keyManager = new KeyManager();

/**
 * Create and configure the MCP server
 */
function createServer() {
  // Use shared core components instead of creating new instances

  // Initialize tool handlers
  const connectionTools = new ConnectionTools(connectionManager, sshWrapper);
  const commandTools = new CommandExecutionTools(connectionManager, sshWrapper);
  const fileTools = new FileTransferTools(connectionManager, sftpHandler);
  const keyTools = new KeyManagementTools(keyManager);
  const portTools = new PortForwardingTools(connectionManager, sshWrapper);
  const configTools = new ConfigurationTools(configManager);

  // Create MCP server
  const server = new Server(
    {
      name: 'ssh-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Connection tools
        {
          name: 'ssh_connect',
          description: 'Establish an SSH connection to a remote host',
          inputSchema: {
            type: 'object',
            properties: {
              host: { type: 'string', description: 'Remote hostname or IP address' },
              port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
              username: { type: 'string', description: 'SSH username' },
              keyPath: { type: 'string', description: 'Path to private key file (optional)' },
              useControlMaster: {
                type: 'boolean',
                description: 'Enable ControlMaster for connection multiplexing',
                default: true,
              },
            },
            required: ['host', 'username'],
          },
        },
        {
          name: 'ssh_disconnect',
          description: 'Close an SSH connection',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID to disconnect' },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'ssh_list_sessions',
          description: 'List all active SSH sessions',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        // Command execution tools
        {
          name: 'ssh_execute',
          description: 'Execute a command on a remote system via SSH',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID' },
              command: { type: 'string', description: 'Command to execute' },
              timeout: { type: 'number', description: 'Timeout in seconds (optional)' },
            },
            required: ['sessionId', 'command'],
          },
        },
        // File transfer tools
        {
          name: 'sftp_upload',
          description: 'Upload a file to remote system via SFTP',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID' },
              localPath: { type: 'string', description: 'Local file path' },
              remotePath: { type: 'string', description: 'Remote file path' },
            },
            required: ['sessionId', 'localPath', 'remotePath'],
          },
        },
        {
          name: 'sftp_download',
          description: 'Download a file from remote system via SFTP',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID' },
              remotePath: { type: 'string', description: 'Remote file path' },
              localPath: { type: 'string', description: 'Local file path' },
            },
            required: ['sessionId', 'remotePath', 'localPath'],
          },
        },
        {
          name: 'sftp_list',
          description: 'List contents of a remote directory',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID' },
              remotePath: { type: 'string', description: 'Remote directory path' },
            },
            required: ['sessionId', 'remotePath'],
          },
        },
        {
          name: 'sftp_delete',
          description: 'Delete a file on remote system',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID' },
              remotePath: { type: 'string', description: 'Remote file path' },
            },
            required: ['sessionId', 'remotePath'],
          },
        },
        // Key management tools
        {
          name: 'ssh_keygen',
          description: 'Generate a new SSH key pair',
          inputSchema: {
            type: 'object',
            properties: {
              algorithm: { type: 'string', description: 'Key algorithm (rsa, ed25519, ecdsa)' },
              bits: { type: 'number', description: 'Key size in bits' },
              path: { type: 'string', description: 'Path to save the key' },
              passphrase: { type: 'string', description: 'Passphrase (optional)' },
            },
            required: ['algorithm', 'bits', 'path'],
          },
        },
        {
          name: 'ssh_list_keys',
          description: 'List available SSH keys',
          inputSchema: {
            type: 'object',
            properties: {
              directory: { type: 'string', description: 'Directory to scan (default: ~/.ssh)' },
            },
          },
        },
        {
          name: 'ssh_fingerprint',
          description: 'Get fingerprint of an SSH key',
          inputSchema: {
            type: 'object',
            properties: {
              keyPath: { type: 'string', description: 'Path to key file' },
            },
            required: ['keyPath'],
          },
        },
        // Port forwarding tools
        {
          name: 'ssh_port_forward',
          description: 'Create an SSH tunnel for port forwarding',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Session ID' },
              type: {
                type: 'string',
                enum: ['local', 'remote', 'dynamic'],
                description: 'Forward type',
              },
              localPort: { type: 'number', description: 'Local port' },
              remoteHost: { type: 'string', description: 'Remote host (for local/remote)' },
              remotePort: { type: 'number', description: 'Remote port (for local/remote)' },
            },
            required: ['sessionId', 'type'],
          },
        },
        {
          name: 'ssh_close_forward',
          description: 'Close an SSH tunnel',
          inputSchema: {
            type: 'object',
            properties: {
              forwardId: { type: 'string', description: 'Port forward ID' },
            },
            required: ['forwardId'],
          },
        },
        // Configuration tools
        {
          name: 'ssh_get_config',
          description: 'Get SSH configuration for a host',
          inputSchema: {
            type: 'object',
            properties: {
              hostname: { type: 'string', description: 'Hostname to get config for' },
            },
            required: ['hostname'],
          },
        },
        {
          name: 'ssh_set_option',
          description: 'Set an SSH configuration option',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Configuration option name' },
              value: { type: 'string', description: 'Configuration option value' },
            },
            required: ['key', 'value'],
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        // Connection tools
        case 'ssh_connect':
          result = await connectionTools.connect(args as any);
          break;
        case 'ssh_disconnect':
          result = await connectionTools.disconnect(args as any);
          break;
        case 'ssh_list_sessions':
          result = await connectionTools.listSessions();
          break;

        // Command execution
        case 'ssh_execute':
          result = await commandTools.execute(args as any);
          break;

        // File transfer
        case 'sftp_upload':
          result = await fileTools.upload(args as any);
          break;
        case 'sftp_download':
          result = await fileTools.download(args as any);
          break;
        case 'sftp_list':
          result = await fileTools.list(args as any);
          break;
        case 'sftp_delete':
          result = await fileTools.delete(args as any);
          break;

        // Key management
        case 'ssh_keygen':
          result = await keyTools.generateKey(args as any);
          break;
        case 'ssh_list_keys':
          result = await keyTools.listKeys(args as any);
          break;
        case 'ssh_fingerprint':
          result = await keyTools.getFingerprint(args as any);
          break;

        // Port forwarding
        case 'ssh_port_forward':
          result = await portTools.createForward(args as any);
          break;
        case 'ssh_close_forward':
          result = await portTools.closeForward(args as any);
          break;

        // Configuration
        case 'ssh_get_config':
          result = await configTools.getConfig(args as any);
          break;
        case 'ssh_set_option':
          result = await configTools.setOption(args as any);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return result as any;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Register resource list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'ssh://docs/ai-usage-guide',
          name: 'AI Usage Guide',
          description: 'Comprehensive guide for AI assistants on how to use SSH MCP Server tools correctly',
          mimeType: 'text/markdown',
        },
        {
          uri: 'ssh://docs/quick-reference',
          name: 'Quick Reference',
          description: 'Quick reference guide with common patterns and examples',
          mimeType: 'text/markdown',
        },
      ],
    };
  });

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      let content: string;

      switch (uri) {
        case 'ssh://docs/ai-usage-guide':
          content = await import('fs').then(fs => 
            fs.promises.readFile('./docs/AI_USAGE_GUIDE.md', 'utf-8')
          );
          break;
        case 'ssh://docs/quick-reference':
          content = await import('fs').then(fs =>
            fs.promises.readFile('./docs/QUICK_REFERENCE.md', 'utf-8')
          );
          break;
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Error reading resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('SSH MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
