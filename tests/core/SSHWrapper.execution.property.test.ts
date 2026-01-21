/**
 * Property-based tests for SSHWrapper command execution
 * 
 * These tests verify the execution properties of SSH commands:
 * - Property 15: Command execution returns all outputs
 * - Property 16: Connection failures capture stderr
 * 
 * Feature: ssh-mcp-server
 * Validates: Requirements 1.4, 2.1
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import type { Session, CommandResult } from '../../src/core/types.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('SSHWrapper - Command Execution Property Tests', () => {
  let wrapper: SSHWrapper;

  // Helper to create a basic session for testing
  const createBasicSession = (overrides?: Partial<Session>): Session => ({
    id: 'test-session-123',
    host: 'example.com',
    port: 22,
    username: 'testuser',
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
  });

  beforeEach(() => {
    wrapper = new SSHWrapper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: ssh-mcp-server, Property 15: Command execution returns all outputs
  // **Validates: Requirement 2.1**
  describe('Property 15: Command execution returns all outputs', () => {
    it('should return stdout, stderr, and exit code for any command execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }), // stdout
          fc.string({ minLength: 0, maxLength: 1000 }), // stderr
          fc.integer({ min: 0, max: 255 }), // exit code
          fc.string({ minLength: 1, maxLength: 100 }), // command
          async (stdout: string, stderr: string, exitCode: number, command: string) => {
            // Mock the spawn function to simulate command execution
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            // Execute the command
            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Simulate stdout data
            if (stdout) {
              mockChild.stdout.emit('data', Buffer.from(stdout));
            }

            // Simulate stderr data
            if (stderr) {
              mockChild.stderr.emit('data', Buffer.from(stderr));
            }

            // Simulate process completion
            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;

            // Verify all outputs are present
            expect(result).toBeDefined();
            expect(result.stdout).toBe(stdout);
            expect(result.stderr).toBe(stderr);
            expect(result.exitCode).toBe(exitCode);
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(typeof result.duration).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all outputs even when stdout is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }), // stderr
          fc.integer({ min: 0, max: 255 }), // exit code
          fc.string({ minLength: 1, maxLength: 100 }), // command
          async (stderr: string, exitCode: number, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Only emit stderr, no stdout
            if (stderr) {
              mockChild.stderr.emit('data', Buffer.from(stderr));
            }

            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;

            expect(result.stdout).toBe('');
            expect(result.stderr).toBe(stderr);
            expect(result.exitCode).toBe(exitCode);
            expect(result.duration).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all outputs even when stderr is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }), // stdout
          fc.integer({ min: 0, max: 255 }), // exit code
          fc.string({ minLength: 1, maxLength: 100 }), // command
          async (stdout: string, exitCode: number, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Only emit stdout, no stderr
            if (stdout) {
              mockChild.stdout.emit('data', Buffer.from(stdout));
            }

            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;

            expect(result.stdout).toBe(stdout);
            expect(result.stderr).toBe('');
            expect(result.exitCode).toBe(exitCode);
            expect(result.duration).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accumulate multiple stdout chunks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 255 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (stdoutChunks: string[], exitCode: number, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Emit multiple stdout chunks
            for (const chunk of stdoutChunks) {
              mockChild.stdout.emit('data', Buffer.from(chunk));
            }

            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;

            // All chunks should be concatenated
            const expectedStdout = stdoutChunks.join('');
            expect(result.stdout).toBe(expectedStdout);
            expect(result.exitCode).toBe(exitCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accumulate multiple stderr chunks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 255 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (stderrChunks: string[], exitCode: number, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Emit multiple stderr chunks
            for (const chunk of stderrChunks) {
              mockChild.stderr.emit('data', Buffer.from(chunk));
            }

            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;

            // All chunks should be concatenated
            const expectedStderr = stderrChunks.join('');
            expect(result.stderr).toBe(expectedStderr);
            expect(result.exitCode).toBe(exitCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle interleaved stdout and stderr chunks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.constantFrom('stdout', 'stderr'),
              data: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          fc.integer({ min: 0, max: 255 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (chunks: Array<{ type: string; data: string }>, exitCode: number, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Emit chunks in order
            for (const chunk of chunks) {
              if (chunk.type === 'stdout') {
                mockChild.stdout.emit('data', Buffer.from(chunk.data));
              } else {
                mockChild.stderr.emit('data', Buffer.from(chunk.data));
              }
            }

            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;

            // Verify stdout and stderr are correctly separated
            const expectedStdout = chunks
              .filter(c => c.type === 'stdout')
              .map(c => c.data)
              .join('');
            const expectedStderr = chunks
              .filter(c => c.type === 'stderr')
              .map(c => c.data)
              .join('');

            expect(result.stdout).toBe(expectedStdout);
            expect(result.stderr).toBe(expectedStderr);
            expect(result.exitCode).toBe(exitCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return -1 exit code when process exits with null code', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 1000 }),
          fc.string({ minLength: 0, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (stdout: string, stderr: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            if (stdout) mockChild.stdout.emit('data', Buffer.from(stdout));
            if (stderr) mockChild.stderr.emit('data', Buffer.from(stderr));

            setImmediate(() => {
              mockChild.emit('close', null); // null exit code
            });

            const result = await resultPromise;

            expect(result.exitCode).toBe(-1);
            expect(result.stdout).toBe(stdout);
            expect(result.stderr).toBe(stderr);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should measure execution duration accurately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 0, max: 255 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (stdout: string, exitCode: number, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const startTime = Date.now();
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stdout.emit('data', Buffer.from(stdout));

            // Simulate some delay
            await new Promise(resolve => setTimeout(resolve, 10));

            setImmediate(() => {
              mockChild.emit('close', exitCode);
            });

            const result = await resultPromise;
            const endTime = Date.now();

            // Duration should be reasonable
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow some margin
          }
        ),
        { numRuns: 50 } // Fewer runs due to timing sensitivity
      );
    });
  });

  // Feature: ssh-mcp-server, Property 16: Connection failures capture stderr
  // **Validates: Requirement 1.4**
  describe('Property 16: Connection failures capture stderr', () => {
    it('should capture stderr for any connection failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }), // stderr content
          fc.string({ minLength: 1, maxLength: 100 }), // command
          async (stderrContent: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Emit stderr (connection failure message)
            mockChild.stderr.emit('data', Buffer.from(stderrContent));

            // Simulate failure with non-zero exit code
            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            // Stderr should be captured
            expect(result.stderr).toBe(stderrContent);
            expect(result.exitCode).not.toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr for authentication failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'Permission denied (publickey).',
            'Permission denied (password).',
            'Permission denied, please try again.'
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (authError: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stderr.emit('data', Buffer.from(authError));

            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            expect(result.stderr).toContain(authError);
            expect(result.exitCode).not.toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr for connection refused errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 65535 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (host: string, port: number, command: string) => {
            const errorMessage = `ssh: connect to host ${host} port ${port}: Connection refused`;
            
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession({ host, port });
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stderr.emit('data', Buffer.from(errorMessage));

            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            expect(result.stderr).toBe(errorMessage);
            expect(result.exitCode).toBe(255);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr for timeout errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'Connection timed out',
            'Operation timed out',
            'ssh: connect to host example.com port 22: Connection timed out'
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (timeoutError: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stderr.emit('data', Buffer.from(timeoutError));

            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            expect(result.stderr).toContain(timeoutError);
            expect(result.exitCode).not.toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr for host key verification failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'Host key verification failed.',
            'REMOTE HOST IDENTIFICATION HAS CHANGED!',
            '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n' +
            '@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @\n' +
            '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (hostKeyError: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stderr.emit('data', Buffer.from(hostKeyError));

            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            expect(result.stderr).toContain(hostKeyError);
            expect(result.exitCode).toBe(255);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr for DNS resolution failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'Could not resolve hostname example.com: Name or service not known',
            'ssh: Could not resolve hostname badhost: nodename nor servname provided, or not known',
            'Temporary failure in name resolution'
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (dnsError: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stderr.emit('data', Buffer.from(dnsError));

            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            expect(result.stderr).toContain(dnsError);
            expect(result.exitCode).not.toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr for network unreachable errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'No route to host',
            'Network is unreachable',
            'ssh: connect to host example.com port 22: No route to host'
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (networkError: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            mockChild.stderr.emit('data', Buffer.from(networkError));

            setImmediate(() => {
              mockChild.emit('close', 255);
            });

            const result = await resultPromise;

            expect(result.stderr).toContain(networkError);
            expect(result.exitCode).toBe(255);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture complete stderr even with multiple chunks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (stderrChunks: string[], command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Emit stderr in multiple chunks
            for (const chunk of stderrChunks) {
              mockChild.stderr.emit('data', Buffer.from(chunk));
            }

            setImmediate(() => {
              mockChild.emit('close', 1);
            });

            const result = await resultPromise;

            // All stderr chunks should be captured
            const expectedStderr = stderrChunks.join('');
            expect(result.stderr).toBe(expectedStderr);
            expect(result.exitCode).not.toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture stderr even when stdout is also present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }), // stdout
          fc.string({ minLength: 1, maxLength: 1000 }), // stderr
          fc.string({ minLength: 1, maxLength: 100 }), // command
          async (stdout: string, stderr: string, command: string) => {
            const mockChild = new EventEmitter() as any;
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();

            (spawn as any).mockReturnValue(mockChild);

            const session = createBasicSession();
            const resultPromise = wrapper.executeCommand(session, command, {});

            // Emit both stdout and stderr
            mockChild.stdout.emit('data', Buffer.from(stdout));
            mockChild.stderr.emit('data', Buffer.from(stderr));

            setImmediate(() => {
              mockChild.emit('close', 1);
            });

            const result = await resultPromise;

            // Both should be captured correctly
            expect(result.stdout).toBe(stdout);
            expect(result.stderr).toBe(stderr);
            expect(result.exitCode).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Timeout handling
  describe('Additional Property: Timeout handling', () => {
    it('should handle timeout and include timeout message in stderr', async () => {
      // Test with a single example rather than property-based testing
      // due to timing complexity
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      (spawn as any).mockReturnValue(mockChild);

      const session = createBasicSession();
      const resultPromise = wrapper.executeCommand(session, 'sleep 100', { timeout: 1 });

      // Simulate timeout by emitting error immediately
      setImmediate(() => {
        const error = new Error('AbortError') as any;
        error.name = 'AbortError';
        mockChild.emit('error', error);
      });

      const result = await resultPromise;

      // Should have timeout exit code and message
      expect(result.exitCode).toBe(124);
      expect(result.stderr).toContain('timed out');
    });
  });
});
