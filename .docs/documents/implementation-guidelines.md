# Implementation Guidelines & Best Practices

## Overview

This document provides detailed implementation guidelines, best practices, and actionable recommendations for building a bulletproof GBV Reporting Platform with comprehensive error handling and robust testing procedures.

## 1. Error Handling Implementation Strategy

### 1.1 Multi-Layer Error Architecture

```typescript
// src/lib/errors/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { NetworkErrorHandler } from './NetworkErrorHandler';
import { toast } from 'react-hot-toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to error tracking service
    this.logErrorToService(error, errorInfo);
    
    // Handle network errors specifically
    if (this.isNetworkError(error)) {
      NetworkErrorHandler.getInstance().handleError(error);
    } else {
      // Show generic error toast
      toast.error('An unexpected error occurred. Please try again.');
    }
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private isNetworkError(error: Error): boolean {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Implementation for error logging service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Send to logging service (e.g., Sentry, LogRocket)
    console.log('Error logged:', errorData);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 1.2 Enhanced Network Error Handler

```typescript
// src/lib/errors/EnhancedNetworkErrorHandler.ts
import { NetworkErrorHandler, NetworkError, ErrorRecoveryResult } from './NetworkErrorHandler';

export class EnhancedNetworkErrorHandler extends NetworkErrorHandler {
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private retryQueue: RetryQueueItem[] = [];
  private isProcessingQueue = false;

  async handleErrorWithCircuitBreaker(
    error: any,
    operation: string
  ): Promise<ErrorRecoveryResult> {
    const breakerState = this.getCircuitBreakerState(operation);
    
    if (breakerState.state === 'OPEN') {
      if (Date.now() - breakerState.lastFailure < breakerState.timeout) {
        throw new Error(`Circuit breaker is OPEN for ${operation}`);
      } else {
        // Try to transition to HALF_OPEN
        breakerState.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await this.handleError(error);
      
      if (result.recovered) {
        this.recordSuccess(operation);
      } else {
        this.recordFailure(operation);
      }
      
      return result;
    } catch (recoveryError) {
      this.recordFailure(operation);
      throw recoveryError;
    }
  }

  private getCircuitBreakerState(operation: string): CircuitBreakerState {
    if (!this.circuitBreaker.has(operation)) {
      this.circuitBreaker.set(operation, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailure: 0,
        timeout: 60000, // 1 minute
        threshold: 5
      });
    }
    return this.circuitBreaker.get(operation)!;
  }

  private recordSuccess(operation: string): void {
    const state = this.getCircuitBreakerState(operation);
    state.failureCount = 0;
    state.state = 'CLOSED';
  }

  private recordFailure(operation: string): void {
    const state = this.getCircuitBreakerState(operation);
    state.failureCount++;
    state.lastFailure = Date.now();
    
    if (state.failureCount >= state.threshold) {
      state.state = 'OPEN';
    }
  }

  async addToRetryQueue(
    operation: () => Promise<any>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<void> {
    const item: RetryQueueItem = {
      id: Date.now().toString(),
      operation,
      maxRetries,
      currentRetry: 0,
      backoffMs,
      nextRetry: Date.now() + backoffMs
    };
    
    this.retryQueue.push(item);
    this.processRetryQueue();
  }

  private async processRetryQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.retryQueue.length > 0) {
      const now = Date.now();
      const readyItems = this.retryQueue.filter(item => item.nextRetry <= now);
      
      for (const item of readyItems) {
        try {
          await item.operation();
          // Success - remove from queue
          this.retryQueue = this.retryQueue.filter(i => i.id !== item.id);
        } catch (error) {
          item.currentRetry++;
          
          if (item.currentRetry >= item.maxRetries) {
            // Max retries reached - remove from queue
            this.retryQueue = this.retryQueue.filter(i => i.id !== item.id);
            console.error(`Operation ${item.id} failed after ${item.maxRetries} retries:`, error);
          } else {
            // Schedule next retry with exponential backoff
            item.nextRetry = now + (item.backoffMs * Math.pow(2, item.currentRetry));
          }
        }
      }
      
      // Wait before next processing cycle
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isProcessingQueue = false;
  }
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailure: number;
  timeout: number;
  threshold: number;
}

