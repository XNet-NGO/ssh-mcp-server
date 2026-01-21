/**
 * Unit tests for SSHWrapper class
 * 
 * Tests the command construction logic for SSH operations including:
 * - Basic connection parameters (host, port, username)
 * - Key authentication
 * - ControlMaster configuration
 * - SSH configuration options
 * - Custom ssh_config options
 * - Environment variables
 * - Port forwarding commands
 * - Command execution with subprocess management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SSHWrapper } from '../../src/core/SSHWrapper.js';
import { Session, PortForwardConfig } from '../../src/core/types.js';
import { EventEmitter } from 'events';

describe('SSHWrapper', () => {
  let wrapper: SSHWrapper;
  let basicSession: Session;

  beforeEach(() => {
    wrapper = new SSHWrapper();
    
    // Create a basic session for testing
    basicSession = {
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
    };
  });

  describe('buildSSHCommand', () => {
    it('should include basic connection parameters', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args).toContain('ssh');
      expect(args).toContain('-p');
      expect(args).toContain('22');
      expect(args).toContain('-l');
      expect(args).toContain('testuser');
      expect(args).toContain('example.com');
      expect(args[args.length - 1]).toBe('echo test');
    });

    it('should include key authentication when keyPath is provided', () => {
      const sessionWithKey: Session = {
        ...basicSession,
        keyPath: '/home/user/.ssh/id_rsa',
      };

      const args = wrapper.buildSSHCommand(sessionWithKey, 'echo test', {});

      expect(args).toContain('-i');
      expect(args).toContain('/home/user/.ssh/id_rsa');
    });

    it('should not include -i flag when keyPath is not provided', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args).not.toContain('-i');
    });

    it('should include ControlMaster options when controlSocketPath is provided', () => {
      const sessionWithControl: Session = {
        ...basicSession,
        controlSocketPath: '/tmp/ssh-mcp-test-123',
      };

      const args = wrapper.buildSSHCommand(sessionWithControl, 'echo test', {});

      // Check for ControlPath
      expect(args).toContain('-o');
      expect(args.some(arg => arg.includes('ControlPath=/tmp/ssh-mcp-test-123'))).toBe(true);
      
      // Check for ControlMaster=auto
      expect(args.some(arg => arg.includes('ControlMaster=auto'))).toBe(true);
      
      // Check for ControlPersist
      expect(args.some(arg => arg.includes('ControlPersist=10m'))).toBe(true);
    });

    it('should not include ControlMaster options when controlSocketPath is not provided', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args.some(arg => arg.includes('ControlPath='))).toBe(false);
      expect(args.some(arg => arg.includes('ControlMaster='))).toBe(false);
      expect(args.some(arg => arg.includes('ControlPersist='))).toBe(false);
    });

    it('should include StrictHostKeyChecking=yes when enabled', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args.some(arg => arg === 'StrictHostKeyChecking=yes')).toBe(true);
    });

    it('should include StrictHostKeyChecking=no when disabled', () => {
      const sessionNoStrict: Session = {
        ...basicSession,
        config: {
          ...basicSession.config,
          strictHostKeyChecking: false,
        },
      };

      const args = wrapper.buildSSHCommand(sessionNoStrict, 'echo test', {});

      expect(args.some(arg => arg === 'StrictHostKeyChecking=no')).toBe(true);
    });

    it('should include ConnectTimeout configuration', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args.some(arg => arg === 'ConnectTimeout=30')).toBe(true);
    });

    it('should include ServerAliveInterval configuration', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args.some(arg => arg === 'ServerAliveInterval=60')).toBe(true);
    });

    it('should include Compression=yes when enabled', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args.some(arg => arg === 'Compression=yes')).toBe(true);
    });

    it('should include Compression=no when disabled', () => {
      const sessionNoCompression: Session = {
        ...basicSession,
        config: {
          ...basicSession.config,
          compression: false,
        },
      };

      const args = wrapper.buildSSHCommand(sessionNoCompression, 'echo test', {});

      expect(args.some(arg => arg === 'Compression=no')).toBe(true);
    });

    it('should include ForwardAgent=no when disabled', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args.some(arg => arg === 'ForwardAgent=no')).toBe(true);
    });

    it('should include ForwardAgent=yes when enabled', () => {
      const sessionWithAgent: Session = {
        ...basicSession,
        config: {
          ...basicSession.config,
          forwardAgent: true,
        },
      };

      const args = wrapper.buildSSHCommand(sessionWithAgent, 'echo test', {});

      expect(args.some(arg => arg === 'ForwardAgent=yes')).toBe(true);
    });

    it('should include custom ssh_config options', () => {
      const sessionWithCustom: Session = {
        ...basicSession,
        config: {
          ...basicSession.config,
          customOptions: {
            'ServerAliveCountMax': '3',
            'TCPKeepAlive': 'yes',
            'LogLevel': 'DEBUG',
          },
        },
      };

      const args = wrapper.buildSSHCommand(sessionWithCustom, 'echo test', {});

      expect(args.some(arg => arg === 'ServerAliveCountMax=3')).toBe(true);
      expect(args.some(arg => arg === 'TCPKeepAlive=yes')).toBe(true);
      expect(args.some(arg => arg === 'LogLevel=DEBUG')).toBe(true);
    });

    it('should include SendEnv for environment variables', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {
        env: {
          'MY_VAR': 'value1',
          'ANOTHER_VAR': 'value2',
        },
      });

      expect(args.some(arg => arg === 'SendEnv=MY_VAR')).toBe(true);
      expect(args.some(arg => arg === 'SendEnv=ANOTHER_VAR')).toBe(true);
    });

    it('should include -t flag when pty is requested', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', { pty: true });

      expect(args).toContain('-t');
      expect(args).not.toContain('-T');
    });

    it('should include -T flag when pty is not requested', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', { pty: false });

      expect(args).toContain('-T');
      expect(args).not.toContain('-t');
    });

    it('should default to -T flag when pty is not specified', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args).toContain('-T');
      expect(args).not.toContain('-t');
    });

    it('should handle empty command', () => {
      const args = wrapper.buildSSHCommand(basicSession, '', {});

      expect(args).toContain('example.com');
      expect(args[args.length - 1]).toBe('example.com');
    });

    it('should handle custom port', () => {
      const sessionCustomPort: Session = {
        ...basicSession,
        port: 2222,
      };

      const args = wrapper.buildSSHCommand(sessionCustomPort, 'echo test', {});

      expect(args).toContain('-p');
      expect(args).toContain('2222');
    });

    it('should construct command in correct order', () => {
      const sessionFull: Session = {
        ...basicSession,
        keyPath: '/home/user/.ssh/id_rsa',
        controlSocketPath: '/tmp/ssh-mcp-test',
        config: {
          ...basicSession.config,
          customOptions: {
            'ServerAliveCountMax': '3',
          },
        },
      };

      const args = wrapper.buildSSHCommand(sessionFull, 'echo test', {});

      // Verify ssh binary is first
      expect(args[0]).toBe('ssh');

      // Verify host is near the end (before command)
      const hostIndex = args.indexOf('example.com');
      expect(hostIndex).toBeGreaterThan(0);
      expect(hostIndex).toBe(args.length - 2); // host, then command

      // Verify command is last and not escaped (spawn passes args directly)
      expect(args[args.length - 1]).toBe('echo test');
    });
  });

  describe('buildPortForwardCommand', () => {
    it('should build local port forward command', () => {
      const forward: PortForwardConfig = {
        type: 'local',
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 80,
      };

      const args = wrapper.buildPortForwardCommand(basicSession, forward);

      expect(args).toContain('-L');
      expect(args).toContain('8080:localhost:80');
      expect(args).toContain('-N');
      expect(args).toContain('example.com');
    });

    it('should build remote port forward command', () => {
      const forward: PortForwardConfig = {
        type: 'remote',
        remotePort: 8080,
        localPort: 80,
      };

      const args = wrapper.buildPortForwardCommand(basicSession, forward);

      expect(args).toContain('-R');
      expect(args).toContain('8080:localhost:80');
      expect(args).toContain('-N');
      expect(args).toContain('example.com');
    });

    it('should build dynamic SOCKS proxy command', () => {
      const forward: PortForwardConfig = {
        type: 'dynamic',
        localPort: 1080,
      };

      const args = wrapper.buildPortForwardCommand(basicSession, forward);

      expect(args).toContain('-D');
      expect(args).toContain('1080');
      expect(args).toContain('-N');
      expect(args).toContain('example.com');
    });

    it('should include -f flag when background is true', () => {
      const forward: PortForwardConfig = {
        type: 'dynamic',
        localPort: 1080,
      };

      const args = wrapper.buildPortForwardCommand(basicSession, forward, true);

      expect(args).toContain('-f');
    });

    it('should not include -f flag when background is false', () => {
      const forward: PortForwardConfig = {
        type: 'dynamic',
        localPort: 1080,
      };

      const args = wrapper.buildPortForwardCommand(basicSession, forward, false);

      expect(args).not.toContain('-f');
    });

    it('should throw error for local forward without required parameters', () => {
      const forward: PortForwardConfig = {
        type: 'local',
        localPort: 8080,
        // Missing remoteHost and remotePort
      };

      expect(() => wrapper.buildPortForwardCommand(basicSession, forward)).toThrow(
        'Local forward requires localPort, remoteHost, and remotePort'
      );
    });

    it('should throw error for remote forward without required parameters', () => {
      const forward: PortForwardConfig = {
        type: 'remote',
        remotePort: 8080,
        // Missing localPort
      };

      expect(() => wrapper.buildPortForwardCommand(basicSession, forward)).toThrow(
        'Remote forward requires remotePort and localPort'
      );
    });

    it('should throw error for dynamic forward without localPort', () => {
      const forward: PortForwardConfig = {
        type: 'dynamic',
        // Missing localPort
      };

      expect(() => wrapper.buildPortForwardCommand(basicSession, forward)).toThrow(
        'Dynamic forward requires localPort'
      );
    });

    it('should include ControlMaster options in port forward command', () => {
      const sessionWithControl: Session = {
        ...basicSession,
        controlSocketPath: '/tmp/ssh-mcp-test',
      };

      const forward: PortForwardConfig = {
        type: 'dynamic',
        localPort: 1080,
      };

      const args = wrapper.buildPortForwardCommand(sessionWithControl, forward);

      expect(args.some(arg => arg.includes('ControlPath=/tmp/ssh-mcp-test'))).toBe(true);
      expect(args.some(arg => arg.includes('ControlMaster=auto'))).toBe(true);
    });
  });

  describe('binary path configuration', () => {
    it('should use default ssh binary path', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args[0]).toBe('ssh');
    });

    it('should use custom ssh binary path', () => {
      const customWrapper = new SSHWrapper('/usr/local/bin/ssh');
      const args = customWrapper.buildSSHCommand(basicSession, 'echo test', {});

      expect(args[0]).toBe('/usr/local/bin/ssh');
    });

    it('should get ssh binary path', () => {
      expect(wrapper.getSshBinaryPath()).toBe('ssh');
    });

    it('should set ssh binary path', () => {
      wrapper.setSshBinaryPath('/custom/path/ssh');
      expect(wrapper.getSshBinaryPath()).toBe('/custom/path/ssh');
    });
  });

  describe('edge cases', () => {
    it('should handle session with all optional fields', () => {
      const fullSession: Session = {
        ...basicSession,
        keyPath: '/home/user/.ssh/id_ed25519',
        controlSocketPath: '/tmp/ssh-mcp-full',
        config: {
          strictHostKeyChecking: false,
          connectTimeout: 60,
          serverAliveInterval: 120,
          compression: false,
          forwardAgent: true,
          customOptions: {
            'ServerAliveCountMax': '5',
            'TCPKeepAlive': 'yes',
            'LogLevel': 'VERBOSE',
            'IdentitiesOnly': 'yes',
          },
        },
      };

      const args = wrapper.buildSSHCommand(fullSession, 'ls -la', {
        pty: true,
        env: {
          'LANG': 'en_US.UTF-8',
          'TERM': 'xterm-256color',
        },
      });

      // Verify all options are included
      expect(args).toContain('-i');
      expect(args).toContain('/home/user/.ssh/id_ed25519');
      expect(args.some(arg => arg.includes('ControlPath='))).toBe(true);
      expect(args.some(arg => arg === 'StrictHostKeyChecking=no')).toBe(true);
      expect(args.some(arg => arg === 'ConnectTimeout=60')).toBe(true);
      expect(args.some(arg => arg === 'ServerAliveInterval=120')).toBe(true);
      expect(args.some(arg => arg === 'Compression=no')).toBe(true);
      expect(args.some(arg => arg === 'ForwardAgent=yes')).toBe(true);
      expect(args.some(arg => arg === 'ServerAliveCountMax=5')).toBe(true);
      expect(args.some(arg => arg === 'TCPKeepAlive=yes')).toBe(true);
      expect(args.some(arg => arg === 'LogLevel=VERBOSE')).toBe(true);
      expect(args.some(arg => arg === 'IdentitiesOnly=yes')).toBe(true);
      expect(args.some(arg => arg === 'SendEnv=LANG')).toBe(true);
      expect(args.some(arg => arg === 'SendEnv=TERM')).toBe(true);
      expect(args).toContain('-t');
      expect(args[args.length - 1]).toBe('ls -la');
    });

    it('should handle session with minimal configuration', () => {
      const minimalSession: Session = {
        id: 'minimal',
        host: '192.168.1.100',
        port: 22,
        username: 'root',
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
      };

      const args = wrapper.buildSSHCommand(minimalSession, 'uptime', {});

      expect(args).toContain('ssh');
      expect(args).toContain('-p');
      expect(args).toContain('22');
      expect(args).toContain('-l');
      expect(args).toContain('root');
      expect(args).toContain('192.168.1.100');
      expect(args[args.length - 1]).toBe('uptime');
    });

    it('should handle empty customOptions', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', {});

      // Should not throw and should still include standard options
      expect(args).toContain('ssh');
      expect(args).toContain('example.com');
    });

    it('should handle empty env options', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo test', { env: {} });

      // Should not include any SendEnv options
      expect(args.some(arg => arg.includes('SendEnv='))).toBe(false);
    });
  });

  describe('escapeCommand', () => {
    it('should wrap simple commands in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo hello');
      expect(escaped).toBe("'echo hello'");
    });

    it('should handle double quotes by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo "hello world"');
      expect(escaped).toBe("'echo \"hello world\"'");
    });

    it('should escape single quotes correctly', () => {
      const escaped = wrapper.escapeCommand("echo 'hello'");
      expect(escaped).toBe("'echo '\\''hello'\\'''");
    });

    it('should handle backticks by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo `whoami`');
      expect(escaped).toBe("'echo `whoami`'");
    });

    it('should handle dollar signs by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo $HOME');
      expect(escaped).toBe("'echo $HOME'");
    });

    it('should handle semicolons by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo hello; rm -rf /');
      expect(escaped).toBe("'echo hello; rm -rf /'");
    });

    it('should handle pipes by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('cat file | grep pattern');
      expect(escaped).toBe("'cat file | grep pattern'");
    });

    it('should handle ampersands by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo hello && echo world');
      expect(escaped).toBe("'echo hello && echo world'");
    });

    it('should handle angle brackets by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('cat < input.txt > output.txt');
      expect(escaped).toBe("'cat < input.txt > output.txt'");
    });

    it('should handle parentheses by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('(echo hello)');
      expect(escaped).toBe("'(echo hello)'");
    });

    it('should handle backslashes by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo \\n\\t');
      expect(escaped).toBe("'echo \\n\\t'");
    });

    it('should handle newlines by wrapping in single quotes', () => {
      const escaped = wrapper.escapeCommand('echo hello\necho world');
      expect(escaped).toBe("'echo hello\necho world'");
    });

    it('should handle empty string', () => {
      const escaped = wrapper.escapeCommand('');
      expect(escaped).toBe('');
    });

    it('should handle complex injection attempt', () => {
      const escaped = wrapper.escapeCommand('"; rm -rf /; echo "gotcha');
      expect(escaped).toBe("'\"; rm -rf /; echo \"gotcha'");
    });

    it('should handle multiple single quotes', () => {
      const escaped = wrapper.escapeCommand("it's a nice day, isn't it?");
      expect(escaped).toBe("'it'\\''s a nice day, isn'\\''t it?'");
    });

    it('should handle mixed special characters', () => {
      const escaped = wrapper.escapeCommand('echo "$HOME" | grep `whoami` && rm -rf /; cat < /etc/passwd');
      expect(escaped).toBe("'echo \"$HOME\" | grep `whoami` && rm -rf /; cat < /etc/passwd'");
    });

    it('should handle unicode characters', () => {
      const escaped = wrapper.escapeCommand('echo "Hello 世界 🌍"');
      expect(escaped).toBe("'echo \"Hello 世界 🌍\"'");
    });

    it('should handle very long commands', () => {
      const longCommand = 'echo ' + 'a'.repeat(10000);
      const escaped = wrapper.escapeCommand(longCommand);
      expect(escaped).toBe(`'${longCommand}'`);
      expect(escaped.length).toBe(longCommand.length + 2); // +2 for the quotes
    });

    it('should handle command with only special characters', () => {
      const escaped = wrapper.escapeCommand('$`|;&<>()');
      expect(escaped).toBe("'$`|;&<>()'");
    });

    it('should handle nested quotes', () => {
      const escaped = wrapper.escapeCommand('echo "He said \'hello\'"');
      expect(escaped).toBe("'echo \"He said '\\''hello'\\''\"'");
    });
  });

  describe('command escaping integration', () => {
    it('should not escape commands in buildSSHCommand when using spawn', () => {
      const args = wrapper.buildSSHCommand(basicSession, 'echo "hello"; rm -rf /', {});
      
      const command = args[args.length - 1];
      // Commands are passed directly to spawn(), which doesn't use shell interpretation
      expect(command).toBe('echo "hello"; rm -rf /');
    });

    it('should pass dangerous commands as-is to SSH (SSH handles remote shell escaping)', () => {
      const dangerousCommand = 'rm -rf /; echo "gotcha"';
      const args = wrapper.buildSSHCommand(basicSession, dangerousCommand, {});
      
      const command = args[args.length - 1];
      // spawn() passes this directly to SSH, which will handle it properly
      expect(command).toBe('rm -rf /; echo "gotcha"');
    });

    it('should handle commands with single quotes in buildSSHCommand', () => {
      const args = wrapper.buildSSHCommand(basicSession, "echo 'hello world'", {});
      
      const command = args[args.length - 1];
      expect(command).toBe("echo 'hello world'");
    });

    it('should preserve command functionality without escaping', () => {
      // This test verifies that normal commands work without escaping
      const normalCommand = 'ls -la /tmp';
      const args = wrapper.buildSSHCommand(basicSession, normalCommand, {});
      
      const command = args[args.length - 1];
      expect(command).toBe('ls -la /tmp');
    });
  });

});
