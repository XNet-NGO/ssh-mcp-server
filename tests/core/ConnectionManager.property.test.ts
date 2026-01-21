/**
 * Property-based tests for ConnectionManager
 * 
 * These tests use fast-check to verify universal properties that should hold
 * for all valid inputs. Each property is tested with a minimum of 100 iterations
 * to ensure correctness across a wide range of inputs.
 * 
 * Feature: ssh-mcp-server
 * Validates: Requirements 1.1, 1.5, 1.6, 1.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import type { ConnectionParams } from '../../src/core/types.js';

describe('ConnectionManager - Property-Based Tests', () => {
  // Note: We create a fresh manager in each property test to avoid state pollution
  // across multiple test runs within the same property test

  // Feature: ssh-mcp-server, Property 1: Session creation stores all parameters
  // **Validates: Requirements 1.1**
  describe('Property 1: Session creation stores all parameters', () => {
    it('should store all provided connection parameters in the session', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary connection parameters
          fc.record({
            host: fc.oneof(
              fc.domain(),
              fc.ipV4(),
              fc.ipV6(),
              fc.string({ minLength: 1, maxLength: 255 })
            ),
            port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
            username: fc.string({ minLength: 1, maxLength: 32 }),
            keyPath: fc.option(
              fc.string({ minLength: 1, maxLength: 255 }),
              { nil: undefined }
            ),
            config: fc.option(
              fc.record({
                strictHostKeyChecking: fc.boolean(),
                connectTimeout: fc.integer({ min: 1, max: 300 }),
                serverAliveInterval: fc.integer({ min: 0, max: 600 }),
                compression: fc.boolean(),
                forwardAgent: fc.boolean(),
                customOptions: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 50 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ),
              }),
              { nil: undefined }
            ),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Session should have a unique ID
            expect(session.id).toBeDefined();
            expect(typeof session.id).toBe('string');
            expect(session.id.length).toBeGreaterThan(0);

            // All provided parameters should be stored
            expect(session.host).toBe(params.host);
            expect(session.port).toBe(params.port ?? 22);
            expect(session.username).toBe(params.username);
            expect(session.keyPath).toBe(params.keyPath);

            // Timestamps should be set
            expect(session.createdAt).toBeInstanceOf(Date);
            expect(session.lastUsedAt).toBeInstanceOf(Date);

            // Configuration should be present
            expect(session.config).toBeDefined();
            if (params.config) {
              if (params.config.strictHostKeyChecking !== undefined) {
                expect(session.config.strictHostKeyChecking).toBe(
                  params.config.strictHostKeyChecking
                );
              }
              if (params.config.connectTimeout !== undefined) {
                expect(session.config.connectTimeout).toBe(params.config.connectTimeout);
              }
              if (params.config.serverAliveInterval !== undefined) {
                expect(session.config.serverAliveInterval).toBe(
                  params.config.serverAliveInterval
                );
              }
              if (params.config.compression !== undefined) {
                expect(session.config.compression).toBe(params.config.compression);
              }
              if (params.config.forwardAgent !== undefined) {
                expect(session.config.forwardAgent).toBe(params.config.forwardAgent);
              }
              if (params.config.customOptions) {
                for (const [key, value] of Object.entries(params.config.customOptions)) {
                  expect(session.config.customOptions[key]).toBe(value);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique session IDs for all sessions', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              username: fc.string({ minLength: 1, maxLength: 32 }),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (paramsArray: ConnectionParams[]) => {
            const manager = new ConnectionManager();
            const sessionIds = new Set<string>();

            for (const params of paramsArray) {
              const session = manager.createSession(params);
              // Each session ID should be unique
              expect(sessionIds.has(session.id)).toBe(false);
              sessionIds.add(session.id);
            }

            // All IDs should be unique
            expect(sessionIds.size).toBe(paramsArray.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 2: Session disconnect removes from tracking
  // **Validates: Requirements 1.5**
  describe('Property 2: Session disconnect removes from tracking', () => {
    it('should remove any active session from tracking when disconnected', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            // Create a session
            const session = manager.createSession(params);

            // Verify it exists
            expect(manager.getSession(session.id)).not.toBeNull();

            // Remove the session
            manager.removeSession(session.id);

            // Verify it no longer exists
            expect(manager.getSession(session.id)).toBeNull();

            // Verify it's not in the list
            const sessions = manager.listSessions();
            expect(sessions.find((s) => s.id === session.id)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle removing multiple sessions independently', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              username: fc.string({ minLength: 1, maxLength: 32 }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.integer({ min: 0, max: 100 }),
          (paramsArray: ConnectionParams[], seed: number) => {
            const manager = new ConnectionManager();
            // Create multiple sessions
            const sessions = paramsArray.map((params) => manager.createSession(params));

            // Randomly select sessions to remove
            const toRemove = sessions.filter((_, index) => (index + seed) % 2 === 0);
            const toKeep = sessions.filter((_, index) => (index + seed) % 2 !== 0);

            // Remove selected sessions
            toRemove.forEach((session) => manager.removeSession(session.id));

            // Verify removed sessions are gone
            toRemove.forEach((session) => {
              expect(manager.getSession(session.id)).toBeNull();
            });

            // Verify kept sessions still exist
            toKeep.forEach((session) => {
              expect(manager.getSession(session.id)).not.toBeNull();
            });

            // Verify list contains only kept sessions
            const remainingSessions = manager.listSessions();
            expect(remainingSessions.length).toBe(toKeep.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not throw when removing non-existent sessions', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (sessionId: string) => {
            const manager = new ConnectionManager();
            // Should not throw for any string ID
            expect(() => manager.removeSession(sessionId)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 3: Session listing returns complete information
  // **Validates: Requirements 1.6**
  describe('Property 3: Session listing returns complete information', () => {
    it('should return all active sessions with complete metadata', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
              username: fc.string({ minLength: 1, maxLength: 32 }),
              keyPath: fc.option(
                fc.string({ minLength: 1, maxLength: 255 }),
                { nil: undefined }
              ),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (paramsArray: ConnectionParams[]) => {
            const manager = new ConnectionManager();
            // Create sessions
            const createdSessions = paramsArray.map((params) =>
              manager.createSession(params)
            );

            // List all sessions
            const listedSessions = manager.listSessions();

            // Should have the same number of sessions
            expect(listedSessions.length).toBe(createdSessions.length);

            // Each created session should be in the list with complete information
            for (const created of createdSessions) {
              const listed = listedSessions.find((s) => s.id === created.id);
              expect(listed).toBeDefined();

              if (listed) {
                // Verify all metadata is present and correct
                expect(listed.id).toBe(created.id);
                expect(listed.host).toBe(created.host);
                expect(listed.port).toBe(created.port);
                expect(listed.username).toBe(created.username);
                expect(listed.keyPath).toBe(created.keyPath);
                expect(listed.controlSocketPath).toBe(created.controlSocketPath);
                expect(listed.createdAt).toEqual(created.createdAt);
                expect(listed.lastUsedAt).toEqual(created.lastUsedAt);
                expect(listed.config).toEqual(created.config);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no sessions exist', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // Fresh manager should have no sessions
            const freshManager = new ConnectionManager();
            const sessions = freshManager.listSessions();
            expect(sessions).toEqual([]);
            expect(sessions.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reflect session additions and removals in real-time', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              username: fc.string({ minLength: 1, maxLength: 32 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (paramsArray: ConnectionParams[]) => {
            const manager = new ConnectionManager();
            // Start with empty list
            expect(manager.listSessions().length).toBe(0);

            const sessions = [];

            // Add sessions one by one and verify count
            for (let i = 0; i < paramsArray.length; i++) {
              const session = manager.createSession(paramsArray[i]);
              sessions.push(session);
              expect(manager.listSessions().length).toBe(i + 1);
            }

            // Remove sessions one by one and verify count
            for (let i = 0; i < sessions.length; i++) {
              manager.removeSession(sessions[i].id);
              expect(manager.listSessions().length).toBe(sessions.length - i - 1);
            }

            // Should be empty again
            expect(manager.listSessions().length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 4: ControlMaster creates control socket
  // **Validates: Requirements 1.7**
  describe('Property 4: ControlMaster creates control socket', () => {
    it('should create a control socket path for every session', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Control socket path should be defined
            expect(session.controlSocketPath).toBeDefined();
            expect(typeof session.controlSocketPath).toBe('string');
            expect(session.controlSocketPath.length).toBeGreaterThan(0);

            // Should follow the pattern /tmp/ssh-mcp-{sessionId}
            expect(session.controlSocketPath).toMatch(/^\/tmp\/ssh-mcp-[0-9a-f-]+$/);
            expect(session.controlSocketPath).toContain(session.id);
            expect(session.controlSocketPath).toBe(`/tmp/ssh-mcp-${session.id}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create unique control socket paths for different sessions', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              username: fc.string({ minLength: 1, maxLength: 32 }),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (paramsArray: ConnectionParams[]) => {
            const manager = new ConnectionManager();
            const socketPaths = new Set<string>();

            for (const params of paramsArray) {
              const session = manager.createSession(params);

              // Each control socket path should be unique
              expect(socketPaths.has(session.controlSocketPath)).toBe(false);
              socketPaths.add(session.controlSocketPath);
            }

            // All socket paths should be unique
            expect(socketPaths.size).toBe(paramsArray.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain control socket path after session retrieval', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const created = manager.createSession(params);
            const originalSocketPath = created.controlSocketPath;

            // Retrieve the session
            const retrieved = manager.getSession(created.id);

            // Control socket path should be unchanged
            expect(retrieved).not.toBeNull();
            expect(retrieved?.controlSocketPath).toBe(originalSocketPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include control socket path in session listings', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              username: fc.string({ minLength: 1, maxLength: 32 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (paramsArray: ConnectionParams[]) => {
            const manager = new ConnectionManager();
            // Create sessions
            const createdSessions = paramsArray.map((params) =>
              manager.createSession(params)
            );

            // List sessions
            const listedSessions = manager.listSessions();

            // Each listed session should have a control socket path
            for (const listed of listedSessions) {
              expect(listed.controlSocketPath).toBeDefined();
              expect(typeof listed.controlSocketPath).toBe('string');
              expect(listed.controlSocketPath).toMatch(/^\/tmp\/ssh-mcp-[0-9a-f-]+$/);

              // Find the corresponding created session
              const created = createdSessions.find((s) => s.id === listed.id);
              expect(created).toBeDefined();
              expect(listed.controlSocketPath).toBe(created?.controlSocketPath);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Session IDs should be valid UUIDs
  describe('Additional Property: Session IDs are valid UUIDs', () => {
    it('should generate valid UUID v4 format for all session IDs', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            // where y is one of [8, 9, a, b]
            const uuidRegex =
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(session.id).toMatch(uuidRegex);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Timestamps should be consistent
  describe('Additional Property: Timestamps are consistent', () => {
    it('should set createdAt and lastUsedAt to the same time initially', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Initially, both timestamps should be the same
            expect(session.createdAt.getTime()).toBe(session.lastUsedAt.getTime());

            // Both should be valid dates
            expect(session.createdAt).toBeInstanceOf(Date);
            expect(session.lastUsedAt).toBeInstanceOf(Date);

            // Should be recent (within last second)
            const now = Date.now();
            expect(session.createdAt.getTime()).toBeLessThanOrEqual(now);
            expect(session.createdAt.getTime()).toBeGreaterThan(now - 1000);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Configuration merging
  describe('Additional Property: Configuration is properly merged', () => {
    it('should merge partial config with defaults correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
            config: fc.option(
              fc.oneof(
                // Either a config with some defined values
                fc.record({
                  strictHostKeyChecking: fc.boolean(),
                  connectTimeout: fc.integer({ min: 1, max: 300 }),
                  serverAliveInterval: fc.integer({ min: 0, max: 600 }),
                  compression: fc.boolean(),
                  forwardAgent: fc.boolean(),
                  customOptions: fc.dictionary(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    fc.string({ minLength: 1, maxLength: 100 })
                  ),
                }),
                // Or a partial config with some optional fields
                fc.record({
                  strictHostKeyChecking: fc.option(fc.boolean(), { nil: undefined }),
                  connectTimeout: fc.option(fc.integer({ min: 1, max: 300 }), {
                    nil: undefined,
                  }),
                })
              ),
              { nil: undefined }
            ),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // All config fields should be defined (either from params or defaults)
            expect(session.config.strictHostKeyChecking).toBeDefined();
            expect(session.config.connectTimeout).toBeDefined();
            expect(session.config.serverAliveInterval).toBeDefined();
            expect(session.config.compression).toBeDefined();
            expect(session.config.forwardAgent).toBeDefined();
            expect(session.config.customOptions).toBeDefined();

            // If config was provided, those values should be used
            if (params.config) {
              if (params.config.strictHostKeyChecking !== undefined) {
                expect(session.config.strictHostKeyChecking).toBe(
                  params.config.strictHostKeyChecking
                );
              } else {
                // Default value
                expect(session.config.strictHostKeyChecking).toBe(true);
              }

              if (params.config.connectTimeout !== undefined) {
                expect(session.config.connectTimeout).toBe(params.config.connectTimeout);
              } else {
                // Default value
                expect(session.config.connectTimeout).toBe(30);
              }
            } else {
              // All defaults should be applied
              expect(session.config.strictHostKeyChecking).toBe(true);
              expect(session.config.connectTimeout).toBe(30);
              expect(session.config.serverAliveInterval).toBe(60);
              expect(session.config.compression).toBe(true);
              expect(session.config.forwardAgent).toBe(false);
              expect(session.config.customOptions).toEqual({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 5: Session status reflects control socket state
  // **Validates: Requirements 6.3**
  describe('Property 5: Session status reflects control socket state', () => {
    it('should return false for isSessionActive when control socket does not exist', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // In tests, control socket files won't exist
            // So isSessionActive should return false
            expect(manager.isSessionActive(session.id)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for non-existent session IDs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (sessionId: string) => {
            const manager = new ConnectionManager();
            // Any random string should return false
            expect(manager.isSessionActive(sessionId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false when session has no control socket path', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Manually remove control socket path
            const sessionObj = manager.getSession(session.id);
            if (sessionObj) {
              sessionObj.controlSocketPath = undefined;
            }

            // Should return false
            expect(manager.isSessionActive(session.id)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 6: Session information includes all metadata
  // **Validates: Requirements 6.4**
  describe('Property 6: Session information includes all metadata', () => {
    it('should return complete session information for any valid session', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
            username: fc.string({ minLength: 1, maxLength: 32 }),
            keyPath: fc.option(
              fc.string({ minLength: 1, maxLength: 255 }),
              { nil: undefined }
            ),
            config: fc.option(
              fc.record({
                strictHostKeyChecking: fc.boolean(),
                connectTimeout: fc.integer({ min: 1, max: 300 }),
                serverAliveInterval: fc.integer({ min: 0, max: 600 }),
                compression: fc.boolean(),
                forwardAgent: fc.boolean(),
                customOptions: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 50 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ),
              }),
              { nil: undefined }
            ),
          }),
          (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);
            const info = manager.getSessionInfo(session.id);

            // Info should not be null
            expect(info).not.toBeNull();

            if (info) {
              // Status should be either 'active' or 'inactive'
              expect(['active', 'inactive']).toContain(info.status);

              // Parameters should match the session
              expect(info.parameters.host).toBe(session.host);
              expect(info.parameters.port).toBe(session.port);
              expect(info.parameters.username).toBe(session.username);
              expect(info.parameters.keyPath).toBe(session.keyPath);
              expect(info.parameters.controlSocketPath).toBe(session.controlSocketPath);

              // Config should be present and complete
              expect(info.config).toBeDefined();
              expect(info.config.strictHostKeyChecking).toBeDefined();
              expect(info.config.connectTimeout).toBeDefined();
              expect(info.config.serverAliveInterval).toBeDefined();
              expect(info.config.compression).toBeDefined();
              expect(info.config.forwardAgent).toBeDefined();
              expect(info.config.customOptions).toBeDefined();

              // Uptime should be non-negative
              expect(info.uptimeSeconds).toBeGreaterThanOrEqual(0);

              // Timestamps should be valid dates
              expect(info.createdAt).toBeInstanceOf(Date);
              expect(info.lastUsedAt).toBeInstanceOf(Date);

              // Timestamps should match the session
              expect(info.createdAt.getTime()).toBe(session.createdAt.getTime());
              expect(info.lastUsedAt.getTime()).toBe(session.lastUsedAt.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for non-existent session IDs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (sessionId: string) => {
            const manager = new ConnectionManager();
            // Any random string should return null
            expect(manager.getSessionInfo(sessionId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate uptime correctly based on creation time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          async (params: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Get initial info
            const info1 = manager.getSessionInfo(session.id);
            expect(info1).not.toBeNull();
            const uptime1 = info1?.uptimeSeconds ?? 0;

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get info again
            const info2 = manager.getSessionInfo(session.id);
            expect(info2).not.toBeNull();
            const uptime2 = info2?.uptimeSeconds ?? 0;

            // Uptime should have increased (or at least not decreased)
            expect(uptime2).toBeGreaterThanOrEqual(uptime1);
          }
        ),
        { numRuns: 50 } // Fewer runs due to async delay
      );
    });
  });

  // Feature: ssh-mcp-server, Property 7: Session configuration updates are persisted
  // **Validates: Requirements 6.5**
  describe('Property 7: Session configuration updates are persisted', () => {
    it('should persist any valid configuration update', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.record({
            strictHostKeyChecking: fc.option(fc.boolean(), { nil: undefined }),
            connectTimeout: fc.option(fc.integer({ min: 1, max: 300 }), {
              nil: undefined,
            }),
            serverAliveInterval: fc.option(fc.integer({ min: 0, max: 600 }), {
              nil: undefined,
            }),
            compression: fc.option(fc.boolean(), { nil: undefined }),
            forwardAgent: fc.option(fc.boolean(), { nil: undefined }),
            customOptions: fc.option(
              fc.dictionary(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 100 })
              ),
              { nil: undefined }
            ),
          }),
          (params: ConnectionParams, configUpdate) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Update the configuration
            const updated = manager.updateSessionConfig(session.id, configUpdate);
            expect(updated).toBe(true);

            // Retrieve the session
            const retrievedSession = manager.getSession(session.id);
            expect(retrievedSession).not.toBeNull();

            if (retrievedSession) {
              // Verify each updated field is persisted
              if (configUpdate.strictHostKeyChecking !== undefined) {
                expect(retrievedSession.config.strictHostKeyChecking).toBe(
                  configUpdate.strictHostKeyChecking
                );
              }
              if (configUpdate.connectTimeout !== undefined) {
                expect(retrievedSession.config.connectTimeout).toBe(
                  configUpdate.connectTimeout
                );
              }
              if (configUpdate.serverAliveInterval !== undefined) {
                expect(retrievedSession.config.serverAliveInterval).toBe(
                  configUpdate.serverAliveInterval
                );
              }
              if (configUpdate.compression !== undefined) {
                expect(retrievedSession.config.compression).toBe(configUpdate.compression);
              }
              if (configUpdate.forwardAgent !== undefined) {
                expect(retrievedSession.config.forwardAgent).toBe(
                  configUpdate.forwardAgent
                );
              }
              if (configUpdate.customOptions !== undefined) {
                // Custom options should be merged
                for (const [key, value] of Object.entries(configUpdate.customOptions)) {
                  expect(retrievedSession.config.customOptions[key]).toBe(value);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for non-existent session IDs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.record({
            connectTimeout: fc.integer({ min: 1, max: 300 }),
          }),
          (sessionId: string, configUpdate) => {
            const manager = new ConnectionManager();
            // Any random string should return false
            expect(manager.updateSessionConfig(sessionId, configUpdate)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update lastUsedAt timestamp on configuration update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.record({
            connectTimeout: fc.integer({ min: 1, max: 300 }),
          }),
          async (params: ConnectionParams, configUpdate) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);
            const originalLastUsed = session.lastUsedAt.getTime();

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            // Update configuration
            manager.updateSessionConfig(session.id, configUpdate);

            // Retrieve session
            const retrievedSession = manager.getSession(session.id);
            expect(retrievedSession).not.toBeNull();

            if (retrievedSession) {
              // lastUsedAt should have been updated
              expect(retrievedSession.lastUsedAt.getTime()).toBeGreaterThan(
                originalLastUsed
              );
            }
          }
        ),
        { numRuns: 50 } // Fewer runs due to async delay
      );
    });

    it('should merge custom options without losing existing ones', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
            config: fc.record({
              customOptions: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 100 }),
                { minKeys: 1, maxKeys: 5 }
              ),
            }),
          }),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            { minKeys: 1, maxKeys: 5 }
          ),
          (params: ConnectionParams, newOptions) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);
            const originalOptions = { ...session.config.customOptions };

            // Update with new custom options
            manager.updateSessionConfig(session.id, {
              customOptions: newOptions,
            });

            // Retrieve session
            const retrievedSession = manager.getSession(session.id);
            expect(retrievedSession).not.toBeNull();

            if (retrievedSession) {
              // All original options should still be present (unless overwritten)
              for (const [key, value] of Object.entries(originalOptions)) {
                if (!(key in newOptions)) {
                  expect(retrievedSession.config.customOptions[key]).toBe(value);
                }
              }

              // All new options should be present
              for (const [key, value] of Object.entries(newOptions)) {
                expect(retrievedSession.config.customOptions[key]).toBe(value);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be retrievable via getSessionInfo after update', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.record({
            connectTimeout: fc.integer({ min: 1, max: 300 }),
            compression: fc.boolean(),
          }),
          (params: ConnectionParams, configUpdate) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(params);

            // Update configuration
            manager.updateSessionConfig(session.id, configUpdate);

            // Get session info
            const info = manager.getSessionInfo(session.id);
            expect(info).not.toBeNull();

            if (info) {
              // Updated config should be reflected in session info
              expect(info.config.connectTimeout).toBe(configUpdate.connectTimeout);
              expect(info.config.compression).toBe(configUpdate.compression);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 22: Port forward tracking stores configuration
  // **Validates: Requirements 5.4**
  describe('Property 22: Port forward tracking stores configuration', () => {
    it('should store all port forward configuration when added', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
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
          (sessionParams: ConnectionParams, forwardConfig: any) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(sessionParams);

            // Add port forward
            const forward = manager.addPortForward(session.id, forwardConfig);

            // Retrieve the port forward
            const retrieved = manager.getPortForward(forward.id);

            // Should not be null
            expect(retrieved).not.toBeNull();

            if (retrieved) {
              // Should store session ID
              expect(retrieved.sessionId).toBe(session.id);

              // Should store type
              expect(retrieved.config.type).toBe(forwardConfig.type);

              // Should store configuration
              expect(retrieved.config).toEqual(forwardConfig);

              // Should have a creation timestamp
              expect(retrieved.createdAt).toBeInstanceOf(Date);
              expect(retrieved.createdAt.getTime()).toBeLessThanOrEqual(Date.now());

              // Should have an ID
              expect(retrieved.id).toBe(forward.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track multiple port forwards independently', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.array(
            fc.oneof(
              fc.record({
                type: fc.constant('local' as const),
                localPort: fc.integer({ min: 1024, max: 65535 }),
                remoteHost: fc.domain(),
                remotePort: fc.integer({ min: 1, max: 65535 }),
              }),
              fc.record({
                type: fc.constant('dynamic' as const),
                localPort: fc.integer({ min: 1024, max: 65535 }),
              })
            ),
            { minLength: 2, maxLength: 10 }
          ),
          (sessionParams: ConnectionParams, forwardConfigs: any[]) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(sessionParams);

            const forwards: import('../../src/core/types.js').PortForward[] = [];

            // Add all port forwards
            for (const config of forwardConfigs) {
              const forward = manager.addPortForward(session.id, config);
              forwards.push(forward);
            }

            // Each forward should be retrievable with correct configuration
            for (let i = 0; i < forwards.length; i++) {
              const retrieved = manager.getPortForward(forwards[i].id);
              expect(retrieved).not.toBeNull();

              if (retrieved) {
                expect(retrieved.sessionId).toBe(session.id);
                expect(retrieved.config.type).toBe(forwardConfigs[i].type);
                expect(retrieved.config).toEqual(forwardConfigs[i]);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove port forward from tracking when closed', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.record({
            type: fc.constant('local' as const),
            localPort: fc.integer({ min: 1024, max: 65535 }),
            remoteHost: fc.domain(),
            remotePort: fc.integer({ min: 1, max: 65535 }),
          }),
          (sessionParams: ConnectionParams, forwardConfig: any) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(sessionParams);

            // Add port forward
            const forward = manager.addPortForward(session.id, forwardConfig);

            // Verify it exists
            expect(manager.getPortForward(forward.id)).not.toBeNull();

            // Remove it
            manager.removePortForward(forward.id);

            // Should no longer exist
            expect(manager.getPortForward(forward.id)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for non-existent port forward IDs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (forwardId: string) => {
            const manager = new ConnectionManager();
            // Any random string should return null
            expect(manager.getPortForward(forwardId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: ssh-mcp-server, Property 23: Port forward listing returns all tunnels
  // **Validates: Requirements 5.6**
  describe('Property 23: Port forward listing returns all tunnels', () => {
    it('should return all active port forwards with complete metadata', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.array(
            fc.oneof(
              fc.record({
                type: fc.constant('local' as const),
                localPort: fc.integer({ min: 1024, max: 65535 }),
                remoteHost: fc.domain(),
                remotePort: fc.integer({ min: 1, max: 65535 }),
              }),
              fc.record({
                type: fc.constant('remote' as const),
                remotePort: fc.integer({ min: 1024, max: 65535 }),
                localPort: fc.integer({ min: 1024, max: 65535 }),
              }),
              fc.record({
                type: fc.constant('dynamic' as const),
                localPort: fc.integer({ min: 1024, max: 65535 }),
              })
            ),
            { minLength: 0, maxLength: 15 }
          ),
          (sessionParams: ConnectionParams, forwardConfigs: any[]) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(sessionParams);

            const addedForwards: import('../../src/core/types.js').PortForward[] = [];

            // Add all port forwards
            for (const config of forwardConfigs) {
              const forward = manager.addPortForward(session.id, config);
              addedForwards.push(forward);
            }

            // List all port forwards
            const listedForwards = manager.listPortForwards();

            // Should have the same number of forwards
            expect(listedForwards.length).toBe(forwardConfigs.length);

            // Each added forward should be in the list with complete information
            for (let i = 0; i < addedForwards.length; i++) {
              const listed = listedForwards.find((f) => f.id === addedForwards[i].id);
              expect(listed).toBeDefined();

              if (listed) {
                // Verify all metadata is present and correct
                expect(listed.id).toBe(addedForwards[i].id);
                expect(listed.sessionId).toBe(session.id);
                expect(listed.config.type).toBe(forwardConfigs[i].type);
                expect(listed.config).toEqual(forwardConfigs[i]);
                expect(listed.createdAt).toBeInstanceOf(Date);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no port forwards exist', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // Fresh manager should have no port forwards
            const freshManager = new ConnectionManager();
            const forwards = freshManager.listPortForwards();
            expect(forwards).toEqual([]);
            expect(forwards.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should list port forwards by session ID', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              host: fc.domain(),
              username: fc.string({ minLength: 1, maxLength: 32 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              type: fc.constant('local' as const),
              localPort: fc.integer({ min: 1024, max: 65535 }),
              remoteHost: fc.domain(),
              remotePort: fc.integer({ min: 1, max: 65535 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (sessionParamsArray: ConnectionParams[], forwardConfigs: any[]) => {
            const manager = new ConnectionManager();

            // Create multiple sessions
            const sessions = sessionParamsArray.map((params) =>
              manager.createSession(params)
            );

            // Add port forwards to each session
            const forwardsBySession = new Map<string, string[]>();

            for (const session of sessions) {
              const sessionForwards: string[] = [];

              for (const config of forwardConfigs) {
                const forward = manager.addPortForward(session.id, config);
                sessionForwards.push(forward.id);
              }

              forwardsBySession.set(session.id, sessionForwards);
            }

            // List port forwards for each session
            for (const session of sessions) {
              const sessionForwards = manager.listPortForwardsBySession(session.id);
              const expectedForwards = forwardsBySession.get(session.id) || [];

              // Should have the correct number of forwards for this session
              expect(sessionForwards.length).toBe(expectedForwards.length);

              // Each forward should belong to this session
              for (const forward of sessionForwards) {
                expect(forward.sessionId).toBe(session.id);
                expect(expectedForwards).toContain(forward.id);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reflect port forward additions and removals in real-time', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          fc.array(
            fc.record({
              type: fc.constant('local' as const),
              localPort: fc.integer({ min: 1024, max: 65535 }),
              remoteHost: fc.domain(),
              remotePort: fc.integer({ min: 1, max: 65535 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (sessionParams: ConnectionParams, forwardConfigs: any[]) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(sessionParams);

            // Start with empty list
            expect(manager.listPortForwards().length).toBe(0);

            const forwards: import('../../src/core/types.js').PortForward[] = [];

            // Add port forwards one by one and verify count
            for (let i = 0; i < forwardConfigs.length; i++) {
              const forward = manager.addPortForward(session.id, forwardConfigs[i]);
              forwards.push(forward);
              expect(manager.listPortForwards().length).toBe(i + 1);
            }

            // Remove port forwards one by one and verify count
            for (let i = 0; i < forwards.length; i++) {
              manager.removePortForward(forwards[i].id);
              expect(manager.listPortForwards().length).toBe(
                forwards.length - i - 1
              );
            }

            // Should be empty again
            expect(manager.listPortForwards().length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for session with no port forwards', () => {
      fc.assert(
        fc.property(
          fc.record({
            host: fc.domain(),
            username: fc.string({ minLength: 1, maxLength: 32 }),
          }),
          (sessionParams: ConnectionParams) => {
            const manager = new ConnectionManager();
            const session = manager.createSession(sessionParams);

            // Session has no port forwards
            const forwards = manager.listPortForwardsBySession(session.id);
            expect(forwards).toEqual([]);
            expect(forwards.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});