import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SecureFileUploadHandler,
  FileSecurityValidator,
  FileEncryption,
  FileHasher,
  uploadSecureFiles,
  validateFilesSecurity,
  globalFileUploadHandler
} from '../secure-file-handler';
import { mockDataGenerators, testHelpers } from '@/test/test-utils';

describe('Secure File Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global handler state
    globalFileUploadHandler.clearActiveUploads();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('FileSecurityValidator', () => {
    let validator: FileSecurityValidator;

    beforeEach(() => {
      validator = new FileSecurityValidator({
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf', '.txt'],
        dangerousExtensions: ['.exe', '.bat', '.cmd', '.scr'],
        scanContent: true
      });
    });

    it('should validate file size', async () => {
      const validFile = mockDataGenerators.file({
        size: 5 * 1024 * 1024 // 5MB
      });
      
      const invalidFile = mockDataGenerators.file({
        size: 15 * 1024 * 1024 // 15MB
      });

      const validResult = await validator.validateFile(validFile);
      const invalidResult = await validator.validateFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('File size exceeds maximum allowed size');
    });

    it('should validate file type', async () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });

      const validResult = await validator.validateFile(validFile);
      const invalidResult = await validator.validateFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('File type not allowed');
    });

    it('should validate file extension', async () => {
      const validFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });
      const invalidFile = new File(['test'], 'malware.exe', { type: 'application/x-executable' });

      const validResult = await validator.validateFile(validFile);
      const invalidResult = await validator.validateFile(invalidFile);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('File extension not allowed');
    });

    it('should detect dangerous extensions', async () => {
      const dangerousFile = new File(['test'], 'script.bat', { type: 'text/plain' });

      const result = await validator.validateFile(dangerousFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dangerous file extension detected');
    });

    it('should scan file content for suspicious patterns', async () => {
      const suspiciousContent = '<script>alert("xss")</script>';
      const suspiciousFile = new File([suspiciousContent], 'test.txt', { type: 'text/plain' });

      const result = await validator.validateFile(suspiciousFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Suspicious content detected in file');
    });

    it('should validate magic numbers for image files', async () => {
      // Mock JPEG magic number (FF D8 FF)
      const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      const validJpeg = new File([jpegHeader], 'test.jpg', { type: 'image/jpeg' });
      
      // Invalid magic number for JPEG
      const invalidJpeg = new File(['not a jpeg'], 'test.jpg', { type: 'image/jpeg' });

      const validResult = await validator.validateFile(validJpeg);
      const invalidResult = await validator.validateFile(invalidJpeg);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('File magic number does not match declared type');
    });
  });

  describe('FileEncryption', () => {
    let encryption: FileEncryption;

    beforeEach(() => {
      encryption = new FileEncryption();
    });

    it('should generate encryption key', async () => {
      const key = await encryption.generateKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32); // 256-bit key
    });

    it('should encrypt and decrypt data', async () => {
      const originalData = new TextEncoder().encode('Hello, World!');
      const key = await encryption.generateKey();

      const encrypted = await encryption.encrypt(originalData, key);
      expect(encrypted.data).toBeInstanceOf(Uint8Array);
      expect(encrypted.iv).toBeInstanceOf(Uint8Array);
      expect(encrypted.data).not.toEqual(originalData);

      const decrypted = await encryption.decrypt(encrypted.data, key, encrypted.iv);
      expect(decrypted).toEqual(originalData);
    });

    it('should export and import keys', async () => {
      const key = await encryption.generateKey();
      const exported = await encryption.exportKey(key);
      const imported = await encryption.importKey(exported);

      expect(imported).toEqual(key);
    });

    it('should fail to decrypt with wrong key', async () => {
      const originalData = new TextEncoder().encode('Secret data');
      const correctKey = await encryption.generateKey();
      const wrongKey = await encryption.generateKey();

      const encrypted = await encryption.encrypt(originalData, correctKey);
      
      await expect(encryption.decrypt(encrypted.data, wrongKey, encrypted.iv))
        .rejects.toThrow();
    });
  });

  describe('FileHasher', () => {
    let hasher: FileHasher;

    beforeEach(() => {
      hasher = new FileHasher();
    });

    it('should calculate file hash', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const hash = await hasher.calculateFileHash(file);

      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('should calculate buffer hash', async () => {
      const buffer = new TextEncoder().encode('test content');
      const hash = await hasher.calculateBufferHash(buffer);

      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('should produce consistent hashes', async () => {
      const content = 'consistent content';
      const file1 = new File([content], 'test1.txt', { type: 'text/plain' });
      const file2 = new File([content], 'test2.txt', { type: 'text/plain' });

      const hash1 = await hasher.calculateFileHash(file1);
      const hash2 = await hasher.calculateFileHash(file2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', async () => {
      const file1 = new File(['content 1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content 2'], 'test2.txt', { type: 'text/plain' });

      const hash1 = await hasher.calculateFileHash(file1);
      const hash2 = await hasher.calculateFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('SecureFileUploadHandler', () => {
    let handler: SecureFileUploadHandler;

    beforeEach(() => {
      handler = new SecureFileUploadHandler({
        maxConcurrentUploads: 3,
        chunkSize: 1024 * 1024, // 1MB
        retryAttempts: 3,
        retryDelay: 100
      });

      // Mock IPFS upload
      global.mockIPFS = {
        upload: jest.fn().mockResolvedValue({
          hash: 'QmTestHash123',
          size: 1024,
          url: 'https://test.ipfs.io/ipfs/QmTestHash123'
        })
      };
    });

    it('should upload files successfully', async () => {
      const files = [
        new File(['test content 1'], 'test1.txt', { type: 'text/plain' }),
        new File(['test content 2'], 'test2.txt', { type: 'text/plain' })
      ];

      const results = await handler.uploadFiles(files, {
        encrypt: true,
        compress: false,
        generateThumbnails: false
      });

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.ipfsHash).toBeDefined();
        expect(result.fileHash).toBeDefined();
        expect(result.metadata).toBeDefined();
      });
    });

    it('should handle upload failures with retry', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      // Mock IPFS to fail twice then succeed
      global.mockIPFS.upload = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          hash: 'QmTestHash123',
          size: 1024,
          url: 'https://test.ipfs.io/ipfs/QmTestHash123'
        });

      const results = await handler.uploadFiles([file], {
        encrypt: false,
        compress: false,
        generateThumbnails: false
      });

      expect(results[0].success).toBe(true);
      expect(global.mockIPFS.upload).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    });

    it('should validate files before upload', async () => {
      const invalidFile = new File(['test'], 'malware.exe', { type: 'application/x-executable' });

      const results = await handler.uploadFiles([invalidFile], {
        encrypt: false,
        compress: false,
        generateThumbnails: false
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('validation');
    });

    it('should track upload progress', async () => {
      const file = new File(['x'.repeat(1024 * 100)], 'large.txt', { type: 'text/plain' }); // 100KB
      const progressCallback = jest.fn();

      await handler.uploadFiles([file], {
        encrypt: false,
        compress: false,
        generateThumbnails: false,
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalled();
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall.percentage).toBe(100);
    });

    it('should respect concurrent upload limit', async () => {
      const files = Array.from({ length: 5 }, (_, i) => 
        new File([`content ${i}`], `test${i}.txt`, { type: 'text/plain' })
      );

      let concurrentUploads = 0;
      let maxConcurrent = 0;

      global.mockIPFS.upload = jest.fn().mockImplementation(async () => {
        concurrentUploads++;
        maxConcurrent = Math.max(maxConcurrent, concurrentUploads);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        concurrentUploads--;
        return {
          hash: 'QmTestHash' + Math.random(),
          size: 1024,
          url: 'https://test.ipfs.io/ipfs/QmTestHash'
        };
      });

      await handler.uploadFiles(files, {
        encrypt: false,
        compress: false,
        generateThumbnails: false
      });

      expect(maxConcurrent).toBeLessThanOrEqual(3); // Max concurrent uploads
    });

    it('should encrypt files when requested', async () => {
      const file = new File(['sensitive data'], 'secret.txt', { type: 'text/plain' });

      const results = await handler.uploadFiles([file], {
        encrypt: true,
        compress: false,
        generateThumbnails: false
      });

      expect(results[0].success).toBe(true);
      expect(results[0].metadata.encrypted).toBe(true);
      expect(results[0].metadata.encryptionKey).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    beforeEach(() => {
      global.mockIPFS = {
        upload: jest.fn().mockResolvedValue({
          hash: 'QmTestHash123',
          size: 1024,
          url: 'https://test.ipfs.io/ipfs/QmTestHash123'
        })
      };
    });

    it('should upload files using utility function', async () => {
      const files = [
        new File(['test content'], 'test.txt', { type: 'text/plain' })
      ];

      const results = await uploadSecureFiles(files, {
        encrypt: true,
        compress: false
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should validate files using utility function', async () => {
      const validFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const invalidFile = new File(['test'], 'malware.exe', { type: 'application/x-executable' });

      const validResult = await validateFilesSecurity([validFile]);
      const invalidResult = await validateFilesSecurity([invalidFile]);

      expect(validResult.allValid).toBe(true);
      expect(invalidResult.allValid).toBe(false);
      expect(invalidResult.results[0].errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      global.mockIPFS.upload = jest.fn().mockRejectedValue(new Error('Network timeout'));

      const results = await globalFileUploadHandler.uploadFiles([file], {
        encrypt: false,
        compress: false,
        generateThumbnails: false
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Network timeout');
    });

    it('should handle encryption errors', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      // Mock crypto.subtle to fail
      const originalSubtle = global.crypto.subtle;
      global.crypto.subtle = {
        ...originalSubtle,
        encrypt: jest.fn().mockRejectedValue(new Error('Encryption failed'))
      };

      const results = await globalFileUploadHandler.uploadFiles([file], {
        encrypt: true,
        compress: false,
        generateThumbnails: false
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Encryption failed');

      // Restore original
      global.crypto.subtle = originalSubtle;
    });
  });
});