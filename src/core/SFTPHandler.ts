/**
 * SFTPHandler - Manages file transfer operations using sftp and scp binaries
 * 
 * This class is responsible for:
 * - Uploading files to remote systems using sftp put command
 * - Downloading files from remote systems using sftp get command
 * - Uploading directories recursively using sftp put -r command
 * - Deleting files on remote systems using sftp rm command
 * - Creating SFTP batch commands for multiple operations
 * - Executing sftp commands via subprocess
 * 
 * The handler builds sftp command arrays and batch files that can be passed
 * to Node.js child_process functions for subprocess execution. All file
 * operations use the openssh-portable sftp command-line tool.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  Session,
  TransferResult,
  SFTPOperation,
  FileInfo,
} from './types.js';
import { scrubSensitiveData } from './SecurityUtils.js';

/**
 * SFTPHandler handles file transfer operations using sftp and scp
 * 
 * Validates Requirements:
 * - 3.1: Executes sftp put command to transfer local file to remote path
 * - 3.2: Executes sftp get command to transfer remote file to local path
 * - 3.5: Executes sftp with put -r flag to recursively transfer all files
 */
export class SFTPHandler {
  /** Path to sftp binary (default: 'sftp' from PATH) */
  private sftpBinaryPath: string;

  /** Path to scp binary (default: 'scp' from PATH) */
  private scpBinaryPath: string;
  
  /** Debug verbosity level (0-3) */
  private debugLevel: number;

  /**
   * Create a new SFTPHandler instance
   * 
   * @param sftpBinaryPath - Path to sftp binary (optional, defaults to 'sftp')
   * @param scpBinaryPath - Path to scp binary (optional, defaults to 'scp')
   * @param debugLevel - Debug verbosity level 0-3 (optional, defaults to 0)
   */
  constructor(
    sftpBinaryPath: string = 'sftp',
    scpBinaryPath: string = 'scp',
    debugLevel: number = 0
  ) {
    this.sftpBinaryPath = sftpBinaryPath;
    this.scpBinaryPath = scpBinaryPath;
    this.debugLevel = debugLevel;
  }

  /**
   * Build base SFTP command arguments for a session
   * 
   * Constructs the common SFTP command flags that are used for all operations:
   * - Port specification (-P)
   * - Key authentication (-i)
   * - Batch mode (-b) when using batch file
   * - Configuration options (-o)
   * 
   * @param session - Session object containing connection parameters
   * @param batchFile - Optional path to batch file for -b flag
   * @returns Array of command arguments
   * 
   * @example
   * ```typescript
   * const args = handler.buildSFTPBaseCommand(session);
   * // Returns: ['sftp', '-P', '22', '-i', '/path/to/key', 'user@host']
   * ```
   */
  private buildSFTPBaseCommand(session: Session, batchFile?: string): string[] {
    const args: string[] = [this.sftpBinaryPath];

    // Port specification
    // -P: Specifies the port to connect to on the remote host (capital P for sftp)
    args.push('-P', session.port.toString());

    // Key authentication
    // -i: Selects a file from which the identity (private key) is read
    if (session.keyPath) {
      args.push('-i', session.keyPath);
    }

    // Batch mode
    // -b: Batch mode reads commands from a file instead of stdin
    if (batchFile) {
      args.push('-b', batchFile);
    }

    // Configuration options
    // -o: Pass options to ssh in the format used in ssh_config
    args.push(
      '-o',
      `StrictHostKeyChecking=${session.config.strictHostKeyChecking ? 'yes' : 'no'}`
    );
    args.push('-o', `ConnectTimeout=${session.config.connectTimeout}`);

    // ControlMaster configuration for connection multiplexing
    if (session.controlSocketPath) {
      args.push('-o', `ControlPath=${session.controlSocketPath}`);
      args.push('-o', 'ControlMaster=auto');
      args.push('-o', 'ControlPersist=10m');
    }

    // Custom ssh_config options
    for (const [key, value] of Object.entries(session.config.customOptions)) {
      args.push('-o', `${key}=${value}`);
    }

    // Debug verbosity flags
    // Add -v flags based on debug level (0 = none, 1 = -v, 2 = -vv, 3 = -vvv)
    for (let i = 0; i < this.debugLevel; i++) {
      args.push('-v');
    }

    // User and host in format: user@host
    args.push(`${session.username}@${session.host}`);

    return args;
  }

