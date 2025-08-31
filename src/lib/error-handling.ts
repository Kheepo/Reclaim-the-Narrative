/**
 * Enhanced error handling utilities with retry mechanisms and user-friendly messages
 */

export interface ErrorContext {
  operation: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
  userId?: string;
  timeout?: number;
  elapsed?: number;
  additionalData?: Record<string, any>;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  type: 'primary' | 'secondary';
}

export interface EnhancedError extends Error {
  code?: string;
  context?: ErrorContext;
  recoveryActions?: ErrorRecoveryAction[];
  userMessage?: string;
  isRetryable?: boolean;
  originalError?: Error;
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  WALLET = 'WALLET',
  BLOCKCHAIN = 'BLOCKCHAIN',
  IPFS = 'IPFS',
  ENCRYPTION = 'ENCRYPTION',
  FILE_PROCESSING = 'FILE_PROCESSING',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  RATE_LIMIT = 'RATE_LIMIT',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

// Default retry options
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error) => {
    // Retry on network errors, timeouts, and server errors
    return error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('fetch') ||
           error.message.includes('500') ||
           error.message.includes('502') ||
           error.message.includes('503') ||
           error.message.includes('504');
  }
};

/**
 * Create an enhanced error with context and recovery actions
 */
export function createEnhancedError(
  message: string,
  category: ErrorCategory,
  context?: Partial<ErrorContext>,
  originalError?: Error
): EnhancedError {
  const error = new Error(message) as EnhancedError;
  
  error.code = category;
  error.context = {
    operation: 'unknown',
    timestamp: new Date(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...context
  };
  error.originalError = originalError;
  error.userMessage = getUserFriendlyMessage(category, message);
  error.isRetryable = isRetryableError(category, message);
  error.recoveryActions = getRecoveryActions(category);
  
  return error;
}

/**
 * Get user-friendly error messages
 */
function getUserFriendlyMessage(category: ErrorCategory, originalMessage: string): string {
  const messages: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK]: 'Network connection issue. Please check your internet connection and try again.',
    [ErrorCategory.VALIDATION]: 'Please check your input and correct any errors.',
    [ErrorCategory.WALLET]: 'Wallet connection issue. Please ensure your wallet is connected and try again.',
    [ErrorCategory.BLOCKCHAIN]: 'Blockchain transaction failed. This might be due to network congestion or insufficient gas.',
    [ErrorCategory.IPFS]: 'File upload failed. Please check your connection and try again.',
    [ErrorCategory.ENCRYPTION]: 'Data encryption failed. Please verify your password and try again.',
    [ErrorCategory.FILE_PROCESSING]: 'File processing failed. Please check the file format and try again.',
    [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please log in again.',
    [ErrorCategory.PERMISSION]: 'Permission denied. You may not have access to this resource.',
    [ErrorCategory.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
    [ErrorCategory.SYSTEM]: 'System error occurred. Please try again later.',
    [ErrorCategory.UNKNOWN]: 'An unexpected error occurred. Please try again.'
  };
  
  return messages[category] || originalMessage;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(category: ErrorCategory, message: string): boolean {
  const retryableCategories = [
    ErrorCategory.NETWORK,
    ErrorCategory.IPFS,
    ErrorCategory.BLOCKCHAIN
  ];
  
  if (retryableCategories.includes(category)) {
    return true;
  }
  
  // Check message for retryable patterns
  const retryablePatterns = [
    'timeout',
    'network',
    'connection',
    'temporary',
    '502',
    '503',
    '504'
  ];
  
  return retryablePatterns.some(pattern => 
    message.toLowerCase().includes(pattern)
  );
}

/**
 * Get recovery actions for different error categories
 */
function getRecoveryActions(category: ErrorCategory): ErrorRecoveryAction[] {
  const actions: Record<ErrorCategory, ErrorRecoveryAction[]> = {
    [ErrorCategory.NETWORK]: [
      {
        label: 'Check Connection',
        action: () => window.location.reload(),
        type: 'primary'
      },
      {
        label: 'Retry',
        action: () => {}, // Will be overridden by caller
        type: 'secondary'
      }
    ],
    [ErrorCategory.WALLET]: [
      {
        label: 'Reconnect Wallet',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      },
      {
        label: 'Switch Network',
        action: () => {}, // Will be overridden by caller
        type: 'secondary'
      }
    ],
    [ErrorCategory.BLOCKCHAIN]: [
      {
        label: 'Retry Transaction',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      },
      {
        label: 'Check Gas Settings',
        action: () => {}, // Will be overridden by caller
        type: 'secondary'
      }
    ],
    [ErrorCategory.IPFS]: [
      {
        label: 'Retry Upload',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      },
      {
        label: 'Check File Size',
        action: () => {}, // Will be overridden by caller
        type: 'secondary'
      }
    ],
    [ErrorCategory.VALIDATION]: [
      {
        label: 'Review Form',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      }
    ],
    [ErrorCategory.ENCRYPTION]: [
      {
        label: 'Check Password',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      }
    ],
    [ErrorCategory.FILE_PROCESSING]: [
      {
        label: 'Check File Format',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      },
      {
        label: 'Try Different File',
        action: () => {}, // Will be overridden by caller
        type: 'secondary'
      }
    ],
    [ErrorCategory.AUTHENTICATION]: [
      {
        label: 'Log In Again',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      }
    ],
    [ErrorCategory.PERMISSION]: [
      {
        label: 'Contact Support',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      }
    ],
    [ErrorCategory.RATE_LIMIT]: [
      {
        label: 'Wait and Retry',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      }
    ],
    [ErrorCategory.SYSTEM]: [
      {
        label: 'Refresh Page',
        action: () => window.location.reload(),
        type: 'primary'
      },
      {
        label: 'Try Again Later',
        action: () => {}, // Will be overridden by caller
        type: 'secondary'
      }
    ],
    [ErrorCategory.UNKNOWN]: [
      {
        label: 'Retry',
        action: () => {}, // Will be overridden by caller
        type: 'primary'
      },
      {
        label: 'Refresh Page',
        action: () => window.location.reload(),
        type: 'secondary'
      }
    ]
  };
  
  return actions[category] || [];
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if condition fails
      if (config.retryCondition && !config.retryCondition(lastError)) {
        throw lastError;
      }
      
      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );
      
      console.warn(`Operation failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Enhanced retry function with exponential backoff and custom options
 */
export interface ExponentialBackoffOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: ExponentialBackoffOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = (error) => {
      // Default retry condition for network and temporary errors
      const message = error.message.toLowerCase();
      return message.includes('network') ||
             message.includes('timeout') ||
             message.includes('fetch') ||
             message.includes('connection') ||
             message.includes('502') ||
             message.includes('503') ||
             message.includes('504') ||
             message.includes('temporary');
    },
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if this is the last attempt
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Calculate exponential backoff delay with jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelay);
      
      console.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delay)}ms:`, lastError.message);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(createEnhancedError(
          `${operation || 'Operation'} timed out after ${timeoutMs}ms`,
          ErrorCategory.NETWORK,
          { operation: operation || 'timeout', timeout: timeoutMs }
        ));
      }, timeoutMs);
    })
  ]);
}

