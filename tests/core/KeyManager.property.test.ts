/**
 * Property-based tests for KeyManager
 * 
 * Tests universal properties that should hold for all valid inputs.
 * Uses fast-check for property-based testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { KeyManager, type KeyGenerationOptions } from '../../src/core/KeyManager.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process');

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Helper function to validate key paths for property tests
const isValidKeyPath = (s: string): boolean => {
  const trimmed = s.trim();
  // Filter out paths that are too short
  if (trimmed.length < 3) return false;
  // Must contain only alphanumeric, forward slash, underscore, hyphen, dot, and tilde
  if (!/^[a-zA-Z0-9/_.\-~]+$/.test(trimmed)) return false;
  // Must start with alphanumeric, forward slash, or tilde
  if (!/^[a-zA-Z0-9/~]/.test(trimmed)) return false;
  return true;
};

describe('KeyManager Property Tests', () => {
  let keyManager: KeyManager;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    keyManager = new KeyManager();
    mockSpawn = vi.mocked(spawn);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Feature: ssh-mcp-server, Property 11: Key management commands use correct ssh-keygen flags
  describe('Property 11: Key management commands use correct ssh-keygen flags', () => {
    // Simple unit test to verify mock is working
    it('mock verification - addToAgent should call ssh-add', async () => {
      const testKeyManager = new KeyManager();
      mockSpawn.mockReset();
      
      const mockProcess = createMockProcess({
        stdout: 'Identity added',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await testKeyManager.addToAgent('/test/key', undefined);

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const firstCall = mockSpawn.mock.calls[0];
      expect(firstCall[0]).toBe('ssh-add');
      expect(firstCall[1]).toContain('/test/key');
    });

    it('generateKey uses correct flags for all valid algorithms and bit sizes', () => {
      fc.assert(
        fc.property(
          fc.record({
            algorithm: fc.constantFrom('rsa', 'ed25519', 'ecdsa', 'dsa'),
            bits: fc.integer({ min: 256, max: 4096 }),
            passphrase: fc.option(fc.string({ minLength: 8, maxLength: 64 }), { nil: undefined }),
            comment: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          }).filter(options => {
            // RSA requires minimum 1024 bits
            if (options.algorithm === 'rsa' && options.bits < 1024) {
              return false;
            }
            return true;
          }),
          async (options) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            // Mock successful key generation
            const mockProcess = createMockProcess({
              stdout: '',
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            // Mock fingerprint retrieval
            const mockFingerprintProcess = createMockProcess({
              stdout: `${options.bits} SHA256:testfingerprint comment (${options.algorithm.toUpperCase()})`,
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockFingerprintProcess as any);

            await keyManager.generateKey(options as KeyGenerationOptions);

            // Verify ssh-keygen was called with correct flags
            const firstCall = mockSpawn.mock.calls[0];
            expect(firstCall[0]).toBe('ssh-keygen');
            
            const args = firstCall[1] as string[];
            expect(args).toContain('-t');
            expect(args).toContain(options.algorithm);
            expect(args).toContain('-b');
            expect(args).toContain(options.bits.toString());
            expect(args).toContain('-f');
            expect(args).toContain('-N');
            
            if (options.comment) {
              expect(args).toContain('-C');
              expect(args).toContain(options.comment);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('extractPublicKey uses -y flag', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 200 }).filter(s => {
            const trimmed = s.trim();
            // Filter out paths that are too short or contain only special characters
            return trimmed.length >= 2 && /[a-zA-Z0-9]/.test(trimmed);
          }),
          async (keyPath) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            const mockProcess = createMockProcess({
              stdout: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... comment',
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            await keyManager.extractPublicKey(keyPath);

            const firstCall = mockSpawn.mock.calls[0];
            expect(firstCall[0]).toBe('ssh-keygen');
            
            const args = firstCall[1] as string[];
            expect(args).toContain('-y');
            expect(args).toContain('-f');
            expect(args).toContain(keyPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getFingerprint uses -lf flags', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
          async (keyPath) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            const mockProcess = createMockProcess({
              stdout: '2048 SHA256:testfingerprint comment (RSA)',
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            await keyManager.getFingerprint(keyPath);

            const firstCall = mockSpawn.mock.calls[0];
            expect(firstCall[0]).toBe('ssh-keygen');
            
            const args = firstCall[1] as string[];
            expect(args).toContain('-lf');
            expect(args).toContain(keyPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('addToAgent uses ssh-add with key path', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyPath: fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
            passphrase: fc.option(fc.string({ minLength: 8, maxLength: 64 }), { nil: undefined }),
          }),
          async ({ keyPath, passphrase }) => {
            // Create a fresh KeyManager instance for this iteration
            const testKeyManager = new KeyManager();
            
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            const mockProcess = createMockProcess({
              stdout: 'Identity added',
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            await testKeyManager.addToAgent(keyPath, passphrase);

            const firstCall = mockSpawn.mock.calls[0];
            expect(firstCall[0]).toBe('ssh-add');
            
            const args = firstCall[1] as string[];
            expect(args).toContain(keyPath);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 19: Key listing returns complete metadata
  describe('Property 19: Key listing returns complete metadata', () => {
    it('getKeyInfo extracts all metadata fields correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyPath: fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
            type: fc.constantFrom('RSA', 'ED25519', 'ECDSA', 'DSA'),
            bits: fc.integer({ min: 256, max: 4096 }),
            fingerprint: fc.hexaString({ minLength: 32, maxLength: 64 }).map(s => `SHA256:${s}`),
            comment: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          }),
          async ({ keyPath, type, bits, fingerprint, comment }) => {
            // Create a fresh KeyManager instance for this iteration
            const testKeyManager = new KeyManager();
            
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            const mockProcess = createMockProcess({
              stdout: `${bits} ${fingerprint} ${comment} (${type})`,
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            const keyInfo = await testKeyManager.getKeyInfo(keyPath);

            expect(keyInfo.path).toBe(keyPath);
            expect(keyInfo.type).toBe(type.toLowerCase());
            expect(keyInfo.bits).toBe(bits);
            expect(keyInfo.fingerprint).toBe(fingerprint);
            expect(keyInfo.comment).toBe(comment);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 20: Invalid keys are rejected
  describe('Property 20: Invalid keys are rejected', () => {
    it('validateKey returns false for keys that fail ssh-keygen validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
          async (keyPath) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            // Mock ssh-keygen failure (invalid key)
            const mockProcess = createMockProcess({
              stdout: '',
              stderr: 'key_load_public: invalid format',
              exitCode: 1,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            const isValid = await keyManager.validateKey(keyPath);

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validateKey returns true for keys that pass ssh-keygen validation', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyPath: fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
            type: fc.constantFrom('RSA', 'ED25519', 'ECDSA'),
            bits: fc.integer({ min: 256, max: 4096 }),
          }),
          async ({ keyPath, type, bits }) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            // Mock ssh-keygen success (valid key)
            const mockProcess = createMockProcess({
              stdout: `${bits} SHA256:validfingerprint comment (${type})`,
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            const isValid = await keyManager.validateKey(keyPath);

            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getKeyInfo throws error for invalid keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
          async (keyPath) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            // Mock ssh-keygen failure
            const mockProcess = createMockProcess({
              stdout: '',
              stderr: 'key_load_public: invalid format',
              exitCode: 1,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            await expect(keyManager.getKeyInfo(keyPath)).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 21: Key formats are supported
  describe('Property 21: Key formats are supported', () => {
    it('supports all standard SSH key types', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyPath: fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
            type: fc.constantFrom('RSA', 'ED25519', 'ECDSA', 'DSA'),
            bits: fc.integer({ min: 256, max: 4096 }),
            fingerprint: fc.hexaString({ minLength: 32, maxLength: 64 }).map(s => `SHA256:${s}`),
          }),
          async ({ keyPath, type, bits, fingerprint }) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            // Mock successful operations for all key types
            const mockProcess = createMockProcess({
              stdout: `${bits} ${fingerprint} comment (${type})`,
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            const keyInfo = await keyManager.getKeyInfo(keyPath);

            expect(keyInfo.type).toBe(type.toLowerCase());
            expect(keyInfo.bits).toBe(bits);
            expect(keyInfo.fingerprint).toBe(fingerprint);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getFingerprint works for all key types and returns SHA256 format', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyPath: fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
            type: fc.constantFrom('RSA', 'ED25519', 'ECDSA', 'DSA'),
            bits: fc.integer({ min: 256, max: 4096 }),
            fingerprint: fc.hexaString({ minLength: 32, maxLength: 64 }).map(s => `SHA256:${s}`),
          }),
          async ({ keyPath, type, bits, fingerprint }) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            const mockProcess = createMockProcess({
              stdout: `${bits} ${fingerprint} comment (${type})`,
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            const result = await keyManager.getFingerprint(keyPath);

            // Verify format rather than exact value
            expect(result).toMatch(/^SHA256:/);
            expect(result.length).toBeGreaterThan(8); // SHA256: + hash
          }
        ),
        { numRuns: 100 }
      );
    });

    it('extractPublicKey works for all key types', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyPath: fc.string({ minLength: 2, maxLength: 200 }).filter(isValidKeyPath),
            type: fc.constantFrom('rsa', 'ed25519', 'ecdsa', 'dsa'),
          }),
          async ({ keyPath, type }) => {
            // Clear mocks at the start of each property test iteration
            mockSpawn.mockReset();
            
            const publicKeyPrefix = type === 'rsa' ? 'ssh-rsa' :
                                   type === 'ed25519' ? 'ssh-ed25519' :
                                   type === 'ecdsa' ? 'ecdsa-sha2-nistp256' :
                                   'ssh-dss';
            
            const mockProcess = createMockProcess({
              stdout: `${publicKeyPrefix} AAAAB3NzaC1... comment`,
              stderr: '',
              exitCode: 0,
            });
            mockSpawn.mockReturnValueOnce(mockProcess as any);

            const publicKey = await keyManager.extractPublicKey(keyPath);

            expect(publicKey).toContain(publicKeyPrefix);
            expect(publicKey).toContain('AAAAB3NzaC1');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Create a mock child process for testing
 */
function createMockProcess(result: { stdout: string; stderr: string; exitCode: number }) {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  // Simulate async process execution
  setImmediate(() => {
    if (result.stdout) {
      mockProcess.stdout.emit('data', Buffer.from(result.stdout));
    }
    if (result.stderr) {
      mockProcess.stderr.emit('data', Buffer.from(result.stderr));
    }
    mockProcess.emit('close', result.exitCode);
  });

  return mockProcess;
}
