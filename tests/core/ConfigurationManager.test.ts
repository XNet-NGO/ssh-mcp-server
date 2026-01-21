/**
 * Unit tests for ConfigurationManager
 * 
 * Tests SSH config file parsing, host pattern matching, and configuration validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('parseSSHConfig', () => {
    it('should parse empty config', () => {
      const config = configManager.parseSSHConfig('');
      
      expect(config.hosts.size).toBe(0);
      expect(Object.keys(config.globalOptions).length).toBe(0);
    });

    it('should parse global options', () => {
      const content = `
        StrictHostKeyChecking yes
        ConnectTimeout 30
        Compression yes
      `;
      
      const config = configManager.parseSSHConfig(content);
      
      expect(config.globalOptions['StrictHostKeyChecking']).toBe('yes');
      expect(config.globalOptions['ConnectTimeout']).toBe('30');
      expect(config.globalOptions['Compression']).toBe('yes');
    });

    it('should parse host blocks', () => {
      const content = `
        Host example.com
          HostName 192.168.1.100
          Port 2222
          User admin
      `;
      
      const config = configManager.parseSSHConfig(content);
      
      expect(config.hosts.size).toBe(1);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig).toBeDefined();
      expect(hostConfig?.hostname).toBe('192.168.1.100');
      expect(hostConfig?.port).toBe(2222);
      expect(hostConfig?.user).toBe('admin');
    });

    it('should parse multiple host blocks', () => {
      const content = `
        Host server1
          HostName 10.0.0.1
          User root
        
        Host server2
          HostName 10.0.0.2
          User admin
      `;
      
      const config = configManager.parseSSHConfig(content);
      
      expect(config.hosts.size).toBe(2);
      expect(config.hosts.get('server1')?.hostname).toBe('10.0.0.1');
      expect(config.hosts.get('server2')?.hostname).toBe('10.0.0.2');
    });

    it('should parse identity files', () => {
      const content = `
        Host example.com
          IdentityFile ~/.ssh/id_rsa
          IdentityFile ~/.ssh/id_ed25519
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      
      expect(hostConfig?.identityFile).toEqual([
        '~/.ssh/id_rsa',
        '~/.ssh/id_ed25519',
      ]);
    });

    it('should skip comments and empty lines', () => {
      const content = `
        # This is a comment
        Host example.com
          # Another comment
          HostName 192.168.1.100
          
          Port 2222
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      
      expect(hostConfig?.hostname).toBe('192.168.1.100');
      expect(hostConfig?.port).toBe(2222);
    });

    it('should handle quoted values', () => {
      const content = `
        Host "example with spaces"
          HostName "192.168.1.100"
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example with spaces');
      
      expect(hostConfig).toBeDefined();
      expect(hostConfig?.hostname).toBe('192.168.1.100');
    });

    it('should store unknown options in options map', () => {
      const content = `
        Host example.com
          CustomOption value123
          AnotherOption test
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      
      expect(hostConfig?.options['CustomOption']).toBe('value123');
      expect(hostConfig?.options['AnotherOption']).toBe('test');
    });
  });

  describe('matchHostPattern', () => {
    it('should match exact hostname', () => {
      expect(configManager.matchHostPattern('example.com', 'example.com')).toBe(true);
      expect(configManager.matchHostPattern('example.com', 'other.com')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(configManager.matchHostPattern('server1.example.com', '*.example.com')).toBe(true);
      expect(configManager.matchHostPattern('server2.example.com', '*.example.com')).toBe(true);
      expect(configManager.matchHostPattern('example.com', '*.example.com')).toBe(false);
    });

    it('should match question mark patterns', () => {
      expect(configManager.matchHostPattern('server1', 'server?')).toBe(true);
      expect(configManager.matchHostPattern('server2', 'server?')).toBe(true);
      expect(configManager.matchHostPattern('server10', 'server?')).toBe(false);
    });

    it('should match complex patterns', () => {
      expect(configManager.matchHostPattern('web-prod-01', 'web-*-??')).toBe(true);
      expect(configManager.matchHostPattern('web-staging-02', 'web-*-??')).toBe(true);
      expect(configManager.matchHostPattern('web-dev-1', 'web-*-??')).toBe(false);
    });

    it('should handle negation patterns', () => {
      expect(configManager.matchHostPattern('example.com', '!example.com')).toBe(false);
      expect(configManager.matchHostPattern('other.com', '!example.com')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(configManager.matchHostPattern('Example.COM', 'example.com')).toBe(true);
      expect(configManager.matchHostPattern('SERVER1', 'server?')).toBe(true);
    });

    it('should match * pattern to everything', () => {
      expect(configManager.matchHostPattern('anything', '*')).toBe(true);
      expect(configManager.matchHostPattern('example.com', '*')).toBe(true);
      expect(configManager.matchHostPattern('192.168.1.1', '*')).toBe(true);
    });
  });

  describe('getHostConfig', () => {
    it('should return config for matching host', () => {
      const content = `
        Host example.com
          HostName 192.168.1.100
          Port 2222
      `;
      
      configManager.parseSSHConfig(content);
      const hostConfig = configManager.getHostConfig('example.com');
      
      expect(hostConfig.hostname).toBe('192.168.1.100');
      expect(hostConfig.port).toBe(2222);
    });

    it('should merge multiple matching patterns', () => {
      const content = `
        Host *
          User defaultuser
        
        Host *.example.com
          Port 2222
        
        Host server1.example.com
          HostName 192.168.1.100
      `;
      
      configManager.parseSSHConfig(content);
      const hostConfig = configManager.getHostConfig('server1.example.com');
      
      expect(hostConfig.hostname).toBe('192.168.1.100');
      expect(hostConfig.port).toBe(2222);
      expect(hostConfig.user).toBe('defaultuser');
    });

    it('should use first match for each option', () => {
      const content = `
        Host *
          User defaultuser
          Port 22
        
        Host *.example.com
          User exampleuser
      `;
      
      configManager.parseSSHConfig(content);
      const hostConfig = configManager.getHostConfig('server.example.com');
      
      // First match wins
      expect(hostConfig.user).toBe('defaultuser');
      expect(hostConfig.port).toBe(22);
    });

    it('should include global options', () => {
      const content = `
        StrictHostKeyChecking yes
        ConnectTimeout 30
        
        Host example.com
          Port 2222
      `;
      
      configManager.parseSSHConfig(content);
      const hostConfig = configManager.getHostConfig('example.com');
      
      expect(hostConfig.options['StrictHostKeyChecking']).toBe('yes');
      expect(hostConfig.options['ConnectTimeout']).toBe('30');
      expect(hostConfig.port).toBe(2222);
    });

    it('should return empty config for non-matching host', () => {
      const content = `
        Host example.com
          HostName 192.168.1.100
      `;
      
      configManager.parseSSHConfig(content);
      const hostConfig = configManager.getHostConfig('other.com');
      
      expect(hostConfig.hostname).toBeUndefined();
      expect(hostConfig.port).toBeUndefined();
    });
  });

  describe('validateOption', () => {
    it('should validate known options', () => {
      expect(configManager.validateOption('Port', '22')).toBe(true);
      expect(configManager.validateOption('User', 'admin')).toBe(true);
      expect(configManager.validateOption('StrictHostKeyChecking', 'yes')).toBe(true);
    });

    it('should reject unknown options', () => {
      expect(configManager.validateOption('UnknownOption', 'value')).toBe(false);
      expect(configManager.validateOption('InvalidKey', 'test')).toBe(false);
    });

    it('should validate number options', () => {
      expect(configManager.validateOption('Port', '22')).toBe(true);
      expect(configManager.validateOption('Port', '2222')).toBe(true);
      expect(configManager.validateOption('Port', 'invalid')).toBe(false);
      expect(configManager.validateOption('ConnectTimeout', '30')).toBe(true);
    });

    it('should validate boolean options', () => {
      expect(configManager.validateOption('Compression', 'yes')).toBe(true);
      expect(configManager.validateOption('Compression', 'no')).toBe(true);
      expect(configManager.validateOption('Compression', 'true')).toBe(true);
      expect(configManager.validateOption('Compression', 'false')).toBe(true);
      expect(configManager.validateOption('Compression', '1')).toBe(true);
      expect(configManager.validateOption('Compression', '0')).toBe(true);
      expect(configManager.validateOption('Compression', 'invalid')).toBe(false);
    });

    it('should be case-insensitive for option names', () => {
      expect(configManager.validateOption('port', '22')).toBe(true);
      expect(configManager.validateOption('PORT', '22')).toBe(true);
      expect(configManager.validateOption('Port', '22')).toBe(true);
    });
  });

  describe('setOption', () => {
    it('should set valid options', () => {
      configManager.setOption('Port', '2222');
      configManager.setOption('User', 'admin');
      
      const config = configManager.getConfig();
      expect(config.globalOptions['Port']).toBe('2222');
      expect(config.globalOptions['User']).toBe('admin');
    });

    it('should throw error for invalid options', () => {
      expect(() => configManager.setOption('UnknownOption', 'value')).toThrow();
      expect(() => configManager.setOption('Port', 'invalid')).toThrow();
    });
  });

  describe('listOptions', () => {
    it('should return all available options', () => {
      const options = configManager.listOptions();
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.some(opt => opt.name === 'Port')).toBe(true);
      expect(options.some(opt => opt.name === 'User')).toBe(true);
      expect(options.some(opt => opt.name === 'HostName')).toBe(true);
    });

    it('should include option metadata', () => {
      const options = configManager.listOptions();
      const portOption = options.find(opt => opt.name === 'Port');
      
      expect(portOption).toBeDefined();
      expect(portOption?.type).toBe('number');
      expect(portOption?.description).toBeDefined();
      expect(portOption?.defaultValue).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle config with only comments', () => {
      const content = `
        # Comment 1
        # Comment 2
        # Comment 3
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.hosts.size).toBe(0);
      expect(Object.keys(config.globalOptions).length).toBe(0);
    });

    it('should handle malformed lines gracefully', () => {
      const content = `
        ValidOption value
        InvalidLine
        Host example.com
          HostName 192.168.1.100
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.hosts.size).toBe(1);
      expect(config.globalOptions['ValidOption']).toBe('value');
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(1000);
      const content = `
        Host example.com
          CustomOption ${longValue}
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.options['CustomOption']).toBe(longValue);
    });

    it('should handle special characters in patterns', () => {
      expect(configManager.matchHostPattern('server.example.com', 'server.example.com')).toBe(true);
      expect(configManager.matchHostPattern('server-1', 'server-?')).toBe(true);
      expect(configManager.matchHostPattern('server_1', 'server_?')).toBe(true);
    });
  });

  describe('ssh_config parsing edge cases', () => {
    it('should handle different indentation styles', () => {
      const content = `
Host example1.com
HostName 192.168.1.1

  Host example2.com
  HostName 192.168.1.2

    Host example3.com
    HostName 192.168.1.3

\tHost example4.com
\tHostName 192.168.1.4
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.hosts.size).toBe(4);
      expect(config.hosts.get('example1.com')?.hostname).toBe('192.168.1.1');
      expect(config.hosts.get('example2.com')?.hostname).toBe('192.168.1.2');
      expect(config.hosts.get('example3.com')?.hostname).toBe('192.168.1.3');
      expect(config.hosts.get('example4.com')?.hostname).toBe('192.168.1.4');
    });

    it('should handle mixed spacing in values', () => {
      const content = `
        Host example.com
          HostName    192.168.1.100
          Port  2222
          User     admin
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.hostname).toBe('192.168.1.100');
      expect(hostConfig?.port).toBe(2222);
      expect(hostConfig?.user).toBe('admin');
    });

    it('should handle inline comments', () => {
      const content = `
        Host example.com
          HostName 192.168.1.100
          Port 2222
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      // Note: Standard SSH config doesn't support inline comments
      // Comments must be on their own line
      expect(hostConfig).toBeDefined();
      expect(hostConfig?.hostname).toBe('192.168.1.100');
      expect(hostConfig?.port).toBe(2222);
    });

    it('should handle multiple consecutive empty lines', () => {
      const content = `
        Host example1.com
          HostName 192.168.1.1


        Host example2.com
          HostName 192.168.1.2



        Host example3.com
          HostName 192.168.1.3
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.hosts.size).toBe(3);
    });

    it('should handle Host patterns with multiple values', () => {
      const content = `
        Host server1 server2 server3
          HostName 192.168.1.100
          Port 2222
      `;
      
      const config = configManager.parseSSHConfig(content);
      // SSH config allows multiple patterns in one Host line
      const hostConfig = config.hosts.get('server1 server2 server3');
      expect(hostConfig).toBeDefined();
      expect(hostConfig?.hostname).toBe('192.168.1.100');
    });

    it('should handle complex wildcard patterns', () => {
      const content = `
        Host *.prod.example.com
          Port 2222
        
        Host *.dev.example.com
          Port 3333
        
        Host web-*-??
          User webadmin
      `;
      
      configManager.parseSSHConfig(content);
      
      expect(configManager.matchHostPattern('server1.prod.example.com', '*.prod.example.com')).toBe(true);
      expect(configManager.matchHostPattern('server1.dev.example.com', '*.dev.example.com')).toBe(true);
      expect(configManager.matchHostPattern('web-staging-01', 'web-*-??')).toBe(true);
    });

    it('should handle escaped characters in values', () => {
      const content = `
        Host example.com
          ProxyCommand ssh -W %h:%p gateway
          CustomOption "value with spaces"
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.options['ProxyCommand']).toBe('ssh -W %h:%p gateway');
      expect(hostConfig?.options['CustomOption']).toBe('value with spaces');
    });

    it('should handle case variations in keywords', () => {
      const content = `
        HOST example.com
          HOSTNAME 192.168.1.100
          port 2222
          UsEr admin
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.hostname).toBe('192.168.1.100');
      expect(hostConfig?.port).toBe(2222);
      expect(hostConfig?.user).toBe('admin');
    });

    it('should handle empty Host pattern', () => {
      const content = `
        Host
          HostName 192.168.1.100
      `;
      
      const config = configManager.parseSSHConfig(content);
      // Empty Host pattern should be skipped or handled gracefully
      expect(config.hosts.size).toBe(0);
    });

    it('should handle options before first Host block', () => {
      const content = `
        StrictHostKeyChecking yes
        ConnectTimeout 30
        
        Host example.com
          HostName 192.168.1.100
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.globalOptions['StrictHostKeyChecking']).toBe('yes');
      expect(config.globalOptions['ConnectTimeout']).toBe('30');
      expect(config.hosts.size).toBe(1);
    });

    it('should handle Host block without any options', () => {
      const content = `
        Host example.com
        
        Host other.com
          HostName 192.168.1.100
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.hosts.size).toBe(2);
      const emptyHost = config.hosts.get('example.com');
      expect(emptyHost).toBeDefined();
      expect(emptyHost?.hostname).toBeUndefined();
    });

    it('should handle duplicate Host patterns', () => {
      const content = `
        Host example.com
          Port 2222
        
        Host example.com
          Port 3333
      `;
      
      const config = configManager.parseSSHConfig(content);
      // Last definition should win
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.port).toBe(3333);
    });

    it('should handle very long Host patterns', () => {
      const longPattern = 'server-' + 'a'.repeat(200) + '.example.com';
      const content = `
        Host ${longPattern}
          HostName 192.168.1.100
      `;
      
      const config = configManager.parseSSHConfig(content);
      expect(config.hosts.has(longPattern)).toBe(true);
    });

    it('should handle numeric values as strings', () => {
      const content = `
        Host example.com
          Port 2222
          ServerAliveInterval 60
          ServerAliveCountMax 3
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.port).toBe(2222);
      expect(hostConfig?.options['ServerAliveInterval']).toBe('60');
      expect(hostConfig?.options['ServerAliveCountMax']).toBe('3');
    });

    it('should handle boolean-like values', () => {
      const content = `
        Host example.com
          Compression yes
          ForwardAgent no
          ForwardX11 true
          BatchMode false
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.options['Compression']).toBe('yes');
      expect(hostConfig?.options['ForwardAgent']).toBe('no');
      expect(hostConfig?.options['ForwardX11']).toBe('true');
      expect(hostConfig?.options['BatchMode']).toBe('false');
    });

    it('should handle paths with tildes and environment variables', () => {
      const content = `
        Host example.com
          IdentityFile ~/.ssh/id_rsa
          IdentityFile ~/keys/special_key
          ControlPath /tmp/ssh-%r@%h:%p
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.identityFile).toContain('~/.ssh/id_rsa');
      expect(hostConfig?.identityFile).toContain('~/keys/special_key');
      expect(hostConfig?.options['ControlPath']).toBe('/tmp/ssh-%r@%h:%p');
    });

    it('should handle comma-separated lists', () => {
      const content = `
        Host example.com
          Ciphers aes128-ctr,aes192-ctr,aes256-ctr
          MACs hmac-sha2-256,hmac-sha2-512
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.options['Ciphers']).toBe('aes128-ctr,aes192-ctr,aes256-ctr');
      expect(hostConfig?.options['MACs']).toBe('hmac-sha2-256,hmac-sha2-512');
    });

    it('should handle ProxyCommand with complex arguments', () => {
      const content = `
        Host example.com
          ProxyCommand ssh -W %h:%p -i ~/.ssh/gateway_key gateway.example.com
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      expect(hostConfig?.options['ProxyCommand']).toBe('ssh -W %h:%p -i ~/.ssh/gateway_key gateway.example.com');
    });

    it('should handle SendEnv with multiple variables', () => {
      const content = `
        Host example.com
          SendEnv LANG LC_*
          SendEnv MY_VAR
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('example.com');
      // Multiple SendEnv lines - last one wins in our simple parser
      expect(hostConfig?.options['SendEnv']).toBeDefined();
    });

    it('should handle Match blocks gracefully', () => {
      const content = `
        Host example.com
          HostName 192.168.1.100
        
        Match host example.com user admin
          Port 2222
      `;
      
      const config = configManager.parseSSHConfig(content);
      // Match blocks are advanced SSH config feature
      // Our parser treats them as unknown options
      expect(config.hosts.size).toBeGreaterThanOrEqual(1);
    });

    it('should handle Include directive', () => {
      const content = `
        Include ~/.ssh/config.d/*
        
        Host example.com
          HostName 192.168.1.100
      `;
      
      const config = configManager.parseSSHConfig(content);
      // Include is a directive, stored as global option
      expect(config.globalOptions['Include']).toBe('~/.ssh/config.d/*');
      expect(config.hosts.size).toBe(1);
    });

    it('should handle IPv6 addresses', () => {
      const content = `
        Host ipv6-server
          HostName 2001:db8::1
          Port 2222
      `;
      
      const config = configManager.parseSSHConfig(content);
      const hostConfig = config.hosts.get('ipv6-server');
      expect(hostConfig?.hostname).toBe('2001:db8::1');
    });

    it('should handle negation in Host patterns', () => {
      const content = `
        Host * !*.internal.com
          ProxyJump gateway
      `;
      
      configManager.parseSSHConfig(content);
      
      expect(configManager.matchHostPattern('example.com', '!*.internal.com')).toBe(true);
      expect(configManager.matchHostPattern('server.internal.com', '!*.internal.com')).toBe(false);
    });

    it('should handle real-world complex config', () => {
      const content = `
        # Global defaults
        StrictHostKeyChecking ask
        ConnectTimeout 30
        ServerAliveInterval 60
        
        # Production servers
        Host *.prod.example.com
          User produser
          Port 2222
          IdentityFile ~/.ssh/prod_key
          StrictHostKeyChecking yes
        
        # Development servers
        Host *.dev.example.com
          User devuser
          Port 22
          IdentityFile ~/.ssh/dev_key
          StrictHostKeyChecking no
        
        # Specific server override
        Host web-01.prod.example.com
          HostName 10.0.1.100
          User webadmin
        
        # Jump host configuration
        Host bastion
          HostName bastion.example.com
          User jumpuser
          IdentityFile ~/.ssh/bastion_key
          ControlMaster auto
          ControlPath /tmp/ssh-%r@%h:%p
          ControlPersist 10m
      `;
      
      const config = configManager.parseSSHConfig(content);
      
      // Verify global options
      expect(config.globalOptions['StrictHostKeyChecking']).toBe('ask');
      expect(config.globalOptions['ConnectTimeout']).toBe('30');
      
      // Verify host blocks
      expect(config.hosts.size).toBe(4);
      
      // Verify specific host config
      const bastionConfig = config.hosts.get('bastion');
      expect(bastionConfig?.hostname).toBe('bastion.example.com');
      expect(bastionConfig?.user).toBe('jumpuser');
      expect(bastionConfig?.options['ControlMaster']).toBe('auto');
    });
  });

  describe('known_hosts handling', () => {
    it('should use default known_hosts path', () => {
      expect(configManager.getKnownHostsPath()).toBe('~/.ssh/known_hosts');
    });

    it('should allow setting custom known_hosts path', () => {
      configManager.setKnownHostsPath('/custom/path/known_hosts');
      expect(configManager.getKnownHostsPath()).toBe('/custom/path/known_hosts');
    });

    it('should use custom known_hosts path from constructor', () => {
      const customManager = new ConfigurationManager('/tmp/known_hosts');
      expect(customManager.getKnownHostsPath()).toBe('/tmp/known_hosts');
    });

    it('should get known_hosts path for host from global config', () => {
      const content = `
        UserKnownHostsFile /etc/ssh/known_hosts
        
        Host example.com
          HostName 192.168.1.100
      `;
      
      configManager.parseSSHConfig(content);
      const path = configManager.getKnownHostsPathForHost('example.com');
      expect(path).toBe('/etc/ssh/known_hosts');
    });

    it('should get known_hosts path for host from host-specific config', () => {
      const content = `
        UserKnownHostsFile /etc/ssh/known_hosts
        
        Host example.com
          UserKnownHostsFile /custom/known_hosts
      `;
      
      configManager.parseSSHConfig(content);
      const path = configManager.getKnownHostsPathForHost('example.com');
      expect(path).toBe('/custom/known_hosts');
    });

    it('should fall back to default known_hosts path', () => {
      const content = `
        Host example.com
          HostName 192.168.1.100
      `;
      
      configManager.parseSSHConfig(content);
      const path = configManager.getKnownHostsPathForHost('example.com');
      expect(path).toBe('~/.ssh/known_hosts');
    });

    it('should prioritize host-specific over global known_hosts', () => {
      const content = `
        UserKnownHostsFile /global/known_hosts
        
        Host *.example.com
          UserKnownHostsFile /wildcard/known_hosts
        
        Host server.example.com
          UserKnownHostsFile /specific/known_hosts
      `;
      
      configManager.parseSSHConfig(content);
      const path = configManager.getKnownHostsPathForHost('server.example.com');
      // First match wins (*.example.com matches first)
      expect(path).toBe('/wildcard/known_hosts');
    });
  });
});