interface RetryQueueItem {
  id: string;
  operation: () => Promise<any>;
  maxRetries: number;
  currentRetry: number;
  backoffMs: number;
  nextRetry: number;
}
```

### 1.3 File Upload Error Handling

```typescript
// src/lib/upload/FileUploadHandler.ts
export class FileUploadHandler {
  private maxFileSize = 50 * 1024 * 1024; // 50MB
  private allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'text/plain',
    'video/mp4', 'video/webm',
    'audio/mp3', 'audio/wav'
  ];
  private maxConcurrentUploads = 3;
  private uploadQueue: UploadQueueItem[] = [];
  private activeUploads = 0;

  async uploadFiles(files: File[]): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (const file of files) {
      try {
        this.validateFile(file);
        const result = await this.queueUpload(file);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          file: file.name
        });
      }
    }
    
    return results;
  }

  private validateFile(file: File): void {
    // File size validation
    if (file.size > this.maxFileSize) {
      throw new Error(`File ${file.name} exceeds maximum size of ${this.maxFileSize / 1024 / 1024}MB`);
    }
    
    // File type validation
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
    
    // File name validation
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      throw new Error(`File name contains invalid characters: ${file.name}`);
    }
    
    // Additional security checks
    this.performSecurityChecks(file);
  }

  private performSecurityChecks(file: File): void {
    // Check for executable file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileName = file.name.toLowerCase();
    
    for (const ext of dangerousExtensions) {
      if (fileName.endsWith(ext)) {
        throw new Error(`Executable files are not allowed: ${file.name}`);
      }
    }
    
    // Check for double extensions (e.g., file.txt.exe)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      const secondLastExt = '.' + parts[parts.length - 2];
      if (dangerousExtensions.includes(secondLastExt)) {
        throw new Error(`Suspicious file extension detected: ${file.name}`);
      }
    }
  }

  private async queueUpload(file: File): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const queueItem: UploadQueueItem = {
        file,
        resolve,
        reject,
        retries: 0,
        maxRetries: 3
      };
      
      this.uploadQueue.push(queueItem);
      this.processUploadQueue();
    });
  }

  private async processUploadQueue(): Promise<void> {
    while (this.uploadQueue.length > 0 && this.activeUploads < this.maxConcurrentUploads) {
      const item = this.uploadQueue.shift()!;
      this.activeUploads++;
      
      this.performUpload(item)
        .finally(() => {
          this.activeUploads--;
          this.processUploadQueue();
        });
    }
  }

  private async performUpload(item: UploadQueueItem): Promise<void> {
    try {
      // Encrypt file if needed
      const encryptedFile = await this.encryptFileIfNeeded(item.file);
      
      // Upload to IPFS with progress tracking
      const result = await this.uploadToIPFSWithProgress(encryptedFile, (progress) => {
        // Emit progress event
        this.emitProgress(item.file.name, progress);
      });
      
      item.resolve({
        success: true,
        cid: result.cid,
        url: result.url,
        file: item.file.name,
        encrypted: !!encryptedFile.encrypted
      });
    } catch (error) {
      if (item.retries < item.maxRetries) {
        item.retries++;
        // Add back to queue with exponential backoff
        setTimeout(() => {
          this.uploadQueue.unshift(item);
          this.processUploadQueue();
        }, Math.pow(2, item.retries) * 1000);
      } else {
        item.reject(new Error(`Upload failed after ${item.maxRetries} retries: ${error.message}`));
      }
    }
  }

  private async encryptFileIfNeeded(file: File): Promise<{ file: File; encrypted?: boolean }> {
    // Check if encryption is required based on file type or user preference
    const requiresEncryption = this.shouldEncryptFile(file);
    
    if (requiresEncryption) {
      try {
        const encryptedData = await this.encryptFile(file);
        const encryptedFile = new File([encryptedData], `${file.name}.encrypted`, {
          type: 'application/octet-stream'
        });
        return { file: encryptedFile, encrypted: true };
      } catch (error) {
        throw new Error(`File encryption failed: ${error.message}`);
      }
    }
    
    return { file };
  }

  private shouldEncryptFile(file: File): boolean {
    // Encrypt sensitive file types by default
    const sensitiveTypes = ['application/pdf', 'text/plain'];
    return sensitiveTypes.includes(file.type);
  }

  private async encryptFile(file: File): Promise<ArrayBuffer> {
    const fileData = await file.arrayBuffer();
    // Use encryption library to encrypt file data
    // Implementation depends on chosen encryption method
    return fileData; // Placeholder
  }

  private async uploadToIPFSWithProgress(
    file: { file: File; encrypted?: boolean },
    onProgress: (progress: number) => void
  ): Promise<{ cid: string; url: string }> {
    // Implementation with progress tracking
    // This would integrate with the IPFS upload function
    throw new Error('Not implemented');
  }

  private emitProgress(fileName: string, progress: number): void {
    // Emit progress event for UI updates
    window.dispatchEvent(new CustomEvent('upload-progress', {
      detail: { fileName, progress }
    }));
  }
}

