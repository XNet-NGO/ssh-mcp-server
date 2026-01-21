/**
 * Unit Tests for File Transfer Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileTransferTools } from '../../src/tools/FileTransferTools.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { SFTPHandler } from '../../src/core/SFTPHandler.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import { TransferResult, FileInfo } from '../../src/core/types.js';

describe('FileTransferTools', () => {
  let fileTransferTools: FileTransferTools;
  let connectionManager: ConnectionManager;
  let sftpHandler: SFTPHandler;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    connectionManager = new ConnectionManager();
    sftpHandler = new SFTPHandler(configManager);
    fileTransferTools = new FileTransferTools(connectionManager, sftpHandler);
  });

  describe('sftp_upload', () => {
    it('should upload file and return success', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock uploadFile to return success
      const mockResult: TransferResult = {
        success: true,
        bytesTransferred: 1024,
        duration: 500,
      };
      vi.spyOn(sftpHandler, 'uploadFile').mockResolvedValue(mockResult);

      const response = await fileTransferTools.upload({
        sessionId: session.id,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check upload result (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.success).toBe(true);
        expect(data.localPath).toBe('/local/file.txt');
        expect(data.remotePath).toBe('/remote/file.txt');
        expect(data.bytesTransferred).toBe(1024);
        expect(data.duration).toBe(500);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await fileTransferTools.upload({
        sessionId: 'nonexistent-id',
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    it('should handle upload failure', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock uploadFile to return failure
      const mockResult: TransferResult = {
        success: false,
        bytesTransferred: 0,
        duration: 100,
        error: 'Permission denied',
      };
      vi.spyOn(sftpHandler, 'uploadFile').mockResolvedValue(mockResult);

      const response = await fileTransferTools.upload({
        sessionId: session.id,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('success')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Permission denied');
      }
    });

    it('should pass timeout to SFTP handler', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock uploadFile
      const mockResult: TransferResult = {
        success: true,
        bytesTransferred: 1024,
        duration: 500,
      };
      const uploadSpy = vi
        .spyOn(sftpHandler, 'uploadFile')
        .mockResolvedValue(mockResult);

      await fileTransferTools.upload({
        sessionId: session.id,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
        timeout: 60,
      });

      // Verify uploadFile was called with timeout
      expect(uploadSpy).toHaveBeenCalledWith(
        session,
        '/local/file.txt',
        '/remote/file.txt',
        60
      );
    });

    it('should update session lastUsedAt timestamp', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      const originalLastUsed = session.lastUsedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Mock uploadFile
      const mockResult: TransferResult = {
        success: true,
        bytesTransferred: 1024,
        duration: 500,
      };
      vi.spyOn(sftpHandler, 'uploadFile').mockResolvedValue(mockResult);

      await fileTransferTools.upload({
        sessionId: session.id,
        localPath: '/local/file.txt',
        remotePath: '/remote/file.txt',
      });

      // Verify lastUsedAt was updated
      expect(session.lastUsedAt.getTime()).toBeGreaterThan(
        originalLastUsed.getTime()
      );
    });
  });

  describe('sftp_download', () => {
    it('should download file and return success', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock downloadFile to return success
      const mockResult: TransferResult = {
        success: true,
        bytesTransferred: 2048,
        duration: 750,
      };
      vi.spyOn(sftpHandler, 'downloadFile').mockResolvedValue(mockResult);

      const response = await fileTransferTools.download({
        sessionId: session.id,
        remotePath: '/remote/file.txt',
        localPath: '/local/file.txt',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check download result (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.success).toBe(true);
        expect(data.remotePath).toBe('/remote/file.txt');
        expect(data.localPath).toBe('/local/file.txt');
        expect(data.bytesTransferred).toBe(2048);
        expect(data.duration).toBe(750);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await fileTransferTools.download({
        sessionId: 'nonexistent-id',
        remotePath: '/remote/file.txt',
        localPath: '/local/file.txt',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    it('should handle download failure', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock downloadFile to return failure
      const mockResult: TransferResult = {
        success: false,
        bytesTransferred: 0,
        duration: 100,
        error: 'File not found',
      };
      vi.spyOn(sftpHandler, 'downloadFile').mockResolvedValue(mockResult);

      const response = await fileTransferTools.download({
        sessionId: session.id,
        remotePath: '/remote/file.txt',
        localPath: '/local/file.txt',
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('success')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.success).toBe(false);
        expect(data.error).toBe('File not found');
      }
    });
  });

  describe('sftp_list', () => {
    it('should list directory contents', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock listDirectory to return files
      const mockFiles: FileInfo[] = [
        {
          name: 'file1.txt',
          path: '/remote/dir/file1.txt',
          size: 1024,
          permissions: '-rw-r--r--',
          owner: 'user',
          group: 'group',
          modifiedAt: new Date('2024-01-15T10:30:00'),
          isDirectory: false,
        },
        {
          name: 'subdir',
          path: '/remote/dir/subdir',
          size: 4096,
          permissions: 'drwxr-xr-x',
          owner: 'user',
          group: 'group',
          modifiedAt: new Date('2024-01-14T09:00:00'),
          isDirectory: true,
        },
      ];
      vi.spyOn(sftpHandler, 'listDirectory').mockResolvedValue(mockFiles);

      const response = await fileTransferTools.list({
        sessionId: session.id,
        remotePath: '/remote/dir',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check file list
      const dataContent = response.content.find((c) => c.text?.includes('files'));
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.files).toHaveLength(2);
        expect(data.count).toBe(2);
        expect(data.path).toBe('/remote/dir');
        expect(data.files[0].name).toBe('file1.txt');
        expect(data.files[1].name).toBe('subdir');
        expect(data.files[1].isDirectory).toBe(true);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await fileTransferTools.list({
        sessionId: 'nonexistent-id',
        remotePath: '/remote/dir',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    it('should handle empty directory', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock listDirectory to return empty array
      vi.spyOn(sftpHandler, 'listDirectory').mockResolvedValue([]);

      const response = await fileTransferTools.list({
        sessionId: session.id,
        remotePath: '/remote/empty',
      });

      expect(response.isError).toBeUndefined();
      const dataContent = response.content.find((c) => c.text?.includes('files'));
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.files).toHaveLength(0);
        expect(data.count).toBe(0);
      }
    });

    it('should handle list errors', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock listDirectory to throw error
      vi.spyOn(sftpHandler, 'listDirectory').mockRejectedValue(
        new Error('Directory not found')
      );

      const response = await fileTransferTools.list({
        sessionId: session.id,
        remotePath: '/remote/nonexistent',
      });

      expect(response.isError).toBe(true);
    });
  });

  describe('sftp_delete', () => {
    it('should delete file and return success', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock deleteFile to return success
      const mockResult: TransferResult = {
        success: true,
        bytesTransferred: 0,
        duration: 200,
      };
      vi.spyOn(sftpHandler, 'deleteFile').mockResolvedValue(mockResult);

      const response = await fileTransferTools.delete({
        sessionId: session.id,
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toBeDefined();

      // Parse the response to check delete result (second content item has JSON)
      const dataContent = response.content[1];
      expect(dataContent).toBeDefined();
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.success).toBe(true);
        expect(data.remotePath).toBe('/remote/file.txt');
        expect(data.duration).toBe(200);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await fileTransferTools.delete({
        sessionId: 'nonexistent-id',
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Session not found');
    });

    it('should handle delete failure', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock deleteFile to return failure
      const mockResult: TransferResult = {
        success: false,
        bytesTransferred: 0,
        duration: 100,
        error: 'Permission denied',
      };
      vi.spyOn(sftpHandler, 'deleteFile').mockResolvedValue(mockResult);

      const response = await fileTransferTools.delete({
        sessionId: session.id,
        remotePath: '/remote/file.txt',
      });

      expect(response.isError).toBe(true);
      const dataContent = response.content.find((c) =>
        c.text?.includes('success')
      );
      if (dataContent?.text) {
        const data = JSON.parse(dataContent.text);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Permission denied');
      }
    });

    it('should pass timeout to SFTP handler', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock deleteFile
      const mockResult: TransferResult = {
        success: true,
        bytesTransferred: 0,
        duration: 200,
      };
      const deleteSpy = vi
        .spyOn(sftpHandler, 'deleteFile')
        .mockResolvedValue(mockResult);

      await fileTransferTools.delete({
        sessionId: session.id,
        remotePath: '/remote/file.txt',
        timeout: 30,
      });

      // Verify deleteFile was called with timeout
      expect(deleteSpy).toHaveBeenCalledWith(
        session,
        '/remote/file.txt',
        30
      );
    });
  });

  describe('multiple operations', () => {
    it('should handle multiple file operations in sequence', async () => {
      // Create a session
      const session = connectionManager.createSession({
        host: 'example.com',
        port: 22,
        username: 'testuser',
      });

      // Mock all operations
      const uploadResult: TransferResult = {
        success: true,
        bytesTransferred: 1024,
        duration: 500,
      };
      const downloadResult: TransferResult = {
        success: true,
        bytesTransferred: 2048,
        duration: 750,
      };
      const deleteResult: TransferResult = {
        success: true,
        bytesTransferred: 0,
        duration: 200,
      };
      const mockFiles: FileInfo[] = [];

      vi.spyOn(sftpHandler, 'uploadFile').mockResolvedValue(uploadResult);
      vi.spyOn(sftpHandler, 'downloadFile').mockResolvedValue(downloadResult);
      vi.spyOn(sftpHandler, 'deleteFile').mockResolvedValue(deleteResult);
      vi.spyOn(sftpHandler, 'listDirectory').mockResolvedValue(mockFiles);

      // Execute operations
      const uploadResponse = await fileTransferTools.upload({
        sessionId: session.id,
        localPath: '/local/file1.txt',
        remotePath: '/remote/file1.txt',
      });
      expect(uploadResponse.isError).toBeUndefined();

      const downloadResponse = await fileTransferTools.download({
        sessionId: session.id,
        remotePath: '/remote/file2.txt',
        localPath: '/local/file2.txt',
      });
      expect(downloadResponse.isError).toBeUndefined();

      const listResponse = await fileTransferTools.list({
        sessionId: session.id,
        remotePath: '/remote',
      });
      expect(listResponse.isError).toBeUndefined();

      const deleteResponse = await fileTransferTools.delete({
        sessionId: session.id,
        remotePath: '/remote/file3.txt',
      });
      expect(deleteResponse.isError).toBeUndefined();
    });
  });
});
