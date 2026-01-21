/**
 * ConnectionManager - Manages SSH session lifecycle and state tracking
 * 
 * This class is responsible for:
 * - Creating and tracking SSH sessions with unique identifiers
 * - Managing session metadata (host, port, username, keys, timestamps)
 * - Generating ControlMaster socket paths for connection multiplexing
 * - Providing session lookup and listing functionality
 * - Handling session removal and cleanup
 * - Checking session status and control socket existence
 * - Updating session configuration dynamically
 * 
 * Sessions are stored in-memory using a Map for fast lookup by session ID.
 * Each session includes connection parameters, configuration options, and
 * timestamps for tracking creation and last usage.
 */

import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import {
  Session,
  ConnectionParams,
  ConnectionConfig,
} from './types.js';

/**
 * Default SSH connection configuration
 */
const DEFAULT_CONFIG: ConnectionConfig = {
  strictHostKeyChecking: true, // Default to true for security (can be overridden per connection)
  connectTimeout: 30,
  serverAliveInterval: 60,
  compression: true,
  forwardAgent: false,
  customOptions: {},
};

/**
 * ConnectionManager handles SSH session lifecycle and state tracking
 * 
 * STATELESS DESIGN: This manager works with ephemeral Docker containers.
 * Session IDs encode connection parameters (base64 JSON) rather than using UUIDs.
 * Sessions exist only in memory for the duration of a single tool call.
 * 
 * Validates Requirements:
 * - 1.1: Creates session identifier and stores connection parameters
 * - 1.5: Removes session from tracking on disconnect
 * - 1.6: Returns all session identifiers with metadata
 * - 1.7: Creates control socket for connection multiplexing
 * - 5.4: Tracks port forwards with session ID, type, and port bindings
 * - 5.6: Lists all active port forwards
 */
export class ConnectionManager {
  /** In-memory storage for active sessions, keyed by session ID */
  private sessions: Map<string, Session> = new Map();

  /** In-memory storage for active port forwards, keyed by forward ID */
  private portForwards: Map<string, import('./types.js').PortForward> = new Map();

  /**
   * Create a new ConnectionManager
   * 
   * Note: No persistence in stateless design. Sessions exist only in memory.
   */
  constructor() {
    console.error(`[ConnectionManager] Initialized (stateless mode)`);
  }

  /**
   * Encode connection parameters into a session ID
   * 
   * Session ID format: base64(JSON.stringify(connectionParams))
   * This allows the session ID to be self-contained with all connection info.
   * 
   * @param params - Connection parameters to encode
   * @returns Base64-encoded session ID
   */
  private encodeSessionId(params: ConnectionParams): string {
    const sessionData = {
      host: params.host,
      port: params.port ?? 22,
      username: params.username,
      keyPath: params.keyPath,
      privateKey: params.privateKey,
      config: params.config,
    };
    const json = JSON.stringify(sessionData);
    return Buffer.from(json).toString('base64');
  }

