/**
 * Unit tests for SSHWrapper error parsing
 * 
 * Tests the parseSSHError() method with various SSH error messages
 * to ensure correct error type classification and message extraction.
 * 
 * Validates: Requirements 1.4, 8.1, 8.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { ErrorInfo } from '../../src/core/types.js';

describe('SSHWrapper - Error Parsing', () => {
  let wrapper: SSHWrapper;

  beforeEach(() => {
    wrapper = new SSHWrapper();
  });

  describe('parseSSHError', () => {
    describe('AUTH_FAILED errors', () => {
      it('should detect public key authentication failure', () => {
        const stderr = 'Permission denied (publickey).';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Public key authentication failed');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should detect password authentication failure', () => {
        const stderr = 'Permission denied (password).';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Password authentication failed');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should detect generic permission denied', () => {
        const stderr = 'Permission denied, please try again.';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Authentication failed');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should handle case-insensitive matching for auth errors', () => {
        const stderr = 'permission denied (PUBLICKEY).';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Public key authentication failed');
      });

      it('should detect auth failure in multi-line output', () => {
        const stderr = `Authenticated to example.com ([192.168.1.1]:22).
debug1: Authentication succeeded (publickey).
Permission denied (publickey,password).
Connection closed by 192.168.1.1 port 22`;
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.rawOutput).toBe(stderr);
      });
    });

    describe('CONNECTION_REFUSED errors', () => {
      it('should detect connection refused', () => {
        const stderr = 'ssh: connect to host example.com port 22: Connection refused';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('CONNECTION_REFUSED');
        expect(error.message).toBe('Remote host refused connection');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should handle case-insensitive matching for connection refused', () => {
        const stderr = 'CONNECTION REFUSED by remote host';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('CONNECTION_REFUSED');
        expect(error.message).toBe('Remote host refused connection');
      });
    });

    describe('HOST_KEY_MISMATCH errors', () => {
      it('should detect host key verification failure', () => {
        const stderr = 'Host key verification failed.';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('HOST_KEY_MISMATCH');
        expect(error.message).toBe('Host key does not match known_hosts');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should detect remote host identification changed', () => {
        const stderr = `@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!`;
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('HOST_KEY_MISMATCH');
        expect(error.message).toBe('Remote host identification has changed');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should handle case-insensitive matching for host key errors', () => {
        const stderr = 'host key verification FAILED.';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('HOST_KEY_MISMATCH');
      });
    });

    describe('TIMEOUT errors', () => {
      it('should detect connection timeout', () => {
        const stderr = 'ssh: connect to host example.com port 22: Connection timed out';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('TIMEOUT');
        expect(error.message).toBe('Connection attempt timed out');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should detect operation timeout', () => {
        const stderr = 'ssh: Operation timed out';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('TIMEOUT');
        expect(error.message).toBe('Operation timed out');
      });

      it('should detect server not responding', () => {
        const stderr = 'Timeout, server example.com not responding.';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('TIMEOUT');
        expect(error.message).toBe('Server not responding');
      });

      it('should handle case-insensitive matching for timeout errors', () => {
        const stderr = 'CONNECTION TIMED OUT';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('TIMEOUT');
      });
    });

    describe('NETWORK_UNREACHABLE errors', () => {
      it('should detect no route to host', () => {
        const stderr = 'ssh: connect to host example.com port 22: No route to host';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('NETWORK_UNREACHABLE');
        expect(error.message).toBe('Network route to host not available');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should detect network unreachable', () => {
        const stderr = 'ssh: connect to host example.com port 22: Network is unreachable';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('NETWORK_UNREACHABLE');
        expect(error.message).toBe('Network is unreachable');
      });

      it('should handle case-insensitive matching for network errors', () => {
        const stderr = 'NO ROUTE TO HOST';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('NETWORK_UNREACHABLE');
      });
    });

    describe('DNS_FAILED errors', () => {
      it('should detect name or service not known', () => {
        const stderr = 'ssh: Could not resolve hostname example.com: Name or service not known';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('DNS_FAILED');
        expect(error.message).toBe('Hostname could not be resolved');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should detect could not resolve hostname', () => {
        const stderr = 'ssh: Could not resolve hostname badhost.example.com: nodename nor servname provided, or not known';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('DNS_FAILED');
        expect(error.message).toBe('Could not resolve hostname');
      });

      it('should detect temporary DNS failure', () => {
        const stderr = 'ssh: Could not resolve hostname example.com: Temporary failure in name resolution';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('DNS_FAILED');
        expect(error.message).toBe('DNS resolution failed temporarily');
      });

      it('should handle case-insensitive matching for DNS errors', () => {
        const stderr = 'NAME OR SERVICE NOT KNOWN';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('DNS_FAILED');
      });
    });

    describe('UNKNOWN errors', () => {
      it('should classify unrecognized errors as UNKNOWN', () => {
        const stderr = 'Some unexpected error message';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('UNKNOWN');
        expect(error.message).toBe('SSH operation failed');
        expect(error.rawOutput).toBe(stderr);
      });

      it('should handle empty stderr', () => {
        const stderr = '';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('UNKNOWN');
        expect(error.message).toBe('SSH operation failed');
        expect(error.rawOutput).toBe('');
      });

      it('should preserve raw output for unknown errors', () => {
        const stderr = 'This is a very specific error that we do not recognize';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('UNKNOWN');
        expect(error.rawOutput).toBe(stderr);
      });
    });

    describe('Pattern priority', () => {
      it('should match the first pattern when multiple patterns could match', () => {
        // This message contains both "Permission denied" and "publickey"
        // Should match the more specific "publickey" pattern first
        const stderr = 'Permission denied (publickey,password).';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Public key authentication failed');
      });

      it('should fall back to generic pattern if specific pattern does not match', () => {
        // This message contains "Permission denied" but not "publickey" or "password"
        const stderr = 'Permission denied (keyboard-interactive).';
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Authentication failed');
      });
    });

    describe('Real-world error messages', () => {
      it('should parse typical SSH connection refused error', () => {
        const stderr = `ssh: connect to host 192.168.1.100 port 22: Connection refused`;
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('CONNECTION_REFUSED');
      });

      it('should parse typical SSH timeout error', () => {
        const stderr = `ssh: connect to host example.com port 22: Connection timed out`;
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('TIMEOUT');
      });

      it('should parse typical SSH auth failure with verbose output', () => {
        const stderr = `debug1: Authentications that can continue: publickey,password
debug1: Next authentication method: publickey
debug1: Offering public key: /home/user/.ssh/id_rsa RSA SHA256:abc123
debug1: Authentications that can continue: publickey,password
debug1: Trying private key: /home/user/.ssh/id_rsa
debug1: Authentications that can continue: publickey,password
debug1: Next authentication method: password
Permission denied (publickey,password).`;
        const error = wrapper.parseSSHError(stderr);

        // The error should be detected even with verbose debug output
        // The pattern should match "Permission denied (publickey,password)" in the output
        expect(error.type).toBe('AUTH_FAILED');
        expect(error.message).toBe('Public key authentication failed');
      });

      it('should parse typical DNS resolution failure', () => {
        const stderr = `ssh: Could not resolve hostname nonexistent.example.com: Name or service not known`;
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('DNS_FAILED');
      });

      it('should parse typical host key mismatch warning', () => {
        const stderr = `@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
Someone could be eavesdropping on you right now (man-in-the-middle attack)!
It is also possible that a host key has just been changed.
The fingerprint for the RSA key sent by the remote host is
SHA256:abc123def456.
Please contact your system administrator.
Add correct host key in /home/user/.ssh/known_hosts to get rid of this message.
Offending RSA key in /home/user/.ssh/known_hosts:42
Host key verification failed.`;
        const error = wrapper.parseSSHError(stderr);

        expect(error.type).toBe('HOST_KEY_MISMATCH');
      });
    });
  });
});
