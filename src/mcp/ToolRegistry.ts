/**
 * MCP Tool Registry
 * 
 * Defines all 15 SSH MCP tools with their schemas and descriptions.
 * Tools are registered on server startup and provide schema validation
 * for tool invocations.
 */

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Connection Tools (3 tools)
 */

export const SSH_CONNECT_SCHEMA: ToolSchema = {
  name: 'ssh_connect',
  description: 'Establish an SSH connection to a remote host',
  inputSchema: {
    type: 'object',
    properties: {
      host: {
        type: 'string',
        description: 'Remote hostname or IP address',
      },
      port: {
        type: 'number',
        description: 'SSH port (default: 22)',
        default: 22,
      },
      username: {
        type: 'string',
        description: 'SSH username',
      },
      keyPath: {
        type: 'string',
        description: 'Path to private key file (optional)',
      },
      config: {
        type: 'object',
        description: 'SSH configuration options',
        properties: {
          strictHostKeyChecking: {
            type: 'boolean',
            description: 'Enable strict host key checking',
            default: true,
          },
          connectTimeout: {
            type: 'number',
            description: 'Connection timeout in seconds',
            default: 30,
          },
          serverAliveInterval: {
            type: 'number',
            description: 'Server alive interval in seconds',
            default: 60,
          },
          compression: {
            type: 'boolean',
            description: 'Enable compression',
            default: true,
          },
          forwardAgent: {
            type: 'boolean',
            description: 'Enable agent forwarding',
            default: false,
          },
          customOptions: {
            type: 'object',
            description: 'Additional ssh_config options',
            additionalProperties: { type: 'string' },
          },
        },
      },
    },
    required: ['host', 'username'],
  },
};

export const SSH_DISCONNECT_SCHEMA: ToolSchema = {
  name: 'ssh_disconnect',
  description: 'Close an SSH connection',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier to disconnect',
      },
    },
    required: ['sessionId'],
  },
};

export const SSH_LIST_SESSIONS_SCHEMA: ToolSchema = {
  name: 'ssh_list_sessions',
  description: 'List all active SSH sessions',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Command Execution Tools (1 tool)
 */

export const SSH_EXECUTE_SCHEMA: ToolSchema = {
  name: 'ssh_execute',
  description: 'Execute a command on a remote host via SSH',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier',
      },
      command: {
        type: 'string',
        description: 'Command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Command timeout in seconds (optional)',
      },
      env: {
        type: 'object',
        description: 'Environment variables (optional)',
        additionalProperties: { type: 'string' },
      },
      workingDir: {
        type: 'string',
        description: 'Remote working directory (optional)',
      },
      pty: {
        type: 'boolean',
        description: 'Allocate pseudo-terminal (optional)',
        default: false,
      },
    },
    required: ['sessionId', 'command'],
  },
};

/**
 * File Transfer Tools (4 tools)
 */

export const SFTP_UPLOAD_SCHEMA: ToolSchema = {
  name: 'sftp_upload',
  description: 'Upload a file to a remote host via SFTP',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier',
      },
      localPath: {
        type: 'string',
        description: 'Local file path',
      },
      remotePath: {
        type: 'string',
        description: 'Remote file path',
      },
      recursive: {
        type: 'boolean',
        description: 'Recursive upload for directories (optional)',
        default: false,
      },
    },
    required: ['sessionId', 'localPath', 'remotePath'],
  },
};

export const SFTP_DOWNLOAD_SCHEMA: ToolSchema = {
  name: 'sftp_download',
  description: 'Download a file from a remote host via SFTP',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier',
      },
      remotePath: {
        type: 'string',
        description: 'Remote file path',
      },
      localPath: {
        type: 'string',
        description: 'Local file path',
      },
    },
    required: ['sessionId', 'remotePath', 'localPath'],
  },
};

export const SFTP_LIST_SCHEMA: ToolSchema = {
  name: 'sftp_list',
  description: 'List contents of a remote directory via SFTP',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier',
      },
      remotePath: {
        type: 'string',
        description: 'Remote directory path',
      },
    },
    required: ['sessionId', 'remotePath'],
  },
};

export const SFTP_DELETE_SCHEMA: ToolSchema = {
  name: 'sftp_delete',
  description: 'Delete a file on a remote host via SFTP',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier',
      },
      remotePath: {
        type: 'string',
        description: 'Remote file path to delete',
      },
    },
    required: ['sessionId', 'remotePath'],
  },
};

/**
 * Key Management Tools (3 tools)
 */

