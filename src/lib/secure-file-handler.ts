import { toast } from 'sonner';
import { globalErrorHandler, ErrorCategory, ErrorContext, ErrorSeverity } from './error-handler';

// File validation interfaces
export interface FileValidationConfig {
  maxSize: number; // in bytes
  allowedTypes: string[];
  allowedExtensions: string[];
  maxFiles: number;
  requireEncryption: boolean;
  scanForMalware: boolean;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  hash: string;
  encrypted: boolean;
  uploadId: string;
}

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  retryCount: number;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export interface UploadResult {
  success: boolean;
  uploadId: string;
  fileHash: string;
  ipfsHash?: string;
  encryptionKey?: string;
  metadata: FileMetadata;
  error?: string;
}

// Security validation utilities
class FileSecurityValidator {
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.app', '.deb', '.pkg', '.dmg', '.msi', '.run', '.sh', '.ps1'
  ];

  private static readonly MAGIC_NUMBERS: Record<string, number[]> = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'text/plain': [], // Text files don't have consistent magic numbers
    'application/json': [],
    'text/csv': []
  };

  static async validateFile(file: File, config: FileValidationConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Size validation
    if (file.size > config.maxSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(config.maxSize)})`);
    }

    // Type validation
    if (!config.allowedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`);
    }

    // Extension validation
    const extension = this.getFileExtension(file.name).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed`);
    }

    // Dangerous file check
    if (this.DANGEROUS_EXTENSIONS.includes(extension)) {
      errors.push(`File extension '${extension}' is potentially dangerous and not allowed`);
    }

    // Magic number validation (file signature)
    try {
      const isValidSignature = await this.validateFileSignature(file);
      if (!isValidSignature) {
        errors.push('File signature does not match the declared file type');
      }
    } catch (error) {
      errors.push('Failed to validate file signature');
    }

    // Content validation
    try {
      await this.validateFileContent(file);
    } catch (error) {
      errors.push(`File content validation failed: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private static async validateFileSignature(file: File): Promise<boolean> {
    const expectedSignature = this.MAGIC_NUMBERS[file.type];
    if (!expectedSignature || expectedSignature.length === 0) {
      return true; // Skip validation for types without magic numbers
    }

    const buffer = await file.slice(0, expectedSignature.length).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    return expectedSignature.every((byte, index) => bytes[index] === byte);
  }

  private static async validateFileContent(file: File): Promise<void> {
    // Additional content validation based on file type
    if (file.type.startsWith('text/') || file.type === 'application/json') {
      const text = await file.text();
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script[^>]*>/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(text)) {
          throw new Error('File contains potentially malicious content');
        }
      }
    }
  }

  private static getFileExtension(filename: string): string {
    return filename.slice(filename.lastIndexOf('.'));
  }

  private static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// File encryption utilities
class FileEncryption {
  private static readonly CONFIG: EncryptionConfig = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12
  };

  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.CONFIG.algorithm,
        length: this.CONFIG.keyLength
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptFile(file: File, key: CryptoKey): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(this.CONFIG.ivLength));
    const fileData = await file.arrayBuffer();

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.CONFIG.algorithm,
        iv: iv
      },
      key,
      fileData
    );

    return { encryptedData, iv };
  }

  static async decryptFile(encryptedData: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      {
        name: this.CONFIG.algorithm,
        iv: iv as BufferSource
      },
      key,
      encryptedData
    );
  }

  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  static async importKey(keyString: string): Promise<CryptoKey> {
    const keyData = new Uint8Array(atob(keyString).split('').map(char => char.charCodeAt(0)));
    
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: this.CONFIG.algorithm,
        length: this.CONFIG.keyLength
      },
      true,
      ['encrypt', 'decrypt']
    );
  }
}

// File hash utilities
class FileHasher {
  static async calculateHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Main secure file upload handler
export class SecureFileUploadHandler {
  private uploadProgress: Map<string, UploadProgress> = new Map();
  private activeUploads: Map<string, AbortController> = new Map();
  private retryQueue: Map<string, { file: File; config: FileValidationConfig; retryCount: number }> = new Map();

