/**
 * MCP Server Lifecycle Manager
 *
 * Manages the complete lifecycle of the SSH MCP Server including:
 * - Server startup with tool registration
 * - Graceful shutdown with session cleanup
 * - Active SSH session management
 * - Resource cleanup on termination
 *
 * Validates Requirement 9.7: Server lifecycle management
 */

import { ConnectionManager } from '../core/ConnectionManager.js';
import { ToolRegistry } from './ToolRegistry.js';
import { MCPProtocolHandler, ToolHandler } from './MCPProtocolHandler.js';

/**
 * Server state enum
 */
export enum ServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
}

/**
 * Server configuration options
 */
export interface ServerConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Session cleanup timeout in milliseconds */
  cleanupTimeout?: number;
}

/**
 * MCP Server
 *
 * Main server class that coordinates all components and manages lifecycle.
 * Handles startup, shutdown, and provides access to core components.
 */
export class MCPServer {
  private state: ServerState = ServerState.STOPPED;
  private connectionManager: ConnectionManager;
  private toolRegistry: ToolRegistry;
  private protocolHandler: MCPProtocolHandler;
  private config: ServerConfig;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  constructor(config: ServerConfig = {}) {
    this.config = {
      debug: config.debug ?? false,
      cleanupTimeout: config.cleanupTimeout ?? 5000,
    };

    // Initialize core components
    this.connectionManager = new ConnectionManager();
    this.toolRegistry = new ToolRegistry();
    this.protocolHandler = new MCPProtocolHandler(this.toolRegistry);
  }