interface UploadQueueItem {
  file: File;
  resolve: (result: UploadResult) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
}

interface UploadResult {
  success: boolean;
  cid?: string;
  url?: string;
  file: string;
  encrypted?: boolean;
  error?: string;
}
```

## 2. Security Implementation Guidelines

### 2.1 Input Validation & Sanitization

```typescript
// src/lib/security/InputValidator.ts
export class InputValidator {
  static validateReportTitle(title: string): ValidationResult {
    const errors: string[] = [];
    
    if (!title || title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (title.length > 200) {
      errors.push('Title must be less than 200 characters');
    }
    
    if (this.containsMaliciousContent(title)) {
      errors.push('Title contains invalid content');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeInput(title)
    };
  }

  static validateReportDescription(description: string): ValidationResult {
    const errors: string[] = [];
    
    if (!description || description.trim().length === 0) {
      errors.push('Description is required');
    }
    
    if (description.length > 5000) {
      errors.push('Description must be less than 5000 characters');
    }
    
    if (this.containsMaliciousContent(description)) {
      errors.push('Description contains invalid content');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeInput(description)
    };
  }

  static validateLocation(location: string): ValidationResult {
    const errors: string[] = [];
    
    if (location && location.length > 500) {
      errors.push('Location must be less than 500 characters');
    }
    
    if (this.containsMaliciousContent(location)) {
      errors.push('Location contains invalid content');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeInput(location)
    };
  }

  static validateDateTime(dateTime: string): ValidationResult {
    const errors: string[] = [];
    
    if (!dateTime) {
      errors.push('Date and time is required');
    }
    
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    }
    
    if (date > new Date()) {
      errors.push('Date cannot be in the future');
    }
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (date < oneYearAgo) {
      errors.push('Date cannot be more than one year ago');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: dateTime
    };
  }

  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    
    if (!password) {
      errors.push('Password is required');
    }
    
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check against common passwords
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common, please choose a stronger password');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: password // Don't sanitize passwords
    };
  }

  private static containsMaliciousContent(input: string): boolean {
    const maliciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /data:text\/html/gi
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(input));
  }

  private static sanitizeInput(input: string): string {
    if (!input) return '';
    
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized: string;
}
```

### 2.2 Secure Storage Implementation

```typescript
// src/lib/security/SecureStorage.ts
export class SecureStorage {
  private static readonly ENCRYPTION_KEY_NAME = 'gbv_encryption_key';
  private static readonly STORAGE_PREFIX = 'gbv_secure_';
  
  static async storeSecurely(key: string, data: any): Promise<void> {
    try {
      const encryptionKey = await this.getOrCreateEncryptionKey();
      const serializedData = JSON.stringify(data);
      const encryptedData = await this.encrypt(serializedData, encryptionKey);
      
      localStorage.setItem(
        this.STORAGE_PREFIX + key,
        JSON.stringify(encryptedData)
      );
    } catch (error) {
      throw new Error(`Failed to store data securely: ${error.message}`);
    }
  }
  
