/**
 * Unit tests for MCP Error Handler
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPErrorHandler, MCPErrorCode } from '../../src/mcp/MCPErrorHandler.js';
import { ErrorInfo, ErrorType } from '../../src/core/types.js';

describe('MCPErrorHandler', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('fromErrorInfo', () => {
    it('should map AUTH_FAILED to INVALID_PARAMS', () => {
      const errorInfo: ErrorInfo = {
        type: 'AUTH_FAILED',
        message: 'Authentication failed',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.INVALID_PARAMS);
      expect(mcpError.message).toBe('Authentication failed');
      expect(mcpError.data).toHaveProperty('errorType', 'AUTH_FAILED');
    });

    it('should map CONNECTION_REFUSED to SERVER_ERROR', () => {
      const errorInfo: ErrorInfo = {
        type: 'CONNECTION_REFUSED',
        message: 'Connection refused',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.SERVER_ERROR);
      expect(mcpError.message).toBe('Connection refused');
    });

    it('should map HOST_KEY_MISMATCH to INVALID_PARAMS', () => {
      const errorInfo: ErrorInfo = {
        type: 'HOST_KEY_MISMATCH',
        message: 'Host key verification failed',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.INVALID_PARAMS);
    });

    it('should map TIMEOUT to SERVER_ERROR', () => {
      const errorInfo: ErrorInfo = {
        type: 'TIMEOUT',
        message: 'Connection timed out',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.SERVER_ERROR);
    });

    it('should map NETWORK_UNREACHABLE to SERVER_ERROR', () => {
      const errorInfo: ErrorInfo = {
        type: 'NETWORK_UNREACHABLE',
        message: 'Network unreachable',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.SERVER_ERROR);
    });

    it('should map DNS_FAILED to INVALID_PARAMS', () => {
      const errorInfo: ErrorInfo = {
        type: 'DNS_FAILED',
        message: 'DNS resolution failed',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.INVALID_PARAMS);
    });

    it('should map PERMISSION_DENIED to INVALID_PARAMS', () => {
      const errorInfo: ErrorInfo = {
        type: 'PERMISSION_DENIED',
        message: 'Permission denied',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.INVALID_PARAMS);
    });

    it('should map FILE_NOT_FOUND to INVALID_PARAMS', () => {
      const errorInfo: ErrorInfo = {
        type: 'FILE_NOT_FOUND',
        message: 'File not found',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.INVALID_PARAMS);
    });

    it('should map UNKNOWN to INTERNAL_ERROR', () => {
      const errorInfo: ErrorInfo = {
        type: 'UNKNOWN',
        message: 'Unknown error',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.code).toBe(MCPErrorCode.INTERNAL_ERROR);
    });

    it('should include rawOutput in development mode', () => {
      process.env.NODE_ENV = 'development';

      const errorInfo: ErrorInfo = {
        type: 'AUTH_FAILED',
        message: 'Authentication failed',
        rawOutput: 'Permission denied (publickey)',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.data).toHaveProperty('rawOutput', 'Permission denied (publickey)');
    });

    it('should not include rawOutput in production mode', () => {
      process.env.NODE_ENV = 'production';

      const errorInfo: ErrorInfo = {
        type: 'AUTH_FAILED',
        message: 'Authentication failed',
        rawOutput: 'Permission denied (publickey)',
      };

      const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);

      expect(mcpError.data).not.toHaveProperty('rawOutput');
    });
  });

  describe('fromError', () => {
    it('should map generic Error to INTERNAL_ERROR', () => {
      const error = new Error('Something went wrong');

      const mcpError = MCPErrorHandler.fromError(error);

      expect(mcpError.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(mcpError.message).toBe('Something went wrong');
      expect(mcpError.data).toHaveProperty('errorType', 'Error');
    });

    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');

      const mcpError = MCPErrorHandler.fromError(error);

      expect(mcpError.data).toHaveProperty('stack');
      expect(mcpError.data.stack).toBeDefined();
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      const mcpError = MCPErrorHandler.fromError(error);

      process.env.NODE_ENV = originalEnv;
      
      expect(mcpError.data.stack).toBeUndefined();
    });

    it('should handle Error without message', () => {
      const error = new Error();

      const mcpError = MCPErrorHandler.fromError(error);

      expect(mcpError.message).toBe('An internal error occurred');
    });
  });

  describe('Static error creators', () => {
    it('should create invalidParams error', () => {
      const error = MCPErrorHandler.invalidParams('Invalid parameter', { field: 'username' });

      expect(error.code).toBe(MCPErrorCode.INVALID_PARAMS);
      expect(error.message).toBe('Invalid parameter');
      expect(error.data).toEqual({ field: 'username' });
    });

    it('should create methodNotFound error', () => {
      const error = MCPErrorHandler.methodNotFound('unknown_method');

      expect(error.code).toBe(MCPErrorCode.METHOD_NOT_FOUND);
      expect(error.message).toBe('Method not found: unknown_method');
    });

    it('should create invalidRequest error', () => {
      const error = MCPErrorHandler.invalidRequest('Malformed request');

      expect(error.code).toBe(MCPErrorCode.INVALID_REQUEST);
      expect(error.message).toBe('Malformed request');
    });

    it('should create internalError', () => {
      const error = MCPErrorHandler.internalError('Internal failure', { detail: 'test' });

      expect(error.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Internal failure');
      expect(error.data).toEqual({ detail: 'test' });
    });

    it('should create serverError', () => {
      const error = MCPErrorHandler.serverError('Server failure', { detail: 'test' });

      expect(error.code).toBe(MCPErrorCode.SERVER_ERROR);
      expect(error.message).toBe('Server failure');
      expect(error.data).toEqual({ detail: 'test' });
    });
  });

  describe('isSSHError', () => {
    it('should return true for valid ErrorInfo', () => {
      const errorInfo: ErrorInfo = {
        type: 'AUTH_FAILED',
        message: 'Authentication failed',
      };

      expect(MCPErrorHandler.isSSHError(errorInfo)).toBe(true);
    });

    it('should return false for generic Error', () => {
      const error = new Error('Test error');

      expect(MCPErrorHandler.isSSHError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(MCPErrorHandler.isSSHError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(MCPErrorHandler.isSSHError(undefined)).toBe(false);
    });

    it('should return false for object without type', () => {
      expect(MCPErrorHandler.isSSHError({ message: 'test' })).toBe(false);
    });

    it('should return false for object without message', () => {
      expect(MCPErrorHandler.isSSHError({ type: 'AUTH_FAILED' })).toBe(false);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return friendly message for AUTH_FAILED', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('AUTH_FAILED');
      expect(message).toContain('Authentication failed');
      expect(message).toContain('credentials');
    });

    it('should return friendly message for CONNECTION_REFUSED', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('CONNECTION_REFUSED');
      expect(message).toContain('Connection refused');
    });

    it('should return friendly message for HOST_KEY_MISMATCH', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('HOST_KEY_MISMATCH');
      expect(message).toContain('Host key');
    });

    it('should return friendly message for TIMEOUT', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('TIMEOUT');
      expect(message).toContain('timed out');
    });

    it('should return friendly message for NETWORK_UNREACHABLE', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('NETWORK_UNREACHABLE');
      expect(message).toContain('Network unreachable');
    });

    it('should return friendly message for DNS_FAILED', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('DNS_FAILED');
      expect(message).toContain('hostname');
    });

    it('should return friendly message for PERMISSION_DENIED', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('PERMISSION_DENIED');
      expect(message).toContain('Permission denied');
    });

    it('should return friendly message for FILE_NOT_FOUND', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('FILE_NOT_FOUND');
      expect(message).toContain('not found');
    });

    it('should return friendly message for UNKNOWN', () => {
      const message = MCPErrorHandler.getUserFriendlyMessage('UNKNOWN');
      expect(message).toContain('unknown');
    });
  });

  describe('isRetryable', () => {
    it('should return true for TIMEOUT', () => {
      expect(MCPErrorHandler.isRetryable('TIMEOUT')).toBe(true);
    });

    it('should return true for NETWORK_UNREACHABLE', () => {
      expect(MCPErrorHandler.isRetryable('NETWORK_UNREACHABLE')).toBe(true);
    });

    it('should return true for CONNECTION_REFUSED', () => {
      expect(MCPErrorHandler.isRetryable('CONNECTION_REFUSED')).toBe(true);
    });

    it('should return false for AUTH_FAILED', () => {
      expect(MCPErrorHandler.isRetryable('AUTH_FAILED')).toBe(false);
    });

    it('should return false for HOST_KEY_MISMATCH', () => {
      expect(MCPErrorHandler.isRetryable('HOST_KEY_MISMATCH')).toBe(false);
    });

    it('should return false for DNS_FAILED', () => {
      expect(MCPErrorHandler.isRetryable('DNS_FAILED')).toBe(false);
    });

    it('should return false for PERMISSION_DENIED', () => {
      expect(MCPErrorHandler.isRetryable('PERMISSION_DENIED')).toBe(false);
    });

    it('should return false for FILE_NOT_FOUND', () => {
      expect(MCPErrorHandler.isRetryable('FILE_NOT_FOUND')).toBe(false);
    });

    it('should return false for UNKNOWN', () => {
      expect(MCPErrorHandler.isRetryable('UNKNOWN')).toBe(false);
    });
  });

  describe('getSuggestedAction', () => {
    it('should return action for AUTH_FAILED', () => {
      const action = MCPErrorHandler.getSuggestedAction('AUTH_FAILED');
      expect(action).toBeDefined();
      expect(action).toContain('key');
    });

    it('should return action for CONNECTION_REFUSED', () => {
      const action = MCPErrorHandler.getSuggestedAction('CONNECTION_REFUSED');
      expect(action).toBeDefined();
      expect(action).toContain('SSH service');
    });

    it('should return action for HOST_KEY_MISMATCH', () => {
      const action = MCPErrorHandler.getSuggestedAction('HOST_KEY_MISMATCH');
      expect(action).toBeDefined();
      expect(action).toContain('known_hosts');
    });

    it('should return action for TIMEOUT', () => {
      const action = MCPErrorHandler.getSuggestedAction('TIMEOUT');
      expect(action).toBeDefined();
      expect(action).toContain('network');
    });

    it('should return action for NETWORK_UNREACHABLE', () => {
      const action = MCPErrorHandler.getSuggestedAction('NETWORK_UNREACHABLE');
      expect(action).toBeDefined();
    });

    it('should return action for DNS_FAILED', () => {
      const action = MCPErrorHandler.getSuggestedAction('DNS_FAILED');
      expect(action).toBeDefined();
      expect(action).toContain('DNS');
    });

    it('should return action for PERMISSION_DENIED', () => {
      const action = MCPErrorHandler.getSuggestedAction('PERMISSION_DENIED');
      expect(action).toBeDefined();
      expect(action).toContain('permissions');
    });

    it('should return action for FILE_NOT_FOUND', () => {
      const action = MCPErrorHandler.getSuggestedAction('FILE_NOT_FOUND');
      expect(action).toBeDefined();
      expect(action).toContain('path');
    });

    it('should return undefined for UNKNOWN', () => {
      const action = MCPErrorHandler.getSuggestedAction('UNKNOWN');
      expect(action).toBeUndefined();
    });
  });

  describe('Error code mappings', () => {
    it('should map all ErrorType values', () => {
      const errorTypes: ErrorType[] = [
        'AUTH_FAILED',
        'CONNECTION_REFUSED',
        'HOST_KEY_MISMATCH',
        'TIMEOUT',
        'NETWORK_UNREACHABLE',
        'DNS_FAILED',
        'PERMISSION_DENIED',
        'FILE_NOT_FOUND',
        'UNKNOWN',
      ];

      for (const errorType of errorTypes) {
        const errorInfo: ErrorInfo = {
          type: errorType,
          message: `Test ${errorType}`,
        };

        const mcpError = MCPErrorHandler.fromErrorInfo(errorInfo);
        expect(mcpError.code).toBeDefined();
        expect(typeof mcpError.code).toBe('number');
      }
    });
  });
});
