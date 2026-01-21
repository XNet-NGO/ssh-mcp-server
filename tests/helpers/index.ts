/**
 * Test helper utilities
 */

import type { Session, ConnectionConfig } from '../../src/core/types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a test session with default values
 */
export function createTestSession(overrides?: Partial<Session>): Session {
  const defaultConfig: ConnectionConfig = {
    strictHostKeyChecking: true,
    connectTimeout: 30,
    serverAliveInterval: 60,
    compression: true,
    forwardAgent: false,
    customOptions: {},
  };

  const now = new Date();

  return {
    id: uuidv4(),
    host: 'test.example.com',
    port: 22,
    username: 'testuser',
    createdAt: now,
    lastUsedAt: now,
    config: defaultConfig,
    ...overrides,
  };
}

/**
 * Create a test connection config with default values
 */
export function createTestConfig(
  overrides?: Partial<ConnectionConfig>
): ConnectionConfig {
  return {
    strictHostKeyChecking: true,
    connectTimeout: 30,
    serverAliveInterval: 60,
    compression: true,
    forwardAgent: false,
    customOptions: {},
    ...overrides,
  };
}