  static async retrieveSecurely<T>(key: string): Promise<T | null> {
    try {
      const storedData = localStorage.getItem(this.STORAGE_PREFIX + key);
      if (!storedData) return null;
      
      const encryptedData = JSON.parse(storedData);
      const encryptionKey = await this.getOrCreateEncryptionKey();
      const decryptedData = await this.decrypt(encryptedData, encryptionKey);
      
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Failed to retrieve secure data:', error);
      return null;
    }
  }
  
  static removeSecurely(key: string): void {
    localStorage.removeItem(this.STORAGE_PREFIX + key);
  }
  
  static clearAllSecureData(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
  
  private static async getOrCreateEncryptionKey(): Promise<CryptoKey> {
    const storedKey = localStorage.getItem(this.ENCRYPTION_KEY_NAME);
    
    if (storedKey) {
      try {
        const keyData = JSON.parse(storedKey);
        return await crypto.subtle.importKey(
          'raw',
          new Uint8Array(keyData),
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      } catch (error) {
        console.warn('Failed to import stored key, generating new one');
      }
    }
    
    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Store key for future use
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(
      this.ENCRYPTION_KEY_NAME,
      JSON.stringify(Array.from(new Uint8Array(exportedKey)))
    );
    
    return key;
  }
  
  private static async encrypt(data: string, key: CryptoKey): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    return {
      data: Array.from(new Uint8Array(encryptedBuffer)),
      iv: Array.from(iv)
    };
  }
  
  private static async decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
    const dataBuffer = new Uint8Array(encryptedData.data);
    const iv = new Uint8Array(encryptedData.iv);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }
}

interface EncryptedData {
  data: number[];
  iv: number[];
}
```

## 3. Performance Optimization Guidelines

### 3.1 Lazy Loading Implementation

```typescript
// src/components/LazyComponents.tsx
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

// Lazy load heavy components
export const SubmitPage = lazy(() => import('../pages/submit'));
export const VerifyPage = lazy(() => import('../pages/verify'));
export const CertificatePage = lazy(() => import('../pages/certificate'));

// Wrapper component for lazy loading
export function LazyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
}

// Code splitting for large libraries
export const CryptoUtils = lazy(() => import('../lib/encryption'));
export const IPFSClient = lazy(() => import('../lib/ipfs'));
```

### 3.2 Caching Strategy

```typescript
// src/lib/cache/CacheManager.ts
export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheItem>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  
  static getInstance(): CacheManager {
    if (!this.instance) {
      this.instance = new CacheManager();
    }
    return this.instance;
  }
  
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }
  
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Automatic cleanup of expired items
  startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }
}

interface CacheItem {
  value: any;
  expiresAt: number;
}
```

## 4. Testing Implementation Strategy

### 4.1 Test Setup Configuration

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
Object.assign(global, { TextDecoder, TextEncoder });

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      generateKey: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    },
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  value: {
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  writable: true,
});

// Setup test environment
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});
```

### 4.2 Custom Testing Utilities

```typescript
// tests/utils/testing-utils.tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '../../src/lib/errors/ErrorBoundary';

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        {children}
        <Toaster />
      </ErrorBoundary>
    </BrowserRouter>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Test utilities
export const createMockFile = (
  content: string = 'test content',
  name: string = 'test.txt',
  type: string = 'text/plain'
): File => {
  return new File([content], name, { type });
};

export const createMockError = (message: string, code?: string): Error => {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
};

export const waitForAsync = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

export const mockEthereum = () => {
  return {
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    selectedAddress: '0x1234567890123456789012345678901234567890',
    chainId: '0x413', // BlockDAG Testnet
  };
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
```

## 5. Deployment & Monitoring Guidelines

### 5.1 Environment Configuration

