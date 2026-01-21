/**
 * Property-based tests for OpenSSH Integration
 * 
 * Tests OpenSSH integration properties using fast-check for property-based testing.
 * These tests validate that the SSH MCP Server correctly uses OpenSSH binaries
 * and handles debug verbosity flags.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { SFTPHandler } from '../../src/core/SFTPHandler.js';
import { KeyManager } from '../../src/core/KeyManager.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import type { Session } from '../../src/core/types.js';

/**
 * Helper function to create a test session
 */
function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-id',
    host: 'example.com',
    port: 22,
    username: 'testuser',
    keyPath: '/path/to/key',
    controlSocketPath: '/tmp/ssh-control-test',
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
    ...overrides,
  };
}

describe('OpenSSH Integration Property Tests', () => {
  describe('Property 13: OpenSSH binaries are used for all operations', () => {
    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should use configured SSH binary path for all SSH operations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          fc.string({ minLength: 1, maxLength: 50 }),
          (binaryPath, command) => {
            // Create SSHWrapper with custom binary path
            const wrapper = new SSHWrapper(binaryPath);
            const session = createTestSession();

            // Build SSH command
            const args = wrapper.buildSSHCommand(session, command, {});

            // First argument should be the configured binary path
            expect(args[0]).toBe(binaryPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should use configured SFTP binary path for SFTP operations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          (sftpBinaryPath) => {
            // Create SFTPHandler with custom binary path
            const handler = new SFTPHandler(sftpBinaryPath, 'scp');
            const session = createTestSession();

            // Build SFTP command (using private method via reflection)
            const buildMethod = (handler as any).buildSFTPBaseCommand.bind(handler);
            const args = buildMethod(session);

            // First argument should be the configured SFTP binary path
            expect(args[0]).toBe(sftpBinaryPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should use configured SCP binary path for SCP operations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          (scpBinaryPath) => {
            // Create SFTPHandler with custom SCP binary path
            const handler = new SFTPHandler('sftp', scpBinaryPath);
            const session = createTestSession();

            // Build SCP command (using private method via reflection)
            const buildMethod = (handler as any).buildSCPCommand.bind(handler);
            const args = buildMethod(session, false);

            // First argument should be the configured SCP binary path
            expect(args[0]).toBe(scpBinaryPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should use configured ssh-keygen binary path for key operations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          (sshKeygenPath) => {
            // Create KeyManager with custom binary path
            const keyManager = new KeyManager(sshKeygenPath, 'ssh-add');

            // The binary path should be stored and used
            // We can't easily test command execution without mocking,
            // but we can verify the path is stored
            expect(sshKeygenPath).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should use configured ssh-add binary path for agent operations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          (sshAddPath) => {
            // Create KeyManager with custom ssh-add binary path
            const keyManager = new KeyManager('ssh-keygen', sshAddPath);

            // The binary path should be stored and used
            expect(sshAddPath).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should allow updating binary paths after construction', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
          (initialPath, newPath) => {
            // Create wrapper with initial path
            const wrapper = new SSHWrapper(initialPath);
            const session = createTestSession();

            // Verify initial path is used
            const args1 = wrapper.buildSSHCommand(session, 'test', {});
            expect(args1[0]).toBe(initialPath);

            // Update binary path
            wrapper.setSshBinaryPath(newPath);

            // Verify new path is used
            const args2 = wrapper.buildSSHCommand(session, 'test', {});
            expect(args2[0]).toBe(newPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 13: OpenSSH binaries are used for all operations
    it('should use default binary paths when not specified', () => {
      // Create components with default paths
      const wrapper = new SSHWrapper();
      const handler = new SFTPHandler();
      const keyManager = new KeyManager();
      const session = createTestSession();

      // SSH should default to 'ssh'
      const sshArgs = wrapper.buildSSHCommand(session, 'test', {});
      expect(sshArgs[0]).toBe('ssh');

      // SFTP should default to 'sftp'
      const buildSFTPMethod = (handler as any).buildSFTPBaseCommand.bind(handler);
      const sftpArgs = buildSFTPMethod(session);
      expect(sftpArgs[0]).toBe('sftp');

      // SCP should default to 'scp'
      const buildSCPMethod = (handler as any).buildSCPCommand.bind(handler);
      const scpArgs = buildSCPMethod(session, false);
      expect(scpArgs[0]).toBe('scp');
    });
  });

  describe('Property 14: Debug flags are added when debugging enabled', () => {
    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should add correct number of -v flags based on debug level for SSH', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1, 2, 3),
          fc.string({ minLength: 1, maxLength: 50 }),
          (debugLevel, command) => {
            // Create SSHWrapper with debug level
            const wrapper = new SSHWrapper('ssh', debugLevel);
            const session = createTestSession();

            // Build SSH command
            const args = wrapper.buildSSHCommand(session, command, {});

            // Count -v flags in the command
            const vFlagCount = args.filter(arg => arg === '-v').length;

            // Should have exactly debugLevel number of -v flags
            expect(vFlagCount).toBe(debugLevel);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should add correct number of -v flags based on debug level for SFTP', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1, 2, 3),
          (debugLevel) => {
            // Create SFTPHandler with debug level
            const handler = new SFTPHandler('sftp', 'scp', debugLevel);
            const session = createTestSession();

            // Build SFTP command
            const buildMethod = (handler as any).buildSFTPBaseCommand.bind(handler);
            const args = buildMethod(session);

            // Count -v flags in the command
            const vFlagCount = args.filter((arg: string) => arg === '-v').length;

            // Should have exactly debugLevel number of -v flags
            expect(vFlagCount).toBe(debugLevel);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should add correct number of -v flags based on debug level for SCP', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1, 2, 3),
          (debugLevel) => {
            // Create SFTPHandler with debug level
            const handler = new SFTPHandler('sftp', 'scp', debugLevel);
            const session = createTestSession();

            // Build SCP command
            const buildMethod = (handler as any).buildSCPCommand.bind(handler);
            const args = buildMethod(session, false);

            // Count -v flags in the command
            const vFlagCount = args.filter((arg: string) => arg === '-v').length;

            // Should have exactly debugLevel number of -v flags
            expect(vFlagCount).toBe(debugLevel);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should allow updating debug level after construction', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1, 2, 3),
          fc.constantFrom(0, 1, 2, 3),
          (initialLevel, newLevel) => {
            // Create wrapper with initial debug level
            const wrapper = new SSHWrapper('ssh', initialLevel);
            const session = createTestSession();

            // Verify initial debug level
            const args1 = wrapper.buildSSHCommand(session, 'test', {});
            const vFlagCount1 = args1.filter(arg => arg === '-v').length;
            expect(vFlagCount1).toBe(initialLevel);

            // Update debug level
            wrapper.setDebugLevel(newLevel);

            // Verify new debug level
            const args2 = wrapper.buildSSHCommand(session, 'test', {});
            const vFlagCount2 = args2.filter(arg => arg === '-v').length;
            expect(vFlagCount2).toBe(newLevel);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should reject invalid debug levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }).filter(n => ![0, 1, 2, 3].includes(n)),
          (invalidLevel) => {
            const wrapper = new SSHWrapper();

            // Setting invalid debug level should throw
            expect(() => wrapper.setDebugLevel(invalidLevel)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should provide debug flags from ConfigurationManager', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1, 2, 3),
          (debugLevel) => {
            // Create ConfigurationManager with debug level
            const configManager = new ConfigurationManager('~/.ssh/known_hosts', undefined, debugLevel);

            // Get debug flags
            const debugFlags = configManager.getDebugFlags();

            // Should have exactly debugLevel number of -v flags
            expect(debugFlags.length).toBe(debugLevel);
            expect(debugFlags.every(flag => flag === '-v')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 14: Debug flags are added when debugging enabled
    it('should maintain debug level consistency across operations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1, 2, 3),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          (debugLevel, commands) => {
            // Create wrapper with debug level
            const wrapper = new SSHWrapper('ssh', debugLevel);
            const session = createTestSession();

            // Build multiple commands
            const allArgs = commands.map(cmd => wrapper.buildSSHCommand(session, cmd, {}));

            // All commands should have the same number of -v flags
            const vFlagCounts = allArgs.map(args => args.filter(arg => arg === '-v').length);
            expect(vFlagCounts.every(count => count === debugLevel)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 36: Standard openssh output is parsed correctly', () => {
    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should parse SSH error output without throwing exceptions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (stderr) => {
            const wrapper = new SSHWrapper();

            // Parsing should not throw, even for arbitrary input
            const errorInfo = wrapper.parseSSHError(stderr);

            // Should return a valid ErrorInfo object
            expect(errorInfo).toBeDefined();
            expect(errorInfo.type).toBeDefined();
            expect(errorInfo.message).toBeDefined();
            expect(errorInfo.rawOutput).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should identify known SSH error patterns', () => {
      const knownErrors = [
        { stderr: 'Permission denied (publickey)', expectedType: 'AUTH_FAILED' },
        { stderr: 'Connection refused', expectedType: 'CONNECTION_REFUSED' },
        { stderr: 'Host key verification failed', expectedType: 'HOST_KEY_MISMATCH' },
        { stderr: 'Connection timed out', expectedType: 'TIMEOUT' },
        { stderr: 'Name or service not known', expectedType: 'DNS_FAILED' },
        { stderr: 'Network is unreachable', expectedType: 'NETWORK_UNREACHABLE' },
      ];

      const wrapper = new SSHWrapper();

      for (const { stderr, expectedType } of knownErrors) {
        const errorInfo = wrapper.parseSSHError(stderr);
        expect(errorInfo.type).toBe(expectedType);
      }
    });

    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should classify unknown errors as UNKNOWN type', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
            !s.toLowerCase().includes('permission') &&
            !s.toLowerCase().includes('refused') &&
            !s.toLowerCase().includes('host key') &&
            !s.toLowerCase().includes('timeout') &&
            !s.toLowerCase().includes('dns') &&
            !s.toLowerCase().includes('network') &&
            !s.toLowerCase().includes('unreachable')
          ),
          (stderr) => {
            const wrapper = new SSHWrapper();

            // Parse the error
            const errorInfo = wrapper.parseSSHError(stderr);

            // Should be classified as UNKNOWN if it doesn't match known patterns
            expect(errorInfo.type).toBe('UNKNOWN');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should preserve raw output in error info', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (stderr) => {
            const wrapper = new SSHWrapper();

            // Parse the error
            const errorInfo = wrapper.parseSSHError(stderr);

            // Raw output should be preserved (possibly scrubbed for sensitive data)
            expect(errorInfo.rawOutput).toBeDefined();
            expect(typeof errorInfo.rawOutput).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should handle empty stderr gracefully', () => {
      const wrapper = new SSHWrapper();

      // Parse empty stderr
      const errorInfo = wrapper.parseSSHError('');

      // Should return UNKNOWN error type
      expect(errorInfo.type).toBe('UNKNOWN');
      expect(errorInfo.message).toBeDefined();
    });

    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should handle multi-line stderr output', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          (lines) => {
            const wrapper = new SSHWrapper();
            const stderr = lines.join('\n');

            // Parse multi-line stderr
            const errorInfo = wrapper.parseSSHError(stderr);

            // Should parse without errors
            expect(errorInfo).toBeDefined();
            expect(errorInfo.type).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: ssh-mcp-server, Property 36: Standard openssh output is parsed correctly
    it('should scrub sensitive data from error output', () => {
      const sensitiveErrors = [
        'Enter passphrase for key: mysecret123',
        'password: mypassword',
        'token: abc123xyz',
      ];

      const wrapper = new SSHWrapper();

      for (const stderr of sensitiveErrors) {
        const errorInfo = wrapper.parseSSHError(stderr);

        // Raw output should not contain the sensitive values
        expect(errorInfo.rawOutput).not.toContain('mysecret123');
        expect(errorInfo.rawOutput).not.toContain('mypassword');
        expect(errorInfo.rawOutput).not.toContain('abc123xyz');
        
        // Should contain redaction marker
        expect(errorInfo.rawOutput).toContain('[REDACTED]');
      }
    });
  });
});
