/**
 * Configuration Manager for SSH MCP Server
 * 
 * Manages SSH client configuration including:
 * - Parsing ssh_config files
 * - Host pattern matching
 * - Configuration validation
 * - Known_hosts file handling
 */

import { SSHConfig, HostConfig, ConfigOption } from './types.js';

/**
 * Valid SSH configuration options with their metadata
 * Based on OpenSSH ssh_config(5) man page
 */
const VALID_SSH_OPTIONS: ConfigOption[] = [
  { name: 'Host', description: 'Host pattern for configuration block', type: 'string', defaultValue: '*' },
  { name: 'HostName', description: 'Real host name to connect to', type: 'string', defaultValue: '' },
  { name: 'Port', description: 'Port number to connect to', type: 'number', defaultValue: '22' },
  { name: 'User', description: 'User name for login', type: 'string', defaultValue: '' },
  { name: 'IdentityFile', description: 'Path to private key file', type: 'string', defaultValue: '~/.ssh/id_rsa' },
  { name: 'StrictHostKeyChecking', description: 'Host key verification policy', type: 'string', defaultValue: 'ask' },
  { name: 'UserKnownHostsFile', description: 'Path to known_hosts file', type: 'string', defaultValue: '~/.ssh/known_hosts' },
  { name: 'ConnectTimeout', description: 'Connection timeout in seconds', type: 'number', defaultValue: '0' },
  { name: 'ServerAliveInterval', description: 'Interval for keepalive messages', type: 'number', defaultValue: '0' },
  { name: 'ServerAliveCountMax', description: 'Maximum keepalive messages', type: 'number', defaultValue: '3' },
  { name: 'Compression', description: 'Enable compression', type: 'boolean', defaultValue: 'no' },
  { name: 'CompressionLevel', description: 'Compression level (1-9)', type: 'number', defaultValue: '6' },
  { name: 'ForwardAgent', description: 'Forward SSH agent', type: 'boolean', defaultValue: 'no' },
  { name: 'ForwardX11', description: 'Forward X11 connections', type: 'boolean', defaultValue: 'no' },
  { name: 'ControlMaster', description: 'Control socket multiplexing', type: 'string', defaultValue: 'no' },
  { name: 'ControlPath', description: 'Path to control socket', type: 'string', defaultValue: '' },
  { name: 'ControlPersist', description: 'Keep control socket open', type: 'string', defaultValue: 'no' },
  { name: 'LogLevel', description: 'Logging verbosity', type: 'string', defaultValue: 'INFO' },
  { name: 'PasswordAuthentication', description: 'Allow password authentication', type: 'boolean', defaultValue: 'yes' },
  { name: 'PubkeyAuthentication', description: 'Allow public key authentication', type: 'boolean', defaultValue: 'yes' },
  { name: 'PreferredAuthentications', description: 'Authentication methods order', type: 'string', defaultValue: 'publickey,password' },
  { name: 'AddKeysToAgent', description: 'Add keys to SSH agent', type: 'string', defaultValue: 'no' },
  { name: 'IdentitiesOnly', description: 'Only use configured identity files', type: 'boolean', defaultValue: 'no' },
  { name: 'BatchMode', description: 'Disable interactive prompts', type: 'boolean', defaultValue: 'no' },
  { name: 'CheckHostIP', description: 'Check host IP in known_hosts', type: 'boolean', defaultValue: 'yes' },
  { name: 'Ciphers', description: 'Allowed ciphers', type: 'string', defaultValue: '' },
  { name: 'MACs', description: 'Allowed MAC algorithms', type: 'string', defaultValue: '' },
  { name: 'KexAlgorithms', description: 'Key exchange algorithms', type: 'string', defaultValue: '' },
  { name: 'HostKeyAlgorithms', description: 'Host key algorithms', type: 'string', defaultValue: '' },
  { name: 'ProxyCommand', description: 'Command to connect through proxy', type: 'string', defaultValue: '' },
  { name: 'ProxyJump', description: 'Jump host for connection', type: 'string', defaultValue: '' },
  { name: 'SendEnv', description: 'Environment variables to send', type: 'string', defaultValue: '' },
  { name: 'SetEnv', description: 'Environment variables to set', type: 'string', defaultValue: '' },
];

