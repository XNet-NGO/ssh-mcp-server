#!/usr/bin/env node
/**
 * SSH MCP CLI - Command-line interface for direct tool invocation
 * 
 * This CLI allows direct invocation of MCP tools without running a persistent server.
 * It loads state from disk, executes the requested tool, and saves state back to disk.
 * 
 * Usage: node dist/cli.js <tool-name> <json-args>
 * Example: node dist/cli.js ssh_connect '{"host":"example.com","username":"user"}'
 */

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

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: cli <tool-name> <json-args>');
    process.exit(1);
  }

  const toolName = args[0];
  const toolArgs = JSON.parse(args[1]);

  // Initialize core components with persistent storage
  const connectionManager = new ConnectionManager();
  const configManager = new ConfigurationManager();
  const sshWrapper = new SSHWrapper();
  const sftpHandler = new SFTPHandler();
  const keyManager = new KeyManager();

  // Initialize tool handlers
  const connectionTools = new ConnectionTools(connectionManager, sshWrapper);
  const commandTools = new CommandExecutionTools(connectionManager, sshWrapper);
  const fileTools = new FileTransferTools(connectionManager, sftpHandler);
  const keyTools = new KeyManagementTools(keyManager);
  const portTools = new PortForwardingTools(connectionManager, sshWrapper);
  const configTools = new ConfigurationTools(configManager);

  try {
    let result;

    switch (toolName) {
      // Connection tools
      case 'ssh_connect':
        result = await connectionTools.connect(toolArgs);
        break;
      case 'ssh_disconnect':
        result = await connectionTools.disconnect(toolArgs);
        break;
      case 'ssh_list_sessions':
        result = await connectionTools.listSessions();
        break;

      // Command execution
      case 'ssh_execute':
        result = await commandTools.execute(toolArgs);
        break;

      // File transfer
      case 'sftp_upload':
        result = await fileTools.upload(toolArgs);
        break;
      case 'sftp_download':
        result = await fileTools.download(toolArgs);
        break;
      case 'sftp_list':
        result = await fileTools.list(toolArgs);
        break;
      case 'sftp_delete':
        result = await fileTools.delete(toolArgs);
        break;

      // Key management
      case 'ssh_keygen':
        result = await keyTools.generateKey(toolArgs);
        break;
      case 'ssh_list_keys':
        result = await keyTools.listKeys(toolArgs);
        break;
      case 'ssh_fingerprint':
        result = await keyTools.getFingerprint(toolArgs);
        break;

      // Port forwarding
      case 'ssh_port_forward':
        result = await portTools.createForward(toolArgs);
        break;
      case 'ssh_close_forward':
        result = await portTools.closeForward(toolArgs);
        break;

      // Configuration
      case 'ssh_get_config':
        result = await configTools.getConfig(toolArgs);
        break;
      case 'ssh_set_option':
        result = await configTools.setOption(toolArgs);
        break;

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    // Output result as JSON
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      content: [
        {
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }, null, 2));
    process.exit(1);
  }
}

main();