/**
 * Enhanced timeout wrapper with progress tracking and cancellation
 */
export interface TimeoutOptions {
  timeoutMs: number;
  operation?: string;
  onProgress?: (elapsed: number, remaining: number) => void;
  progressInterval?: number;
}

export function withEnhancedTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): { promise: Promise<T>; cancel: () => void } {
  const {
    timeoutMs,
    operation = 'Operation',
    onProgress,
    progressInterval = 1000
  } = options;
  
  let timeoutId: NodeJS.Timeout;
  let progressId: NodeJS.Timeout;
  let cancelled = false;
  
  const cancel = () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
    if (progressId) clearInterval(progressId);
  };
  
  const enhancedPromise = Promise.race([
    promise.then(result => {
      cancel();
      return result;
    }).catch(error => {
      cancel();
      throw error;
    }),
    new Promise<never>((_, reject) => {
      const startTime = Date.now();
      
      // Set up progress tracking
      if (onProgress) {
        progressId = setInterval(() => {
          if (cancelled) return;
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, timeoutMs - elapsed);
          onProgress(elapsed, remaining);
        }, progressInterval);
      }
      
      // Set up timeout
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        cancel();
        reject(createEnhancedError(
          `${operation} timed out after ${timeoutMs}ms`,
          ErrorCategory.NETWORK,
          { 
            operation: operation.toLowerCase().replace(/\s+/g, '_'),
            timeout: timeoutMs,
            elapsed: Date.now() - startTime
          }
        ));
      }, timeoutMs);
    })
  ]);
  
  return { promise: enhancedPromise, cancel };
}

