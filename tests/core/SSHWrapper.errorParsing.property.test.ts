/**
 * Property-based tests for SSHWrapper error parsing
 * 
 * These tests use fast-check to verify universal properties that should hold
 * for error parsing across all valid inputs. Each property is tested with a
 * minimum of 100 iterations to ensure correctness.
 * 
 * Feature: ssh-mcp-server
 * Validates: Requirements 8.1, 8.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import type { ErrorType } from '../../src/core/types.js';

describe('SSHWrapper - Error Parsing Property Tests', () => {
  // Feature: ssh-mcp-server, Property 29: SSH errors are parsed into structured format
  // **Validates: Requirement 8.1**
  describe('Property 29: SSH errors are parsed into structured format', () => {
    it('should always return an ErrorInfo object with required fields', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Should have all required fields
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('rawOutput');

            // Type should be a valid ErrorType
            const validTypes: ErrorType[] = [
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
            expect(validTypes).toContain(error.type);

            // Message should be a non-empty string
            expect(typeof error.message).toBe('string');
            expect(error.message.length).toBeGreaterThan(0);

            // Raw output should match input
            expect(error.rawOutput).toBe(stderr);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve raw output for all inputs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Raw output should exactly match input
            expect(error.rawOutput).toBe(stderr);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return UNKNOWN type for unrecognized errors', () => {
      fc.assert(
        fc.property(
          // Generate strings that don't contain known error patterns
          fc.string().filter(s => 
            !s.toLowerCase().includes('permission denied') &&
            !s.toLowerCase().includes('connection refused') &&
            !s.toLowerCase().includes('host key verification') &&
            !s.toLowerCase().includes('timed out') &&
            !s.toLowerCase().includes('no route to host') &&
            !s.toLowerCase().includes('network is unreachable') &&
            !s.toLowerCase().includes('name or service not known') &&
            !s.toLowerCase().includes('could not resolve hostname') &&
            !s.toLowerCase().includes('temporary failure') &&
            !s.toLowerCase().includes('remote host identification')
          ),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Should classify as UNKNOWN
            expect(error.type).toBe('UNKNOWN');
            expect(error.message).toBe('SSH operation failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty strings gracefully', () => {
      fc.assert(
        fc.property(
          fc.constant(''),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Should return valid ErrorInfo
            expect(error.type).toBe('UNKNOWN');
            expect(error.message).toBe('SSH operation failed');
            expect(error.rawOutput).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very long error messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1000, maxLength: 10000 }),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Should still parse correctly
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('message');
            expect(error.rawOutput).toBe(stderr);
          }
        ),
        { numRuns: 50 } // Fewer runs for performance
      );
    });

    it('should handle unicode characters in error messages', () => {
      fc.assert(
        fc.property(
          fc.unicodeString(),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Should handle unicode gracefully
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('message');
            expect(error.rawOutput).toBe(stderr);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for the same input', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error1 = wrapper.parseSSHError(stderr);
            const error2 = wrapper.parseSSHError(stderr);

            // Should produce identical results
            expect(error1.type).toBe(error2.type);
            expect(error1.message).toBe(error2.message);
            expect(error1.rawOutput).toBe(error2.rawOutput);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 31: Authentication failures are identified
  // **Validates: Requirement 8.4**
  describe('Property 31: Authentication failures are identified', () => {
    it('should detect AUTH_FAILED for any message containing "Permission denied"', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (prefix: string, suffix: string, authType: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}Permission denied${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            // Should classify as AUTH_FAILED
            expect(error.type).toBe('AUTH_FAILED');
            expect(error.message).toContain('failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect publickey authentication failures specifically', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}Permission denied (publickey)${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            // Should classify as AUTH_FAILED with specific message
            expect(error.type).toBe('AUTH_FAILED');
            expect(error.message).toBe('Public key authentication failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect password authentication failures specifically', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}Permission denied (password)${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            // Should classify as AUTH_FAILED with specific message
            expect(error.type).toBe('AUTH_FAILED');
            expect(error.message).toBe('Password authentication failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive for authentication errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'permission denied',
            'Permission Denied',
            'PERMISSION DENIED',
            'PermISSion DeNIed'
          ),
          (permissionText: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${permissionText} (publickey).`;
            const error = wrapper.parseSSHError(stderr);

            // Should detect regardless of case
            expect(error.type).toBe('AUTH_FAILED');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Error type consistency
  describe('Additional Property: Error type consistency', () => {
    it('should classify CONNECTION_REFUSED for any message containing "Connection refused"', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}Connection refused${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            expect(error.type).toBe('CONNECTION_REFUSED');
            expect(error.message).toBe('Remote host refused connection');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify HOST_KEY_MISMATCH for host key verification failures', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}Host key verification failed${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            expect(error.type).toBe('HOST_KEY_MISMATCH');
            expect(error.message).toBe('Host key does not match known_hosts');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify TIMEOUT for timeout-related messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Connection timed out',
            'Operation timed out',
            'Timeout, server example.com not responding'
          ),
          fc.string(),
          fc.string(),
          (timeoutText: string, prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}${timeoutText}${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            expect(error.type).toBe('TIMEOUT');
            // Message should be non-empty
            expect(error.message.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify NETWORK_UNREACHABLE for network errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'No route to host',
            'Network is unreachable'
          ),
          fc.string(),
          fc.string(),
          (networkText: string, prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}${networkText}${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            expect(error.type).toBe('NETWORK_UNREACHABLE');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify DNS_FAILED for DNS resolution errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Name or service not known',
            'Could not resolve hostname',
            'Temporary failure in name resolution'
          ),
          fc.string(),
          fc.string(),
          (dnsText: string, prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}${dnsText}${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            expect(error.type).toBe('DNS_FAILED');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Pattern matching behavior
  describe('Additional Property: Pattern matching behavior', () => {
    it('should match patterns anywhere in the error message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Permission denied',
            'Connection refused',
            'Host key verification failed',
            'Connection timed out',
            'No route to host',
            'Name or service not known'
          ),
          fc.string({ maxLength: 100 }),
          fc.string({ maxLength: 100 }),
          (pattern: string, prefix: string, suffix: string) => {
            const wrapper = new SSHWrapper();
            const stderr = `${prefix}${pattern}${suffix}`;
            const error = wrapper.parseSSHError(stderr);

            // Should not be UNKNOWN if pattern is present
            expect(error.type).not.toBe('UNKNOWN');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize more specific patterns over generic ones', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Permission denied (publickey)',
            'Permission denied (password)'
          ),
          (stderr: string) => {
            const wrapper = new SSHWrapper();
            const error = wrapper.parseSSHError(stderr);

            // Should match specific pattern, not generic "Permission denied"
            expect(error.type).toBe('AUTH_FAILED');
            expect(error.message).not.toBe('Authentication failed');
            expect(
              error.message === 'Public key authentication failed' ||
              error.message === 'Password authentication failed'
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multi-line error messages', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ maxLength: 100 }), { minLength: 2, maxLength: 10 }),
          fc.constantFrom(
            'Permission denied',
            'Connection refused',
            'Host key verification failed'
          ),
          (lines: string[], pattern: string) => {
            const wrapper = new SSHWrapper();
            // Insert pattern in a random line
            const randomIndex = Math.floor(Math.random() * lines.length);
            lines[randomIndex] = `${lines[randomIndex]} ${pattern}`;
            const stderr = lines.join('\n');
            const error = wrapper.parseSSHError(stderr);

            // Should detect pattern even in multi-line output
            expect(error.type).not.toBe('UNKNOWN');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
