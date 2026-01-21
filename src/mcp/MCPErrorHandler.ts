/**
 * MCP Error Handler
 *
 * Maps internal SSH errors to MCP-compliant error responses with appropriate
 * error codes and structured error information.
 */

import { ErrorInfo, ErrorType } from '../core/types.js';
import { MCPError } from './MCPProtocolHandler.js';

/**
 * MCP error codes following JSON-RPC 2.0 specification
 */
export enum MCPErrorCode {
  /** Invalid JSON was received by the server */
  PARSE_ERROR = -32700,

  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST = -32600,

  /** The method does not exist / is not available */
  METHOD_NOT_FOUND = -32601,

  /** Invalid method parameter(s) */
  INVALID_PARAMS = -32602,

  /** Internal JSON-RPC error */
  INTERNAL_ERROR = -32603,

  /** Server error (custom range: -32000 to -32099) */
  SERVER_ERROR = -32000,
}

/**
 * Error type to MCP error code mapping
 */
const ERROR_TYPE_TO_CODE: Record<ErrorType, MCPErrorCode> = {
  AUTH_FAILED: MCPErrorCode.INVALID_PARAMS,
  CONNECTION_REFUSED: MCPErrorCode.SERVER_ERROR,
  HOST_KEY_MISMATCH: MCPErrorCode.INVALID_PARAMS,
  TIMEOUT: MCPErrorCode.SERVER_ERROR,
  NETWORK_UNREACHABLE: MCPErrorCode.SERVER_ERROR,
  DNS_FAILED: MCPErrorCode.INVALID_PARAMS,
  PERMISSION_DENIED: MCPErrorCode.INVALID_PARAMS,
  FILE_NOT_FOUND: MCPErrorCode.INVALID_PARAMS,
  UNKNOWN: MCPErrorCode.INTERNAL_ERROR,
};

/**
 * MCP Error Handler
 *
 * Provides utilities for mapping internal errors to MCP-compliant error responses.
 */
export class MCPErrorHandler {
  /**
   * Map an ErrorInfo object to an MCP error
   */
  static fromErrorInfo(error: ErrorInfo): MCPError {
    const code = ERROR_TYPE_TO_CODE[error.type] || MCPErrorCode.INTERNAL_ERROR;
    const message = this.formatErrorMessage(error);
    const data = this.createErrorData(error);

    return { code, message, data };
  }

  /**
   * Map a generic Error to an MCP error
   */
  static fromError(error: Error): MCPError {
    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message: error.message || 'An internal error occurred',
      data: {
        errorType: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  }

  /**
   * Create an MCP error for invalid parameters
   */
  static invalidParams(message: string, details?: any): MCPError {
    return {
      code: MCPErrorCode.INVALID_PARAMS,
      message,
      data: details,
    };
  }

  /**
   * Create an MCP error for method not found
   */
  static methodNotFound(method: string): MCPError {
    return {
      code: MCPErrorCode.METHOD_NOT_FOUND,
      message: `Method not found: ${method}`,
    };
  }

  /**
   * Create an MCP error for invalid request
   */
  static invalidRequest(message: string): MCPError {
    return {
      code: MCPErrorCode.INVALID_REQUEST,
      message,
    };
  }

  /**
   * Create an MCP error for internal errors
   */
  static internalError(message: string, details?: any): MCPError {
    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message,
      data: details,
    };
  }

  /**
   * Create an MCP error for server errors
   */
  static serverError(message: string, details?: any): MCPError {
    return {
      code: MCPErrorCode.SERVER_ERROR,
      message,
      data: details,
    };
  }

  /**
   * Format error message for MCP response
   */
  private static formatErrorMessage(error: ErrorInfo): string {
    // Use the error message directly, it's already human-readable
    return error.message;
  }

  /**
   * Create structured error data for MCP response
   */
  private static createErrorData(error: ErrorInfo): any {
    const data: any = {
      errorType: error.type,
    };

    // Include raw output only in development mode for debugging
    if (process.env.NODE_ENV === 'development' && error.rawOutput) {
      data.rawOutput = error.rawOutput;
    }

    return data;
  }

  /**
   * Check if an error is an SSH-related error
   */
  static isSSHError(error: any): error is ErrorInfo {
    return !!(
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'message' in error &&
      typeof error.type === 'string' &&
      typeof error.message === 'string'
    );
  }

  /**
   * Get user-friendly error message based on error type
   */
  static getUserFriendlyMessage(errorType: ErrorType): string {
    const messages: Record<ErrorType, string> = {
      AUTH_FAILED: 'Authentication failed. Please check your credentials.',
      CONNECTION_REFUSED: 'Connection refused by remote host. Please verify the host is accessible.',
      HOST_KEY_MISMATCH: 'Host key verification failed. The remote host key has changed.',
      TIMEOUT: 'Connection timed out. Please check network connectivity.',
      NETWORK_UNREACHABLE: 'Network unreachable. Please check your network connection.',
      DNS_FAILED: 'Failed to resolve hostname. Please check the hostname is correct.',
      PERMISSION_DENIED: 'Permission denied. Please check file permissions.',
      FILE_NOT_FOUND: 'File or directory not found.',
      UNKNOWN: 'An unknown error occurred.',
    };

    return messages[errorType] || messages.UNKNOWN;
  }

  /**
   * Determine if an error is retryable
   */
  static isRetryable(errorType: ErrorType): boolean {
    const retryableErrors: ErrorType[] = [
      'TIMEOUT',
      'NETWORK_UNREACHABLE',
      'CONNECTION_REFUSED',
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * Get suggested action for an error type
   */
  static getSuggestedAction(errorType: ErrorType): string | undefined {
    const actions: Partial<Record<ErrorType, string>> = {
      AUTH_FAILED: 'Verify your SSH key or password is correct',
      CONNECTION_REFUSED: 'Check if SSH service is running on the remote host',
      HOST_KEY_MISMATCH: 'Remove the old host key from known_hosts or disable StrictHostKeyChecking',
      TIMEOUT: 'Check network connectivity and firewall settings',
      NETWORK_UNREACHABLE: 'Verify network connection and routing',
      DNS_FAILED: 'Check DNS settings or use IP address instead',
      PERMISSION_DENIED: 'Check file permissions and ownership',
      FILE_NOT_FOUND: 'Verify the file path is correct',
    };

    return actions[errorType];
  }
}
