/**
 * Security Utilities for SSH MCP Server
 * 
 * Provides functions for:
 * - Scrubbing sensitive data from error messages and logs
 * - Security event logging
 * - Credential protection
 */

/**
 * Patterns for detecting sensitive data in strings
 * These patterns match common formats for credentials and secrets
 */
const SENSITIVE_PATTERNS = [
  // Passphrase patterns
  { pattern: /passphrase[:\s]+[^\s\n]+/gi, replacement: 'passphrase: [REDACTED]' },
  { pattern: /Enter passphrase[^\n]*/gi, replacement: 'Enter passphrase: [REDACTED]' },
  { pattern: /-N\s+['"]?[^'"]+['"]?/g, replacement: '-N [REDACTED]' },
  
  // Password patterns
  { pattern: /password[:\s]+[^\s\n]+/gi, replacement: 'password: [REDACTED]' },
  { pattern: /passwd[:\s]+[^\s\n]+/gi, replacement: 'passwd: [REDACTED]' },
  { pattern: /Enter password[^\n]*/gi, replacement: 'Enter password: [REDACTED]' },
  
  // Private key patterns (OpenSSH format)
  { pattern: /-----BEGIN [A-Z\s]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+ PRIVATE KEY-----/g, replacement: '[PRIVATE KEY REDACTED]' },
  { pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g, replacement: '[PRIVATE KEY REDACTED]' },
  { pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g, replacement: '[PRIVATE KEY REDACTED]' },
  { pattern: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g, replacement: '[PRIVATE KEY REDACTED]' },
  { pattern: /-----BEGIN DSA PRIVATE KEY-----[\s\S]*?-----END DSA PRIVATE KEY-----/g, replacement: '[PRIVATE KEY REDACTED]' },
  
  // SSH key file content patterns
  { pattern: /ssh-keygen.*-N\s+['"]?[^'"]+['"]?/gi, replacement: 'ssh-keygen -N [REDACTED]' },
  
  // Authentication tokens and secrets
  { pattern: /token[:\s]+[^\s\n]+/gi, replacement: 'token: [REDACTED]' },
  { pattern: /secret[:\s]+[^\s\n]+/gi, replacement: 'secret: [REDACTED]' },
  { pattern: /api[_-]?key[:\s]+[^\s\n]+/gi, replacement: 'api_key: [REDACTED]' },
  
  // Environment variable assignments with sensitive data
  { pattern: /PASSWORD=[^\s]+/gi, replacement: 'PASSWORD=[REDACTED]' },
  { pattern: /PASSPHRASE=[^\s]+/gi, replacement: 'PASSPHRASE=[REDACTED]' },
  { pattern: /TOKEN=[^\s]+/gi, replacement: 'TOKEN=[REDACTED]' },
  { pattern: /SECRET=[^\s]+/gi, replacement: 'SECRET=[REDACTED]' },
];

/**
 * Scrub sensitive data from a string
 * 
 * This function removes or redacts sensitive information such as:
 * - Passphrases and passwords
 * - Private keys
 * - Authentication tokens
 * - API keys and secrets
 * 
 * The function preserves the structure and readability of error messages
 * while ensuring no sensitive data is exposed.
 * 
 * @param input - String that may contain sensitive data
 * @returns String with sensitive data replaced by [REDACTED] markers
 * 
 * @example
 * ```typescript
 * const error = "Enter passphrase for key: mysecret123";
 * const scrubbed = scrubSensitiveData(error);
 * // Returns: "Enter passphrase: [REDACTED]"
 * ```
 * 
 * Validates: Requirements 8.2
 */
export function scrubSensitiveData(input: string): string {
  if (!input) {
    return input;
  }

  let scrubbed = input;

  // Apply each pattern to scrub sensitive data
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }

  return scrubbed;
}

/**
 * Scrub sensitive data from an Error object
 * 
 * Creates a new Error with scrubbed message while preserving
 * the error type and stack trace.
 * 
 * @param error - Error object that may contain sensitive data
 * @returns New Error object with scrubbed message
 * 
 * @example
 * ```typescript
 * try {
 *   // Some operation that fails with sensitive data in error
 * } catch (error) {
 *   throw scrubError(error);
 * }
 * ```
 */
export function scrubError(error: Error): Error {
  const scrubbedMessage = scrubSensitiveData(error.message);
  const scrubbedError = new Error(scrubbedMessage);
  scrubbedError.name = error.name;
  scrubbedError.stack = error.stack;
  return scrubbedError;
}

/**
 * Scrub sensitive data from command arguments
 * 
 * Specifically handles command-line arguments that may contain
 * sensitive data, such as -N flag for ssh-keygen.
 * 
 * @param args - Array of command arguments
 * @returns Array with sensitive arguments redacted
 * 
 * @example
 * ```typescript
 * const args = ['ssh-keygen', '-t', 'rsa', '-N', 'mysecret'];
 * const scrubbed = scrubCommandArgs(args);
 * // Returns: ['ssh-keygen', '-t', 'rsa', '-N', '[REDACTED]']
 * ```
 */
export function scrubCommandArgs(args: string[]): string[] {
  const scrubbed = [...args];
  
  // Find flags that precede sensitive values
  const sensitiveFlags = ['-N', '--passphrase', '--password'];
  
  for (let i = 0; i < scrubbed.length - 1; i++) {
    if (sensitiveFlags.includes(scrubbed[i])) {
      // Redact the next argument
      scrubbed[i + 1] = '[REDACTED]';
    }
  }
  
  return scrubbed;
}