/**
 * Binary paths configuration for OpenSSH tools
 */
export interface BinaryPaths {
  ssh?: string;
  sftp?: string;
  scp?: string;
  sshKeygen?: string;
  sshAdd?: string;
}

/**
 * Debug verbosity level for SSH operations
 * 
 * - 0: No debug output (default)
 * - 1: Basic debug output (-v flag)
 * - 2: Detailed debug output (-vv flag)
 * - 3: Maximum debug output (-vvv flag)
 */
export type DebugLevel = 0 | 1 | 2 | 3;

/**
 * Configuration Manager class
 * 
 * Handles SSH configuration file parsing, validation, and host-specific configuration lookup.
 * Also manages binary paths for OpenSSH tools and debug verbosity settings.
 */
export class ConfigurationManager {
  private config: SSHConfig;
  private validOptions: Map<string, ConfigOption>;
  private knownHostsPath: string;
  private binaryPaths: Required<BinaryPaths>;
  private debugLevel: DebugLevel;

  constructor(knownHostsPath: string = '~/.ssh/known_hosts', binaryPaths?: BinaryPaths, debugLevel: DebugLevel = 0) {
    this.config = {
      hosts: new Map(),
      globalOptions: {},
    };
    
    this.knownHostsPath = knownHostsPath;
    this.debugLevel = debugLevel;
    
    // Initialize binary paths with defaults (lookup from PATH)
    this.binaryPaths = {
      ssh: binaryPaths?.ssh || 'ssh',
      sftp: binaryPaths?.sftp || 'sftp',
      scp: binaryPaths?.scp || 'scp',
      sshKeygen: binaryPaths?.sshKeygen || 'ssh-keygen',
      sshAdd: binaryPaths?.sshAdd || 'ssh-add',
    };
    
    // Build lookup map for valid options
    this.validOptions = new Map();
    for (const option of VALID_SSH_OPTIONS) {
      this.validOptions.set(option.name.toLowerCase(), option);
    }
  }

  /**
   * Parse SSH configuration from file content
   * 
   * Parses ssh_config format:
   * - Host blocks define host-specific configuration
   * - Options outside Host blocks are global
   * - Comments start with #
   * - Blank lines are ignored
   * 
   * @param content - SSH config file content
   * @returns Parsed SSH configuration
   */
  parseSSHConfig(content: string): SSHConfig {
    const lines = content.split('\n');
    const config: SSHConfig = {
      hosts: new Map(),
      globalOptions: {},
    };

    let currentHost: HostConfig | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Split on whitespace, handling quoted values
      const parts = this.splitConfigLine(trimmed);
      if (parts.length < 2) {
        continue;
      }

      const key = parts[0];
      const value = parts.slice(1).join(' ');

      if (key.toLowerCase() === 'host') {
        // Save previous host block if exists
        if (currentHost) {
          config.hosts.set(currentHost.pattern, currentHost);
        }

        // Start new host block
        currentHost = {
          pattern: value,
          options: {},
        };
      } else if (currentHost) {
        // Host-specific option
        this.applyHostOption(currentHost, key, value);
      } else {
        // Global option
        config.globalOptions[key] = value;
      }
    }

    // Save last host block
    if (currentHost) {
      config.hosts.set(currentHost.pattern, currentHost);
    }