  /**
   * Start the MCP server
   *
   * Performs server initialization:
   * 1. Validates server is not already running
   * 2. Registers all tool handlers
   * 3. Sets up shutdown handlers
   * 4. Transitions to RUNNING state
   *
   * @throws Error if server is already running or startup fails
   *
   * @example
   * ```typescript
   * const server = new MCPServer();
   * await server.start();
   * console.log('Server is running');
   * ```
   *
   * Validates: Requirement 9.7 (server startup with tool registration)
   */
  async start(): Promise<void> {
    if (this.state !== ServerState.STOPPED) {
      throw new Error(`Cannot start server: current state is ${this.state}`);
    }

    this.state = ServerState.STARTING;

    try {
      // Register tool handlers
      this.registerToolHandlers();

      // Set up process signal handlers for graceful shutdown
      this.setupSignalHandlers();

      this.state = ServerState.RUNNING;

      if (this.config.debug) {
        console.log('[MCPServer] Server started successfully');
        console.log(
          `[MCPServer] Registered ${this.toolRegistry.getToolCount()} tools`
        );
      }
    } catch (error) {
      this.state = ServerState.STOPPED;
      throw new Error(
        `Server startup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stop the MCP server gracefully
   *
   * Performs graceful shutdown:
   * 1. Transitions to STOPPING state
   * 2. Closes all active SSH sessions
   * 3. Runs registered shutdown handlers
   * 4. Cleans up resources
   * 5. Transitions to STOPPED state
   *
   * @throws Error if shutdown fails
   *
   * @example
   * ```typescript
   * await server.stop();
   * console.log('Server stopped gracefully');
   * ```
   *
   * Validates: Requirement 9.7 (graceful shutdown with session cleanup)
   */
  async stop(): Promise<void> {
    if (this.state !== ServerState.RUNNING) {
      throw new Error(`Cannot stop server: current state is ${this.state}`);
    }

    this.state = ServerState.STOPPING;

    try {
      if (this.config.debug) {
        console.log('[MCPServer] Stopping server...');
      }

      // Close all active SSH sessions
      await this.closeAllSessions();

      // Run shutdown handlers
      await this.runShutdownHandlers();

      this.state = ServerState.STOPPED;

      if (this.config.debug) {
        console.log('[MCPServer] Server stopped successfully');
      }
    } catch (error) {
      // Even if shutdown fails, transition to STOPPED state
      this.state = ServerState.STOPPED;
      throw new Error(
        `Server shutdown failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Register a shutdown handler
   *
   * Shutdown handlers are called during server shutdown to clean up
   * resources, close connections, or perform other cleanup tasks.
   *
   * @param handler - Async function to call during shutdown
   *
   * @example
   * ```typescript
   * server.registerShutdownHandler(async () => {
   *   console.log('Cleaning up resources...');
   *   await cleanupDatabase();
   * });
   * ```
   */
  registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Close all active SSH sessions
   *
   * Iterates through all tracked sessions and removes them from the
   * connection manager. This ensures clean shutdown without orphaned
   * sessions.
   *
   * Note: This removes sessions from tracking. Actual SSH connection
   * termination (killing processes, removing control sockets) would be
   * handled by the SSH wrapper component.
   *
   * @private
   */
  private async closeAllSessions(): Promise<void> {
    const sessions = this.connectionManager.listSessions();

    if (this.config.debug && sessions.length > 0) {
      console.log(`[MCPServer] Closing ${sessions.length} active sessions...`);
    }

    // Remove all sessions from tracking
    for (const session of sessions) {
      this.connectionManager.removeSession(session.id);

      if (this.config.debug) {
        console.log(
          `[MCPServer] Closed session ${session.id} (${session.username}@${session.host})`
        );
      }
    }

    // Also close all port forwards
    const forwards = this.connectionManager.listPortForwards();
    for (const forward of forwards) {
      this.connectionManager.removePortForward(forward.id);

      if (this.config.debug) {
        console.log(`[MCPServer] Closed port forward ${forward.id}`);
      }
    }
  }

  /**
   * Run all registered shutdown handlers
   *
   * Executes shutdown handlers in registration order with timeout protection.
   * If a handler takes too long, it will be skipped to prevent hanging.
   *
   * @private
   */
  private async runShutdownHandlers(): Promise<void> {
    if (this.shutdownHandlers.length === 0) {
      return;
    }

    if (this.config.debug) {
      console.log(
        `[MCPServer] Running ${this.shutdownHandlers.length} shutdown handlers...`
      );
    }

    for (const handler of this.shutdownHandlers) {
      try {
        // Run handler with timeout
        await Promise.race([
          handler(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Shutdown handler timeout')),
              this.config.cleanupTimeout
            )
          ),
        ]);
      } catch (error) {
        if (this.config.debug) {
          console.error(
            `[MCPServer] Shutdown handler failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        // Continue with other handlers even if one fails
      }
    }
  }

  /**
   * Register all tool handlers
   *
   * Registers handler functions for all 15 SSH MCP tools.
   * Each handler is a placeholder that will be implemented in Task 15.
   *
   * @private
   */
  private registerToolHandlers(): void {
    // Connection tools
    this.protocolHandler.registerToolHandler(
      'ssh_connect',
      this.createPlaceholderHandler('ssh_connect')
    );
    this.protocolHandler.registerToolHandler(
      'ssh_disconnect',
      this.createPlaceholderHandler('ssh_disconnect')
    );
    this.protocolHandler.registerToolHandler(
      'ssh_list_sessions',
      this.createPlaceholderHandler('ssh_list_sessions')
    );

    // Command execution tools
    this.protocolHandler.registerToolHandler(
      'ssh_execute',
      this.createPlaceholderHandler('ssh_execute')
    );

    // File transfer tools
    this.protocolHandler.registerToolHandler(
      'sftp_upload',
      this.createPlaceholderHandler('sftp_upload')
    );
    this.protocolHandler.registerToolHandler(
      'sftp_download',
      this.createPlaceholderHandler('sftp_download')
    );
    this.protocolHandler.registerToolHandler(
      'sftp_list',
      this.createPlaceholderHandler('sftp_list')
    );
    this.protocolHandler.registerToolHandler(
      'sftp_delete',
      this.createPlaceholderHandler('sftp_delete')
    );

    // Key management tools
    this.protocolHandler.registerToolHandler(
      'ssh_keygen',
      this.createPlaceholderHandler('ssh_keygen')
    );
    this.protocolHandler.registerToolHandler(
      'ssh_list_keys',
      this.createPlaceholderHandler('ssh_list_keys')
    );
    this.protocolHandler.registerToolHandler(
      'ssh_fingerprint',
      this.createPlaceholderHandler('ssh_fingerprint')
    );

    // Port forwarding tools
    this.protocolHandler.registerToolHandler(
      'ssh_port_forward',
      this.createPlaceholderHandler('ssh_port_forward')
    );
    this.protocolHandler.registerToolHandler(
      'ssh_close_forward',
      this.createPlaceholderHandler('ssh_close_forward')
    );

    // Configuration tools
    this.protocolHandler.registerToolHandler(
      'ssh_get_config',
      this.createPlaceholderHandler('ssh_get_config')
    );
    this.protocolHandler.registerToolHandler(
      'ssh_set_option',
      this.createPlaceholderHandler('ssh_set_option')
    );
  }

  /**
   * Create a placeholder handler for a tool
   *
   * Returns a handler that responds with "not implemented" message.
   * These will be replaced with actual implementations in Task 15.
   *
   * @param toolName - Name of the tool
   * @returns Placeholder handler function
   * @private
   */
  private createPlaceholderHandler(toolName: string): ToolHandler {
    return async (params: Record<string, any>) => {
      return {
        content: [
          {
            type: 'text',
            text: `Tool ${toolName} is not yet implemented. Parameters received: ${JSON.stringify(params, null, 2)}`,
          },
        ],
      };
    };
  }

  /**
   * Set up process signal handlers for graceful shutdown
   *
   * Listens for SIGINT and SIGTERM signals and triggers graceful shutdown.
   * This ensures the server cleans up properly when terminated.
   *
   * @private
   */
  private setupSignalHandlers(): void {
    const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    for (const signal of shutdownSignals) {
      process.on(signal, async () => {
        if (this.config.debug) {
          console.log(`[MCPServer] Received ${signal}, shutting down...`);
        }

        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          console.error(
            `[MCPServer] Shutdown error: ${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(1);
        }
      });
    }
  }

  /**
   * Get the current server state
   *
   * @returns Current server state
   */
  getState(): ServerState {
    return this.state;
  }

  /**
   * Check if the server is running
   *
   * @returns true if server is in RUNNING state
   */
  isRunning(): boolean {
    return this.state === ServerState.RUNNING;
  }

  /**
   * Get the connection manager instance
   *
   * @returns ConnectionManager instance
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get the tool registry instance
   *
   * @returns ToolRegistry instance
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the protocol handler instance
   *
   * @returns MCPProtocolHandler instance
   */
  getProtocolHandler(): MCPProtocolHandler {
    return this.protocolHandler;
  }

  /**
   * Get server statistics
   *
   * @returns Object containing server statistics
   */
  getStats(): {
    state: ServerState;
    activeSessions: number;
    activePortForwards: number;
    registeredTools: number;
    registeredHandlers: number;
  } {
    return {
      state: this.state,
      activeSessions: this.connectionManager.listSessions().length,
      activePortForwards: this.connectionManager.listPortForwards().length,
      registeredTools: this.toolRegistry.getToolCount(),
      registeredHandlers: this.protocolHandler.getRegisteredHandlers().length,
    };
  }
}