/**
 * Check if a string contains sensitive data
 * 
 * Useful for validation and testing to ensure sensitive data
 * is not present in logs or error messages.
 * 
 * @param input - String to check
 * @returns True if sensitive data patterns are detected
 * 
 * @example
 * ```typescript
 * const message = "Connection failed";
 * const hasSensitive = containsSensitiveData(message); // false
 * 
 * const error = "Enter passphrase for key: secret123";
 * const hasSensitive2 = containsSensitiveData(error); // true
 * ```
 */
export function containsSensitiveData(input: string): boolean {
  if (!input) {
    return false;
  }

  // Check if any sensitive pattern matches
  for (const { pattern } of SENSITIVE_PATTERNS) {
    // Reset regex lastIndex to ensure fresh matching
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Security event types
 */
export type SecurityEventType = 
  | 'AUTH_FAILED'
  | 'MULTIPLE_AUTH_FAILURES'
  | 'HOST_KEY_MISMATCH'
  | 'SUSPICIOUS_ACTIVITY'
  | 'CONNECTION_REFUSED'
  | 'TIMEOUT';

/**
 * Security event structure
 */
export interface SecurityEvent {
  timestamp: Date;
  sessionId: string | null;
  eventType: SecurityEventType;
  details: string;
  host?: string;
  username?: string;
}

/**
 * In-memory storage for security events
 * In a production system, this would be persisted to a database or log file
 */
const securityEvents: SecurityEvent[] = [];

/**
 * Track authentication failures per session for suspicious activity detection
 */
const authFailureTracker = new Map<string, { count: number; lastFailure: Date }>();

/**
 * Log a security event
 * 
 * Records security-related events such as failed authentication attempts,
 * suspicious activity, and host key mismatches. Events include timestamp,
 * session ID, event type, and details.
 * 
 * This function also tracks multiple authentication failures per session
 * and logs suspicious activity when a threshold is exceeded.
 * 
 * @param event - Security event to log
 * 
 * @example
 * ```typescript
 * logSecurityEvent({
 *   timestamp: new Date(),
 *   sessionId: '550e8400-e29b-41d4-a716-446655440000',
 *   eventType: 'AUTH_FAILED',
 *   details: 'Public key authentication failed',
 *   host: 'example.com',
 *   username: 'user'
 * });
 * ```
 * 
 * Validates: Requirements 8.6
 */
export function logSecurityEvent(event: SecurityEvent): void {
  // Store the event
  securityEvents.push(event);

  // Track authentication failures for suspicious activity detection
  if (event.eventType === 'AUTH_FAILED' && event.sessionId) {
    const tracker = authFailureTracker.get(event.sessionId);
    
    if (tracker) {
      tracker.count++;
      tracker.lastFailure = event.timestamp;
      
      // Log suspicious activity if multiple failures detected
      // Threshold: 3 failures within 5 minutes
      const FAILURE_THRESHOLD = 3;
      const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
      
      if (tracker.count >= FAILURE_THRESHOLD) {
        const timeSinceFirst = event.timestamp.getTime() - tracker.lastFailure.getTime();
        
        if (timeSinceFirst <= TIME_WINDOW_MS) {
          // Log suspicious activity
          securityEvents.push({
            timestamp: new Date(),
            sessionId: event.sessionId,
            eventType: 'MULTIPLE_AUTH_FAILURES',
            details: `${tracker.count} authentication failures detected for session ${event.sessionId}`,
            host: event.host,
            username: event.username,
          });
        }
      }
    } else {
      // First failure for this session
      authFailureTracker.set(event.sessionId, {
        count: 1,
        lastFailure: event.timestamp,
      });
    }
  }

  // In a production system, this would write to a log file or database
  // For now, we keep events in memory for testing and debugging
  // Example: console.error(`[SECURITY] ${event.eventType}: ${event.details}`);
}

/**
 * Get all security events
 * 
 * Returns all logged security events. Useful for auditing and analysis.
 * 
 * @returns Array of all security events
 * 
 * @example
 * ```typescript
 * const events = getSecurityEvents();
 * events.forEach(event => {
 *   console.log(`${event.timestamp}: ${event.eventType} - ${event.details}`);
 * });
 * ```
 */
export function getSecurityEvents(): SecurityEvent[] {
  return [...securityEvents];
}

/**
 * Get security events for a specific session
 * 
 * Returns all security events associated with a particular session.
 * 
 * @param sessionId - Session ID to filter by
 * @returns Array of security events for the specified session
 * 
 * @example
 * ```typescript
 * const events = getSecurityEventsBySession('550e8400-e29b-41d4-a716-446655440000');
 * console.log(`Session has ${events.length} security events`);
 * ```
 */
export function getSecurityEventsBySession(sessionId: string): SecurityEvent[] {
  return securityEvents.filter(event => event.sessionId === sessionId);
}

/**
 * Clear all security events
 * 
 * Removes all logged security events from memory. Useful for testing.
 * 
 * @example
 * ```typescript
 * clearSecurityEvents();
 * ```
 */
export function clearSecurityEvents(): void {
  securityEvents.length = 0;
  authFailureTracker.clear();
}

/**
 * Get authentication failure count for a session
 * 
 * Returns the number of authentication failures tracked for a session.
 * 
 * @param sessionId - Session ID to check
 * @returns Number of authentication failures, or 0 if none tracked
 * 
 * @example
 * ```typescript
 * const failures = getAuthFailureCount('550e8400-e29b-41d4-a716-446655440000');
 * if (failures >= 3) {
 *   console.log('Multiple authentication failures detected');
 * }
 * ```
 */
export function getAuthFailureCount(sessionId: string): number {
  const tracker = authFailureTracker.get(sessionId);
  return tracker ? tracker.count : 0;
}