```typescript
// src/config/environment.ts
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'staging' | 'production';
  NEXT_PUBLIC_NETWORK: string;
  NEXT_PUBLIC_CONTRACT_ADDRESS: string;
  NEXT_PUBLIC_IPFS_GATEWAY: string;
  WEB3_STORAGE_TOKEN: string;
  SENTRY_DSN?: string;
  ANALYTICS_ID?: string;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || 'blockdag-testnet',
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '',
    NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io',
    WEB3_STORAGE_TOKEN: process.env.WEB3_STORAGE_TOKEN || '',
    SENTRY_DSN: process.env.SENTRY_DSN,
    ANALYTICS_ID: process.env.ANALYTICS_ID,
  };
  
  // Validate required environment variables
  validateEnvironmentConfig(config);
  
  return config;
}

function validateEnvironmentConfig(config: EnvironmentConfig): void {
  const requiredVars = [
    'NEXT_PUBLIC_CONTRACT_ADDRESS',
    'WEB3_STORAGE_TOKEN'
  ];
  
  const missing = requiredVars.filter(varName => {
    const value = config[varName as keyof EnvironmentConfig];
    return !value || value === '';
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

### 5.2 Error Monitoring Setup

```typescript
// src/lib/monitoring/ErrorMonitor.ts
import * as Sentry from '@sentry/nextjs';

export class ErrorMonitor {
  static initialize(): void {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        beforeSend(event) {
          // Filter out known non-critical errors
          if (event.exception) {
            const error = event.exception.values?.[0];
            if (error?.value?.includes('Non-Error promise rejection')) {
              return null;
            }
          }
          return event;
        },
      });
    }
  }
  
  static captureError(error: Error, context?: Record<string, any>): void {
    console.error('Error captured:', error);
    
    if (process.env.SENTRY_DSN) {
      Sentry.withScope(scope => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
        }
        Sentry.captureException(error);
      });
    }
  }
  
  static captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    console.log(`[${level.toUpperCase()}] ${message}`);
    
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(message, level);
    }
  }
  
  static setUserContext(user: { id: string; address?: string }): void {
    if (process.env.SENTRY_DSN) {
      Sentry.setUser(user);
    }
  }
}
```

## 6. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up error boundary components
- [ ] Implement enhanced network error handler
- [ ] Create input validation system
- [ ] Set up secure storage
- [ ] Configure testing environment
- [ ] Implement basic monitoring

### Phase 2: Core Features (Week 2)
- [ ] Implement file upload error handling
- [ ] Add circuit breaker pattern
- [ ] Create retry queue system
- [ ] Implement caching strategy
- [ ] Add performance monitoring
- [ ] Set up automated testing

### Phase 3: Security & Optimization (Week 3)
- [ ] Implement comprehensive input sanitization
- [ ] Add security validation layers
- [ ] Optimize performance with lazy loading
- [ ] Implement advanced caching
- [ ] Add chaos testing
- [ ] Set up error tracking

### Phase 4: Production Readiness (Week 4)
- [ ] Complete end-to-end testing
- [ ] Implement production monitoring
- [ ] Add performance benchmarks
- [ ] Complete security audit
- [ ] Finalize deployment configuration
- [ ] Create operational runbooks

## 7. Success Metrics

### Technical Metrics
- **Error Rate**: < 0.1% of user interactions
- **Recovery Rate**: > 95% of recoverable errors
- **Performance**: Page load < 3 seconds
- **Uptime**: > 99.9% availability
- **Security**: Zero critical vulnerabilities

### Quality Metrics
- **Test Coverage**: > 95%
- **Code Quality**: A+ grade on code analysis
- **Documentation**: 100% API documentation
- **Accessibility**: WCAG 2.1 AA compliance

### User Experience Metrics
- **Error Recovery**: Users can recover from 95% of errors
- **Data Loss**: Zero data loss incidents
- **User Satisfaction**: > 4.5/5 rating
- **Support Tickets**: < 1% error-related tickets

This implementation guide provides a comprehensive roadmap for building a bulletproof GBV Reporting Platform with robust error handling, comprehensive testing, and production-ready monitoring capabilities.