export const SSH_KEYGEN_SCHEMA: ToolSchema = {
  name: 'ssh_keygen',
  description: 'Generate an SSH key pair',
  inputSchema: {
    type: 'object',
    properties: {
      algorithm: {
        type: 'string',
        description: 'Key algorithm (rsa, ed25519, ecdsa, dsa)',
        enum: ['rsa', 'ed25519', 'ecdsa', 'dsa'],
      },
      bits: {
        type: 'number',
        description: 'Key size in bits (for RSA, DSA, ECDSA)',
      },
      passphrase: {
        type: 'string',
        description: 'Passphrase for the private key (optional)',
      },
      path: {
        type: 'string',
        description: 'Path where the key should be saved',
      },
      comment: {
        type: 'string',
        description: 'Comment for the key (optional)',
      },
    },
    required: ['algorithm', 'path'],
  },
};

export const SSH_LIST_KEYS_SCHEMA: ToolSchema = {
  name: 'ssh_list_keys',
  description: 'List available SSH keys in a directory',
  inputSchema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Directory to scan for SSH keys (default: ~/.ssh)',
      },
    },
  },
};

export const SSH_FINGERPRINT_SCHEMA: ToolSchema = {
  name: 'ssh_fingerprint',
  description: 'Get the fingerprint of an SSH key',
  inputSchema: {
    type: 'object',
    properties: {
      keyPath: {
        type: 'string',
        description: 'Path to the SSH key file',
      },
    },
    required: ['keyPath'],
  },
};

/**
 * Port Forwarding Tools (2 tools)
 */

export const SSH_PORT_FORWARD_SCHEMA: ToolSchema = {
  name: 'ssh_port_forward',
  description: 'Create an SSH tunnel for port forwarding',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier',
      },
      type: {
        type: 'string',
        description: 'Forward type: local, remote, or dynamic',
        enum: ['local', 'remote', 'dynamic'],
      },
      localPort: {
        type: 'number',
        description: 'Local port number',
      },
      remoteHost: {
        type: 'string',
        description: 'Remote host (for local and remote forwards)',
      },
      remotePort: {
        type: 'number',
        description: 'Remote port number (for local and remote forwards)',
      },
    },
    required: ['sessionId', 'type'],
  },
};

export const SSH_CLOSE_FORWARD_SCHEMA: ToolSchema = {
  name: 'ssh_close_forward',
  description: 'Close an SSH tunnel',
  inputSchema: {
    type: 'object',
    properties: {
      forwardId: {
        type: 'string',
        description: 'Port forward identifier to close',
      },
    },
    required: ['forwardId'],
  },
};

/**
 * Configuration Tools (2 tools)
 */

export const SSH_GET_CONFIG_SCHEMA: ToolSchema = {
  name: 'ssh_get_config',
  description: 'Get SSH configuration for a hostname',
  inputSchema: {
    type: 'object',
    properties: {
      hostname: {
        type: 'string',
        description: 'Hostname to get configuration for',
      },
    },
    required: ['hostname'],
  },
};

export const SSH_SET_OPTION_SCHEMA: ToolSchema = {
  name: 'ssh_set_option',
  description: 'Set an SSH configuration option',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Configuration option name',
      },
      value: {
        type: 'string',
        description: 'Configuration option value',
      },
    },
    required: ['key', 'value'],
  },
};

/**
 * Tool Registry Class
 * 
 * Manages registration and retrieval of all SSH MCP tools.
 */
export class ToolRegistry {
  private tools: Map<string, ToolSchema> = new Map();

  constructor() {
    this.registerAllTools();
  }

  /**
   * Register all 15 SSH MCP tools
   */
  private registerAllTools(): void {
    // Connection tools
    this.registerTool(SSH_CONNECT_SCHEMA);
    this.registerTool(SSH_DISCONNECT_SCHEMA);
    this.registerTool(SSH_LIST_SESSIONS_SCHEMA);

    // Command execution tools
    this.registerTool(SSH_EXECUTE_SCHEMA);

    // File transfer tools
    this.registerTool(SFTP_UPLOAD_SCHEMA);
    this.registerTool(SFTP_DOWNLOAD_SCHEMA);
    this.registerTool(SFTP_LIST_SCHEMA);
    this.registerTool(SFTP_DELETE_SCHEMA);

    // Key management tools
    this.registerTool(SSH_KEYGEN_SCHEMA);
    this.registerTool(SSH_LIST_KEYS_SCHEMA);
    this.registerTool(SSH_FINGERPRINT_SCHEMA);

    // Port forwarding tools
    this.registerTool(SSH_PORT_FORWARD_SCHEMA);
    this.registerTool(SSH_CLOSE_FORWARD_SCHEMA);

    // Configuration tools
    this.registerTool(SSH_GET_CONFIG_SCHEMA);
    this.registerTool(SSH_SET_OPTION_SCHEMA);
  }

  /**
   * Register a single tool
   */
  private registerTool(schema: ToolSchema): void {
    this.tools.set(schema.name, schema);
  }

  /**
   * Get a tool schema by name
   */
  getTool(name: string): ToolSchema | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolSchema[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }
}
