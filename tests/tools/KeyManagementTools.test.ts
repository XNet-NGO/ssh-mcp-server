/**
 * Unit Tests for Key Management Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyManagementTools } from '../../src/tools/KeyManagementTools.js';
import { KeyManager } from '../../src/core/KeyManager.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import { KeyPair, KeyInfo } from '../../src/core/types.js';

describe('KeyManagementTools', () => {
  let keyManagementTools: KeyManagementTools;
  let keyManager: KeyManager;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    keyManager = new KeyManager(configManager);
    keyManagementTools = new KeyManagementTools(keyManager);
  });

  describe('ssh_keygen', () => {
    it('should generate key pair and return details', async () => {
      // Mock generateKey to return key pair
      const mockKeyPair: KeyPair = {
        privateKeyPath: '/home/user/.ssh/id_rsa_123',
        publicKeyPath: '/home/user/.ssh/id_rsa_123.pub',
        fingerprint: 'SHA256:abc123def456',
        algorithm: 'rsa',
        bits: 2048,
      };
      vi.spyOn(keyManager, 'generateKey').mockResolvedValue(mockKeyPair);

      const response = await keyManagementTools.generateKey({
        algorithm: 'rsa',
        bits: 2048,
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check key pair details (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.privateKeyPath).toBe('/home/user/.ssh/id_rsa_123');
        expect(data.publicKeyPath).toBe('/home/user/.ssh/id_rsa_123.pub');
        expect(data.fingerprint).toBe('SHA256:abc123def456');
        expect(data.algorithm).toBe('rsa');
        expect(data.bits).toBe(2048);
      }
    });

    it('should pass all parameters to KeyManager', async () => {
      // Mock generateKey
      const mockKeyPair: KeyPair = {
        privateKeyPath: '/custom/path/id_ed25519',
        publicKeyPath: '/custom/path/id_ed25519.pub',
        fingerprint: 'SHA256:xyz789',
        algorithm: 'ed25519',
        bits: 256,
      };
      const generateSpy = vi
        .spyOn(keyManager, 'generateKey')
        .mockResolvedValue(mockKeyPair);

      await keyManagementTools.generateKey({
        algorithm: 'ed25519',
        bits: 256,
        passphrase: 'secret',
        path: '/custom/path/id_ed25519',
        comment: 'test key',
      });

      // Verify generateKey was called with all parameters
      expect(generateSpy).toHaveBeenCalledWith({
        algorithm: 'ed25519',
        bits: 256,
        passphrase: 'secret',
        path: '/custom/path/id_ed25519',
        comment: 'test key',
      });
    });

    it('should handle key generation errors', async () => {
      // Mock generateKey to throw error
      vi.spyOn(keyManager, 'generateKey').mockRejectedValue(
        new Error('Invalid algorithm')
      );

      const response = await keyManagementTools.generateKey({
        algorithm: 'invalid',
        bits: 2048,
      });

      expect(response.isError).toBe(true);
    });

    it('should generate RSA key with default parameters', async () => {
      // Mock generateKey
      const mockKeyPair: KeyPair = {
        privateKeyPath: '/home/user/.ssh/id_rsa_456',
        publicKeyPath: '/home/user/.ssh/id_rsa_456.pub',
        fingerprint: 'SHA256:def456ghi789',
        algorithm: 'rsa',
        bits: 4096,
      };
      vi.spyOn(keyManager, 'generateKey').mockResolvedValue(mockKeyPair);

      const response = await keyManagementTools.generateKey({
        algorithm: 'rsa',
        bits: 4096,
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.algorithm).toBe('rsa');
        expect(data.bits).toBe(4096);
      }
    });

    it('should generate ed25519 key', async () => {
      // Mock generateKey
      const mockKeyPair: KeyPair = {
        privateKeyPath: '/home/user/.ssh/id_ed25519_789',
        publicKeyPath: '/home/user/.ssh/id_ed25519_789.pub',
        fingerprint: 'SHA256:ghi789jkl012',
        algorithm: 'ed25519',
        bits: 256,
      };
      vi.spyOn(keyManager, 'generateKey').mockResolvedValue(mockKeyPair);

      const response = await keyManagementTools.generateKey({
        algorithm: 'ed25519',
        bits: 256,
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.algorithm).toBe('ed25519');
      }
    });

    it('should generate key with passphrase', async () => {
      // Mock generateKey
      const mockKeyPair: KeyPair = {
        privateKeyPath: '/home/user/.ssh/id_rsa_secure',
        publicKeyPath: '/home/user/.ssh/id_rsa_secure.pub',
        fingerprint: 'SHA256:secure123',
        algorithm: 'rsa',
        bits: 2048,
      };
      const generateSpy = vi
        .spyOn(keyManager, 'generateKey')
        .mockResolvedValue(mockKeyPair);

      await keyManagementTools.generateKey({
        algorithm: 'rsa',
        bits: 2048,
        passphrase: 'my-secret-passphrase',
      });

      // Verify passphrase was passed
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          passphrase: 'my-secret-passphrase',
        })
      );
    });
  });

  describe('ssh_list_keys', () => {
    it('should list all SSH keys', async () => {
      // Mock listKeys to return keys
      const mockKeys: KeyInfo[] = [
        {
          path: '/home/user/.ssh/id_rsa',
          type: 'rsa',
          bits: 2048,
          fingerprint: 'SHA256:abc123',
          comment: 'user@host',
        },
        {
          path: '/home/user/.ssh/id_ed25519',
          type: 'ed25519',
          bits: 256,
          fingerprint: 'SHA256:def456',
          comment: 'user@laptop',
        },
      ];
      vi.spyOn(keyManager, 'listKeys').mockResolvedValue(mockKeys);

      const response = await keyManagementTools.listKeys();

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check key list (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.keys).toHaveLength(2);
        expect(data.count).toBe(2);
        expect(data.keys[0].type).toBe('rsa');
        expect(data.keys[1].type).toBe('ed25519');
      }
    });

    it('should handle empty key list', async () => {
      // Mock listKeys to return empty array
      vi.spyOn(keyManager, 'listKeys').mockResolvedValue([]);

      const response = await keyManagementTools.listKeys();

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.keys).toHaveLength(0);
        expect(data.count).toBe(0);
      }
    });

    it('should pass directory parameter to KeyManager', async () => {
      // Mock listKeys
      const mockKeys: KeyInfo[] = [];
      const listSpy = vi
        .spyOn(keyManager, 'listKeys')
        .mockResolvedValue(mockKeys);

      await keyManagementTools.listKeys({ directory: '/custom/ssh/dir' });

      // Verify listKeys was called with directory
      expect(listSpy).toHaveBeenCalledWith('/custom/ssh/dir');
    });

    it('should handle list errors', async () => {
      // Mock listKeys to throw error
      vi.spyOn(keyManager, 'listKeys').mockRejectedValue(
        new Error('Directory not found')
      );

      const response = await keyManagementTools.listKeys();

      expect(response.isError).toBe(true);
    });

    it('should list keys with complete metadata', async () => {
      // Mock listKeys with detailed key info
      const mockKeys: KeyInfo[] = [
        {
          path: '/home/user/.ssh/id_ecdsa',
          type: 'ecdsa',
          bits: 521,
          fingerprint: 'SHA256:ecdsa123',
          comment: 'ecdsa key',
        },
      ];
      vi.spyOn(keyManager, 'listKeys').mockResolvedValue(mockKeys);

      const response = await keyManagementTools.listKeys();

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.keys[0].path).toBe('/home/user/.ssh/id_ecdsa');
        expect(data.keys[0].type).toBe('ecdsa');
        expect(data.keys[0].bits).toBe(521);
        expect(data.keys[0].fingerprint).toBe('SHA256:ecdsa123');
        expect(data.keys[0].comment).toBe('ecdsa key');
      }
    });
  });

  describe('ssh_fingerprint', () => {
    it('should get key fingerprint', async () => {
      // Mock getFingerprint to return fingerprint
      vi.spyOn(keyManager, 'getFingerprint').mockResolvedValue(
        'SHA256:abc123def456ghi789'
      );

      const response = await keyManagementTools.getFingerprint({
        keyPath: '/home/user/.ssh/id_rsa',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check fingerprint (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.keyPath).toBe('/home/user/.ssh/id_rsa');
        expect(data.fingerprint).toBe('SHA256:abc123def456ghi789');
      }
    });

    it('should pass key path to KeyManager', async () => {
      // Mock getFingerprint
      const fingerprintSpy = vi
        .spyOn(keyManager, 'getFingerprint')
        .mockResolvedValue('SHA256:test123');

      await keyManagementTools.getFingerprint({
        keyPath: '/custom/path/my_key',
      });

      // Verify getFingerprint was called with correct path
      expect(fingerprintSpy).toHaveBeenCalledWith('/custom/path/my_key');
    });

    it('should handle fingerprint errors', async () => {
      // Mock getFingerprint to throw error
      vi.spyOn(keyManager, 'getFingerprint').mockRejectedValue(
        new Error('Invalid key file')
      );

      const response = await keyManagementTools.getFingerprint({
        keyPath: '/invalid/path',
      });

      expect(response.isError).toBe(true);
    });

    it('should get fingerprint for public key', async () => {
      // Mock getFingerprint
      vi.spyOn(keyManager, 'getFingerprint').mockResolvedValue(
        'SHA256:pubkey123'
      );

      const response = await keyManagementTools.getFingerprint({
        keyPath: '/home/user/.ssh/id_rsa.pub',
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.fingerprint).toBe('SHA256:pubkey123');
      }
    });

    it('should get fingerprint for different key types', async () => {
      // Mock getFingerprint for ed25519
      vi.spyOn(keyManager, 'getFingerprint').mockResolvedValue(
        'SHA256:ed25519fingerprint'
      );

      const response = await keyManagementTools.getFingerprint({
        keyPath: '/home/user/.ssh/id_ed25519',
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content[1];
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.fingerprint).toBe('SHA256:ed25519fingerprint');
      }
    });
  });

  describe('multiple operations', () => {
    it('should handle multiple key operations in sequence', async () => {
      // Mock all operations
      const mockKeyPair: KeyPair = {
        privateKeyPath: '/home/user/.ssh/id_rsa_new',
        publicKeyPath: '/home/user/.ssh/id_rsa_new.pub',
        fingerprint: 'SHA256:new123',
        algorithm: 'rsa',
        bits: 2048,
      };
      const mockKeys: KeyInfo[] = [
        {
          path: '/home/user/.ssh/id_rsa_new',
          type: 'rsa',
          bits: 2048,
          fingerprint: 'SHA256:new123',
          comment: 'new key',
        },
      ];

      vi.spyOn(keyManager, 'generateKey').mockResolvedValue(mockKeyPair);
      vi.spyOn(keyManager, 'listKeys').mockResolvedValue(mockKeys);
      vi.spyOn(keyManager, 'getFingerprint').mockResolvedValue('SHA256:new123');

      // Execute operations
      const generateResponse = await keyManagementTools.generateKey({
        algorithm: 'rsa',
        bits: 2048,
      });
      expect(generateResponse.isError).toBeUndefined();

      const listResponse = await keyManagementTools.listKeys();
      expect(listResponse.isError).toBeUndefined();

      const fingerprintResponse = await keyManagementTools.getFingerprint({
        keyPath: '/home/user/.ssh/id_rsa_new',
      });
      expect(fingerprintResponse.isError).toBeUndefined();
    });
  });
});
