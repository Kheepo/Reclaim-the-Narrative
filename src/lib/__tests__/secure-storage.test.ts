import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SecureStorage,
  StorageEncryption,
  StorageCompression,
  StorageChecksum,
  secureStore,
  secureRetrieve,
  secureRemove,
  secureExists,
  initializeSecureStorage,
  StorageKeys,
  TypedStorage
} from '../secure-storage';
import { ErrorCategory, globalErrorHandler } from '../error-handler';

// Mock the error handler
jest.mock('../error-handler', () => ({
  globalErrorHandler: {
    handleError: jest.fn(),
    reportError: jest.fn()
  },
  ErrorCategory: {
    STORAGE: 'storage',
    SECURITY: 'security',
    NETWORK: 'network',
    BLOCKCHAIN: 'blockchain',
    VALIDATION: 'validation',
    UI: 'ui'
  },
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  }
}));

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      generateKey: jest.fn().mockResolvedValue({}),
      importKey: jest.fn().mockResolvedValue({}),
      exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
      decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      deriveKey: jest.fn().mockResolvedValue({})
    },
    getRandomValues: jest.fn().mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock compression streams
global.CompressionStream = jest.fn().mockImplementation(() => ({
  writable: {
    getWriter: () => ({
      write: jest.fn(),
      close: jest.fn()
    })
  },
  readable: {
    getReader: () => ({
      read: jest.fn().mockResolvedValue({ value: new Uint8Array([1, 2, 3]), done: true })
    })
  }
}));

global.DecompressionStream = jest.fn().mockImplementation(() => ({
  writable: {
    getWriter: () => ({
      write: jest.fn(),
      close: jest.fn()
    })
  },
  readable: {
    getReader: () => ({
      read: jest.fn().mockResolvedValue({ value: new Uint8Array([1, 2, 3]), done: true })
    })
  }
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock Blob
global.Blob = jest.fn().mockImplementation((content, options) => ({
  size: content ? content[0].length : 0,
  type: options?.type || ''
}));

// Mock btoa and atob
global.btoa = jest.fn().mockImplementation((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn().mockImplementation((str) => Buffer.from(str, 'base64').toString('binary'));

// Mock TextEncoder and TextDecoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockImplementation((str) => new Uint8Array(Buffer.from(str, 'utf8')))
}));

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockImplementation((buffer) => Buffer.from(buffer).toString('utf8'))
}));

// Mock setInterval and clearInterval
global.setInterval = jest.fn();
global.clearInterval = jest.fn();
Object.defineProperty(window, 'setInterval', { value: global.setInterval });
Object.defineProperty(window, 'clearInterval', { value: global.clearInterval });

