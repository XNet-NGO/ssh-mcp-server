/**
 * Unit tests for KeyManager
 * 
 * Tests key generation, validation, fingerprint computation, and ssh-agent integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyManager } from '../../src/core/KeyManager.js';
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

describe('KeyManager', () => {
  let keyManager: KeyManager;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    keyManager = new KeyManager();
    mockSpawn = vi.mocked(spawn);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate an RSA key with correct parameters', async () => {
      // Mock successful key generation
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      // Mock fingerprint retrieval
      const mockFingerprintProcess = createMockProcess({
        stdout: '2048 SHA256:abc123def456 comment (RSA)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockFingerprintProcess as any);

      const result = await keyManager.generateKey({
        algorithm: 'rsa',
        bits: 2048,
        passphrase: 'test-passphrase',
      });

      expect(result.algorithm).toBe('rsa');
      expect(result.bits).toBe(2048);
      expect(result.fingerprint).toBe('SHA256:abc123def456');
      expect(result.privateKeyPath).toContain('id_rsa_');
      expect(result.publicKeyPath).toContain('id_rsa_');
      expect(result.publicKeyPath).toMatch(/\.pub$/);
    });

    it('should generate an ed25519 key without passphrase', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const mockFingerprintProcess = createMockProcess({
        stdout: '256 SHA256:xyz789 comment (ED25519)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockFingerprintProcess as any);

      const result = await keyManager.generateKey({
        algorithm: 'ed25519',
        bits: 256,
      });

      expect(result.algorithm).toBe('ed25519');
      expect(result.bits).toBe(256);
      expect(result.fingerprint).toBe('SHA256:xyz789');
    });

    it('should use custom path when provided', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const mockFingerprintProcess = createMockProcess({
        stdout: '2048 SHA256:custom123 comment (RSA)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockFingerprintProcess as any);

      const customPath = '/custom/path/my_key';
      const result = await keyManager.generateKey({
        algorithm: 'rsa',
        bits: 2048,
        path: customPath,
      });

      expect(result.privateKeyPath).toBe(customPath);
      expect(result.publicKeyPath).toBe(`${customPath}.pub`);
    });

    it('should include custom comment when provided', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const mockFingerprintProcess = createMockProcess({
        stdout: '2048 SHA256:comment123 my-custom-comment (RSA)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockFingerprintProcess as any);

      await keyManager.generateKey({
        algorithm: 'rsa',
        bits: 2048,
        comment: 'my-custom-comment',
      });

      // Verify ssh-keygen was called with -C flag
      expect(mockSpawn).toHaveBeenCalledWith(
        'ssh-keygen',
        expect.arrayContaining(['-C', 'my-custom-comment']),
        expect.any(Object)
      );
    });

    it('should throw error when key generation fails', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'Key generation failed: invalid algorithm',
        exitCode: 1,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await expect(
        keyManager.generateKey({
          algorithm: 'invalid',
          bits: 2048,
        })
      ).rejects.toThrow('Key generation failed');
    });
  });

  describe('extractPublicKey', () => {
    it('should extract public key from private key', async () => {
      const mockProcess = createMockProcess({
        stdout: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... comment\n',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const publicKey = await keyManager.extractPublicKey('/path/to/private_key');

      expect(publicKey).toBe('ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... comment');
      expect(mockSpawn).toHaveBeenCalledWith(
        'ssh-keygen',
        ['-y', '-f', '/path/to/private_key'],
        expect.any(Object)
      );
    });

    it('should throw error when extraction fails', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'Load key "/path/to/invalid_key": invalid format',
        exitCode: 1,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await expect(
        keyManager.extractPublicKey('/path/to/invalid_key')
      ).rejects.toThrow('Failed to extract public key');
    });
  });

  describe('getFingerprint', () => {
    it('should compute SHA256 fingerprint', async () => {
      const mockProcess = createMockProcess({
        stdout: '2048 SHA256:abc123def456ghi789 user@host (RSA)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const fingerprint = await keyManager.getFingerprint('/path/to/key');

      expect(fingerprint).toBe('SHA256:abc123def456ghi789');
    });

    it('should handle different key types', async () => {
      const testCases = [
        { output: '256 SHA256:ed25519fingerprint comment (ED25519)', expected: 'SHA256:ed25519fingerprint' },
        { output: '521 SHA256:ecdsafingerprint comment (ECDSA)', expected: 'SHA256:ecdsafingerprint' },
        { output: '4096 SHA256:rsafingerprint comment (RSA)', expected: 'SHA256:rsafingerprint' },
      ];

      for (const testCase of testCases) {
        const mockProcess = createMockProcess({
          stdout: testCase.output,
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const fingerprint = await keyManager.getFingerprint('/path/to/key');
        expect(fingerprint).toBe(testCase.expected);
      }
    });

    it('should throw error when fingerprint computation fails', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'key_load_public: invalid format',
        exitCode: 1,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await expect(
        keyManager.getFingerprint('/path/to/invalid_key')
      ).rejects.toThrow('Failed to get fingerprint');
    });

    it('should throw error when output format is unexpected', async () => {
      const mockProcess = createMockProcess({
        stdout: 'unexpected output format',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await expect(
        keyManager.getFingerprint('/path/to/key')
      ).rejects.toThrow('Failed to parse fingerprint');
    });
  });

  describe('getKeyInfo', () => {
    it('should parse key information correctly', async () => {
      const mockProcess = createMockProcess({
        stdout: '2048 SHA256:abc123 user@host (RSA)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const keyInfo = await keyManager.getKeyInfo('/path/to/key');

      expect(keyInfo).toEqual({
        path: '/path/to/key',
        type: 'rsa',
        bits: 2048,
        fingerprint: 'SHA256:abc123',
        comment: 'user@host',
      });
    });

    it('should handle different key types and sizes', async () => {
      const testCases = [
        {
          output: '256 SHA256:ed25519fp ed25519-comment (ED25519)',
          expected: { type: 'ed25519', bits: 256, fingerprint: 'SHA256:ed25519fp', comment: 'ed25519-comment' },
        },
        {
          output: '521 SHA256:ecdsafp ecdsa-comment (ECDSA)',
          expected: { type: 'ecdsa', bits: 521, fingerprint: 'SHA256:ecdsafp', comment: 'ecdsa-comment' },
        },
        {
          output: '4096 SHA256:rsafp rsa-comment (RSA)',
          expected: { type: 'rsa', bits: 4096, fingerprint: 'SHA256:rsafp', comment: 'rsa-comment' },
        },
      ];

      for (const testCase of testCases) {
        const mockProcess = createMockProcess({
          stdout: testCase.output,
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const keyInfo = await keyManager.getKeyInfo('/path/to/key');
        expect(keyInfo.type).toBe(testCase.expected.type);
        expect(keyInfo.bits).toBe(testCase.expected.bits);
        expect(keyInfo.fingerprint).toBe(testCase.expected.fingerprint);
        expect(keyInfo.comment).toBe(testCase.expected.comment);
      }
    });

    it('should throw error for invalid key', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'key_load_public: invalid format',
        exitCode: 1,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await expect(
        keyManager.getKeyInfo('/path/to/invalid_key')
      ).rejects.toThrow('Failed to get key info');
    });
  });

  describe('validateKey', () => {
    it('should return true for valid key', async () => {
      const mockProcess = createMockProcess({
        stdout: '2048 SHA256:abc123 comment (RSA)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const isValid = await keyManager.validateKey('/path/to/valid_key');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid key', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'key_load_public: invalid format',
        exitCode: 1,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      const isValid = await keyManager.validateKey('/path/to/invalid_key');
      expect(isValid).toBe(false);
    });
  });

  describe('addToAgent', () => {
    it('should add key to ssh-agent without passphrase', async () => {
      const mockProcess = createMockProcess({
        stdout: 'Identity added: /path/to/key',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await keyManager.addToAgent('/path/to/key');

      expect(mockSpawn).toHaveBeenCalledWith(
        'ssh-add',
        ['/path/to/key'],
        { stdio: 'pipe' }
      );
    });

    it('should add key to ssh-agent with passphrase', async () => {
      const mockProcess = createMockProcess({
        stdout: 'Identity added: /path/to/key',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await keyManager.addToAgent('/path/to/key', 'my-passphrase');

      expect(mockSpawn).toHaveBeenCalledWith(
        'ssh-add',
        ['/path/to/key'],
        { stdio: 'pipe' }
      );
    });

    it('should throw error when adding to agent fails', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'Could not open a connection to your authentication agent',
        exitCode: 2,
      });
      mockSpawn.mockReturnValueOnce(mockProcess as any);

      await expect(
        keyManager.addToAgent('/path/to/key')
      ).rejects.toThrow('Failed to add key to agent');
    });
  });

  describe('listKeys', () => {
    it('should list keys in default SSH directory', async () => {
      const { promises: fs } = await import('fs');
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'id_rsa',
        'id_rsa.pub',
        'id_ed25519',
        'id_ed25519.pub',
        'known_hosts',
        'config',
      ] as any);

      // Mock getKeyInfo calls for each key
      const mockProcess1 = createMockProcess({
        stdout: '2048 SHA256:rsa123 rsa-comment (RSA)',
        stderr: '',
        exitCode: 0,
      });
      const mockProcess2 = createMockProcess({
        stdout: '256 SHA256:ed123 ed25519-comment (ED25519)',
        stderr: '',
        exitCode: 0,
      });
      mockSpawn
        .mockReturnValueOnce(mockProcess1 as any)
        .mockReturnValueOnce(mockProcess2 as any);

      const keys = await keyManager.listKeys();

      expect(keys).toHaveLength(2);
      expect(keys[0].type).toBe('rsa');
      expect(keys[1].type).toBe('ed25519');
    });

    it('should return empty array when directory does not exist', async () => {
      const { promises: fs } = await import('fs');
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      vi.mocked(fs.readdir).mockRejectedValueOnce(error);

      const keys = await keyManager.listKeys();
      expect(keys).toEqual([]);
    });

    it('should skip invalid key files', async () => {
      const { promises: fs } = await import('fs');
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'id_rsa',
        'id_invalid',
      ] as any);

      // First key is valid
      const mockProcess1 = createMockProcess({
        stdout: '2048 SHA256:rsa123 comment (RSA)',
        stderr: '',
        exitCode: 0,
      });
      // Second key is invalid
      const mockProcess2 = createMockProcess({
        stdout: '',
        stderr: 'invalid format',
        exitCode: 1,
      });
      mockSpawn
        .mockReturnValueOnce(mockProcess1 as any)
        .mockReturnValueOnce(mockProcess2 as any);

      const keys = await keyManager.listKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0].type).toBe('rsa');
    });
  });

  describe('Key Format Validation', () => {
    describe('OpenSSH Format', () => {
      it('should validate OpenSSH format RSA keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:openssh123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/openssh_rsa_key');
        expect(isValid).toBe(true);
      });

      it('should validate OpenSSH format ED25519 keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '256 SHA256:openssh456 comment (ED25519)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/openssh_ed25519_key');
        expect(isValid).toBe(true);
      });

      it('should validate OpenSSH format ECDSA keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '521 SHA256:openssh789 comment (ECDSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/openssh_ecdsa_key');
        expect(isValid).toBe(true);
      });

      it('should extract public key from OpenSSH format private key', async () => {
        const mockProcess = createMockProcess({
          stdout: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDOpenSSH comment',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const publicKey = await keyManager.extractPublicKey('/path/to/openssh_key');
        expect(publicKey).toContain('ssh-rsa');
        expect(publicKey).toContain('AAAAB3NzaC1yc2EAAAADAQABAAABAQDOpenSSH');
      });

      it('should get fingerprint from OpenSSH format key', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:opensshfingerprint123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const fingerprint = await keyManager.getFingerprint('/path/to/openssh_key');
        expect(fingerprint).toBe('SHA256:opensshfingerprint123');
      });
    });

    describe('PEM Format', () => {
      it('should validate PEM format RSA keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:pem123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/pem_rsa_key.pem');
        expect(isValid).toBe(true);
      });

      it('should validate PEM format DSA keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '1024 SHA256:pem456 comment (DSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/pem_dsa_key.pem');
        expect(isValid).toBe(true);
      });

      it('should extract public key from PEM format private key', async () => {
        const mockProcess = createMockProcess({
          stdout: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDPEMFormat comment',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const publicKey = await keyManager.extractPublicKey('/path/to/pem_key.pem');
        expect(publicKey).toContain('ssh-rsa');
        expect(publicKey).toContain('AAAAB3NzaC1yc2EAAAADAQABAAABAQDPEMFormat');
      });

      it('should get fingerprint from PEM format key', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:pemfingerprint789 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const fingerprint = await keyManager.getFingerprint('/path/to/pem_key.pem');
        expect(fingerprint).toBe('SHA256:pemfingerprint789');
      });

      it('should handle PEM format with encrypted private key', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:encryptedpem123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/encrypted_pem_key.pem');
        expect(isValid).toBe(true);
      });
    });

    describe('PKCS8 Format', () => {
      it('should validate PKCS8 format RSA keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:pkcs8123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/pkcs8_rsa_key');
        expect(isValid).toBe(true);
      });

      it('should validate PKCS8 format ED25519 keys', async () => {
        const mockProcess = createMockProcess({
          stdout: '256 SHA256:pkcs8456 comment (ED25519)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/pkcs8_ed25519_key');
        expect(isValid).toBe(true);
      });

      it('should extract public key from PKCS8 format private key', async () => {
        const mockProcess = createMockProcess({
          stdout: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQPKCS8Format comment',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const publicKey = await keyManager.extractPublicKey('/path/to/pkcs8_key');
        expect(publicKey).toContain('ssh-rsa');
        expect(publicKey).toContain('AAAAB3NzaC1yc2EAAAADAQABAAABAQPKCS8Format');
      });

      it('should get fingerprint from PKCS8 format key', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:pkcs8fingerprint789 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const fingerprint = await keyManager.getFingerprint('/path/to/pkcs8_key');
        expect(fingerprint).toBe('SHA256:pkcs8fingerprint789');
      });

      it('should handle PKCS8 format with encrypted private key', async () => {
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:encryptedpkcs8123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/encrypted_pkcs8_key');
        expect(isValid).toBe(true);
      });
    });

    describe('Invalid Key Files', () => {
      it('should reject file with invalid key format', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/invalid_key');
        expect(isValid).toBe(false);
      });

      it('should reject corrupted key file', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format\nLoad key "/path/to/corrupted": invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/corrupted_key');
        expect(isValid).toBe(false);
      });

      it('should reject non-key text file', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/text_file.txt');
        expect(isValid).toBe(false);
      });

      it('should reject binary file that is not a key', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/binary_file.bin');
        expect(isValid).toBe(false);
      });

      it('should throw error when extracting public key from invalid file', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'Load key "/path/to/invalid": invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        await expect(
          keyManager.extractPublicKey('/path/to/invalid_key')
        ).rejects.toThrow('Failed to extract public key');
      });

      it('should throw error when getting fingerprint from invalid file', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        await expect(
          keyManager.getFingerprint('/path/to/invalid_key')
        ).rejects.toThrow('Failed to get fingerprint');
      });

      it('should reject key with wrong file extension but valid content', async () => {
        // Even if content is valid, ssh-keygen should handle it
        const mockProcess = createMockProcess({
          stdout: '2048 SHA256:validcontent123 comment (RSA)',
          stderr: '',
          exitCode: 0,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/key.wrongext');
        expect(isValid).toBe(true); // ssh-keygen validates content, not extension
      });

      it('should handle empty file', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/empty_file');
        expect(isValid).toBe(false);
      });

      it('should handle file with only whitespace', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/whitespace_file');
        expect(isValid).toBe(false);
      });

      it('should handle malformed PEM header', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format\nPEM_read_bio_PrivateKey failed',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/malformed_pem');
        expect(isValid).toBe(false);
      });

      it('should handle truncated key file', async () => {
        const mockProcess = createMockProcess({
          stdout: '',
          stderr: 'key_load_public: invalid format\nLoad key: invalid format',
          exitCode: 1,
        });
        mockSpawn.mockReturnValueOnce(mockProcess as any);

        const isValid = await keyManager.validateKey('/path/to/truncated_key');
        expect(isValid).toBe(false);
      });
    });

    describe('Cross-Format Operations', () => {
      it('should handle key operations across different formats', async () => {
        // Test that operations work regardless of format
        const formats = [
          { path: '/path/to/openssh_key', format: 'OpenSSH' },
          { path: '/path/to/pem_key.pem', format: 'PEM' },
          { path: '/path/to/pkcs8_key', format: 'PKCS8' },
        ];

        for (const { path, format } of formats) {
          // Validate
          const mockValidate = createMockProcess({
            stdout: '2048 SHA256:crossformat123 comment (RSA)',
            stderr: '',
            exitCode: 0,
          });
          mockSpawn.mockReturnValueOnce(mockValidate as any);
          const isValid = await keyManager.validateKey(path);
          expect(isValid).toBe(true);

          // Extract public key
          const mockExtract = createMockProcess({
            stdout: `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ${format} comment`,
            stderr: '',
            exitCode: 0,
          });
          mockSpawn.mockReturnValueOnce(mockExtract as any);
          const publicKey = await keyManager.extractPublicKey(path);
          expect(publicKey).toContain('ssh-rsa');

          // Get fingerprint
          const mockFingerprint = createMockProcess({
            stdout: `2048 SHA256:${format.toLowerCase()}fp123 comment (RSA)`,
            stderr: '',
            exitCode: 0,
          });
          mockSpawn.mockReturnValueOnce(mockFingerprint as any);
          const fingerprint = await keyManager.getFingerprint(path);
          expect(fingerprint).toMatch(/^SHA256:/);
        }
      });
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