  /**
   * Create an SFTP batch command file
   * 
   * Generates a temporary file containing SFTP commands for batch execution.
   * The batch file format is one command per line, which sftp reads when
   * invoked with the -b flag.
   * 
   * @param operations - Array of SFTP operations to include in batch
   * @returns Path to the created batch file
   * 
   * @example
   * ```typescript
   * const batchFile = handler.createSFTPBatch([
   *   { type: 'put', localPath: '/local/file.txt', remotePath: '/remote/file.txt' },
   *   { type: 'get', remotePath: '/remote/data.txt', localPath: '/local/data.txt' }
   * ]);
   * // Creates file with content:
   * // put /local/file.txt /remote/file.txt
   * // get /remote/data.txt /local/data.txt
   * ```
   */
  private createSFTPBatch(operations: SFTPOperation[]): string {
    const commands = operations.map((op) => {
      switch (op.type) {
        case 'put':
          if (!op.localPath) {
            throw new Error('put operation requires localPath');
          }
          return `put ${op.localPath} ${op.remotePath}`;
        
        case 'get':
          if (!op.localPath) {
            throw new Error('get operation requires localPath');
          }
          return `get ${op.remotePath} ${op.localPath}`;
        
        case 'ls':
          return `ls -la ${op.remotePath}`;
        
        case 'rm':
          return `rm ${op.remotePath}`;
        
        case 'mkdir':
          return `mkdir ${op.remotePath}`;
        
        case 'rmdir':
          return `rmdir ${op.remotePath}`;
        
        default:
          throw new Error(`Unknown operation type: ${(op as SFTPOperation).type}`);
      }
    });

    // Create temporary batch file
    const batchFilePath = join(tmpdir(), `sftp-batch-${randomUUID()}.txt`);
    writeFileSync(batchFilePath, commands.join('\n'), 'utf-8');

    return batchFilePath;
  }

