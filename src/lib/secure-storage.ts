import { toast } from 'sonner';
import { globalErrorHandler, ErrorCategory, ErrorContext, ErrorSeverity } from './error-handler';

// Storage interfaces
export interface StorageConfig {
  encryptionKey?: string;
  storagePrefix?: string;
  compressionEnabled?: boolean;
  expirationTime?: number; // in milliseconds
  maxStorageSize?: number; // in bytes
  enableBackup?: boolean;
}

export interface StorageItem<T = any> {
  value: T;
  encrypted: boolean;
  compressed: boolean;
  timestamp: number;
  expiresAt?: number;
  checksum: string;
  version: string;
}

export interface StorageMetrics {
  totalItems: number;
  totalSize: number;
  encryptedItems: number;
  compressedItems: number;
  expiredItems: number;
  lastCleanup: number;
}

export interface BackupData {
  items: Record<string, StorageItem>;
  metadata: {
    timestamp: number;
    version: string;
    itemCount: number;
  };
}

// Encryption utilities
class StorageEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async deriveKeyFromPassword(password: string, salt?: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(16));

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  static async importKey(keyData: string): Promise<CryptoKey> {
    const keyBytes = new Uint8Array(
      atob(keyData).split('').map(char => char.charCodeAt(0))
    );

    return await crypto.subtle.importKey(
      'raw',
      keyBytes,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      encoder.encode(data)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  static async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, this.IV_LENGTH);
    const encrypted = combined.slice(this.IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

// Compression utilities
class StorageCompression {
  static async compress(data: string): Promise<string> {
    try {
      // Simple compression using built-in compression
      const encoder = new TextEncoder();
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(encoder.encode(data));
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      return btoa(String.fromCharCode(...compressed));
    } catch (error) {
      // Fallback: return original data if compression fails
      return data;
    }
  }

  static async decompress(compressedData: string): Promise<string> {
    try {
      const compressed = new Uint8Array(
        atob(compressedData).split('').map(char => char.charCodeAt(0))
      );
      
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(compressed);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      const decoder = new TextDecoder();
      return decoder.decode(decompressed);
    } catch (error) {
      // Fallback: return original data if decompression fails
      return compressedData;
    }
  }
}

// Checksum utilities
class StorageChecksum {
  static async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async verifyChecksum(data: string, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
}

// Main secure storage class
export class SecureStorage {
  private static instance: SecureStorage;
  private config: StorageConfig;
  private encryptionKey: CryptoKey | null = null;
  private storagePrefix: string;
  private metrics: StorageMetrics;
  private cleanupInterval: number | null = null;

  private constructor(config: StorageConfig = {}) {
    this.config = {
      storagePrefix: 'gbv_secure_',
      compressionEnabled: true,
      expirationTime: 24 * 60 * 60 * 1000, // 24 hours
      maxStorageSize: 10 * 1024 * 1024, // 10MB
      enableBackup: true,
      ...config
    };
    
    this.storagePrefix = this.config.storagePrefix!;
    this.metrics = {
      totalItems: 0,
      totalSize: 0,
      encryptedItems: 0,
      compressedItems: 0,
      expiredItems: 0,
      lastCleanup: Date.now()
    };

    this.initializeCleanup();
  }

  static getInstance(config?: StorageConfig): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage(config);
    }
    return SecureStorage.instance;
  }

  async initialize(encryptionPassword?: string): Promise<void> {
    try {
      if (encryptionPassword) {
        this.encryptionKey = await StorageEncryption.deriveKeyFromPassword(encryptionPassword);
      } else if (this.config.encryptionKey) {
        this.encryptionKey = await StorageEncryption.importKey(this.config.encryptionKey);
      } else {
        this.encryptionKey = await StorageEncryption.generateKey();
      }

      await this.updateMetrics();
      await this.cleanup();
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'initialize',
        timestamp: Date.now(),
        metadata: { hasPassword: !!encryptionPassword }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.SECURITY,
        context,
        ErrorSeverity.HIGH
      );
      
      throw new Error('Failed to initialize secure storage');
    }
  }

  async setItem<T>(
    key: string,
    value: T,
    options: {
      encrypt?: boolean;
      compress?: boolean;
      expiresIn?: number;
    } = {}
  ): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = JSON.stringify(value);
      
      // Check storage size limit
      const estimatedSize = new Blob([serializedValue]).size;
      if (this.metrics.totalSize + estimatedSize > this.config.maxStorageSize!) {
        await this.cleanup();
        if (this.metrics.totalSize + estimatedSize > this.config.maxStorageSize!) {
          throw new Error('Storage size limit exceeded');
        }
      }

      let processedValue = serializedValue;
      let compressed = false;
      let encrypted = false;

      // Compression
      if (options.compress ?? this.config.compressionEnabled) {
        const compressedValue = await StorageCompression.compress(processedValue);
        if (compressedValue.length < processedValue.length) {
          processedValue = compressedValue;
          compressed = true;
        }
      }

      // Encryption
      if ((options.encrypt ?? true) && this.encryptionKey) {
        processedValue = await StorageEncryption.encrypt(processedValue, this.encryptionKey);
        encrypted = true;
      }

      // Calculate checksum
      const checksum = await StorageChecksum.calculateChecksum(serializedValue);

      // Create storage item
      const storageItem: StorageItem<T> = {
        value: processedValue as any,
        encrypted,
        compressed,
        timestamp: Date.now(),
        expiresAt: options.expiresIn ? Date.now() + options.expiresIn : undefined,
        checksum,
        version: '1.0'
      };

      // Store item
      localStorage.setItem(fullKey, JSON.stringify(storageItem));
      
      // Update metrics
      await this.updateMetrics();

    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'setItem',
        timestamp: Date.now(),
        metadata: {
          key,
          encrypted: options.encrypt,
          compressed: options.compress
        }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.MEDIUM
      );
      
      throw new Error(`Failed to store item: ${(error as Error).message}`);
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const storedData = localStorage.getItem(fullKey);
      
      if (!storedData) {
        return null;
      }

      const storageItem: StorageItem = JSON.parse(storedData);
      
      // Check expiration
      if (storageItem.expiresAt && Date.now() > storageItem.expiresAt) {
        await this.removeItem(key);
        return null;
      }

      let processedValue = storageItem.value;

      // Decryption
      if (storageItem.encrypted && this.encryptionKey) {
        processedValue = await StorageEncryption.decrypt(processedValue, this.encryptionKey);
      }

      // Decompression
      if (storageItem.compressed) {
        processedValue = await StorageCompression.decompress(processedValue);
      }

      // Verify checksum
      const isValid = await StorageChecksum.verifyChecksum(processedValue, storageItem.checksum);
      if (!isValid) {
        throw new Error('Data integrity check failed');
      }

      return JSON.parse(processedValue);

    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'getItem',
        timestamp: Date.now(),
        metadata: { key }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.MEDIUM
      );
      
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      localStorage.removeItem(fullKey);
      await this.updateMetrics();
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'removeItem',
        timestamp: Date.now(),
        metadata: { key }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.LOW
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = this.getAllKeys();
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      await this.updateMetrics();
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'clear',
        timestamp: Date.now()
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.MEDIUM
      );
    }
  }

  async hasItem(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const item = localStorage.getItem(fullKey);
    
    if (!item) {
      return false;
    }

    try {
      const storageItem: StorageItem = JSON.parse(item);
      
      // Check expiration
      if (storageItem.expiresAt && Date.now() > storageItem.expiresAt) {
        await this.removeItem(key);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  async getKeys(): Promise<string[]> {
    const allKeys = this.getAllKeys();
    const validKeys: string[] = [];
    
    for (const fullKey of allKeys) {
      const key = this.getOriginalKey(fullKey);
      if (await this.hasItem(key)) {
        validKeys.push(key);
      }
    }
    
    return validKeys;
  }

  async getSize(): Promise<number> {
    let totalSize = 0;
    const keys = this.getAllKeys();
    
    for (const key of keys) {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += new Blob([item]).size;
      }
    }
    
    return totalSize;
  }

  async backup(): Promise<BackupData> {
    if (!this.config.enableBackup) {
      throw new Error('Backup is disabled');
    }

    try {
      const keys = await this.getKeys();
      const items: Record<string, StorageItem> = {};
      
      for (const key of keys) {
        const fullKey = this.getFullKey(key);
        const storedData = localStorage.getItem(fullKey);
        if (storedData) {
          items[key] = JSON.parse(storedData);
        }
      }

      return {
        items,
        metadata: {
          timestamp: Date.now(),
          version: '1.0',
          itemCount: keys.length
        }
      };
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'backup',
        timestamp: Date.now()
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.MEDIUM
      );
      
      throw new Error('Failed to create backup');
    }
  }

  async restore(backupData: BackupData): Promise<void> {
    if (!this.config.enableBackup) {
      throw new Error('Backup is disabled');
    }

    try {
      // Clear existing data
      await this.clear();
      
      // Restore items
      for (const [key, item] of Object.entries(backupData.items)) {
        const fullKey = this.getFullKey(key);
        localStorage.setItem(fullKey, JSON.stringify(item));
      }
      
      await this.updateMetrics();
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'restore',
        timestamp: Date.now(),
        metadata: {
          itemCount: Object.keys(backupData.items).length,
          backupTimestamp: backupData.metadata.timestamp
        }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.HIGH
      );
      
      throw new Error('Failed to restore backup');
    }
  }

  async cleanup(): Promise<void> {
    try {
      const keys = this.getAllKeys();
      let cleanedCount = 0;
      
      for (const fullKey of keys) {
        const storedData = localStorage.getItem(fullKey);
        if (storedData) {
          try {
            const storageItem: StorageItem = JSON.parse(storedData);
            
            // Remove expired items
            if (storageItem.expiresAt && Date.now() > storageItem.expiresAt) {
              localStorage.removeItem(fullKey);
              cleanedCount++;
            }
          } catch {
            // Remove corrupted items
            localStorage.removeItem(fullKey);
            cleanedCount++;
          }
        }
      }
      
      this.metrics.lastCleanup = Date.now();
      await this.updateMetrics();
      
      if (cleanedCount > 0) {
        console.log(`SecureStorage: Cleaned up ${cleanedCount} expired/corrupted items`);
      }
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'cleanup',
        timestamp: Date.now()
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.STORAGE,
        context,
        ErrorSeverity.LOW
      );
    }
  }

  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  async exportEncryptionKey(): Promise<string | null> {
    if (!this.encryptionKey) {
      return null;
    }
    
    try {
      return await StorageEncryption.exportKey(this.encryptionKey);
    } catch (error) {
      const context: ErrorContext = {
        component: 'SecureStorage',
        action: 'exportEncryptionKey',
        timestamp: Date.now()
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.SECURITY,
        context,
        ErrorSeverity.HIGH
      );
      
      return null;
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storagePrefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  private getFullKey(key: string): string {
    return `${this.storagePrefix}${key}`;
  }

  private getOriginalKey(fullKey: string): string {
    return fullKey.replace(this.storagePrefix, '');
  }

  private async updateMetrics(): Promise<void> {
    const keys = this.getAllKeys();
    let totalSize = 0;
    let encryptedItems = 0;
    let compressedItems = 0;
    let expiredItems = 0;
    
    for (const fullKey of keys) {
      const storedData = localStorage.getItem(fullKey);
      if (storedData) {
        totalSize += new Blob([storedData]).size;
        
        try {
          const storageItem: StorageItem = JSON.parse(storedData);
          
          if (storageItem.encrypted) encryptedItems++;
          if (storageItem.compressed) compressedItems++;
          if (storageItem.expiresAt && Date.now() > storageItem.expiresAt) {
            expiredItems++;
          }
        } catch {
          // Corrupted item
        }
      }
    }
    
    this.metrics = {
      totalItems: keys.length,
      totalSize,
      encryptedItems,
      compressedItems,
      expiredItems,
      lastCleanup: this.metrics.lastCleanup
    };
  }

  private initializeCleanup(): void {
    // Run cleanup every hour
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
}

// Global secure storage instance
export const globalSecureStorage = SecureStorage.getInstance();

// Utility functions
export const secureStore = async <T>(
  key: string,
  value: T,
  options?: {
    encrypt?: boolean;
    compress?: boolean;
    expiresIn?: number;
  }
): Promise<void> => {
  return await globalSecureStorage.setItem(key, value, options);
};

export const secureRetrieve = async <T>(key: string): Promise<T | null> => {
  return await globalSecureStorage.getItem<T>(key);
};

export const secureRemove = async (key: string): Promise<void> => {
  return await globalSecureStorage.removeItem(key);
};

export const secureExists = async (key: string): Promise<boolean> => {
  return await globalSecureStorage.hasItem(key);
};

export const initializeSecureStorage = async (encryptionPassword?: string): Promise<void> => {
  return await globalSecureStorage.initialize(encryptionPassword);
};

// Common storage keys
export const StorageKeys = {
  USER_PREFERENCES: 'user_preferences',
  DRAFT_REPORTS: 'draft_reports',
  ENCRYPTION_SETTINGS: 'encryption_settings',
  NETWORK_CONFIG: 'network_config',
  WALLET_CACHE: 'wallet_cache',
  FILE_METADATA: 'file_metadata',
  SECURITY_LOGS: 'security_logs',
  PERFORMANCE_METRICS: 'performance_metrics'
} as const;

// Type-safe storage helpers
export const TypedStorage = {
  async setUserPreferences(preferences: Record<string, any>): Promise<void> {
    await secureStore(StorageKeys.USER_PREFERENCES, preferences, {
      encrypt: true,
      compress: true,
      expiresIn: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
  },

  async getUserPreferences(): Promise<Record<string, any> | null> {
    return await secureRetrieve(StorageKeys.USER_PREFERENCES);
  },

  async setDraftReport(reportId: string, draft: any): Promise<void> {
    const drafts = await secureRetrieve<Record<string, any>>(StorageKeys.DRAFT_REPORTS) || {};
    drafts[reportId] = {
      ...draft,
      lastModified: Date.now()
    };
    
    await secureStore(StorageKeys.DRAFT_REPORTS, drafts, {
      encrypt: true,
      compress: true,
      expiresIn: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  },

  async getDraftReport(reportId: string): Promise<any | null> {
    const drafts = await secureRetrieve<Record<string, any>>(StorageKeys.DRAFT_REPORTS);
    return drafts?.[reportId] || null;
  },

  async removeDraftReport(reportId: string): Promise<void> {
    const drafts = await secureRetrieve<Record<string, any>>(StorageKeys.DRAFT_REPORTS) || {};
    delete drafts[reportId];
    
    if (Object.keys(drafts).length === 0) {
      await secureRemove(StorageKeys.DRAFT_REPORTS);
    } else {
      await secureStore(StorageKeys.DRAFT_REPORTS, drafts, {
        encrypt: true,
        compress: true,
        expiresIn: 7 * 24 * 60 * 60 * 1000
      });
    }
  },

  async setNetworkConfig(config: any): Promise<void> {
    await secureStore(StorageKeys.NETWORK_CONFIG, config, {
      encrypt: true,
      compress: false
    });
  },

  async getNetworkConfig(): Promise<any | null> {
    return await secureRetrieve(StorageKeys.NETWORK_CONFIG);
  }
};

// Export encryption utilities for advanced use cases
export { StorageEncryption, StorageCompression, StorageChecksum };