    this.config = config;
    return config;
  }

  /**
   * Split a config line into parts, respecting quotes
   * 
   * @param line - Config line to split
   * @returns Array of parts
   */
  private splitConfigLine(line: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Apply a configuration option to a host config
   * 
   * @param hostConfig - Host configuration to update
   * @param key - Option key
   * @param value - Option value
   */
  private applyHostOption(hostConfig: HostConfig, key: string, value: string): void {
    const lowerKey = key.toLowerCase();

    switch (lowerKey) {
      case 'hostname':
        hostConfig.hostname = value;
        break;
      case 'port':
        hostConfig.port = parseInt(value, 10);
        break;
      case 'user':
        hostConfig.user = value;
        break;
      case 'identityfile':
        if (!hostConfig.identityFile) {
          hostConfig.identityFile = [];
        }
        hostConfig.identityFile.push(value);
        break;
      default:
        hostConfig.options[key] = value;
        break;
    }
  }

  /**
   * Get configuration for a specific hostname
   * 
   * Matches the hostname against all Host patterns and merges matching configurations.
   * More specific patterns take precedence over less specific ones.
   * 
   * @param hostname - Hostname to get configuration for
   * @returns Host-specific configuration
   */
  getHostConfig(hostname: string): HostConfig {
    const matchedConfigs: HostConfig[] = [];

    // Find all matching host patterns
    for (const [pattern, hostConfig] of this.config.hosts) {
      if (this.matchHostPattern(hostname, pattern)) {
        matchedConfigs.push(hostConfig);
      }
    }

    // Merge configurations (first match wins for each option)
    const merged: HostConfig = {
      pattern: hostname,
      options: { ...this.config.globalOptions },
    };

    for (const config of matchedConfigs) {
      if (!merged.hostname && config.hostname) {
        merged.hostname = config.hostname;
      }
      if (!merged.port && config.port) {
        merged.port = config.port;
      }
      if (!merged.user && config.user) {
        merged.user = config.user;
      }
      if (config.identityFile) {
        if (!merged.identityFile) {
          merged.identityFile = [];
        }
        merged.identityFile.push(...config.identityFile);
      }
      
      // Merge options (first match wins)
      for (const [key, value] of Object.entries(config.options)) {
        if (!(key in merged.options)) {
          merged.options[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Match a hostname against an SSH host pattern
   * 
   * SSH patterns support:
   * - * matches zero or more characters
   * - ? matches exactly one character
   * - Negation with ! prefix
   * 
   * @param hostname - Hostname to match
   * @param pattern - SSH host pattern
   * @returns True if hostname matches pattern
   */
  matchHostPattern(hostname: string, pattern: string): boolean {
    // Handle negation
    if (pattern.startsWith('!')) {
      return !this.matchHostPattern(hostname, pattern.substring(1));
    }

    // Convert SSH pattern to regex
    // Escape special regex characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
      .replace(/\*/g, '.*')                    // * matches any characters
      .replace(/\?/g, '.');                    // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`, 'i');  // Case-insensitive
    return regex.test(hostname);
  }

  /**
   * Validate a configuration option
   * 
   * @param key - Option key
   * @param value - Option value
   * @returns True if option is valid
   */
  validateOption(key: string, value: string): boolean {
    const option = this.validOptions.get(key.toLowerCase());
    
    if (!option) {
      return false;
    }

    // Type-specific validation
    switch (option.type) {
      case 'number':
        return !isNaN(parseInt(value, 10));
      case 'boolean':
        return ['yes', 'no', 'true', 'false', '1', '0'].includes(value.toLowerCase());
      case 'string':
        return true;  // Any string is valid
      default:
        return false;
    }
  }

  /**
   * Set a configuration option
   * 
   * @param key - Option key
   * @param value - Option value
   * @throws Error if option is invalid
   */
  setOption(key: string, value: string): void {
    if (!this.validateOption(key, value)) {
      throw new Error(`Invalid configuration option: ${key}=${value}`);
    }

    this.config.globalOptions[key] = value;
  }

  /**
   * List all available configuration options
   * 
   * @returns Array of configuration option metadata
   */
  listOptions(): ConfigOption[] {
    return VALID_SSH_OPTIONS;
  }

  /**
   * Get current configuration
   * 
   * @returns Current SSH configuration
   */
  getConfig(): SSHConfig {
    return this.config;
  }

  /**
   * Load configuration from file content
   * 
   * @param content - SSH config file content
   * @returns Parsed configuration
   */
  loadConfig(content: string): SSHConfig {
    return this.parseSSHConfig(content);
  }

  /**
   * Get the known_hosts file path
   * 
   * @returns Path to known_hosts file
   */
  getKnownHostsPath(): string {
    return this.knownHostsPath;
  }

  /**
   * Set the known_hosts file path
   * 
   * @param path - Path to known_hosts file
   */
  setKnownHostsPath(path: string): void {
    this.knownHostsPath = path;
  }

  /**
   * Get known_hosts path for a specific host configuration
   * 
   * Checks host-specific configuration first, then falls back to global setting.
   * 
   * @param hostname - Hostname to get known_hosts path for
   * @returns Path to known_hosts file
   */
  getKnownHostsPathForHost(hostname: string): string {
    // Check host-specific configurations (first match wins)
    for (const [pattern, hostConfig] of this.config.hosts) {
      if (this.matchHostPattern(hostname, pattern)) {
        if (hostConfig.options['UserKnownHostsFile']) {
          return hostConfig.options['UserKnownHostsFile'];
        }
      }
    }
    
    // Check global UserKnownHostsFile option
    if (this.config.globalOptions['UserKnownHostsFile']) {
      return this.config.globalOptions['UserKnownHostsFile'];
    }
    
    // Fall back to default
    return this.knownHostsPath;
  }

  /**
   * Get binary paths configuration
   * 
   * Returns the configured paths for all OpenSSH binaries.
   * 
   * @returns Binary paths configuration
   * 
   * Validates: Requirements 10.1, 10.2
   */
  getBinaryPaths(): Required<BinaryPaths> {
    return { ...this.binaryPaths };
  }

  /**
   * Set binary path for a specific tool
   * 
   * Allows configuring custom paths for OpenSSH binaries if they're not in PATH
   * or if a specific version should be used.
   * 
   * @param tool - Tool name (ssh, sftp, scp, sshKeygen, sshAdd)
   * @param path - Path to the binary
   * 
   * @example
   * ```typescript
   * configManager.setBinaryPath('ssh', '/usr/local/bin/ssh');
   * configManager.setBinaryPath('sshKeygen', '/opt/openssh/bin/ssh-keygen');
   * ```
   * 
   * Validates: Requirements 10.1, 10.2
   */
  setBinaryPath(tool: keyof BinaryPaths, path: string): void {
    if (!path) {
      throw new Error(`Binary path cannot be empty for ${tool}`);
    }
    this.binaryPaths[tool] = path;
  }

  /**
   * Set multiple binary paths at once
   * 
   * @param paths - Binary paths to set
   * 
   * @example
   * ```typescript
   * configManager.setBinaryPaths({
   *   ssh: '/usr/local/bin/ssh',
   *   sftp: '/usr/local/bin/sftp',
   *   sshKeygen: '/usr/local/bin/ssh-keygen'
   * });
   * ```
   * 
   * Validates: Requirements 10.1, 10.2
   */
  setBinaryPaths(paths: BinaryPaths): void {
    if (paths.ssh) this.binaryPaths.ssh = paths.ssh;
    if (paths.sftp) this.binaryPaths.sftp = paths.sftp;
    if (paths.scp) this.binaryPaths.scp = paths.scp;
    if (paths.sshKeygen) this.binaryPaths.sshKeygen = paths.sshKeygen;
    if (paths.sshAdd) this.binaryPaths.sshAdd = paths.sshAdd;
  }

  /**
   * Validate that a binary exists and is executable
   * 
   * This method checks if a binary can be found and executed.
   * It's useful for validating configuration on startup.
   * 
   * @param binaryPath - Path to the binary to validate
   * @returns Promise resolving to true if binary is valid, false otherwise
   * 
   * @example
   * ```typescript
   * const isValid = await configManager.validateBinary('/usr/bin/ssh');
   * if (!isValid) {
   *   console.error('SSH binary not found or not executable');
   * }
   * ```
   * 
   * Validates: Requirements 10.1, 10.2
   */
  async validateBinary(binaryPath: string): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        // Try to execute the binary with --version or -V flag
        // Most OpenSSH tools support this
        const proc = spawn(binaryPath, ['--version'], {
          stdio: 'pipe',
        });

        let hasOutput = false;

        proc.stdout?.on('data', () => {
          hasOutput = true;
        });

        proc.stderr?.on('data', () => {
          hasOutput = true;
        });

        proc.on('error', () => {
          resolve(false);
        });

        proc.on('close', (code) => {
          // Binary is valid if it executed (even if it returned non-zero)
          // and produced some output
          resolve(hasOutput || code !== null);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate all configured binary paths
   * 
   * Checks that all OpenSSH binaries can be found and executed.
   * Returns a map of tool names to validation results.
   * 
   * @returns Promise resolving to validation results for each binary
   * 
   * @example
   * ```typescript
   * const results = await configManager.validateAllBinaries();
   * for (const [tool, isValid] of Object.entries(results)) {
   *   if (!isValid) {
   *     console.error(`${tool} binary is not valid`);
   *   }
   * }
   * ```
   * 
   * Validates: Requirements 10.1, 10.2
   */
  async validateAllBinaries(): Promise<Record<keyof BinaryPaths, boolean>> {
    const results: Record<keyof BinaryPaths, boolean> = {
      ssh: false,
      sftp: false,
      scp: false,
      sshKeygen: false,
      sshAdd: false,
    };

    // Validate each binary in parallel
    const validations = await Promise.all([
      this.validateBinary(this.binaryPaths.ssh),
      this.validateBinary(this.binaryPaths.sftp),
      this.validateBinary(this.binaryPaths.scp),
      this.validateBinary(this.binaryPaths.sshKeygen),
      this.validateBinary(this.binaryPaths.sshAdd),
    ]);

    results.ssh = validations[0];
    results.sftp = validations[1];
    results.scp = validations[2];
    results.sshKeygen = validations[3];
    results.sshAdd = validations[4];

    return results;
  }

  /**
   * Get debug verbosity level
   * 
   * Returns the current debug level configuration (0-3).
   * 
   * @returns Debug level (0 = no debug, 1 = -v, 2 = -vv, 3 = -vvv)
   * 
   * Validates: Requirement 10.7
   */
  getDebugLevel(): DebugLevel {
    return this.debugLevel;
  }

  /**
   * Set debug verbosity level
   * 
   * Configures the debug level for SSH operations:
   * - 0: No debug output (default)
   * - 1: Basic debug output (-v flag)
   * - 2: Detailed debug output (-vv flag)
   * - 3: Maximum debug output (-vvv flag)
   * 
   * @param level - Debug level (0-3)
   * @throws Error if level is not 0, 1, 2, or 3
   * 
   * @example
   * ```typescript
   * // Enable basic debug output
   * configManager.setDebugLevel(1);
   * 
   * // Enable maximum debug output
   * configManager.setDebugLevel(3);
   * 
   * // Disable debug output
   * configManager.setDebugLevel(0);
   * ```
   * 
   * Validates: Requirement 10.7
   */
  setDebugLevel(level: DebugLevel): void {
    if (![0, 1, 2, 3].includes(level)) {
      throw new Error(`Invalid debug level: ${level}. Must be 0, 1, 2, or 3.`);
    }
    this.debugLevel = level;
  }

  /**
   * Get debug flags for SSH commands
   * 
   * Returns an array of -v flags based on the current debug level:
   * - Level 0: [] (no flags)
   * - Level 1: ['-v']
   * - Level 2: ['-v', '-v']
   * - Level 3: ['-v', '-v', '-v']
   * 
   * These flags can be added to SSH command arguments to enable verbose output.
   * 
   * @returns Array of debug flags
   * 
   * @example
   * ```typescript
   * const debugFlags = configManager.getDebugFlags();
   * const sshArgs = ['ssh', ...debugFlags, 'user@host', 'command'];
   * ```
   * 
   * Validates: Requirement 10.7
   */
  getDebugFlags(): string[] {
    const flags: string[] = [];
    for (let i = 0; i < this.debugLevel; i++) {
      flags.push('-v');
    }
    return flags;
  }
}