/**
 * Adaptive timeout that adjusts based on network conditions
 */
export async function withAdaptiveTimeout<T>(
  promise: Promise<T>,
  baseTimeoutMs: number,
  operation?: string
): Promise<T> {
  // Get network speed estimate to adjust timeout
  let timeoutMultiplier = 1;
  
  try {
    // Check if we have network connection info
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.effectiveType) {
        switch (connection.effectiveType) {
          case 'slow-2g':
            timeoutMultiplier = 4;
            break;
          case '2g':
            timeoutMultiplier = 3;
            break;
          case '3g':
            timeoutMultiplier = 2;
            break;
          case '4g':
          default:
            timeoutMultiplier = 1;
            break;
        }
      }
    }
  } catch (error) {
    // Fallback to default timeout if network info unavailable
    console.warn('Could not determine network speed, using default timeout');
  }
  
  const adaptiveTimeout = baseTimeoutMs * timeoutMultiplier;
  console.log(`Using adaptive timeout: ${adaptiveTimeout}ms (base: ${baseTimeoutMs}ms, multiplier: ${timeoutMultiplier})`);
  
  return withTimeout(promise, adaptiveTimeout, operation);
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw createEnhancedError(
          'Service temporarily unavailable',
          ErrorCategory.SYSTEM,
          { operation: 'circuit_breaker_open' }
        );
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Error boundary for React components
 */
export function handleComponentError(error: Error, errorInfo: any) {
  const enhancedError = createEnhancedError(
    error.message,
    ErrorCategory.SYSTEM,
    {
      operation: 'component_render',
      additionalData: errorInfo
    },
    error
  );
  
  console.error('Component error:', enhancedError);
  
  // Log to external service if available
  if (typeof window !== 'undefined' && (window as any).errorLogger) {
    (window as any).errorLogger.log(enhancedError);
  }
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = createEnhancedError(
      event.reason?.message || 'Unhandled promise rejection',
      ErrorCategory.SYSTEM,
      { operation: 'unhandled_promise_rejection' },
      event.reason
    );
    
    console.error('Unhandled promise rejection:', error);
    event.preventDefault();
  });
  
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error = createEnhancedError(
      event.error?.message || event.message || 'Uncaught error',
      ErrorCategory.SYSTEM,
      {
        operation: 'uncaught_error',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      },
      event.error
    );
    
    console.error('Uncaught error:', error);
  });
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if we can make a new request
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
  
  getTimeUntilNextRequest(): number {
    if (this.requests.length < this.maxRequests) {
      return 0;
    }
    
    const oldestRequest = Math.min(...this.requests);
    return this.windowMs - (Date.now() - oldestRequest);
  }
}

/**
 * Categorize error based on message and context
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return ErrorCategory.NETWORK;
  }
  
  if (message.includes('wallet') || message.includes('metamask') || message.includes('signer')) {
    return ErrorCategory.WALLET;
  }
  
  if (message.includes('transaction') || message.includes('gas') || message.includes('blockchain')) {
    return ErrorCategory.BLOCKCHAIN;
  }
  
  if (message.includes('ipfs') || message.includes('upload') || message.includes('storage')) {
    return ErrorCategory.IPFS;
  }
  
  if (message.includes('encrypt') || message.includes('decrypt') || message.includes('password')) {
    return ErrorCategory.ENCRYPTION;
  }
  
  if (message.includes('file') || message.includes('format') || message.includes('size')) {
    return ErrorCategory.FILE_PROCESSING;
  }
  
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return ErrorCategory.VALIDATION;
  }
  
  if (message.includes('auth') || message.includes('login') || message.includes('token')) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  if (message.includes('permission') || message.includes('access') || message.includes('forbidden')) {
    return ErrorCategory.PERMISSION;
  }
  
  if (message.includes('rate') || message.includes('limit') || message.includes('too many')) {
    return ErrorCategory.RATE_LIMIT;
  }
  
  return ErrorCategory.UNKNOWN;
}