  /**
   * Execute an SFTP command with optional batch file
   * 
   * Spawns an sftp subprocess and captures output. Handles both interactive
   * single commands and batch file execution.
   * 
   * @param session - Session object containing connection parameters
   * @param batchFile - Optional path to batch file
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to stdout and stderr output
   */
  private async executeSFTPCommand(
    session: Session,
    batchFile?: string,
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Build the SFTP command array
    const args = this.buildSFTPBaseCommand(session, batchFile);
    
    // Extract the binary path (first element) and arguments (rest)
    const binary = args[0];
    const cmdArgs = args.slice(1);
    
    return new Promise((resolve, reject) => {
      // Set up AbortController for timeout handling
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, timeout * 1000);
      }
      
      // Spawn the SFTP subprocess
      const child = spawn(binary, cmdArgs, {
        signal: abortController.signal,
      });
      
      // Buffers to accumulate stdout and stderr
      let stdout = '';
      let stderr = '';
      
      // Capture stdout
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      // Capture stderr
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code: number | null) => {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });
      
      // Handle process errors
      child.on('error', (error: Error) => {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Check if this is a timeout abort
        if (error.name === 'AbortError') {
          resolve({
            stdout,
            stderr: stderr + '\nSFTP operation timed out',
            exitCode: 124,
          });
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Upload a file to the remote system
   * 
   * Uses sftp put command to transfer a local file to a remote path.
   * The operation is performed using a batch file to ensure proper
   * command execution and error handling.
   * 
   * @param session - Session object containing connection parameters
   * @param localPath - Path to the local file to upload
   * @param remotePath - Destination path on the remote system
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to TransferResult with success status and metadata
   * 
   * @example
   * ```typescript
   * const result = await handler.uploadFile(
   *   session,
   *   '/local/document.pdf',
   *   '/remote/uploads/document.pdf'
   * );
   * if (result.success) {
   *   console.log(`Uploaded ${result.bytesTransferred} bytes in ${result.duration}ms`);
   * }
   * ```
   * 
   * Validates: Requirement 3.1
   */
  async uploadFile(
    session: Session,
    localPath: string,
    remotePath: string,
    timeout?: number
  ): Promise<TransferResult> {
    const startTime = Date.now();
    let batchFile: string | undefined;

    try {
      // Create batch file with put command
      batchFile = this.createSFTPBatch([
        { type: 'put', localPath, remotePath },
      ]);

      // Execute SFTP command
      const result = await this.executeSFTPCommand(session, batchFile, timeout);

      const duration = Date.now() - startTime;

      // Check if operation was successful
      if (result.exitCode === 0) {
        // Try to extract bytes transferred from output
        // SFTP output format varies, so we'll estimate based on file size if available
        const bytesTransferred = 0; // TODO: Parse from sftp output or stat file

        return {
          success: true,
          bytesTransferred,
          duration,
        };
      } else {
        return {
          success: false,
          bytesTransferred: 0,
          duration,
          error: scrubSensitiveData(result.stderr || 'Upload failed'),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        bytesTransferred: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Clean up batch file
      if (batchFile) {
        try {
          unlinkSync(batchFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Download a file from the remote system
   * 
   * Uses sftp get command to transfer a remote file to a local path.
   * The operation is performed using a batch file to ensure proper
   * command execution and error handling.
   * 
   * @param session - Session object containing connection parameters
   * @param remotePath - Path to the remote file to download
   * @param localPath - Destination path on the local system
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to TransferResult with success status and metadata
   * 
   * @example
   * ```typescript
   * const result = await handler.downloadFile(
   *   session,
   *   '/remote/logs/app.log',
   *   '/local/logs/app.log'
   * );
   * if (result.success) {
   *   console.log(`Downloaded ${result.bytesTransferred} bytes in ${result.duration}ms`);
   * }
   * ```
   * 
   * Validates: Requirement 3.2
   */
  async downloadFile(
    session: Session,
    remotePath: string,
    localPath: string,
    timeout?: number
  ): Promise<TransferResult> {
    const startTime = Date.now();
    let batchFile: string | undefined;

    try {
      // Create batch file with get command
      batchFile = this.createSFTPBatch([
        { type: 'get', remotePath, localPath },
      ]);

      // Execute SFTP command
      const result = await this.executeSFTPCommand(session, batchFile, timeout);

      const duration = Date.now() - startTime;

      // Check if operation was successful
      if (result.exitCode === 0) {
        // Try to extract bytes transferred from output
        const bytesTransferred = 0; // TODO: Parse from sftp output or stat file

        return {
          success: true,
          bytesTransferred,
          duration,
        };
      } else {
        return {
          success: false,
          bytesTransferred: 0,
          duration,
          error: scrubSensitiveData(result.stderr || 'Download failed'),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        bytesTransferred: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Clean up batch file
      if (batchFile) {
        try {
          unlinkSync(batchFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Upload a directory recursively to the remote system
   * 
   * Uses sftp put -r command to recursively transfer all files and
   * subdirectories from a local directory to a remote path.
   * 
   * @param session - Session object containing connection parameters
   * @param localPath - Path to the local directory to upload
   * @param remotePath - Destination path on the remote system
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to TransferResult with success status and metadata
   * 
   * @example
   * ```typescript
   * const result = await handler.uploadDirectory(
   *   session,
   *   '/local/project',
   *   '/remote/backups/project'
   * );
   * if (result.success) {
   *   console.log(`Uploaded directory in ${result.duration}ms`);
   * }
   * ```
   * 
   * Validates: Requirement 3.5
   */
  async uploadDirectory(
    session: Session,
    localPath: string,
    remotePath: string,
    timeout?: number
  ): Promise<TransferResult> {
    const startTime = Date.now();
    let batchFile: string | undefined;

    try {
      // Create batch file with put -r command
      // Note: The -r flag is part of the put command, not a separate flag
      batchFile = this.createSFTPBatch([
        { type: 'put', localPath: `${localPath}/*`, remotePath },
      ]);

      // For recursive directory upload, we need to modify the batch command
      // to include the -r flag with put
      const batchContent = `put -r ${localPath} ${remotePath}`;
      const batchFilePath = join(tmpdir(), `sftp-batch-${randomUUID()}.txt`);
      writeFileSync(batchFilePath, batchContent, 'utf-8');
      batchFile = batchFilePath;

      // Execute SFTP command
      const result = await this.executeSFTPCommand(session, batchFile, timeout);

      const duration = Date.now() - startTime;

      // Check if operation was successful
      if (result.exitCode === 0) {
        return {
          success: true,
          bytesTransferred: 0, // TODO: Calculate total bytes transferred
          duration,
        };
      } else {
        return {
          success: false,
          bytesTransferred: 0,
          duration,
          error: scrubSensitiveData(result.stderr || 'Directory upload failed'),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        bytesTransferred: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Clean up batch file
      if (batchFile) {
        try {
          unlinkSync(batchFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Delete a file on the remote system
   * 
   * Uses sftp rm command to delete a file on the remote system.
   * 
   * @param session - Session object containing connection parameters
   * @param remotePath - Path to the remote file to delete
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to TransferResult with success status
   * 
   * @example
   * ```typescript
   * const result = await handler.deleteFile(
   *   session,
   *   '/remote/temp/old-file.txt'
   * );
   * if (result.success) {
   *   console.log('File deleted successfully');
   * }
   * ```
   */
  async deleteFile(
    session: Session,
    remotePath: string,
    timeout?: number
  ): Promise<TransferResult> {
    const startTime = Date.now();
    let batchFile: string | undefined;

    try {
      // Create batch file with rm command
      batchFile = this.createSFTPBatch([
        { type: 'rm', remotePath },
      ]);

      // Execute SFTP command
      const result = await this.executeSFTPCommand(session, batchFile, timeout);

      const duration = Date.now() - startTime;

      // Check if operation was successful
      if (result.exitCode === 0) {
        return {
          success: true,
          bytesTransferred: 0,
          duration,
        };
      } else {
        return {
          success: false,
          bytesTransferred: 0,
          duration,
          error: scrubSensitiveData(result.stderr || 'Delete failed'),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        bytesTransferred: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Clean up batch file
      if (batchFile) {
        try {
          unlinkSync(batchFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * List contents of a remote directory
   * 
   * Uses sftp ls -la command to list directory contents and parses the output
   * into FileInfo objects containing metadata for each file and directory.
   * 
   * @param session - Session object containing connection parameters
   * @param remotePath - Path to the remote directory to list
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to array of FileInfo objects
   * 
   * @example
   * ```typescript
   * const files = await handler.listDirectory(
   *   session,
   *   '/remote/directory'
   * );
   * files.forEach(file => {
   *   console.log(`${file.name}: ${file.size} bytes, ${file.permissions}`);
   * });
   * ```
   * 
   * Validates: Requirement 3.6
   */
  async listDirectory(
    session: Session,
    remotePath: string,
    timeout?: number
  ): Promise<FileInfo[]> {
    let batchFile: string | undefined;

    try {
      // Create batch file with ls -la command
      batchFile = this.createSFTPBatch([
        { type: 'ls', remotePath },
      ]);

      // Execute SFTP command
      const result = await this.executeSFTPCommand(session, batchFile, timeout);

      // Check if operation was successful
      if (result.exitCode === 0) {
        // Parse the directory listing output
        return this.parseDirectoryListing(result.stdout, remotePath);
      } else {
        throw new Error(scrubSensitiveData(result.stderr || 'Directory listing failed'));
      }
    } catch (error) {
      throw new Error(
        `Failed to list directory: ${scrubSensitiveData(error instanceof Error ? error.message : 'Unknown error')}`
      );
    } finally {
      // Clean up batch file
      if (batchFile) {
        try {
          unlinkSync(batchFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Parse SFTP ls -la output into FileInfo objects
   * 
   * Parses the output from sftp ls -la command, which follows a format similar to
   * Unix ls -la. Each line represents a file or directory with the following format:
   * 
   * permissions links owner group size month day time/year name
   * 
   * Example line:
   * drwxr-xr-x    5 user  group      160 Jan 15 10:30 dirname
   * -rw-r--r--    1 user  group     1234 Dec 25 2023 filename.txt
   * 
   * @param output - Raw output from sftp ls -la command
   * @param basePath - Base path for constructing full file paths
   * @returns Array of FileInfo objects
   * 
   * @example
   * ```typescript
   * const output = `
   * drwxr-xr-x    5 user  group      160 Jan 15 10:30 docs
   * -rw-r--r--    1 user  group     1234 Dec 25 2023 readme.txt
   * `;
   * const files = handler.parseDirectoryListing(output, '/home/user');
   * // Returns:
   * // [
   * //   { name: 'docs', path: '/home/user/docs', size: 160, ... },
   * //   { name: 'readme.txt', path: '/home/user/readme.txt', size: 1234, ... }
   * // ]
   * ```
   */
  private parseDirectoryListing(output: string, basePath: string): FileInfo[] {
    const lines = output.split('\n').filter((line) => line.trim());
    const files: FileInfo[] = [];

    for (const line of lines) {
      // Skip empty lines and header lines
      if (!line.trim() || line.startsWith('total ')) {
        continue;
      }

      // Parse ls -la output format:
      // permissions links owner group size month day time/year name
      // Example: drwxr-xr-x    5 user  group      160 Jan 15 10:30 dirname
      // Example: -rw-r--r--    1 user  group     1234 Dec 25 2023 filename.txt
      
      // Match the ls -la format with flexible whitespace
      // Group 1: permissions (10 chars: type + 9 permission bits)
      //   - First char: file type (-, d, l, etc.)
      //   - Next 9 chars: permission bits (r, w, x, -, s, t, S, T)
      // Group 2: owner
      // Group 3: group
      // Group 4: size
      // Group 5: date (month day time/year)
      // Group 6: filename (everything after date)
      const match = line.match(
        /^([dlbcps-][rwxstST-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\w+\s+\d+\s+[\d:]+)\s+(.+)$/
      );

      if (!match) {
        // Try alternative format with year instead of time
        const altMatch = line.match(
          /^([dlbcps-][rwxstST-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\w+\s+\d+\s+\d{4})\s+(.+)$/
        );
        
        if (!altMatch) {
          // Skip lines that don't match expected format
          continue;
        }
        
        const [, permissions, owner, group, sizeStr, dateStr, name] = altMatch;
        files.push(this.createFileInfo(permissions, owner, group, sizeStr, dateStr, name, basePath));
        continue;
      }

      const [, permissions, owner, group, sizeStr, dateStr, name] = match;
      files.push(this.createFileInfo(permissions, owner, group, sizeStr, dateStr, name, basePath));
    }

    return files;
  }

  /**
   * Create a FileInfo object from parsed ls -la fields
   * 
   * @param permissions - Permission string (e.g., "drwxr-xr-x")
   * @param owner - Owner username
   * @param group - Group name
   * @param sizeStr - File size as string
   * @param dateStr - Date string (e.g., "Jan 15 10:30" or "Dec 25 2023")
   * @param name - File or directory name
   * @param basePath - Base path for constructing full path
   * @returns FileInfo object
   */
  private createFileInfo(
    permissions: string,
    owner: string,
    group: string,
    sizeStr: string,
    dateStr: string,
    name: string,
    basePath: string
  ): FileInfo {
    const size = parseInt(sizeStr, 10);
    const isDirectory = permissions.startsWith('d');
    
    // Construct full path
    const fullPath = basePath.endsWith('/')
      ? `${basePath}${name}`
      : `${basePath}/${name}`;

    // Parse date string
    const modifiedAt = this.parseDate(dateStr);

    return {
      name,
      path: fullPath,
      size,
      permissions,
      owner,
      group,
      modifiedAt,
      isDirectory,
    };
  }

  /**
   * Parse date string from ls -la output
   * 
   * Handles two formats:
   * 1. "Jan 15 10:30" - Recent files with time
   * 2. "Dec 25 2023" - Older files with year
   * 
   * @param dateStr - Date string from ls output
   * @returns Date object
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.trim().split(/\s+/);
    
    if (parts.length !== 3) {
      // Invalid format, return current date
      return new Date();
    }

    const [month, day, timeOrYear] = parts;
    
    // Month name to number mapping
    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const monthNum = monthMap[month];
    if (monthNum === undefined) {
      // Invalid month, return current date
      return new Date();
    }

    const dayNum = parseInt(day, 10);
    
    // Check if third part is time (HH:MM) or year (YYYY)
    if (timeOrYear.includes(':')) {
      // Format: "Jan 15 10:30" - use current year
      const [hours, minutes] = timeOrYear.split(':').map((s) => parseInt(s, 10));
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, monthNum, dayNum, hours, minutes);
    } else {
      // Format: "Dec 25 2023" - use specified year
      const year = parseInt(timeOrYear, 10);
      return new Date(year, monthNum, dayNum);
    }
  }

  /**
   * Build SCP command arguments for file transfer
   * 
   * Constructs the SCP command flags for simple file transfers:
   * - Port specification (-P)
   * - Key authentication (-i)
   * - Configuration options (-o)
   * - Recursive flag (-r) for directories
   * 
   * @param session - Session object containing connection parameters
   * @param recursive - Whether to transfer recursively (for directories)
   * @returns Array of command arguments (without source and destination)
   * 
   * @example
   * ```typescript
   * const args = handler.buildSCPCommand(session, false);
   * // Returns: ['scp', '-P', '22', '-i', '/path/to/key', '-o', 'StrictHostKeyChecking=yes']
   * ```
   */
  private buildSCPCommand(session: Session, recursive: boolean = false): string[] {
    const args: string[] = [this.scpBinaryPath];

    // Port specification
    // -P: Specifies the port to connect to on the remote host (capital P for scp)
    args.push('-P', session.port.toString());

    // Key authentication
    // -i: Selects a file from which the identity (private key) is read
    if (session.keyPath) {
      args.push('-i', session.keyPath);
    }

    // Recursive flag for directories
    // -r: Recursively copy entire directories
    if (recursive) {
      args.push('-r');
    }

    // Configuration options
    // -o: Pass options to ssh in the format used in ssh_config
    args.push(
      '-o',
      `StrictHostKeyChecking=${session.config.strictHostKeyChecking ? 'yes' : 'no'}`
    );
    args.push('-o', `ConnectTimeout=${session.config.connectTimeout}`);

    // ControlMaster configuration for connection multiplexing
    if (session.controlSocketPath) {
      args.push('-o', `ControlPath=${session.controlSocketPath}`);
      args.push('-o', 'ControlMaster=auto');
      args.push('-o', 'ControlPersist=10m');
    }

    // Custom ssh_config options
    for (const [key, value] of Object.entries(session.config.customOptions)) {
      args.push('-o', `${key}=${value}`);
    }

    // Debug verbosity flags
    // Add -v flags based on debug level (0 = none, 1 = -v, 2 = -vv, 3 = -vvv)
    for (let i = 0; i < this.debugLevel; i++) {
      args.push('-v');
    }

    return args;
  }

  /**
   * Execute an SCP command
   * 
   * Spawns an scp subprocess and captures output. Handles both upload and
   * download operations.
   * 
   * @param args - Complete SCP command arguments including source and destination
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to stdout, stderr, and exit code
   */
  private async executeSCPCommand(
    args: string[],
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Extract the binary path (first element) and arguments (rest)
    const binary = args[0];
    const cmdArgs = args.slice(1);
    
    return new Promise((resolve, reject) => {
      // Set up AbortController for timeout handling
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, timeout * 1000);
      }
      
      // Spawn the SCP subprocess
      const child = spawn(binary, cmdArgs, {
        signal: abortController.signal,
      });
      
      // Buffers to accumulate stdout and stderr
      let stdout = '';
      let stderr = '';
      
      // Capture stdout
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      // Capture stderr
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code: number | null) => {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });
      
      // Handle process errors
      child.on('error', (error: Error) => {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Check if this is a timeout abort
        if (error.name === 'AbortError') {
          resolve({
            stdout,
            stderr: stderr + '\nSCP operation timed out',
            exitCode: 124,
          });
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Upload a file using SCP
   * 
   * Uses scp command to transfer a local file to a remote path. This is an
   * alternative to SFTP for simple file transfers and is often faster for
   * single file operations.
   * 
   * @param session - Session object containing connection parameters
   * @param localPath - Path to the local file to upload
   * @param remotePath - Destination path on the remote system
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to TransferResult with success status and metadata
   * 
   * @example
   * ```typescript
   * const result = await handler.uploadFileWithSCP(
   *   session,
   *   '/local/document.pdf',
   *   '/remote/uploads/document.pdf'
   * );
   * if (result.success) {
   *   console.log(`Uploaded ${result.bytesTransferred} bytes in ${result.duration}ms`);
   * }
   * ```
   * 
   * Validates: Requirement 3.7
   */
  async uploadFileWithSCP(
    session: Session,
    localPath: string,
    remotePath: string,
    timeout?: number
  ): Promise<TransferResult> {
    const startTime = Date.now();

    try {
      // Build SCP command
      const args = this.buildSCPCommand(session, false);
      
      // Add source (local) and destination (remote)
      // Format: scp [options] localPath user@host:remotePath
      args.push(localPath);
      args.push(`${session.username}@${session.host}:${remotePath}`);

      // Execute SCP command
      const result = await this.executeSCPCommand(args, timeout);

      const duration = Date.now() - startTime;

      // Check if operation was successful
      if (result.exitCode === 0) {
        return {
          success: true,
          bytesTransferred: 0, // SCP doesn't provide byte count in output
          duration,
        };
      } else {
        return {
          success: false,
          bytesTransferred: 0,
          duration,
          error: scrubSensitiveData(result.stderr || 'SCP upload failed'),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        bytesTransferred: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download a file using SCP
   * 
   * Uses scp command to transfer a remote file to a local path. This is an
   * alternative to SFTP for simple file transfers and is often faster for
   * single file operations.
   * 
   * @param session - Session object containing connection parameters
   * @param remotePath - Path to the remote file to download
   * @param localPath - Destination path on the local system
   * @param timeout - Optional timeout in seconds
   * @returns Promise resolving to TransferResult with success status and metadata
   * 
   * @example
   * ```typescript
   * const result = await handler.downloadFileWithSCP(
   *   session,
   *   '/remote/logs/app.log',
   *   '/local/logs/app.log'
   * );
   * if (result.success) {
   *   console.log(`Downloaded ${result.bytesTransferred} bytes in ${result.duration}ms`);
   * }
   * ```
   * 
   * Validates: Requirement 3.7
   */
  async downloadFileWithSCP(
    session: Session,
    remotePath: string,
    localPath: string,
    timeout?: number
  ): Promise<TransferResult> {
    const startTime = Date.now();

    try {
      // Build SCP command
      const args = this.buildSCPCommand(session, false);
      
      // Add source (remote) and destination (local)
      // Format: scp [options] user@host:remotePath localPath
      args.push(`${session.username}@${session.host}:${remotePath}`);
      args.push(localPath);

      // Execute SCP command
      const result = await this.executeSCPCommand(args, timeout);

      const duration = Date.now() - startTime;

      // Check if operation was successful
      if (result.exitCode === 0) {
        return {
          success: true,
          bytesTransferred: 0, // SCP doesn't provide byte count in output
          duration,
        };
      } else {
        return {
          success: false,
          bytesTransferred: 0,
          duration,
          error: scrubSensitiveData(result.stderr || 'SCP download failed'),
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        bytesTransferred: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the SFTP binary path
   * 
   * @returns Path to the SFTP binary
   */
  getSftpBinaryPath(): string {
    return this.sftpBinaryPath;
  }

  /**
   * Set the SFTP binary path
   * 
   * Allows configuring a custom path to the SFTP binary if it's not in PATH
   * or if a specific version should be used.
   * 
   * @param path - Path to the SFTP binary
   */
  setSftpBinaryPath(path: string): void {
    this.sftpBinaryPath = path;
  }

  /**
   * Get the SCP binary path
   * 
   * @returns Path to the SCP binary
   */
  getScpBinaryPath(): string {
    return this.scpBinaryPath;
  }

  /**
   * Set the SCP binary path
   * 
   * Allows configuring a custom path to the SCP binary if it's not in PATH
   * or if a specific version should be used.
   * 
   * @param path - Path to the SCP binary
   */
  setScpBinaryPath(path: string): void {
    this.scpBinaryPath = path;
  }

  /**
   * Get the debug verbosity level
   * 
   * @returns Debug level (0-3)
   * 
   * Validates: Requirement 10.7
   */
  getDebugLevel(): number {
    return this.debugLevel;
  }

  /**
   * Set the debug verbosity level
   * 
   * Configures the debug level for SFTP/SCP operations:
   * - 0: No debug output (default)
   * - 1: Basic debug output (-v flag)
   * - 2: Detailed debug output (-vv flag)
   * - 3: Maximum debug output (-vvv flag)
   * 
   * @param level - Debug level (0-3)
   * @throws Error if level is not 0, 1, 2, or 3
   * 
   * Validates: Requirement 10.7
   */
  setDebugLevel(level: number): void {
    if (![0, 1, 2, 3].includes(level)) {
      throw new Error(`Invalid debug level: ${level}. Must be 0, 1, 2, or 3.`);
    }
    this.debugLevel = level;
  }
}