// Mock localStorage
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: jest.fn((key: string) => mockLocalStorage.store.get(key) || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store.set(key, value);
  }),
  removeItem: jest.fn((key: string) => {
    mockLocalStorage.store.delete(key);
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store.clear();
  }),
  key: jest.fn((index: number) => {
    const keys = Array.from(mockLocalStorage.store.keys());
    return keys[index] || null;
  }),
  get length() {
    return mockLocalStorage.store.size;
  }
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('Secure Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.store.clear();
    SecureStorage.getInstance().clear();
  });

  describe('StorageEncryption', () => {
    let encryption: StorageEncryption;

    beforeEach(async () => {
      encryption = new StorageEncryption();
      await encryption.generateKey();
    });

    it('should generate encryption key', async () => {
      const key = await encryption.generateKey();
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should encrypt and decrypt data', async () => {
      const data = 'sensitive information';
      const encrypted = await encryption.encrypt(data);
      const decrypted = await encryption.decrypt(encrypted);
      
      expect(encrypted).not.toBe(data);
      expect(decrypted).toBe(data);
    });

    it('should export and import key', async () => {
      const exportedKey = await encryption.exportKey();
      const newEncryption = new StorageEncryption();
      await newEncryption.importKey(exportedKey);
      
      const data = 'test data';
      const encrypted = await encryption.encrypt(data);
      const decrypted = await newEncryption.decrypt(encrypted);
      
      expect(decrypted).toBe(data);
    });

    it('should handle decryption with wrong key', async () => {
      const data = 'test data';
      const encrypted = await encryption.encrypt(data);
      
      const wrongEncryption = new StorageEncryption();
      await wrongEncryption.generateKey();
      
      await expect(wrongEncryption.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe('StorageCompression', () => {
    it('should compress and decompress data', async () => {
      const data = 'This is a long string that should be compressed to save space in storage';
      const compressed = await StorageCompression.compress(data);
      const decompressed = await StorageCompression.decompress(compressed);
      
      expect(compressed).not.toBe(data);
      expect(decompressed).toBe(data);
    });

    it('should handle compression errors', async () => {
      await expect(StorageCompression.decompress('invalid-data')).rejects.toThrow();
    });
  });

  describe('StorageChecksum', () => {
    it('should calculate checksum for data', async () => {
      const data = 'test data';
      const checksum = await StorageChecksum.calculate(data);
      
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });

    it('should verify data integrity', async () => {
      const data = 'test data';
      const checksum = await StorageChecksum.calculate(data);
      
      const isValid = await StorageChecksum.verify(data, checksum);
      expect(isValid).toBe(true);
      
      const isInvalid = await StorageChecksum.verify('modified data', checksum);
      expect(isInvalid).toBe(false);
    });
  });

  describe('SecureStorage', () => {
    let storage: SecureStorage;

    beforeEach(async () => {
      storage = SecureStorage.getInstance();
      await storage.initialize();
    });

    describe('Basic Operations', () => {
      it('should store and retrieve data', async () => {
        const key = 'test-key';
        const value = { message: 'Hello, World!' };
        
        await storage.setItem(key, value);
        const retrieved = await storage.getItem(key);
        
        expect(retrieved).toEqual(value);
      });

      it('should return null for non-existent keys', async () => {
        const result = await storage.getItem('non-existent');
        expect(result).toBeNull();
      });

      it('should remove items', async () => {
        const key = 'test-key';
        const value = 'test value';
        
        await storage.setItem(key, value);
        expect(await storage.hasItem(key)).toBe(true);
        
        await storage.removeItem(key);
        expect(await storage.hasItem(key)).toBe(false);
      });

      it('should clear all items', async () => {
        await storage.setItem('key1', 'value1');
        await storage.setItem('key2', 'value2');
        
        expect(await storage.getSize()).toBe(2);
        
        await storage.clear();
        expect(await storage.getSize()).toBe(0);
      });

      it('should get all keys', async () => {
        await storage.setItem('key1', 'value1');
        await storage.setItem('key2', 'value2');
        
        const keys = await storage.getKeys();
        expect(keys).toContain('key1');
        expect(keys).toContain('key2');
      });
    });

    describe('Expiration', () => {
      it('should handle item expiration', async () => {
        const key = 'expiring-key';
        const value = 'expiring value';
        const ttl = 100; // 100ms
        
        await storage.setItem(key, value, { ttl });
        expect(await storage.hasItem(key)).toBe(true);
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 150));
        
        expect(await storage.hasItem(key)).toBe(false);
        expect(await storage.getItem(key)).toBeNull();
      });

      it('should not expire items without TTL', async () => {
        const key = 'permanent-key';
        const value = 'permanent value';
        
        await storage.setItem(key, value);
        
        // Wait some time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(await storage.hasItem(key)).toBe(true);
        expect(await storage.getItem(key)).toBe(value);
      });
    });

    describe('Encryption', () => {
      it('should encrypt sensitive data', async () => {
        const key = 'sensitive-key';
        const value = 'sensitive information';
        
        await storage.setItem(key, value, { encrypt: true });
        
        // Check that raw storage contains encrypted data
        const rawData = localStorage.getItem(`secure_storage_${key}`);
        expect(rawData).toBeTruthy();
        expect(rawData).not.toContain(value);
        
        // But retrieval should return original value
        const retrieved = await storage.getItem(key);
        expect(retrieved).toBe(value);
      });
    });

    describe('Compression', () => {
      it('should compress large data', async () => {
        const key = 'large-data';
        const value = 'A'.repeat(1000); // Large string
        
        await storage.setItem(key, value, { compress: true });
        const retrieved = await storage.getItem(key);
        
        expect(retrieved).toBe(value);
      });
    });

    describe('Data Integrity', () => {
      it('should verify data integrity', async () => {
        const key = 'integrity-key';
        const value = 'important data';
        
        await storage.setItem(key, value, { verifyIntegrity: true });
        const retrieved = await storage.getItem(key);
        
        expect(retrieved).toBe(value);
      });

      it('should detect corrupted data', async () => {
        const key = 'corrupted-key';
        const value = 'original data';
        
        await storage.setItem(key, value, { verifyIntegrity: true });
        
        // Manually corrupt the data
        const rawKey = `secure_storage_${key}`;
        const rawData = localStorage.getItem(rawKey);
        if (rawData) {
          const parsed = JSON.parse(rawData);
          parsed.data = 'corrupted';
          localStorage.setItem(rawKey, JSON.stringify(parsed));
        }
        
        const retrieved = await storage.getItem(key);
        expect(retrieved).toBeNull();
        expect(globalErrorHandler.handleError).toHaveBeenCalled();
      });
    });

    describe('Size Limits', () => {
      it('should respect size limits', async () => {
        const key = 'large-item';
        const value = 'A'.repeat(10000); // Very large string
        
        await storage.setItem(key, value);
        
        // Should handle large data gracefully
        const retrieved = await storage.getItem(key);
        expect(retrieved).toBe(value);
      });
    });

    describe('Backup and Restore', () => {
      it('should create backup', async () => {
        await storage.setItem('key1', 'value1');
        await storage.setItem('key2', { nested: 'object' });
        
        const backup = await storage.backup();
        
        expect(backup.version).toBe('1.0.0');
        expect(backup.timestamp).toBeTruthy();
        expect(backup.data).toHaveProperty('key1');
        expect(backup.data).toHaveProperty('key2');
      });

      it('should restore from backup', async () => {
        // Create initial data
        await storage.setItem('original', 'data');
        
        // Create backup
        const backup = await storage.backup();
        
        // Clear storage
        await storage.clear();
        expect(await storage.getSize()).toBe(0);
        
        // Restore from backup
        await storage.restore(backup);
        
        expect(await storage.getItem('original')).toBe('data');
      });
    });

    describe('Metrics', () => {
      it('should provide storage metrics', async () => {
        await storage.setItem('key1', 'value1');
        await storage.setItem('key2', 'value2');
        
        const metrics = await storage.getMetrics();
        
        expect(metrics.totalItems).toBe(2);
        expect(metrics.totalSize).toBeGreaterThan(0);
        expect(metrics.encryptedItems).toBe(0);
        expect(metrics.compressedItems).toBe(0);
      });
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    it('should use utility functions', async () => {
      const key = 'util-key';
      const value = 'utility value';
      
      await secureStore(key, value);
      expect(await secureExists(key)).toBe(true);
      
      const retrieved = await secureRetrieve(key);
      expect(retrieved).toBe(value);
      
      await secureRemove(key);
      expect(await secureExists(key)).toBe(false);
    });
  });

  describe('TypedStorage', () => {
    beforeEach(async () => {
      await initializeSecureStorage();
    });

    it('should provide typed storage helpers', async () => {
      const userProfile = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      await TypedStorage.setUserProfile(userProfile);
      const retrieved = await TypedStorage.getUserProfile();
      
      expect(retrieved).toEqual(userProfile);
    });

    it('should handle encryption keys', async () => {
      const encryptionKey = 'test-encryption-key';
      
      await TypedStorage.setEncryptionKey(encryptionKey);
      const retrieved = await TypedStorage.getEncryptionKey();
      
      expect(retrieved).toBe(encryptionKey);
    });

    it('should manage app settings', async () => {
      const settings = {
        theme: 'dark',
        notifications: true,
        language: 'en'
      };
      
      await TypedStorage.setAppSettings(settings);
      const retrieved = await TypedStorage.getAppSettings();
      
      expect(retrieved).toEqual(settings);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const storage = SecureStorage.getInstance();
      
      // Mock localStorage to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });
      
      await storage.setItem('test', 'value');
      
      expect(globalErrorHandler.handleError).toHaveBeenCalled();
      
      // Restore original method
      localStorage.setItem = originalSetItem;
    });

    it('should handle initialization errors', async () => {
      const storage = SecureStorage.getInstance();
      
      // Mock crypto to be unavailable
      const originalCrypto = global.crypto;
      delete (global as any).crypto;
      
      await storage.initialize();
      
      expect(globalErrorHandler.handleError).toHaveBeenCalled();
      
      // Restore crypto
      global.crypto = originalCrypto;
    });
  });

  describe('Performance', () => {
    it('should handle concurrent operations', async () => {
      const storage = SecureStorage.getInstance();
      await storage.initialize();
      
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(storage.setItem(`key${i}`, `value${i}`));
      }
      
      await Promise.all(operations);
      
      for (let i = 0; i < 10; i++) {
        const value = await storage.getItem(`key${i}`);
        expect(value).toBe(`value${i}`);
      }
    });
  });
});