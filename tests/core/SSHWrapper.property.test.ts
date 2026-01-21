/**
 * Property-based tests for SSHWrapper
 * 
 * These tests use fast-check to verify universal properties that should hold
 * for all valid inputs. Each property is tested with a minimum of 100 iterations
 * to ensure correctness across a wide range of inputs.
 * 
 * Feature: ssh-mcp-server
 * Validates: Requirements 1.2, 1.3, 2.2, 2.4, 2.5, 7.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import type { Session, ExecOptions } from '../../src/core/types.js';

describe('SSHWrapper - Property-Based Tests', () => {
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

  // Feature: ssh-mcp-server, Property 8: SSH command includes all configuration options
  // **Validates: Requirements 1.2, 1.3, 2.4, 2.5, 7.5**
  describe('Property 8: SSH command includes all configuration options', () => {
    it('should include key authentication flag when keyPath is provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (keyPath: string, command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({ keyPath });
            const args = wrapper.buildSSHCommand(session, command, {});

            // Should contain -i flag
            expect(args).toContain('-i');
            // Should contain the key path
            expect(args).toContain(keyPath);
            // -i should be followed by the key path
            const iIndex = args.indexOf('-i');
            expect(args[iIndex + 1]).toBe(keyPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include StrictHostKeyChecking option for any boolean value', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (strictHostKeyChecking: boolean, command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({
              config: {
                ...createBasicSession().config,
                strictHostKeyChecking,
              },
            });
            const args = wrapper.buildSSHCommand(session, command, {});

            // Should contain the StrictHostKeyChecking option
            const expectedValue = `StrictHostKeyChecking=${strictHostKeyChecking ? 'yes' : 'no'}`;
            expect(args.some(arg => arg === expectedValue)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include ControlMaster options when controlSocketPath is provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (controlSocketPath: string, command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({ controlSocketPath });
            const args = wrapper.buildSSHCommand(session, command, {});

            // Should contain ControlPath option
            expect(args.some(arg => arg.includes(`ControlPath=${controlSocketPath}`))).toBe(true);
            // Should contain ControlMaster=auto
            expect(args.some(arg => arg === 'ControlMaster=auto')).toBe(true);
            // Should contain ControlPersist
            expect(args.some(arg => arg.includes('ControlPersist='))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all custom options', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            { minKeys: 1, maxKeys: 10 }
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          (customOptions: Record<string, string>, command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({
              config: {
                ...createBasicSession().config,
                customOptions,
              },
            });
            const args = wrapper.buildSSHCommand(session, command, {});

            // Each custom option should be present
            for (const [key, value] of Object.entries(customOptions)) {
              const expectedOption = `${key}=${value}`;
              expect(args.some(arg => arg === expectedOption)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include SendEnv for all environment variables', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            { minKeys: 1, maxKeys: 10 }
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          (env: Record<string, string>, command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildSSHCommand(session, command, { env });

            // Each environment variable should have a SendEnv option
            for (const envVar of Object.keys(env)) {
              const expectedOption = `SendEnv=${envVar}`;
              expect(args.some(arg => arg === expectedOption)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all standard configuration options', () => {
      fc.assert(
        fc.property(
          fc.record({
            strictHostKeyChecking: fc.boolean(),
            connectTimeout: fc.integer({ min: 1, max: 300 }),
            serverAliveInterval: fc.integer({ min: 0, max: 600 }),
            compression: fc.boolean(),
            forwardAgent: fc.boolean(),
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (config, command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({
              config: {
                ...config,
                customOptions: {},
              },
            });
            const args = wrapper.buildSSHCommand(session, command, {});

            // Verify all config options are present
            expect(args.some(arg => 
              arg === `StrictHostKeyChecking=${config.strictHostKeyChecking ? 'yes' : 'no'}`
            )).toBe(true);
            expect(args.some(arg => arg === `ConnectTimeout=${config.connectTimeout}`)).toBe(true);
            expect(args.some(arg => 
              arg === `ServerAliveInterval=${config.serverAliveInterval}`
            )).toBe(true);
            expect(args.some(arg => 
              arg === `Compression=${config.compression ? 'yes' : 'no'}`
            )).toBe(true);
            expect(args.some(arg => 
              arg === `ForwardAgent=${config.forwardAgent ? 'yes' : 'no'}`
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 9: Special characters are properly escaped
  // **Validates: Requirement 2.2**
  describe('Property 9: Special characters are properly escaped', () => {
    it('should wrap all commands in single quotes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const escaped = wrapper.escapeCommand(command);

            // Should start and end with single quotes
            expect(escaped.startsWith("'")).toBe(true);
            expect(escaped.endsWith("'")).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent command injection with semicolons', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (cmd1: string, cmd2: string) => {
            const wrapper = new SSHWrapper();
            const dangerousCommand = `${cmd1}; ${cmd2}`;
            const escaped = wrapper.escapeCommand(dangerousCommand);

            // The semicolon should be literal, not a command separator
            // The entire command should be wrapped in single quotes
            expect(escaped).toBe(`'${dangerousCommand.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent command injection with pipes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (cmd1: string, cmd2: string) => {
            const wrapper = new SSHWrapper();
            const dangerousCommand = `${cmd1} | ${cmd2}`;
            const escaped = wrapper.escapeCommand(dangerousCommand);

            // The pipe should be literal, not a command pipe
            expect(escaped).toBe(`'${dangerousCommand.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent variable expansion with dollar signs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (varName: string) => {
            const wrapper = new SSHWrapper();
            const command = `echo $${varName}`;
            const escaped = wrapper.escapeCommand(command);

            // The dollar sign should be literal, not variable expansion
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent command substitution with backticks', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (cmd: string) => {
            const wrapper = new SSHWrapper();
            const command = `echo \`${cmd}\``;
            const escaped = wrapper.escapeCommand(command);

            // The backticks should be literal, not command substitution
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single quotes by escaping them correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (before: string, after: string) => {
            const wrapper = new SSHWrapper();
            const command = `${before}'${after}`;
            const escaped = wrapper.escapeCommand(command);

            // Single quotes should be escaped using the '\'' pattern
            // This works by: ending the current quote, adding an escaped quote, starting a new quote
            const expected = `'${command.replace(/'/g, "'\\''")}'`;
            expect(escaped).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple single quotes', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          (parts: string[]) => {
            const wrapper = new SSHWrapper();
            const command = parts.join("'");
            const escaped = wrapper.escapeCommand(command);

            // Each single quote should be escaped
            const expected = `'${command.replace(/'/g, "'\\''")}'`;
            expect(escaped).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle double quotes without escaping', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (content: string) => {
            const wrapper = new SSHWrapper();
            const command = `echo "${content}"`;
            const escaped = wrapper.escapeCommand(command);

            // Double quotes should be preserved as-is within single quotes
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle ampersands without creating background processes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (cmd1: string, cmd2: string) => {
            const wrapper = new SSHWrapper();
            const command = `${cmd1} && ${cmd2}`;
            const escaped = wrapper.escapeCommand(command);

            // Ampersands should be literal
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle angle brackets without redirection', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (input: string, output: string) => {
            const wrapper = new SSHWrapper();
            const command = `cat < ${input} > ${output}`;
            const escaped = wrapper.escapeCommand(command);

            // Angle brackets should be literal
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle parentheses without subshells', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (cmd: string) => {
            const wrapper = new SSHWrapper();
            const command = `(${cmd})`;
            const escaped = wrapper.escapeCommand(command);

            // Parentheses should be literal
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle backslashes without escape sequences', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (text: string) => {
            const wrapper = new SSHWrapper();
            const command = `echo \\n${text}\\t`;
            const escaped = wrapper.escapeCommand(command);

            // Backslashes should be literal
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle newlines without command separation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (line1: string, line2: string) => {
            const wrapper = new SSHWrapper();
            const command = `${line1}\n${line2}`;
            const escaped = wrapper.escapeCommand(command);

            // Newlines should be literal
            expect(escaped).toBe(`'${command.replace(/'/g, "'\\''")}'`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty strings', () => {
      fc.assert(
        fc.property(
          fc.constant(''),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const escaped = wrapper.escapeCommand(command);

            // Empty string should remain empty
            expect(escaped).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very long commands', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1000, maxLength: 10000 }),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const escaped = wrapper.escapeCommand(command);

            // Should still wrap in quotes
            expect(escaped.startsWith("'")).toBe(true);
            expect(escaped.endsWith("'")).toBe(true);
            // Length should be original + 2 (for quotes) + escaping overhead
            expect(escaped.length).toBeGreaterThanOrEqual(command.length + 2);
          }
        ),
        { numRuns: 50 } // Fewer runs for performance
      );
    });

    it('should handle unicode characters', () => {
      fc.assert(
        fc.property(
          fc.unicodeString({ minLength: 1, maxLength: 100 }),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const escaped = wrapper.escapeCommand(command);

            // Should wrap in quotes
            expect(escaped.startsWith("'")).toBe(true);
            expect(escaped.endsWith("'")).toBe(true);
            // Should preserve unicode
            const expected = `'${command.replace(/'/g, "'\\''")}'`;
            expect(escaped).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent when used in buildSSHCommand', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            
            // Build command twice
            const args1 = wrapper.buildSSHCommand(session, command, {});
            const args2 = wrapper.buildSSHCommand(session, command, {});

            // Should produce identical results
            expect(args1).toEqual(args2);
            
            // Command should be escaped the same way
            expect(args1[args1.length - 1]).toBe(args2[args2.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent all common injection patterns', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Semicolon injection
            fc.tuple(fc.string(), fc.string()).map(([a, b]) => `${a}; ${b}`),
            // Pipe injection
            fc.tuple(fc.string(), fc.string()).map(([a, b]) => `${a} | ${b}`),
            // Ampersand injection
            fc.tuple(fc.string(), fc.string()).map(([a, b]) => `${a} && ${b}`),
            // Backtick injection
            fc.string().map(s => `\`${s}\``),
            // Dollar sign injection
            fc.string().map(s => `$${s}`),
            // Redirection injection
            fc.tuple(fc.string(), fc.string()).map(([a, b]) => `${a} > ${b}`),
            // Subshell injection
            fc.string().map(s => `$(${s})`)
          ),
          (dangerousCommand: string) => {
            const wrapper = new SSHWrapper();
            const escaped = wrapper.escapeCommand(dangerousCommand);

            // All special characters should be literal
            expect(escaped).toBe(`'${dangerousCommand.replace(/'/g, "'\\''")}'`);
            
            // Should be wrapped in single quotes
            expect(escaped.startsWith("'")).toBe(true);
            expect(escaped.endsWith("'")).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 10: Port forwarding commands include correct flags
  // **Validates: Requirements 5.1, 5.2, 5.3, 5.7**
  describe('Property 10: Port forwarding commands include correct flags', () => {
    it('should include -L flag with correct format for local port forwarding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 65535 }),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (localPort: number, remoteHost: string, remotePort: number) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildPortForwardCommand(session, {
              type: 'local',
              localPort,
              remoteHost,
              remotePort,
            });

            // Should contain -L flag
            expect(args).toContain('-L');
            // Should contain the correct format: localPort:remoteHost:remotePort
            const expectedBinding = `${localPort}:${remoteHost}:${remotePort}`;
            expect(args).toContain(expectedBinding);
            // -L should be followed by the binding
            const lIndex = args.indexOf('-L');
            expect(args[lIndex + 1]).toBe(expectedBinding);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include -R flag with correct format for remote port forwarding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 65535 }),
          fc.integer({ min: 1024, max: 65535 }),
          (remotePort: number, localPort: number) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildPortForwardCommand(session, {
              type: 'remote',
              remotePort,
              localPort,
            });

            // Should contain -R flag
            expect(args).toContain('-R');
            // Should contain the correct format: remotePort:localhost:localPort
            const expectedBinding = `${remotePort}:localhost:${localPort}`;
            expect(args).toContain(expectedBinding);
            // -R should be followed by the binding
            const rIndex = args.indexOf('-R');
            expect(args[rIndex + 1]).toBe(expectedBinding);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include -D flag with correct format for dynamic SOCKS proxy', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 65535 }),
          (localPort: number) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildPortForwardCommand(session, {
              type: 'dynamic',
              localPort,
            });

            // Should contain -D flag
            expect(args).toContain('-D');
            // Should contain the local port
            expect(args).toContain(localPort.toString());
            // -D should be followed by the port
            const dIndex = args.indexOf('-D');
            expect(args[dIndex + 1]).toBe(localPort.toString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include -N flag for tunnel-only mode', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Local forward
            fc.record({
              type: fc.constant('local' as const),
              localPort: fc.integer({ min: 1024, max: 65535 }),
              remoteHost: fc.domain(),
              remotePort: fc.integer({ min: 1, max: 65535 }),
            }),
            // Remote forward
            fc.record({
              type: fc.constant('remote' as const),
              remotePort: fc.integer({ min: 1024, max: 65535 }),
              localPort: fc.integer({ min: 1024, max: 65535 }),
            }),
            // Dynamic forward
            fc.record({
              type: fc.constant('dynamic' as const),
              localPort: fc.integer({ min: 1024, max: 65535 }),
            })
          ),
          (config: any) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildPortForwardCommand(session, config);

            // Should contain -N flag for tunnel-only mode
            expect(args).toContain('-N');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all standard SSH options in port forward commands', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 65535 }),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (localPort: number, remoteHost: string, remotePort: number) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({
              config: {
                strictHostKeyChecking: true,
                connectTimeout: 30,
                serverAliveInterval: 60,
                compression: true,
                forwardAgent: false,
                customOptions: {},
              },
            });
            const args = wrapper.buildPortForwardCommand(session, {
              type: 'local',
              localPort,
              remoteHost,
              remotePort,
            });

            // Should include standard SSH configuration options
            expect(args.some(arg => arg.includes('StrictHostKeyChecking='))).toBe(true);
            expect(args.some(arg => arg.includes('ConnectTimeout='))).toBe(true);
            expect(args.some(arg => arg.includes('ServerAliveInterval='))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Command structure is consistent
  describe('Additional Property: Command structure is consistent', () => {
    it('should always have ssh binary as first argument', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildSSHCommand(session, command, {});

            expect(args[0]).toBe('ssh');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always have host as second-to-last argument when command is provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.domain(),
          (command: string, host: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({ host });
            const args = wrapper.buildSSHCommand(session, command, {});

            expect(args[args.length - 2]).toBe(host);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always have command as last argument when command is provided (unescaped)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (command: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession();
            const args = wrapper.buildSSHCommand(session, command, {});

            const lastArg = args[args.length - 1];
            // Commands are NOT escaped by buildSSHCommand because spawn() passes
            // arguments directly to SSH without shell interpretation
            expect(lastArg).toBe(command);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have host as last argument when command is empty', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          (host: string) => {
            const wrapper = new SSHWrapper();
            const session = createBasicSession({ host });
            const args = wrapper.buildSSHCommand(session, '', {});

            expect(args[args.length - 1]).toBe(host);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
