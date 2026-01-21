/**
 * Core data types for SSH MCP Server
 * 
 * These types define the fundamental data structures used throughout the server
 * for session management, command execution, file operations, and error handling.
 */

/**
 * Represents an active SSH session with connection parameters and metadata
 */
export interface Session {
  /** Unique session identifier (UUID) */
  id: string;
  
  /** Remote hostname or IP address */
  host: string;
  
  /** SSH port (default 22) */
  port: number;
  
  /** SSH username */
  username: string;
  
  /** Path to private key file (optional) */
  keyPath?: string;
  
  /** Private key content as string (optional, alternative to keyPath) */
  privateKey?: string;
  
  /** Path to ControlMaster socket for connection multiplexing (optional) */
  controlSocketPath?: string;
  
  /** Session creation timestamp */
  createdAt: Date;
  
  /** Last activity timestamp */
  lastUsedAt: Date;
  
  /** SSH configuration options */
  config: ConnectionConfig;
}

/**
 * SSH connection configuration options
 */
export interface ConnectionConfig {
  /** Enable strict host key checking (default: true) */
  strictHostKeyChecking: boolean;
  
  /** Connection timeout in seconds (default: 30) */
  connectTimeout: number;
  
  /** Server alive interval in seconds (default: 60) */
  serverAliveInterval: number;
  
  /** Enable compression (default: true) */
  compression: boolean;
  
  /** Forward SSH agent (default: false) */
  forwardAgent: boolean;
  
  /** Additional ssh_config options as key-value pairs */
  customOptions: Record<string, string>;
}

/**
 * Parameters for creating a new SSH connection
 */
export interface ConnectionParams {
  /** Remote hostname or IP address */
  host: string;
  
  /** SSH port (optional, default: 22) */
  port?: number;
  
  /** SSH username */
  username: string;
  
  /** Path to private key file (optional) */
  keyPath?: string;
  
  /** Private key content as string (optional, alternative to keyPath) */
  privateKey?: string;
  
  /** Enable ControlMaster for connection multiplexing (optional, default: true) */
  useControlMaster?: boolean;
  
  /** SSH configuration options (optional) */
  config?: Partial<ConnectionConfig>;
}

/**
 * Result of executing a remote command via SSH
 */
export interface CommandResult {
  /** Standard output from the command */
  stdout: string;
  
  /** Standard error from the command */
  stderr: string;
  
  /** Exit code of the command (0 = success) */
  exitCode: number;
  
  /** Execution time in milliseconds */
  duration: number;
}

/**
 * Options for command execution
 */
export interface ExecOptions {
  /** Command timeout in seconds (optional) */
  timeout?: number;
  
  /** Environment variables to pass to the command (optional) */
  env?: Record<string, string>;
  
  /** Remote working directory (optional) */
  workingDir?: string;
  
  /** Allocate pseudo-terminal (optional) */
  pty?: boolean;
}

/**
 * Structured error information from SSH operations
 */
export interface ErrorInfo {
  /** Error type classification */
  type: ErrorType;
  
  /** Human-readable error message */
  message: string;
  
  /** Raw stderr output from SSH command (optional) */
  rawOutput?: string;
}

/**
 * SSH error type classifications
 */
export type ErrorType =
  | 'AUTH_FAILED'           // Authentication failure
  | 'CONNECTION_REFUSED'    // Remote host refused connection
  | 'HOST_KEY_MISMATCH'     // Host key verification failed
  | 'TIMEOUT'               // Connection or command timeout
  | 'NETWORK_UNREACHABLE'   // Network route not available
  | 'DNS_FAILED'            // Hostname resolution failed
  | 'PERMISSION_DENIED'     // Permission denied on remote system
  | 'FILE_NOT_FOUND'        // File or directory not found
  | 'UNKNOWN';              // Unknown or unclassified error

/**
 * Information about a file or directory on the remote system
 */
export interface FileInfo {
  /** File or directory name */
  name: string;
  
  /** Full path to the file or directory */
  path: string;
  
  /** File size in bytes */
  size: number;
  
  /** Unix permissions string (e.g., "drwxr-xr-x") */
  permissions: string;
  
  /** Owner username */
  owner: string;
  
  /** Group name */
  group: string;
  
  /** Last modification timestamp */
  modifiedAt: Date;
  
  /** True if this is a directory */
  isDirectory: boolean;
}

/**
 * Result of a file transfer operation
 */
export interface TransferResult {
  /** Whether the transfer completed successfully */
  success: boolean;
  
  /** Number of bytes transferred */
  bytesTransferred: number;
  
  /** Transfer duration in milliseconds */
  duration: number;
  
  /** Error message if transfer failed (optional) */
  error?: string;
}

/**
 * SSH key pair information
 */
export interface KeyPair {
  /** Path to the private key file */
  privateKeyPath: string;
  
  /** Path to the public key file */
  publicKeyPath: string;
  
  /** Key fingerprint (SHA256 hash) */
  fingerprint: string;
  
  /** Key algorithm (rsa, ed25519, ecdsa, etc.) */
  algorithm: string;
  
  /** Key size in bits */
  bits: number;
}

/**
 * Information about an SSH key
 */
export interface KeyInfo {
  /** Path to the key file */
  path: string;
  
  /** Key type (rsa, ed25519, ecdsa, etc.) */
  type: string;
  
  /** Key size in bits */
  bits: number;
  
  /** Key fingerprint (SHA256 hash) */
  fingerprint: string;
  
  /** Key comment or description */
  comment: string;
}

/**
 * Port forwarding configuration
 */
export interface PortForwardConfig {
  /** Type of port forward */
  type: 'local' | 'remote' | 'dynamic';
  
  /** Local port to bind (for local and dynamic forwards) */
  localPort?: number;
  
  /** Remote host to forward to (for local forwards) */
  remoteHost?: string;
  
  /** Remote port to forward to (for local and remote forwards) */
  remotePort?: number;
}

/**
 * Active port forward tracking information
 */
export interface PortForward {
  /** Unique identifier for this port forward */
  id: string;
  
  /** Session ID this forward belongs to */
  sessionId: string;
  
  /** Port forward configuration */
  config: PortForwardConfig;
  
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * SSH configuration from ssh_config file
 */
export interface SSHConfig {
  /** Host-specific configurations mapped by host pattern */
  hosts: Map<string, HostConfig>;
  
  /** Global configuration options */
  globalOptions: Record<string, string>;
}

/**
 * Configuration for a specific host or host pattern
 */
export interface HostConfig {
  /** Host pattern (e.g., "*.example.com") */
  pattern: string;
  
  /** Actual hostname to connect to (optional) */
  hostname?: string;
  
  /** Port to connect to (optional) */
  port?: number;
  
  /** Username to use (optional) */
  user?: string;
  
  /** Paths to identity files (optional) */
  identityFile?: string[];
  
  /** Additional configuration options */
  options: Record<string, string>;
}

/**
 * Configuration option metadata
 */
export interface ConfigOption {
  /** Option name */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** Value type */
  type: 'string' | 'number' | 'boolean';
  
  /** Default value */
  defaultValue: string;
}

/**
 * SFTP operation types for batch processing
 */
export interface SFTPOperation {
  /** Operation type */
  type: 'put' | 'get' | 'ls' | 'rm' | 'mkdir' | 'rmdir';
  
  /** Local file path (for put/get operations) */
  localPath?: string;
  
  /** Remote file path */
  remotePath: string;
}