  constructor(
    private defaultConfig: FileValidationConfig = {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'],
      maxFiles: 5,
      requireEncryption: true,
      scanForMalware: false
    }
  ) {}

  async uploadFiles(
    files: FileList | File[],
    config?: Partial<FileValidationConfig>,
    onProgress?: (progress: UploadProgress[]) => void
  ): Promise<UploadResult[]> {
    const fileArray = Array.from(files);
    const uploadConfig = { ...this.defaultConfig, ...config };

    // Validate file count
    if (fileArray.length > uploadConfig.maxFiles) {
      throw new Error(`Cannot upload more than ${uploadConfig.maxFiles} files at once`);
    }

    const results: UploadResult[] = [];
    const uploadPromises = fileArray.map(file => this.uploadSingleFile(file, uploadConfig, onProgress));

    // Wait for all uploads to complete
    const settledResults = await Promise.allSettled(uploadPromises);

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const file = fileArray[index];
        results.push({
          success: false,
          uploadId: this.generateUploadId(),
          fileHash: '',
          metadata: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            hash: '',
            encrypted: false,
            uploadId: ''
          },
          error: result.reason.message
        });
      }
    });

    return results;
  }

  async uploadSingleFile(
    file: File,
    config: FileValidationConfig,
    onProgress?: (progress: UploadProgress[]) => void
  ): Promise<UploadResult> {
    const uploadId = this.generateUploadId();
    const abortController = new AbortController();
    
    this.activeUploads.set(uploadId, abortController);
    
    const progress: UploadProgress = {
      uploadId,
      fileName: file.name,
      progress: 0,
      status: 'pending',
      retryCount: 0
    };

    this.uploadProgress.set(uploadId, progress);
    this.notifyProgress(onProgress);

    try {
      // Step 1: Validate file
      progress.status = 'uploading';
      progress.progress = 10;
      this.notifyProgress(onProgress);

      const validation = await FileSecurityValidator.validateFile(file, config);
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 2: Calculate file hash
      progress.progress = 20;
      this.notifyProgress(onProgress);

      const fileHash = await FileHasher.calculateHash(file);

      // Step 3: Encrypt file if required
      let encryptedData: ArrayBuffer;
      let encryptionKey: string | undefined;
      let iv: Uint8Array | undefined;

      if (config.requireEncryption) {
        progress.status = 'processing';
        progress.progress = 40;
        this.notifyProgress(onProgress);

        const key = await FileEncryption.generateKey();
        const encryption = await FileEncryption.encryptFile(file, key);
        encryptedData = encryption.encryptedData;
        iv = encryption.iv;
        encryptionKey = await FileEncryption.exportKey(key);
      } else {
        encryptedData = await file.arrayBuffer();
      }

      // Step 4: Upload to IPFS with retry mechanism
      progress.progress = 60;
      this.notifyProgress(onProgress);

      const ipfsHash = await this.uploadToIPFS(encryptedData, uploadId, abortController.signal);

      // Step 5: Create metadata
      progress.progress = 90;
      this.notifyProgress(onProgress);

      const metadata: FileMetadata = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        hash: fileHash,
        encrypted: config.requireEncryption,
        uploadId
      };

      // Step 6: Complete upload
      progress.status = 'completed';
      progress.progress = 100;
      this.notifyProgress(onProgress);

      const result: UploadResult = {
        success: true,
        uploadId,
        fileHash,
        ipfsHash,
        encryptionKey,
        metadata
      };

      // Clean up
      this.activeUploads.delete(uploadId);
      
      return result;

    } catch (error) {
      progress.status = 'failed';
      progress.error = (error as Error).message;
      this.notifyProgress(onProgress);

      // Handle error with global error handler
      const context: ErrorContext = {
        component: 'SecureFileUploadHandler',
        action: 'uploadSingleFile',
        timestamp: Date.now(),
        metadata: {
          uploadId,
          fileName: file.name,
          fileSize: file.size,
          retryCount: progress.retryCount
        }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.HIGH
      );

      // Add to retry queue if not at max retries
      if (progress.retryCount < 3) {
        this.retryQueue.set(uploadId, {
          file,
          config,
          retryCount: progress.retryCount + 1
        });
      }

      throw error;
    }
  }

  private async uploadToIPFS(
    data: ArrayBuffer,
    uploadId: string,
    signal: AbortSignal
  ): Promise<string> {
    // This would integrate with your existing IPFS upload logic
    // For now, we'll simulate the upload with retry mechanism
    
    return await globalErrorHandler.handleNetworkOperation(
      async () => {
        // Simulate IPFS upload
        if (signal.aborted) {
          throw new Error('Upload cancelled');
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate occasional failures for testing retry mechanism
        if (Math.random() < 0.1) {
          throw new Error('IPFS upload failed');
        }

        // Return mock IPFS hash
        const hash = await FileHasher.calculateBufferHash(data);
        return `Qm${hash.substring(0, 44)}`;
      },
      {
        component: 'SecureFileUploadHandler',
        action: 'uploadToIPFS',
        timestamp: Date.now(),
        metadata: { uploadId }
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true
      }
    );
  }

  async retryFailedUpload(uploadId: string, onProgress?: (progress: UploadProgress[]) => void): Promise<UploadResult | null> {
    const retryData = this.retryQueue.get(uploadId);
    if (!retryData) {
      return null;
    }

    const progress = this.uploadProgress.get(uploadId);
    if (progress) {
      progress.retryCount = retryData.retryCount;
      progress.status = 'pending';
      progress.error = undefined;
    }

    try {
      const result = await this.uploadSingleFile(retryData.file, retryData.config, onProgress);
      this.retryQueue.delete(uploadId);
      return result;
    } catch (error) {
      toast.error(`Retry failed: ${(error as Error).message}`);
      return null;
    }
  }

  cancelUpload(uploadId: string): void {
    const abortController = this.activeUploads.get(uploadId);
    if (abortController) {
      abortController.abort();
      this.activeUploads.delete(uploadId);
    }

    const progress = this.uploadProgress.get(uploadId);
    if (progress) {
      progress.status = 'cancelled';
    }

    this.retryQueue.delete(uploadId);
    toast.info('Upload cancelled');
  }

  getUploadProgress(uploadId?: string): UploadProgress[] {
    if (uploadId) {
      const progress = this.uploadProgress.get(uploadId);
      return progress ? [progress] : [];
    }
    return Array.from(this.uploadProgress.values());
  }

  getFailedUploads(): UploadProgress[] {
    return Array.from(this.uploadProgress.values()).filter(p => p.status === 'failed');
  }

  clearCompletedUploads(): void {
    for (const [id, progress] of this.uploadProgress.entries()) {
      if (progress.status === 'completed' || progress.status === 'cancelled') {
        this.uploadProgress.delete(id);
      }
    }
  }

  private notifyProgress(onProgress?: (progress: UploadProgress[]) => void): void {
    if (onProgress) {
      onProgress(Array.from(this.uploadProgress.values()));
    }
  }

  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global instance
export const globalFileUploadHandler = new SecureFileUploadHandler();

// Utility functions
export const uploadSecureFiles = async (
  files: FileList | File[],
  config?: Partial<FileValidationConfig>,
  onProgress?: (progress: UploadProgress[]) => void
): Promise<UploadResult[]> => {
  return await globalFileUploadHandler.uploadFiles(files, config, onProgress);
};

export const validateFilesSecurity = async (
  files: FileList | File[],
  config: FileValidationConfig
): Promise<{ valid: boolean; errors: string[] }> => {
  const fileArray = Array.from(files);
  const allErrors: string[] = [];
  
  for (const file of fileArray) {
    const validation = await FileSecurityValidator.validateFile(file, config);
    if (!validation.valid) {
      allErrors.push(`${file.name}: ${validation.errors.join(', ')}`);
    }
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
};

export { FileSecurityValidator, FileEncryption, FileHasher };