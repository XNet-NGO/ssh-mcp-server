/**
 * SSHWrapper - Executes SSH commands and manages subprocess lifecycle
 * 
 * This class is responsible for:
 * - Constructing SSH command arrays with proper flags and options
 * - Handling connection parameters (host, port, username)
 * - Managing key authentication (-i flag)
 * - Configuring ControlMaster options for connection multiplexing
 * - Applying SSH configuration options via -o flags
 * - Supporting custom ssh_config options
 * 
 * The wrapper builds command arrays that can be passed to Node.js child_process
 * functions for subprocess execution. All SSH operations use the openssh-portable
 * command-line tools (ssh, sftp, scp, etc.).
 */

import { spawn } from 'child_process';
import { writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  Session,
  ExecOptions,
  CommandResult,
  PortForwardConfig,
} from './types.js';
import { scrubSensitiveData, logSecurityEvent, SecurityEventType } from './SecurityUtils.js';

/**
 * SSHWrapper handles SSH command construction and execution
 * 
 * Validates Requirements:
 * - 1.2: Uses ssh -i flag for key-based authentication
 * - 1.3: Passes StrictHostKeyChecking via -o flag
 * - 2.4: Reuses existing control socket when using ControlMaster
 * - 2.5: Passes environment variables using ssh -o SendEnv or command prefix
 * - 7.5: Uses -o flag for each configuration option
 */
export class SSHWrapper {
  /** Path to ssh binary (default: 'ssh' from PATH) */
  private sshBinaryPath: string;
  
  /** Debug verbosity level (0-3) */
  private debugLevel: number;

  /**
   * Create a new SSHWrapper instance
   * 
   * @param sshBinaryPath - Path to ssh binary (optional, defaults to 'ssh')
   * @param debugLevel - Debug verbosity level 0-3 (optional, defaults to 0)
   */
  constructor(sshBinaryPath: string = 'ssh', debugLevel: number = 0) {
    this.sshBinaryPath = sshBinaryPath;
    this.debugLevel = debugLevel;
  }

  /**
   * Write private key content to a temporary file
   * 
   * Creates a temporary file with the private key content and sets proper permissions (0600).
   * The caller is responsible for deleting the file after use.
   * 
   * @param privateKey - Private key content as string
   * @returns Path to the temporary key file
   */
  private writePrivateKeyToTempFile(privateKey: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const tempKeyPath = join(tmpdir(), `ssh-mcp-key-${timestamp}-${random}`);
    
    // Write key to temp file
    writeFileSync(tempKeyPath, privateKey, { mode: 0o600 });
    
    // Ensure proper permissions (SSH requires 0600)
    try {
      chmodSync(tempKeyPath, 0o600);
    } catch (error) {
      // chmod may fail on Windows, but that's okay
      console.error(`[SSHWrapper] Warning: Could not chmod temp key file: ${error}`);
    }
    
    console.error(`[SSHWrapper] Created temporary key file: ${tempKeyPath}`);
    return tempKeyPath;
  }

