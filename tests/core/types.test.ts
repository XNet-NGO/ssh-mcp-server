/**
 * Tests for core type definitions
 * 
 * These tests verify that the core types are properly defined and can be used
 * to create valid data structures.
 */

import { describe, it, expect } from 'vitest';
import type {
  Session,
  ConnectionConfig,
  ConnectionParams,
  CommandResult,
  ErrorInfo,
  FileInfo,
  KeyPair,
  KeyInfo,
  PortForwardConfig,
  TransferResult,
} from '../../src/core/types.js';

describe('Core Types', () => {
  describe('Session', () => {
    it('should create a valid session object', () => {
      const session: Session = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        host: 'example.com',
        port: 22,
        username: 'testuser',
        keyPath: '/home/user/.ssh/id_rsa',
        controlSocketPath: '/tmp/ssh-mcp-123',
        createdAt: new Date(),
        lastUsedAt: new Date(),
        config: {
          strictHostKeyChecking: true,
          connectTimeout: 30,
          serverAliveInterval: 60,
          compression: true,
          forwardAgent: false,
          customOptions: {},
        },
      };

      expect(session.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(session.host).toBe('example.com');
      expect(session.port).toBe(22);
      expect(session.username).toBe('testuser');
    });
  });

  describe('ConnectionConfig', () => {
    it('should create a valid connection config', () => {
      const config: ConnectionConfig = {
        strictHostKeyChecking: true,
        connectTimeout: 30,
        serverAliveInterval: 60,
        compression: true,
        forwardAgent: false,
        customOptions: {
          'ServerAliveCountMax': '3',
        },
      };

      expect(config.strictHostKeyChecking).toBe(true);
      expect(config.connectTimeout).toBe(30);
      expect(config.customOptions['ServerAliveCountMax']).toBe('3');
    });
  });

  describe('ConnectionParams', () => {
    it('should create valid connection parameters', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        port: 2222,
        username: 'admin',
        keyPath: '/home/user/.ssh/id_ed25519',
        config: {
          strictHostKeyChecking: false,
        },
      };

      expect(params.host).toBe('example.com');
      expect(params.port).toBe(2222);
      expect(params.username).toBe('admin');
    });

    it('should allow optional fields to be omitted', () => {
      const params: ConnectionParams = {
        host: 'example.com',
        username: 'user',
      };

      expect(params.host).toBe('example.com');
      expect(params.username).toBe('user');
      expect(params.port).toBeUndefined();
      expect(params.keyPath).toBeUndefined();
    });
  });

  describe('CommandResult', () => {
    it('should create a valid command result', () => {
      const result: CommandResult = {
        stdout: 'Hello, World!',
        stderr: '',
        exitCode: 0,
        duration: 150,
      };

      expect(result.stdout).toBe('Hello, World!');
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBe(150);
    });
  });

  describe('ErrorInfo', () => {
    it('should create a valid error info object', () => {
      const error: ErrorInfo = {
        type: 'AUTH_FAILED',
        message: 'Authentication failed',
        rawOutput: 'Permission denied (publickey)',
      };

      expect(error.type).toBe('AUTH_FAILED');
      expect(error.message).toBe('Authentication failed');
      expect(error.rawOutput).toBe('Permission denied (publickey)');
    });

    it('should support all error types', () => {
      const errorTypes: ErrorInfo['type'][] = [
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

      errorTypes.forEach(type => {
        const error: ErrorInfo = {
          type,
          message: `Test error: ${type}`,
        };
        expect(error.type).toBe(type);
      });
    });
  });

  describe('FileInfo', () => {
    it('should create a valid file info object', () => {
      const fileInfo: FileInfo = {
        name: 'test.txt',
        path: '/home/user/test.txt',
        size: 1024,
        permissions: '-rw-r--r--',
        owner: 'user',
        group: 'users',
        modifiedAt: new Date('2024-01-15T10:30:00Z'),
        isDirectory: false,
      };

      expect(fileInfo.name).toBe('test.txt');
      expect(fileInfo.size).toBe(1024);
      expect(fileInfo.isDirectory).toBe(false);
    });

    it('should represent a directory', () => {
      const dirInfo: FileInfo = {
        name: 'documents',
        path: '/home/user/documents',
        size: 4096,
        permissions: 'drwxr-xr-x',
        owner: 'user',
        group: 'users',
        modifiedAt: new Date(),
        isDirectory: true,
      };

      expect(dirInfo.isDirectory).toBe(true);
      expect(dirInfo.permissions.startsWith('d')).toBe(true);
    });
  });

  describe('KeyPair', () => {
    it('should create a valid key pair object', () => {
      const keyPair: KeyPair = {
        privateKeyPath: '/home/user/.ssh/id_ed25519',
        publicKeyPath: '/home/user/.ssh/id_ed25519.pub',
        fingerprint: 'SHA256:abc123def456',
        algorithm: 'ed25519',
        bits: 256,
      };

      expect(keyPair.algorithm).toBe('ed25519');
      expect(keyPair.bits).toBe(256);
      expect(keyPair.fingerprint).toContain('SHA256:');
    });
  });

  describe('KeyInfo', () => {
    it('should create a valid key info object', () => {
      const keyInfo: KeyInfo = {
        path: '/home/user/.ssh/id_rsa',
        type: 'rsa',
        bits: 4096,
        fingerprint: 'SHA256:xyz789abc123',
        comment: 'user@hostname',
      };

      expect(keyInfo.type).toBe('rsa');
      expect(keyInfo.bits).toBe(4096);
      expect(keyInfo.comment).toBe('user@hostname');
    });
  });

  describe('PortForwardConfig', () => {
    it('should create a local port forward config', () => {
      const config: PortForwardConfig = {
        type: 'local',
        localPort: 8080,
        remoteHost: 'internal.example.com',
        remotePort: 80,
      };

      expect(config.type).toBe('local');
      expect(config.localPort).toBe(8080);
      expect(config.remotePort).toBe(80);
    });

    it('should create a remote port forward config', () => {
      const config: PortForwardConfig = {
        type: 'remote',
        localPort: 3000,
        remotePort: 8080,
      };

      expect(config.type).toBe('remote');
    });

    it('should create a dynamic port forward config', () => {
      const config: PortForwardConfig = {
        type: 'dynamic',
        localPort: 1080,
      };

      expect(config.type).toBe('dynamic');
      expect(config.localPort).toBe(1080);
    });
  });

  describe('TransferResult', () => {
    it('should create a successful transfer result', () => {
      const result: TransferResult = {
        success: true,
        bytesTransferred: 1048576,
        duration: 2500,
      };

      expect(result.success).toBe(true);
      expect(result.bytesTransferred).toBe(1048576);
      expect(result.error).toBeUndefined();
    });

    it('should create a failed transfer result', () => {
      const result: TransferResult = {
        success: false,
        bytesTransferred: 0,
        duration: 100,
        error: 'Permission denied',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});