  /**
   * Decode a session ID back into connection parameters
   * 
   * @param sessionId - Base64-encoded session ID
   * @returns Connection parameters
   * @throws Error if session ID is invalid
   */
  decodeSessionId(sessionId: string): ConnectionParams {
    try {
      const json = Buffer.from(sessionId, 'base64').toString('utf-8');
      const params = JSON.parse(json);
      return params as ConnectionParams;
    } catch (error) {
      throw new Error(`Invalid session ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new SSH session with encoded identifier
   * 
   * Generates a session ID by encoding connection parameters as base64 JSON.
   * This makes the session ID self-contained with all connection information.
   * 
   * Note: ControlMaster is supported on Windows with OpenSSH 8.1+ using named pipes,
   * and on Unix-like systems using Unix domain sockets. Can be disabled by setting
   * useControlMaster to false in connection parameters.
   * 
   * @param params - Connection parameters (host, port, username, keyPath, config)
   * @returns Session object with encoded ID and all parameters
   * 
   * @example
   * ```typescript
   * const manager = new ConnectionManager();
   * const session = manager.createSession({
   *   host: 'example.com',
   *   port: 22,
   *   username: 'user',
   *   keyPath: '/home/user/.ssh/id_rsa'
   * });
   * // session.id is base64-encoded connection params
   * ```
   * 
   * Validates: Requirements 1.1, 1.7
   */
  createSession(params: ConnectionParams): Session {
    const now = new Date();
    const timestamp = new Date().toISOString();
    
    console.error(`[ConnectionManager ${timestamp}] createSession called for ${params.host}`);

    // Merge provided config with defaults
    const config: ConnectionConfig = {
      strictHostKeyChecking:
        params.config?.strictHostKeyChecking ?? DEFAULT_CONFIG.strictHostKeyChecking,
      connectTimeout: params.config?.connectTimeout ?? DEFAULT_CONFIG.connectTimeout,
      serverAliveInterval:
        params.config?.serverAliveInterval ?? DEFAULT_CONFIG.serverAliveInterval,
      compression: params.config?.compression ?? DEFAULT_CONFIG.compression,
      forwardAgent: params.config?.forwardAgent ?? DEFAULT_CONFIG.forwardAgent,
      customOptions: {
        ...DEFAULT_CONFIG.customOptions,
        ...(params.config?.customOptions || {}),
      },
    };

    // Encode connection params as session ID
    const sessionId = this.encodeSessionId({
      ...params,
      config,
    });

    // Generate control socket path for ControlMaster multiplexing
    const controlSocketPath = params.useControlMaster !== false 
      ? this.generateControlSocketPath(sessionId) 
      : undefined;

    const session: Session = {
      id: sessionId,
      host: params.host,
      port: params.port ?? 22,
      username: params.username,
      keyPath: params.keyPath,
      privateKey: params.privateKey,
      controlSocketPath,
      createdAt: now,
      lastUsedAt: now,
      config,
    };

    console.error(`[ConnectionManager ${timestamp}] Created session with encoded ID (length: ${sessionId.length})`);
    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * Retrieve a session by its unique identifier
   * 
   * @param id - Session ID to look up
   * @returns Session object if found, null otherwise
   * 
   * @example
   * ```typescript
   * const session = manager.getSession('550e8400-e29b-41d4-a716-446655440000');
   * if (session) {
   *   console.log(`Connected to ${session.host}`);
   * }
   * ```
   * 
   * Validates: Requirements 1.1, 1.6
   */
  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  /**
   * List all active sessions
   * 
   * Returns an array of all currently tracked sessions with their
   * complete metadata including host, port, username, and timestamps.
   * 
   * @returns Array of all active Session objects
   * 
   * @example
   * ```typescript
   * const sessions = manager.listSessions();
   * sessions.forEach(session => {
   *   console.log(`${session.id}: ${session.username}@${session.host}:${session.port}`);
   * });
   * ```
   * 
   * Validates: Requirements 1.6
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Remove a session from tracking
   * 
   * Deletes the session from the internal storage. In stateless mode,
   * this is primarily for cleanup within a single tool call.
   * 
   * Note: This does not terminate any active SSH connections or clean up
   * control sockets - that is the responsibility of the SSH wrapper.
   * 
   * @param id - Session ID to remove
   * 
   * @example
   * ```typescript
   * manager.removeSession('base64-encoded-session-id');
   * ```
   * 
   * Validates: Requirements 1.5
   */
  removeSession(id: string): void {
    this.sessions.delete(id);
    // No persistence in stateless mode
  }

  /**
   * Generate a control socket path for ControlMaster multiplexing
   * 
   * Creates a unique socket path in the OS temp directory for SSH connection multiplexing.
   * Uses a hash of the session ID to create a shorter, filesystem-safe path.
   * 
   * On Windows (OpenSSH 8.1+), this creates a named pipe path.
   * On Unix-like systems, this creates a Unix domain socket path.
   * 
   * ControlMaster allows multiple SSH sessions to share a single network
   * connection, improving performance and reducing connection overhead.
   * 
   * @param sessionId - Session ID to include in the socket path
   * @returns Full path to the control socket
   * 
   * @example
   * ```typescript
   * const socketPath = manager.generateControlSocketPath('base64-session-id');
   * // Returns: "/tmp/ssh-mcp-abc123def456"
   * ```
   * 
   * Validates: Requirements 1.7
   */
  private generateControlSocketPath(sessionId: string): string {
    // Use a hash of the session ID to create a shorter path
    // (session IDs are now base64-encoded JSON, which can be long)
    const hash = createHash('sha256').update(sessionId).digest('hex').substring(0, 12);
    return join(tmpdir(), `ssh-mcp-${hash}`);
  }

  /**
   * Check if a session's control socket is active
   * 
   * Verifies whether the ControlMaster socket file exists on the filesystem,
   * indicating that the SSH connection is still active and can be reused.
   * 
   * @param id - Session ID to check
   * @returns true if the control socket exists, false otherwise
   * 
   * @example
   * ```typescript
   * const isActive = manager.isSessionActive('550e8400-e29b-41d4-a716-446655440000');
   * if (isActive) {
   *   console.log('Session is active and can be reused');
   * }
   * ```
   * 
   * Validates: Requirements 6.3
   */
  isSessionActive(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || !session.controlSocketPath) {
      return false;
    }
    
    // Check if the control socket file exists
    return existsSync(session.controlSocketPath);
  }

  /**
   * Get detailed information about a session
   * 
   * Returns comprehensive session information including connection status,
   * all connection parameters, and uptime calculated from creation timestamp.
   * 
   * @param id - Session ID to retrieve information for
   * @returns Object containing session status, parameters, and uptime, or null if session not found
   * 
   * @example
   * ```typescript
   * const info = manager.getSessionInfo('550e8400-e29b-41d4-a716-446655440000');
   * if (info) {
   *   console.log(`Status: ${info.status}`);
   *   console.log(`Uptime: ${info.uptimeSeconds} seconds`);
   *   console.log(`Connected to: ${info.parameters.host}:${info.parameters.port}`);
   * }
   * ```
   * 
   * Validates: Requirements 6.4
   */
  getSessionInfo(id: string): {
    status: 'active' | 'inactive';
    parameters: {
      host: string;
      port: number;
      username: string;
      keyPath?: string;
      controlSocketPath?: string;
    };
    config: ConnectionConfig;
    uptimeSeconds: number;
    createdAt: Date;
    lastUsedAt: Date;
  } | null {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    // Calculate uptime in seconds
    const now = new Date();
    const uptimeSeconds = Math.floor((now.getTime() - session.createdAt.getTime()) / 1000);

    // Determine if session is active based on control socket existence
    const status = this.isSessionActive(id) ? 'active' : 'inactive';

    return {
      status,
      parameters: {
        host: session.host,
        port: session.port,
        username: session.username,
        keyPath: session.keyPath,
        controlSocketPath: session.controlSocketPath,
      },
      config: session.config,
      uptimeSeconds,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
    };
  }

  /**
   * Update the configuration of an existing session
   * 
   * Modifies the configuration parameters of a session. This allows changing
   * SSH options like timeouts, compression, and custom options without
   * recreating the session.
   * 
   * Note: In stateless mode, this only affects the in-memory session.
   * 
   * @param id - Session ID to update
   * @param config - Partial configuration object with fields to update
   * @returns true if session was found and updated, false otherwise
   * 
   * @example
   * ```typescript
   * const updated = manager.updateSessionConfig('base64-session-id', {
   *   connectTimeout: 60,
   *   compression: false,
   *   customOptions: { 'ServerAliveCountMax': '5' }
   * });
   * if (updated) {
   *   console.log('Session configuration updated');
   * }
   * ```
   * 
   * Validates: Requirements 6.5
   */
  updateSessionConfig(id: string, config: Partial<ConnectionConfig>): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    // Merge the new configuration with existing configuration
    session.config = {
      strictHostKeyChecking: config.strictHostKeyChecking ?? session.config.strictHostKeyChecking,
      connectTimeout: config.connectTimeout ?? session.config.connectTimeout,
      serverAliveInterval: config.serverAliveInterval ?? session.config.serverAliveInterval,
      compression: config.compression ?? session.config.compression,
      forwardAgent: config.forwardAgent ?? session.config.forwardAgent,
      customOptions: {
        ...session.config.customOptions,
        ...(config.customOptions || {}),
      },
    };

    // Update lastUsedAt timestamp to reflect the configuration change
    session.lastUsedAt = new Date();

    // No persistence in stateless mode
    return true;
  }

  /**
   * Add a port forward to tracking
   * 
   * Stores port forward metadata including session ID, type, and port bindings.
   * This allows listing and managing active port forwards.
   * 
   * Note: In stateless mode, port forwards only exist for the current tool call.
   * 
   * @param sessionId - Session ID this forward belongs to
   * @param config - Port forward configuration
   * @returns Port forward object with unique ID
   * 
   * @example
   * ```typescript
   * const forward = manager.addPortForward('base64-session-id', {
   *   type: 'local',
   *   localPort: 8080,
   *   remoteHost: 'localhost',
   *   remotePort: 80
   * });
   * console.log(forward.id); // "a1b2c3d4-..."
   * ```
   * 
   * Validates: Requirements 5.4
   */
  addPortForward(
    sessionId: string,
    config: import('./types.js').PortForwardConfig
  ): import('./types.js').PortForward {
    // Generate a simple hash-based ID for the port forward
    const forwardId = randomBytes(16).toString('hex');
    
    const forward: import('./types.js').PortForward = {
      id: forwardId,
      sessionId,
      config,
      createdAt: new Date(),
    };

    this.portForwards.set(forwardId, forward);
    // No persistence in stateless mode
    return forward;
  }

  /**
   * Remove a port forward from tracking
   * 
   * Deletes the port forward from internal storage. This should be called
   * when closing a tunnel to clean up tracking state.
   * 
   * Note: This does not terminate the SSH process - that is the responsibility
   * of the SSH wrapper's closePortForward() method.
   * 
   * @param id - Port forward ID to remove
   * 
   * @example
   * ```typescript
   * manager.removePortForward('a1b2c3d4-...');
   * ```
   * 
   * Validates: Requirements 5.4
   */
  removePortForward(id: string): void {
    this.portForwards.delete(id);
    // No persistence in stateless mode
  }

  /**
   * Get a port forward by its unique identifier
   * 
   * @param id - Port forward ID to look up
   * @returns Port forward object if found, null otherwise
   * 
   * @example
   * ```typescript
   * const forward = manager.getPortForward('a1b2c3d4-...');
   * if (forward) {
   *   console.log(`Forward type: ${forward.config.type}`);
   * }
   * ```
   * 
   * Validates: Requirements 5.4
   */
  getPortForward(id: string): import('./types.js').PortForward | null {
    return this.portForwards.get(id) ?? null;
  }

  /**
   * List all active port forwards
   * 
   * Returns an array of all currently tracked port forwards with their
   * complete metadata including session ID, type, and port bindings.
   * 
   * @returns Array of all active PortForward objects
   * 
   * @example
   * ```typescript
   * const forwards = manager.listPortForwards();
   * forwards.forEach(forward => {
   *   console.log(`${forward.id}: ${forward.config.type} forward on session ${forward.sessionId}`);
   * });
   * ```
   * 
   * Validates: Requirements 5.6
   */
  listPortForwards(): import('./types.js').PortForward[] {
    return Array.from(this.portForwards.values());
  }

  /**
   * List port forwards for a specific session
   * 
   * Returns an array of port forwards associated with a particular session.
   * 
   * @param sessionId - Session ID to filter by
   * @returns Array of PortForward objects for the specified session
   * 
   * @example
   * ```typescript
   * const forwards = manager.listPortForwardsBySession('550e8400-...');
   * console.log(`Session has ${forwards.length} active port forwards`);
   * ```
   * 
   * Validates: Requirements 5.4, 5.6
   */
  listPortForwardsBySession(sessionId: string): import('./types.js').PortForward[] {
    return Array.from(this.portForwards.values()).filter(
      (forward) => forward.sessionId === sessionId
    );
  }
}