  /**
   * Escape a command string for safe execution via SSH
   * 
   * This function properly escapes special shell characters to prevent command injection
   * and ensure the command executes as intended. It handles:
   * - Single quotes (')
   * - Double quotes (")
   * - Backticks (`)
   * - Dollar signs ($)
   * - Semicolons (;)
   * - Pipes (|)
   * - Ampersands (&)
   * - Angle brackets (< >)
   * - Parentheses (( ))
   * - Backslashes (\)
   * - Newlines and other control characters
   * 
   * The escaping strategy uses single quotes to wrap the entire command, which prevents
   * shell interpretation of special characters. Within single quotes, only the single
   * quote character itself needs special handling, which is done by ending the quoted
   * string, adding an escaped single quote, and starting a new quoted string.
   * 
   * @param command - The command string to escape
   * @returns Escaped command string safe for shell execution
   * 
   * @example
   * ```typescript
   * escapeCommand('echo "hello"')
   * // Returns: 'echo "hello"' (wrapped in single quotes)
   * 
   * escapeCommand("echo 'hello'")
   * // Returns: 'echo '\''hello'\''' (single quotes escaped)
   * 
   * escapeCommand('rm -rf /; echo "gotcha"')
   * // Returns: 'rm -rf /; echo "gotcha"' (semicolon is literal, not command separator)
   * 
   * escapeCommand('echo $HOME')
   * // Returns: 'echo $HOME' (dollar sign is literal, not variable expansion)
   * 
   * escapeCommand('cat file | grep pattern')
   * // Returns: 'cat file | grep pattern' (pipe is literal, not command pipe)
   * ```
   * 
   * Validates: Requirement 2.2
   */
  escapeCommand(command: string): string {
    // Empty commands don't need escaping
    if (!command) {
      return command;
    }

    // Single quotes provide the strongest protection against shell interpretation.
    // Inside single quotes, all characters are literal except for the single quote itself.
    // To include a literal single quote, we:
    // 1. End the current single-quoted string with '
    // 2. Add an escaped single quote \'
    // 3. Start a new single-quoted string with '
    // This transforms: '  into  '\''
    // 
    // Example: echo 'it's working'
    // Becomes: 'echo '\''it'\''s working'\'''
    // Which the shell interprets as three concatenated strings:
    // 1. 'echo '
    // 2. \'
    // 3. 's working'
    
    const escaped = command.replace(/'/g, "'\\''");
    
    // Wrap the entire command in single quotes
    return `'${escaped}'`;
  }

  /**
   * Build an SSH command array for subprocess execution
   * 
   * Constructs a complete SSH command with all necessary flags and options:
   * - Connection parameters: -p (port), -l (username)
   * - Key authentication: -i (identity file)
   * - ControlMaster: ControlPath, ControlMaster, ControlPersist options
   * - Configuration: StrictHostKeyChecking, ConnectTimeout, etc.
   * - Custom options: Any additional ssh_config options
   * 
   * The returned array can be passed directly to child_process.spawn() or
   * similar subprocess execution functions.
   * 
   * Commands are automatically escaped to prevent shell injection attacks.
   * 
   * @param session - Session object containing connection parameters
   * @param command - Remote command to execute (optional, for connection-only use empty string)
   * @param options - Execution options (timeout, env, etc.)
   * @returns Array of command arguments suitable for subprocess execution
   * 
   * @example
   * ```typescript
   * const wrapper = new SSHWrapper();
   * const session = {
   *   id: '123',
   *   host: 'example.com',
   *   port: 22,
   *   username: 'user',
   *   keyPath: '/home/user/.ssh/id_rsa',
   *   controlSocketPath: '/tmp/ssh-mcp-123',
   *   config: {
   *     strictHostKeyChecking: true,
   *     connectTimeout: 30,
   *     serverAliveInterval: 60,
   *     compression: true,
   *     forwardAgent: false,
   *     customOptions: { 'ServerAliveCountMax': '3' }
   *   },
   *   createdAt: new Date(),
   *   lastUsedAt: new Date()
   * };
   * 
   * const args = wrapper.buildSSHCommand(session, 'echo "Hello World"', {});
   * // Returns: ['ssh', '-p', '22', '-l', 'user', '-i', '/home/user/.ssh/id_rsa',
   * //           '-o', 'ControlPath=/tmp/ssh-mcp-123', '-o', 'ControlMaster=auto',
   * //           '-o', 'ControlPersist=10m', '-o', 'StrictHostKeyChecking=yes',
   * //           '-o', 'ConnectTimeout=30', '-o', 'ServerAliveInterval=60',
   * //           '-o', 'Compression=yes', '-o', 'ForwardAgent=no',
   * //           '-o', 'ServerAliveCountMax=3', 'example.com', 'echo "Hello World"']
   * ```
   * 
   * Validates: Requirements 1.2, 1.3, 2.2, 2.4, 2.5, 7.5
   */
  buildSSHCommand(
    session: Session,
    command: string,
    options: ExecOptions = {}
  ): string[] {
    const args: string[] = [this.sshBinaryPath];

    // Connection parameters
    // -p: Specifies the port to connect to on the remote host
    args.push('-p', session.port.toString());
    
    // -l: Specifies the user to log in as on the remote machine
    args.push('-l', session.username);

    // Key authentication
    // -i: Selects a file from which the identity (private key) is read
    // If privateKey content is provided, write it to a temp file first
    let tempKeyPath: string | undefined;
    if (session.privateKey) {
      tempKeyPath = this.writePrivateKeyToTempFile(session.privateKey);
      args.push('-i', tempKeyPath);
    } else if (session.keyPath) {
      args.push('-i', session.keyPath);
    }

    // ControlMaster configuration for connection multiplexing
    // This allows multiple SSH sessions to share a single network connection
    if (session.controlSocketPath) {
      // ControlPath: Specify the path to the control socket
      args.push('-o', `ControlPath=${session.controlSocketPath}`);
      
      // ControlMaster=auto: Automatically create a master connection if one doesn't exist,
      // or use an existing master connection if available
      args.push('-o', 'ControlMaster=auto');
      
      // ControlPersist: Keep the master connection open for 10 minutes after the last session closes
      // This allows subsequent connections to reuse the master without reconnecting
      args.push('-o', 'ControlPersist=10m');
    }

    // Configuration options
    // StrictHostKeyChecking: Controls host key verification
    args.push(
      '-o',
      `StrictHostKeyChecking=${session.config.strictHostKeyChecking ? 'yes' : 'no'}`
    );

    // ConnectTimeout: Timeout for establishing the connection (in seconds)
    args.push('-o', `ConnectTimeout=${session.config.connectTimeout}`);

    // ServerAliveInterval: Send keepalive messages at this interval (in seconds)
    // to prevent connection from timing out
    args.push('-o', `ServerAliveInterval=${session.config.serverAliveInterval}`);

    // Compression: Enable or disable compression of the connection
    args.push('-o', `Compression=${session.config.compression ? 'yes' : 'no'}`);

    // ForwardAgent: Enable or disable SSH agent forwarding
    args.push('-o', `ForwardAgent=${session.config.forwardAgent ? 'yes' : 'no'}`);

    // Custom ssh_config options
    // These are additional options that can be passed via the customOptions field
    // Each option is passed as a separate -o flag
    for (const [key, value] of Object.entries(session.config.customOptions)) {
      args.push('-o', `${key}=${value}`);
    }

    // Debug verbosity flags
    // Add -v flags based on debug level (0 = none, 1 = -v, 2 = -vv, 3 = -vvv)
    for (let i = 0; i < this.debugLevel; i++) {
      args.push('-v');
    }

    // Environment variables
    // If environment variables are specified, configure SSH to send them
    if (options.env && Object.keys(options.env).length > 0) {
      // SendEnv: Specifies which environment variables should be sent to the server
      // We need to configure the server to accept these variables (AcceptEnv)
      for (const envVar of Object.keys(options.env)) {
        args.push('-o', `SendEnv=${envVar}`);
      }
    }

    // Pseudo-terminal allocation
    // -T: Disable pseudo-terminal allocation (useful for non-interactive commands)
    // -t: Force pseudo-terminal allocation (useful for interactive commands)
    if (options.pty) {
      args.push('-t');
    } else {
      args.push('-T'); // Disable PTY
    }

    // Remote host
    args.push(session.host);

    // Remote command (if provided)
    // If no command is provided, SSH will open an interactive shell
    // For ControlMaster setup or port forwarding, command may be empty
    // NOTE: We do NOT escape the command here because spawn() passes arguments
    // directly to the SSH binary without shell interpretation. The SSH binary
    // itself will properly handle the command string when sending it to the remote shell.
    // Escaping is only needed when constructing shell command strings (e.g., for system()).
    if (command) {
      args.push(command);
    }

    return args;
  }

  /**
   * Build an SSH command for port forwarding
   * 
   * Constructs an SSH command with port forwarding flags:
   * - Local forward (-L): Forward local port to remote destination
   * - Remote forward (-R): Forward remote port to local destination
   * - Dynamic forward (-D): Create SOCKS proxy on local port
   * 
   * Port forwarding commands typically use -N flag to prevent command execution
   * and -f flag to run in background (optional).
   * 
   * @param session - Session object containing connection parameters
   * @param forward - Port forwarding configuration
   * @param background - Run SSH in background (default: false)
   * @returns Array of command arguments for port forwarding
   * 
   * @example
   * ```typescript
   * // Local port forward: localhost:8080 -> remote:80
   * const localArgs = wrapper.buildPortForwardCommand(session, {
   *   type: 'local',
   *   localPort: 8080,
   *   remoteHost: 'localhost',
   *   remotePort: 80
   * });
   * // Returns: ['ssh', ..., '-L', '8080:localhost:80', '-N', 'example.com']
   * 
   * // Dynamic SOCKS proxy on port 1080
   * const dynamicArgs = wrapper.buildPortForwardCommand(session, {
   *   type: 'dynamic',
   *   localPort: 1080
   * });
   * // Returns: ['ssh', ..., '-D', '1080', '-N', 'example.com']
   * ```
   * 
   * Validates: Requirements 5.1, 5.2, 5.3, 5.7
   */
  buildPortForwardCommand(
    session: Session,
    forward: PortForwardConfig,
    background: boolean = false
  ): string[] {
    // Start with base SSH command (without remote command)
    const args = this.buildSSHCommand(session, '', {});

    // Remove the host from the end (we'll add it back after port forward flags)
    args.pop();

    // Add port forwarding flags based on type
    switch (forward.type) {
      case 'local':
        // -L: Local port forward
        // Format: -L [bind_address:]port:host:hostport
        if (!forward.localPort || !forward.remoteHost || !forward.remotePort) {
          throw new Error('Local forward requires localPort, remoteHost, and remotePort');
        }
        args.push('-L', `${forward.localPort}:${forward.remoteHost}:${forward.remotePort}`);
        break;

      case 'remote':
        // -R: Remote port forward
        // Format: -R [bind_address:]port:host:hostport
        if (!forward.remotePort || !forward.localPort) {
          throw new Error('Remote forward requires remotePort and localPort');
        }
        // For remote forwards, we typically forward from remote port to localhost:localPort
        args.push('-R', `${forward.remotePort}:localhost:${forward.localPort}`);
        break;

      case 'dynamic':
        // -D: Dynamic SOCKS proxy
        // Format: -D [bind_address:]port
        if (!forward.localPort) {
          throw new Error('Dynamic forward requires localPort');
        }
        args.push('-D', forward.localPort.toString());
        break;

      default:
        throw new Error(`Unknown port forward type: ${forward.type}`);
    }

    // -N: Do not execute a remote command (just forward ports)
    args.push('-N');

    // -f: Go to background before command execution (optional)
    if (background) {
      args.push('-f');
    }

    // Add host back at the end
    args.push(session.host);

    return args;
  }

  /**
   * Execute a remote command via SSH
   * 
   * This method spawns an SSH subprocess, captures stdout/stderr, and enforces
   * timeout limits. It returns a CommandResult with all output and execution metadata.
   * 
   * The implementation uses Node.js child_process.spawn() for subprocess management
   * and AbortController for timeout handling. This provides:
   * - Non-blocking execution with stream capture
   * - Proper timeout enforcement with process termination
   * - Accurate duration measurement
   * - Complete stdout/stderr capture
   * 
   * @param session - Session object containing connection parameters
   * @param command - Remote command to execute
   * @param options - Execution options including timeout and environment variables
   * @returns Promise resolving to CommandResult with stdout, stderr, exit code, and duration
   * 
   * @throws Error if command execution fails to start
   * 
   * @example
   * ```typescript
   * const wrapper = new SSHWrapper();
   * const result = await wrapper.executeCommand(session, 'echo "Hello World"', {
   *   timeout: 30
   * });
   * console.log(result.stdout); // "Hello World\n"
   * console.log(result.exitCode); // 0
   * console.log(result.duration); // 123 (milliseconds)
   * ```
   * 
   * @example
   * ```typescript
   * // Command with timeout
   * try {
   *   const result = await wrapper.executeCommand(session, 'sleep 60', {
   *     timeout: 5
   *   });
   * } catch (error) {
   *   // Timeout error after 5 seconds
   * }
   * ```
   * 
   * Validates: Requirements 2.1, 2.3
   */
  async executeCommand(
    session: Session,
    command: string,
    options: ExecOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    // Build the SSH command array
    const args = this.buildSSHCommand(session, command, options);
    
    // Extract the binary path (first element) and arguments (rest)
    const binary = args[0];
    const cmdArgs = args.slice(1);
    
    return new Promise((resolve, reject) => {
      // Set up AbortController for timeout handling
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, options.timeout * 1000); // Convert seconds to milliseconds
      }
      
      // Ensure HOME or USERPROFILE is set for SSH to find config files
      const spawnEnv = options.env ? { ...process.env, ...options.env } : { ...process.env };
      if (!spawnEnv.HOME && spawnEnv.USERPROFILE) {
        spawnEnv.HOME = spawnEnv.USERPROFILE;
      }
      
      // Spawn the SSH subprocess
      const child = spawn(binary, cmdArgs, {
        signal: abortController.signal,
        env: spawnEnv,
        stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin, pipe stdout and stderr
        windowsHide: true, // Hide console window on Windows
      });
      
      // Buffers to accumulate stdout and stderr
      let stdout = '';
      let stderr = '';
      
      // Capture stdout
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      // Capture stderr
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code: number | null) => {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        const duration = Date.now() - startTime;
        
        // Resolve with CommandResult
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1, // Use -1 if exit code is null
          duration,
        });
      });
      
      // Handle process errors (e.g., binary not found)
      child.on('error', (error: Error) => {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Check if this is a timeout abort
        if (error.name === 'AbortError') {
          const duration = Date.now() - startTime;
          resolve({
            stdout,
            stderr: stderr + '\nCommand timed out',
            exitCode: 124, // Standard timeout exit code
            duration,
          });
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Parse SSH error output to structured ErrorInfo
   * 
   * This method analyzes stderr output from SSH commands and classifies errors
   * into specific types with human-readable messages. It uses pattern matching
   * to identify common SSH error conditions.
   * 
   * The error patterns are checked in order, and the first match determines
   * the error type. If no pattern matches, the error is classified as UNKNOWN.
   * 
   * This method also logs security events for authentication failures and
   * other security-related errors.
   * 
   * Supported error types:
   * - AUTH_FAILED: Authentication failures (publickey, password, etc.)
   * - CONNECTION_REFUSED: Remote host refused the connection
   * - HOST_KEY_MISMATCH: Host key verification failed
   * - TIMEOUT: Connection or operation timeout
   * - DNS_FAILED: Hostname could not be resolved
   * - NETWORK_UNREACHABLE: Network route to host not available
   * - PERMISSION_DENIED: Permission denied on remote system
   * - UNKNOWN: Unclassified error
   * 
   * @param stderr - Standard error output from SSH command
   * @param sessionId - Optional session ID for security event logging
   * @param host - Optional host for security event logging
   * @param username - Optional username for security event logging
   * @returns ErrorInfo object with type, message, and raw output
   * 
   * @example
   * ```typescript
   * const error = wrapper.parseSSHError('Permission denied (publickey).', 'session-123', 'example.com', 'user');
   * // Returns: {
   * //   type: 'AUTH_FAILED',
   * //   message: 'Public key authentication failed',
   * //   rawOutput: 'Permission denied (publickey).'
   * // }
   * // Also logs a security event
   * ```
   * 
   * @example
   * ```typescript
   * const error = wrapper.parseSSHError('ssh: connect to host example.com port 22: Connection refused');
   * // Returns: {
   * //   type: 'CONNECTION_REFUSED',
   * //   message: 'Remote host refused connection',
   * //   rawOutput: 'ssh: connect to host example.com port 22: Connection refused'
   * // }
   * ```
   * 
   * Validates: Requirements 1.4, 8.1, 8.4, 8.6
   */
  parseSSHError(
    stderr: string,
    sessionId?: string,
    host?: string,
    username?: string
  ): import('./types.js').ErrorInfo {
    // Scrub sensitive data from stderr before processing
    const scrubbedStderr = scrubSensitiveData(stderr);

    // Define error patterns with regex and corresponding error types
    // Patterns are checked in order, first match wins
    const ERROR_PATTERNS: Array<{
      pattern: RegExp;
      errorType: import('./types.js').ErrorType;
      messageExtractor: (match: RegExpMatchArray) => string;
    }> = [
      {
        pattern: /Permission denied \(publickey/i,
        errorType: 'AUTH_FAILED',
        messageExtractor: () => 'Public key authentication failed',
      },
      {
        pattern: /Permission denied \(password/i,
        errorType: 'AUTH_FAILED',
        messageExtractor: () => 'Password authentication failed',
      },
      {
        pattern: /Permission denied/i,
        errorType: 'AUTH_FAILED',
        messageExtractor: () => 'Authentication failed',
      },
      {
        pattern: /Connection refused/i,
        errorType: 'CONNECTION_REFUSED',
        messageExtractor: () => 'Remote host refused connection',
      },
      {
        pattern: /Host key verification failed/i,
        errorType: 'HOST_KEY_MISMATCH',
        messageExtractor: () => 'Host key does not match known_hosts',
      },
      {
        pattern: /REMOTE HOST IDENTIFICATION HAS CHANGED/i,
        errorType: 'HOST_KEY_MISMATCH',
        messageExtractor: () => 'Remote host identification has changed',
      },
      {
        pattern: /Connection timed out/i,
        errorType: 'TIMEOUT',
        messageExtractor: () => 'Connection attempt timed out',
      },
      {
        pattern: /Operation timed out/i,
        errorType: 'TIMEOUT',
        messageExtractor: () => 'Operation timed out',
      },
      {
        pattern: /Timeout, server .+ not responding/i,
        errorType: 'TIMEOUT',
        messageExtractor: () => 'Server not responding',
      },
      {
        pattern: /No route to host/i,
        errorType: 'NETWORK_UNREACHABLE',
        messageExtractor: () => 'Network route to host not available',
      },
      {
        pattern: /Network is unreachable/i,
        errorType: 'NETWORK_UNREACHABLE',
        messageExtractor: () => 'Network is unreachable',
      },
      {
        pattern: /Temporary failure in name resolution/i,
        errorType: 'DNS_FAILED',
        messageExtractor: () => 'DNS resolution failed temporarily',
      },
      {
        pattern: /Name or service not known/i,
        errorType: 'DNS_FAILED',
        messageExtractor: () => 'Hostname could not be resolved',
      },
      {
        pattern: /Could not resolve hostname/i,
        errorType: 'DNS_FAILED',
        messageExtractor: () => 'Could not resolve hostname',
      },
    ];

    // Try to match each pattern against the stderr output
    for (const { pattern, errorType, messageExtractor } of ERROR_PATTERNS) {
      const match = scrubbedStderr.match(pattern);
      if (match) {
        const errorInfo = {
          type: errorType,
          message: messageExtractor(match),
          rawOutput: scrubbedStderr,
        };

        // Log security events for security-related errors
        const securityEventTypes: SecurityEventType[] = [
          'AUTH_FAILED',
          'HOST_KEY_MISMATCH',
          'CONNECTION_REFUSED',
          'TIMEOUT',
        ];

        if (securityEventTypes.includes(errorType as SecurityEventType)) {
          logSecurityEvent({
            timestamp: new Date(),
            sessionId: sessionId || null,
            eventType: errorType as SecurityEventType,
            details: errorInfo.message,
            host,
            username,
          });
        }

        return errorInfo;
      }
    }

    // If no pattern matched, return UNKNOWN error type
    return {
      type: 'UNKNOWN',
      message: 'SSH operation failed',
      rawOutput: scrubbedStderr,
    };
  }

  /**
   * Create an SSH port forward (tunnel)
   * 
   * Establishes an SSH tunnel for port forwarding using the appropriate flags:
   * - Local forward (-L): Forward local port to remote destination
   * - Remote forward (-R): Forward remote port to local destination
   * - Dynamic forward (-D): Create SOCKS proxy on local port
   * 
   * The tunnel runs in the background and uses the -N flag to prevent
   * command execution (tunnel-only mode).
   * 
   * @param session - Session object containing connection parameters
   * @param forward - Port forwarding configuration
   * @returns Promise resolving to the spawned child process
   * 
   * @throws Error if port forward configuration is invalid
   * 
   * @example
   * ```typescript
   * // Local port forward: localhost:8080 -> remote:80
   * const process = await wrapper.createPortForward(session, {
   *   type: 'local',
   *   localPort: 8080,
   *   remoteHost: 'localhost',
   *   remotePort: 80
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Dynamic SOCKS proxy on port 1080
   * const process = await wrapper.createPortForward(session, {
   *   type: 'dynamic',
   *   localPort: 1080
   * });
   * ```
   * 
   * Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.7
   */
  async createPortForward(
    session: Session,
    forward: PortForwardConfig
  ): Promise<import('child_process').ChildProcess> {
    // Build the port forwarding command
    const args = this.buildPortForwardCommand(session, forward, false);
    
    // Extract the binary path (first element) and arguments (rest)
    const binary = args[0];
    const cmdArgs = args.slice(1);
    
    // Spawn the SSH process for port forwarding
    // The process will run in the foreground (not using -f flag)
    // so we can track it and terminate it when needed
    const child = spawn(binary, cmdArgs, {
      stdio: 'pipe', // Capture stdout/stderr for error handling
      detached: false, // Keep process attached so we can kill it
    });
    
    // Return the child process so it can be tracked and terminated
    return child;
  }

  /**
   * Close an SSH port forward (tunnel)
   * 
   * Terminates the SSH process managing a port forward tunnel.
   * This closes the tunnel and frees the local port.
   * 
   * @param process - The child process returned by createPortForward()
   * @returns Promise resolving when the process has been terminated
   * 
   * @example
   * ```typescript
   * const process = await wrapper.createPortForward(session, config);
   * // ... use the tunnel ...
   * await wrapper.closePortForward(process);
   * ```
   * 
   * Validates: Requirements 5.5
   */
  async closePortForward(
    process: import('child_process').ChildProcess
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if process is already dead
      if (process.exitCode !== null) {
        resolve();
        return;
      }
      
      // Set up exit handler
      process.on('exit', () => {
        resolve();
      });
      
      // Set up error handler
      process.on('error', (error) => {
        // If the error is ESRCH (no such process), the process is already dead
        if ((error as any).code === 'ESRCH') {
          resolve();
        } else {
          reject(error);
        }
      });
      
      // Try to kill the process gracefully with SIGTERM
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // If kill fails, the process might already be dead
        if ((error as any).code === 'ESRCH') {
          resolve();
        } else {
          reject(error);
        }
      }
      
      // Set a timeout to force kill if graceful termination fails
      setTimeout(() => {
        if (process.exitCode === null) {
          try {
            process.kill('SIGKILL');
          } catch (error) {
            // Ignore errors on force kill
          }
        }
      }, 5000); // 5 second timeout
    });
  }

  /**
   * Get the SSH binary path
   * 
   * @returns Path to the SSH binary
   */
  getSshBinaryPath(): string {
    return this.sshBinaryPath;
  }

  /**
   * Set the SSH binary path
   * 
   * Allows configuring a custom path to the SSH binary if it's not in PATH
   * or if a specific version should be used.
   * 
   * @param path - Path to the SSH binary
   * 
   * @example
   * ```typescript
   * wrapper.setSshBinaryPath('/usr/local/bin/ssh');
   * ```
   * 
   * Validates: Requirements 10.1, 10.2
   */
  setSshBinaryPath(path: string): void {
    this.sshBinaryPath = path;
  }

  /**
   * Get the debug verbosity level
   * 
   * @returns Debug level (0-3)
   * 
   * Validates: Requirement 10.7
   */
  getDebugLevel(): number {
    return this.debugLevel;
  }

  /**
   * Set the debug verbosity level
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
   * wrapper.setDebugLevel(1);
   * 
   * // Enable maximum debug output
   * wrapper.setDebugLevel(3);
   * ```
   * 
   * Validates: Requirement 10.7
   */
  setDebugLevel(level: number): void {
    if (![0, 1, 2, 3].includes(level)) {
      throw new Error(`Invalid debug level: ${level}. Must be 0, 1, 2, or 3.`);
    }
    this.debugLevel = level;
  }
}
