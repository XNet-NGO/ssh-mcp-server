/**
 * Property-based tests for ConfigurationManager
 * 
 * Tests universal properties that should hold for all valid inputs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';

describe('ConfigurationManager Property Tests', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  // Feature: ssh-mcp-server, Property 24: Invalid configuration options are rejected
  describe('Property 24: Invalid configuration options are rejected', () => {
    it('should reject unknown option names', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            s => !['Port', 'User', 'HostName', 'Host', 'IdentityFile', 
                   'StrictHostKeyChecking', 'Compression', 'ForwardAgent',
                   'ConnectTimeout', 'ServerAliveInterval'].some(
              valid => s.toLowerCase() === valid.toLowerCase()
            )
          ),
          fc.string(),
          (invalidKey, value) => {
            expect(configManager.validateOption(invalidKey, value)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid number values for number options', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Port', 'ConnectTimeout', 'ServerAliveInterval'),
          fc.string().filter(s => isNaN(parseInt(s, 10))),
          (key, invalidValue) => {
            expect(configManager.validateOption(key, invalidValue)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid boolean values for boolean options', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Compression', 'ForwardAgent', 'ForwardX11'),
          fc.string().filter(s => !['yes', 'no', 'true', 'false', '1', '0'].includes(s.toLowerCase())),
          (key, invalidValue) => {
            expect(configManager.validateOption(key, invalidValue)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when setting invalid options', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => 
            !configManager.listOptions().some(opt => opt.name.toLowerCase() === s.toLowerCase())
          ),
          fc.string(),
          (invalidKey, value) => {
            expect(() => configManager.setOption(invalidKey, value)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 25: SSH config parsing round-trip
  describe('Property 25: SSH config parsing round-trip', () => {
    it('should preserve host patterns after parsing', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              pattern: fc.oneof(
                fc.domain(),
                fc.constant('*'),
                fc.string({ minLength: 1, maxLength: 20 }).map(s => `*.${s}`)
              ).filter(s => {
                // Filter out patterns with trailing/leading whitespace or quotes
                const trimmed = s.trim();
                return trimmed.length > 0 && trimmed === s && !s.includes('"');
              }),
              hostname: fc.option(fc.domain(), { nil: undefined }),
              port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
              user: fc.option(fc.string({ minLength: 1, maxLength: 32 }).filter(s => {
                const trimmed = s.trim();
                // Ensure no quotes, no leading/trailing spaces, and not empty after trim
                return trimmed.length > 0 && trimmed === s && !s.includes('"');
              }), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 5 }
          ).map(hosts => {
            // Ensure unique patterns
            const seen = new Set<string>();
            return hosts.filter(h => {
              if (seen.has(h.pattern)) return false;
              seen.add(h.pattern);
              return true;
            });
          }).filter(hosts => hosts.length > 0),  // Ensure at least one host after deduplication
          (hosts) => {
            // Build config content
            const lines: string[] = [];
            for (const host of hosts) {
              lines.push(`Host ${host.pattern}`);
              if (host.hostname) lines.push(`  HostName ${host.hostname}`);
              if (host.port) lines.push(`  Port ${host.port}`);
              if (host.user) lines.push(`  User ${host.user}`);
            }
            const content = lines.join('\n');

            // Parse and verify
            const config = configManager.parseSSHConfig(content);
            
            for (const host of hosts) {
              const parsed = config.hosts.get(host.pattern);
              expect(parsed).toBeDefined();
              expect(parsed?.pattern).toBe(host.pattern);
              if (host.hostname) expect(parsed?.hostname).toBe(host.hostname);
              if (host.port) expect(parsed?.port).toBe(host.port);
              if (host.user) expect(parsed?.user).toBe(host.user);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve global options after parsing', () => {
      fc.assert(
        fc.property(
          fc.record({
            strictHostKeyChecking: fc.constantFrom('yes', 'no'),
            connectTimeout: fc.integer({ min: 1, max: 300 }).map(String),
            compression: fc.constantFrom('yes', 'no'),
          }),
          (options) => {
            const content = `
              StrictHostKeyChecking ${options.strictHostKeyChecking}
              ConnectTimeout ${options.connectTimeout}
              Compression ${options.compression}
            `;

            const config = configManager.parseSSHConfig(content);
            
            expect(config.globalOptions['StrictHostKeyChecking']).toBe(options.strictHostKeyChecking);
            expect(config.globalOptions['ConnectTimeout']).toBe(options.connectTimeout);
            expect(config.globalOptions['Compression']).toBe(options.compression);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 26: Host patterns match correctly
  describe('Property 26: Host patterns match correctly', () => {
    it('should match exact hostnames', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          (hostname) => {
            expect(configManager.matchHostPattern(hostname, hostname)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match wildcard patterns correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (prefix, suffix) => {
            const hostname = `${prefix}.${suffix}`;
            const pattern = `*.${suffix}`;
            
            expect(configManager.matchHostPattern(hostname, pattern)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match question mark patterns correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 10 }),
          fc.integer({ min: 0, max: 4 }),
          (base, pos) => {
            // Replace one character with ?
            const pattern = base.substring(0, pos) + '?' + base.substring(pos + 1);
            
            expect(configManager.matchHostPattern(base, pattern)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle negation patterns', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          (hostname) => {
            const negatedPattern = `!${hostname}`;
            expect(configManager.matchHostPattern(hostname, negatedPattern)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
          (hostname) => {
            const upper = hostname.toUpperCase();
            const lower = hostname.toLowerCase();
            
            expect(configManager.matchHostPattern(upper, lower)).toBe(true);
            expect(configManager.matchHostPattern(lower, upper)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match * to any hostname', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.domain(), fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })),
          (hostname) => {
            expect(configManager.matchHostPattern(hostname, '*')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 27: Known_hosts file path is used
  describe('Property 27: Known_hosts file path is used', () => {
    it('should use configured known_hosts path', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (path) => {
            configManager.setKnownHostsPath(path);
            expect(configManager.getKnownHostsPath()).toBe(path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use known_hosts path from constructor', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (path) => {
            const manager = new ConfigurationManager(path);
            expect(manager.getKnownHostsPath()).toBe(path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use host-specific known_hosts path when configured', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => {
            const trimmed = s.trim();
            // Ensure no quotes, no leading/trailing spaces, length > 1, and not empty after trim
            return trimmed.length > 1 && trimmed === s && !s.includes('"');
          }),
          (hostname, knownHostsPath) => {
            const content = `
              Host ${hostname}
                UserKnownHostsFile ${knownHostsPath}
            `;
            
            configManager.parseSSHConfig(content);
            const path = configManager.getKnownHostsPathForHost(hostname);
            
            expect(path).toBe(knownHostsPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to default when no host-specific path', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (hostname, defaultPath) => {
            const manager = new ConfigurationManager(defaultPath);
            const content = `
              Host ${hostname}
                HostName 192.168.1.1
            `;
            
            manager.parseSSHConfig(content);
            const path = manager.getKnownHostsPathForHost(hostname);
            
            expect(path).toBe(defaultPath);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 28: Known_hosts format is supported
  describe('Property 28: Known_hosts format is supported', () => {
    it('should accept any valid file path for known_hosts', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('~/.ssh/known_hosts'),
            fc.constant('/etc/ssh/known_hosts'),
            fc.string({ minLength: 1, maxLength: 100 }).map(s => `/tmp/${s}`),
            fc.string({ minLength: 1, maxLength: 100 }).map(s => `~/.ssh/${s}`)
          ),
          (path) => {
            configManager.setKnownHostsPath(path);
            expect(configManager.getKnownHostsPath()).toBe(path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support UserKnownHostsFile option in config', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 100 }).filter(s => {
            const trimmed = s.trim();
            // Ensure no quotes, no leading/trailing spaces, and not empty after trim
            return trimmed.length > 1 && trimmed === s && !s.includes('"');
          }),
          (path) => {
            const content = `UserKnownHostsFile ${path}`;
            const config = configManager.parseSSHConfig(content);
            
            expect(config.globalOptions['UserKnownHostsFile']).toBe(path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support multiple known_hosts paths per host', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.array(
            fc.string({ minLength: 2, maxLength: 50 }).filter(s => {
              const trimmed = s.trim();
              // Ensure no quotes, no leading/trailing spaces, and not empty after trim
              return trimmed.length > 1 && trimmed === s && !s.includes('"');
            }), 
            { minLength: 1, maxLength: 3 }
          ),
          (hostname, paths) => {
            // SSH supports multiple UserKnownHostsFile entries
            const lines = [`Host ${hostname}`];
            for (const path of paths) {
              lines.push(`  UserKnownHostsFile ${path}`);
            }
            const content = lines.join('\n');
            
            const config = configManager.parseSSHConfig(content);
            const hostConfig = config.hosts.get(hostname);
            
            // Last one wins in our implementation
            expect(hostConfig?.options['UserKnownHostsFile']).toBe(paths[paths.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional configuration properties', () => {
    it('should validate all valid SSH options', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...configManager.listOptions().map(opt => opt.name)),
          fc.string({ minLength: 1, maxLength: 50 }),
          (optionName, value) => {
            const option = configManager.listOptions().find(opt => opt.name === optionName);
            if (!option) return;

            // Generate valid value based on type
            let validValue = value;
            if (option.type === 'number') {
              validValue = '123';
            } else if (option.type === 'boolean') {
              validValue = 'yes';
            }

            expect(configManager.validateOption(optionName, validValue)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve identity files in order', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.array(
            fc.string({ minLength: 2, maxLength: 50 }).filter(s => {
              const trimmed = s.trim();
              // Ensure no quotes, no leading/trailing spaces, no multiple consecutive spaces, and not empty after trim
              return trimmed.length > 1 && trimmed === s && !s.includes('"') && !/\s{2,}/.test(s);
            }), 
            { minLength: 1, maxLength: 5 }
          ),
          (hostname, identityFiles) => {
            const lines = [`Host ${hostname}`];
            for (const file of identityFiles) {
              lines.push(`  IdentityFile ${file}`);
            }
            const content = lines.join('\n');

            const config = configManager.parseSSHConfig(content);
            const hostConfig = config.hosts.get(hostname);
            
            expect(hostConfig?.identityFile).toEqual(identityFiles);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle comments and whitespace correctly', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (hostname, port) => {
            const content = `
              # This is a comment
              Host ${hostname}
                # Another comment
                Port ${port}
                
                # Empty line above
            `;

            const config = configManager.parseSSHConfig(content);
            const hostConfig = config.hosts.get(hostname);
            
            expect(hostConfig?.port).toBe(port);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
