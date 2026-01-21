/**
 * Unit tests for SecurityUtils
 * 
 * Tests specific edge cases and patterns for sensitive data scrubbing.
 * These tests complement the property-based tests with concrete examples.
 */

import { describe, it, expect } from 'vitest';
import {
  scrubSensitiveData,
  scrubCommandArgs,
  scrubError,
  containsSensitiveData,
} from '../../src/core/SecurityUtils.js';

describe('SecurityUtils Unit Tests', () => {
  describe('scrubSensitiveData', () => {
    describe('passphrase patterns', () => {
      it('should scrub passphrase with colon separator', () => {
        const input = 'Enter passphrase: mysecret123';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('mysecret123');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub passphrase with space separator', () => {
        const input = 'passphrase mysecret123';
        const result = scrubSensitiveData(input);
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub multiple passphrases in same string', () => {
        const input = 'passphrase: secret1 and passphrase: secret2';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('secret1');
        expect(result).not.toContain('secret2');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub passphrase with special characters', () => {
        const input = 'passphrase: p@$$w0rd!#$%';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('p@$$w0rd!#$%');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub passphrase with unicode characters', () => {
        const input = 'passphrase: пароль密码';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('пароль密码');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub ssh-keygen -N flag with passphrase', () => {
        const input = 'ssh-keygen -t rsa -N mysecret';
        const result = scrubSensitiveData(input);
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub ssh-keygen -N flag with quoted passphrase', () => {
        const input = 'ssh-keygen -t rsa -N "my secret"';
        const result = scrubSensitiveData(input);
        expect(result).toContain('[REDACTED]');
      });
    });

    describe('password patterns', () => {
      it('should scrub password with colon separator', () => {
        const input = 'Enter password: mypassword';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('mypassword');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub passwd variant', () => {
        const input = 'passwd: mypassword';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('mypassword');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub password prompt', () => {
        const input = 'Enter password for user@host: secret123';
        const result = scrubSensitiveData(input);
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub environment variable PASSWORD', () => {
        const input = 'PASSWORD=mysecret123';
        const result = scrubSensitiveData(input);
        expect(result).toBe('PASSWORD=[REDACTED]');
      });
    });

    describe('private key patterns', () => {
      it('should scrub RSA private key', () => {
        const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef
ghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;
        const result = scrubSensitiveData(privateKey);
        expect(result).toBe('[PRIVATE KEY REDACTED]');
        expect(result).not.toContain('MIIEpAIBAAKCAQEA');
      });

      it('should scrub EC private key', () => {
        const privateKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbcdef1234567890
-----END EC PRIVATE KEY-----`;
        const result = scrubSensitiveData(privateKey);
        expect(result).toBe('[PRIVATE KEY REDACTED]');
      });

      it('should scrub DSA private key', () => {
        const privateKey = `-----BEGIN DSA PRIVATE KEY-----
MIIBugIBAAKBgQC1234567890
-----END DSA PRIVATE KEY-----`;
        const result = scrubSensitiveData(privateKey);
        expect(result).toBe('[PRIVATE KEY REDACTED]');
      });

      it('should scrub OPENSSH private key', () => {
        const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
-----END OPENSSH PRIVATE KEY-----`;
        const result = scrubSensitiveData(privateKey);
        expect(result).toBe('[PRIVATE KEY REDACTED]');
      });

      it('should scrub private key in error message', () => {
        const input = `Failed to load key: -----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890
-----END RSA PRIVATE KEY-----`;
        const result = scrubSensitiveData(input);
        expect(result).toContain('Failed to load key:');
        expect(result).toContain('[PRIVATE KEY REDACTED]');
        expect(result).not.toContain('MIIEpAIBAAKCAQEA');
      });
    });

    describe('token and secret patterns', () => {
      it('should scrub token with colon', () => {
        const input = 'token: abc123xyz';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('abc123xyz');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub secret with colon', () => {
        const input = 'secret: mysecretvalue';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('mysecretvalue');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub api_key', () => {
        const input = 'api_key: sk-1234567890abcdef';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('sk-1234567890abcdef');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub api-key with hyphen', () => {
        const input = 'api-key: sk-1234567890abcdef';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('sk-1234567890abcdef');
        expect(result).toContain('[REDACTED]');
      });

      it('should scrub TOKEN environment variable', () => {
        const input = 'TOKEN=abc123xyz';
        const result = scrubSensitiveData(input);
        expect(result).toBe('TOKEN=[REDACTED]');
      });

      it('should scrub SECRET environment variable', () => {
        const input = 'SECRET=mysecret';
        const result = scrubSensitiveData(input);
        expect(result).toBe('SECRET=[REDACTED]');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = scrubSensitiveData('');
        expect(result).toBe('');
      });

      it('should handle string with no sensitive data', () => {
        const input = 'Connection established successfully';
        const result = scrubSensitiveData(input);
        expect(result).toBe(input);
      });

      it('should preserve error message structure', () => {
        const input = 'Error: Authentication failed - passphrase: wrongpass';
        const result = scrubSensitiveData(input);
        expect(result).toContain('Error: Authentication failed');
        expect(result).toContain('[REDACTED]');
        expect(result).not.toContain('wrongpass');
      });

      it('should handle very long strings', () => {
        const longString = 'a'.repeat(10000) + ' passphrase: secret ' + 'b'.repeat(10000);
        const result = scrubSensitiveData(longString);
        expect(result).toContain('[REDACTED]');
        expect(result).not.toContain('passphrase: secret');
      });

      it('should handle multiple types of sensitive data', () => {
        const input = 'passphrase: pass1 password: pass2 token: tok1 secret: sec1';
        const result = scrubSensitiveData(input);
        expect(result).not.toContain('pass1');
        expect(result).not.toContain('pass2');
        expect(result).not.toContain('tok1');
        expect(result).not.toContain('sec1');
        expect(result).toContain('[REDACTED]');
      });

      it('should handle newlines in sensitive data', () => {
        const input = 'passphrase: line1\nline2\npassword: pass2';
        const result = scrubSensitiveData(input);
        expect(result).toContain('[REDACTED]');
      });

      it('should handle case-insensitive patterns', () => {
        const input = 'PASSPHRASE: secret123 PASSWORD: mypass456 TOKEN: tok789';
        const result = scrubSensitiveData(input);
        expect(result).toContain('[REDACTED]');
        expect(result).not.toContain('secret123');
        expect(result).not.toContain('mypass456');
        expect(result).not.toContain('tok789');
      });
    });
  });

  describe('scrubCommandArgs', () => {
    it('should scrub -N flag argument', () => {
      const args = ['ssh-keygen', '-t', 'rsa', '-N', 'mysecret'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(['ssh-keygen', '-t', 'rsa', '-N', '[REDACTED]']);
    });

    it('should scrub --passphrase flag argument', () => {
      const args = ['ssh-keygen', '--passphrase', 'mysecret'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(['ssh-keygen', '--passphrase', '[REDACTED]']);
    });

    it('should scrub --password flag argument', () => {
      const args = ['ssh', '--password', 'mypass'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(['ssh', '--password', '[REDACTED]']);
    });

    it('should handle multiple sensitive flags', () => {
      const args = ['cmd', '-N', 'pass1', '--password', 'pass2'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(['cmd', '-N', '[REDACTED]', '--password', '[REDACTED]']);
    });

    it('should not modify non-sensitive arguments', () => {
      const args = ['ssh-keygen', '-t', 'rsa', '-b', '4096', '-f', '/path/to/key'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(args);
    });

    it('should handle empty array', () => {
      const args: string[] = [];
      const result = scrubCommandArgs(args);
      expect(result).toEqual([]);
    });

    it('should handle single argument', () => {
      const args = ['ssh-keygen'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(['ssh-keygen']);
    });

    it('should handle sensitive flag at end (no value to redact)', () => {
      const args = ['ssh-keygen', '-t', 'rsa', '-N'];
      const result = scrubCommandArgs(args);
      expect(result).toEqual(['ssh-keygen', '-t', 'rsa', '-N']);
    });
  });

  describe('scrubError', () => {
    it('should scrub error message', () => {
      const error = new Error('Authentication failed: passphrase: wrongpass');
      const result = scrubError(error);
      expect(result.message).toContain('[REDACTED]');
      expect(result.message).not.toContain('wrongpass');
    });

    it('should preserve error name', () => {
      const error = new Error('passphrase: secret');
      error.name = 'AuthenticationError';
      const result = scrubError(error);
      expect(result.name).toBe('AuthenticationError');
    });

    it('should preserve error stack', () => {
      const error = new Error('passphrase: secret');
      const originalStack = error.stack;
      const result = scrubError(error);
      expect(result.stack).toBe(originalStack);
    });

    it('should handle error with no sensitive data', () => {
      const error = new Error('Connection timeout');
      const result = scrubError(error);
      expect(result.message).toBe('Connection timeout');
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect passphrase pattern', () => {
      expect(containsSensitiveData('passphrase: secret')).toBe(true);
    });

    it('should detect password pattern', () => {
      expect(containsSensitiveData('password: secret')).toBe(true);
    });

    it('should detect private key', () => {
      const key = '-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----';
      expect(containsSensitiveData(key)).toBe(true);
    });

    it('should detect token pattern', () => {
      expect(containsSensitiveData('token: abc123')).toBe(true);
    });

    it('should detect secret pattern', () => {
      expect(containsSensitiveData('secret: xyz789')).toBe(true);
    });

    it('should detect api_key pattern', () => {
      expect(containsSensitiveData('api_key: sk-123')).toBe(true);
    });

    it('should detect environment variables', () => {
      expect(containsSensitiveData('PASSWORD=secret')).toBe(true);
      expect(containsSensitiveData('TOKEN=abc')).toBe(true);
      expect(containsSensitiveData('SECRET=xyz')).toBe(true);
    });

    it('should return false for non-sensitive data', () => {
      expect(containsSensitiveData('Connection established')).toBe(false);
      expect(containsSensitiveData('Error: timeout')).toBe(false);
      expect(containsSensitiveData('Host: example.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsSensitiveData('')).toBe(false);
    });

    it('should handle case-insensitive patterns', () => {
      expect(containsSensitiveData('PASSPHRASE: secret')).toBe(true);
      expect(containsSensitiveData('PASSWORD: secret')).toBe(true);
    });
  });

  describe('scrubbing does not break error messages', () => {
    it('should preserve SSH error structure', () => {
      const input = 'ssh: connect to host example.com port 22: Connection refused';
      const result = scrubSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should preserve authentication error with scrubbed passphrase', () => {
      const input = 'Permission denied (publickey). passphrase: wrongpass';
      const result = scrubSensitiveData(input);
      expect(result).toContain('Permission denied (publickey)');
      expect(result).toContain('[REDACTED]');
    });

    it('should preserve host key error', () => {
      const input = 'Host key verification failed.';
      const result = scrubSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should preserve timeout error', () => {
      const input = 'ssh: connect to host example.com port 22: Connection timed out';
      const result = scrubSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should preserve DNS error', () => {
      const input = 'ssh: Could not resolve hostname example.com: Name or service not known';
      const result = scrubSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should preserve network unreachable error', () => {
      const input = 'ssh: connect to host example.com port 22: Network is unreachable';
      const result = scrubSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should preserve multi-line error messages', () => {
      const input = `Error: Connection failed
Host: example.com
Port: 22
Reason: Connection refused`;
      const result = scrubSensitiveData(input);
      expect(result).toBe(input);
    });

    it('should preserve error with scrubbed sensitive data', () => {
      const input = `Error: Authentication failed
User: testuser
passphrase: wrongpass
Host: example.com`;
      const result = scrubSensitiveData(input);
      expect(result).toContain('Error: Authentication failed');
      expect(result).toContain('User: testuser');
      expect(result).toContain('Host: example.com');
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('wrongpass');
    });
  });
});
