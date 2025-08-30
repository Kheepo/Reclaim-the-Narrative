import { toast } from 'sonner';

// Error types and interfaces
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  BLOCKCHAIN = 'blockchain',
  STORAGE = 'storage',
  VALIDATION = 'validation',
  SECURITY = 'security',
  UI = 'ui'
}

export interface ErrorReport {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  resolved: boolean;
  retryCount: number;
}

// Circuit Breaker States
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Circuit Breaker Implementation
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.resetTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
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

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

// Retry Queue Implementation
class RetryQueue {
  private queue: Array<{
    id: string;
    operation: () => Promise<any>;
    retryCount: number;
    nextRetry: number;
    config: RetryConfig;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  
  private processing = false;

  async add<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    id?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: id || this.generateId(),
        operation,
        retryCount: 0,
        nextRetry: Date.now(),
        config,
        resolve,
        reject
      });
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const readyItems = this.queue.filter(item => item.nextRetry <= now);
      
      if (readyItems.length === 0) {
        // Wait for the next item to be ready
        const nextItem = this.queue.reduce((earliest, item) => 
          item.nextRetry < earliest.nextRetry ? item : earliest
        );
        
        const waitTime = nextItem.nextRetry - now;
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
        continue;
      }
      
      const item = readyItems[0];
      const index = this.queue.indexOf(item);
      
      try {
        const result = await item.operation();
        this.queue.splice(index, 1);
        item.resolve(result);
      } catch (error) {
        item.retryCount++;
        
        if (item.retryCount >= item.config.maxAttempts) {
          this.queue.splice(index, 1);
          item.reject(error);
        } else {
          // Calculate next retry time with exponential backoff
          const delay = Math.min(
            item.config.baseDelay * Math.pow(item.config.backoffMultiplier, item.retryCount - 1),
            item.config.maxDelay
          );
          
          const jitter = item.config.jitter ? Math.random() * 0.1 * delay : 0;
          item.nextRetry = Date.now() + delay + jitter;
        }
      }
    }
    
    this.processing = false;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getQueueStatus() {
    return {
      length: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        id: item.id,
        retryCount: item.retryCount,
        nextRetry: item.nextRetry
      }))
    };
  }
}

// Enhanced Network Error Handler
export class NetworkErrorHandler {
  private circuitBreaker: CircuitBreaker;
  private retryQueue: RetryQueue;
  private errorReports: Map<string, ErrorReport> = new Map();
  private metrics = {
    totalErrors: 0,
    resolvedErrors: 0,
    networkErrors: 0,
    retryAttempts: 0
  };

  constructor(
    private retryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true
    },
    private circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 30000,
      monitoringPeriod: 60000
    }
  ) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
    this.retryQueue = new RetryQueue();
  }

  async handleNetworkOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    
    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.retryQueue.add(operation, config, context.action);
      });
    } catch (error) {
      this.handleError(error as Error, ErrorCategory.NETWORK, context);
      throw error;
    }
  }

  handleError(
    error: Error,
    category: ErrorCategory,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): string {
    const errorId = this.generateErrorId();
    
    const errorReport: ErrorReport = {
      id: errorId,
      category,
      severity,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        timestamp: Date.now()
      },
      resolved: false,
      retryCount: 0
    };

    this.errorReports.set(errorId, errorReport);
    this.metrics.totalErrors++;
    
    if (category === ErrorCategory.NETWORK) {
      this.metrics.networkErrors++;
    }

    // Log error based on severity
    this.logError(errorReport);
    
    // Show user-friendly notification
    this.showUserNotification(errorReport);
    
    // Report to monitoring service (if available)
    this.reportToMonitoring(errorReport);

    return errorId;
  }

  private logError(errorReport: ErrorReport): void {
    const logLevel = this.getLogLevel(errorReport.severity);
    const logMessage = `[${errorReport.category.toUpperCase()}] ${errorReport.message}`;
    
    console[logLevel](logMessage, {
      id: errorReport.id,
      context: errorReport.context,
      stack: errorReport.stack
    });
  }

  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'warn';
    }
  }

  private showUserNotification(errorReport: ErrorReport): void {
    const message = this.getUserFriendlyMessage(errorReport);
    
    switch (errorReport.severity) {
      case ErrorSeverity.LOW:
        toast.info(message);
        break;
      case ErrorSeverity.MEDIUM:
        toast.warning(message);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        toast.error(message, {
          duration: 10000,
          action: {
            label: 'Retry',
            onClick: () => this.retryOperation(errorReport.id)
          }
        });
        break;
    }
  }

  private getUserFriendlyMessage(errorReport: ErrorReport): string {
    switch (errorReport.category) {
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check your internet connection.';
      case ErrorCategory.BLOCKCHAIN:
        return 'Blockchain operation failed. Please try again.';
      case ErrorCategory.STORAGE:
        return 'Storage operation failed. Please try again.';
      case ErrorCategory.VALIDATION:
        return 'Invalid input detected. Please check your data.';
      case ErrorCategory.SECURITY:
        return 'Security validation failed. Please verify your credentials.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private async reportToMonitoring(errorReport: ErrorReport): Promise<void> {
    // Implementation for external monitoring service
    // This could be Sentry, LogRocket, or custom analytics
    try {
      // Example: await monitoringService.reportError(errorReport);
      console.log('Error reported to monitoring:', errorReport.id);
    } catch (monitoringError) {
      console.warn('Failed to report error to monitoring service:', monitoringError);
    }
  }

  async retryOperation(errorId: string): Promise<void> {
    const errorReport = this.errorReports.get(errorId);
    if (!errorReport) return;

    errorReport.retryCount++;
    this.metrics.retryAttempts++;
    
    // Implementation depends on storing the original operation
    // This is a placeholder for retry logic
    toast.info('Retrying operation...');
  }

  resolveError(errorId: string): void {
    const errorReport = this.errorReports.get(errorId);
    if (errorReport) {
      errorReport.resolved = true;
      this.metrics.resolvedErrors++;
    }
  }

  getErrorReport(errorId: string): ErrorReport | undefined {
    return this.errorReports.get(errorId);
  }

  getMetrics() {
    return {
      ...this.metrics,
      circuitBreaker: this.circuitBreaker.getMetrics(),
      retryQueue: this.retryQueue.getQueueStatus(),
      errorRate: this.metrics.totalErrors > 0 ? 
        (this.metrics.totalErrors - this.metrics.resolvedErrors) / this.metrics.totalErrors : 0
    };
  }

  getUnresolvedErrors(): ErrorReport[] {
    return Array.from(this.errorReports.values()).filter(error => !error.resolved);
  }

  clearResolvedErrors(): void {
    for (const [id, error] of this.errorReports.entries()) {
      if (error.resolved) {
        this.errorReports.delete(id);
      }
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global error handler instance
export const globalErrorHandler = new NetworkErrorHandler();

// Utility functions for common error scenarios
export const handleNetworkError = (error: Error, context: ErrorContext) => {
  return globalErrorHandler.handleError(error, ErrorCategory.NETWORK, context, ErrorSeverity.HIGH);
};

export const handleBlockchainError = (error: Error, context: ErrorContext) => {
  return globalErrorHandler.handleError(error, ErrorCategory.BLOCKCHAIN, context, ErrorSeverity.HIGH);
};

export const handleStorageError = (error: Error, context: ErrorContext) => {
  return globalErrorHandler.handleError(error, ErrorCategory.STORAGE, context, ErrorSeverity.MEDIUM);
};

export const handleValidationError = (error: Error, context: ErrorContext) => {
  return globalErrorHandler.handleError(error, ErrorCategory.VALIDATION, context, ErrorSeverity.LOW);
};

export const handleSecurityError = (error: Error, context: ErrorContext) => {
  return globalErrorHandler.handleError(error, ErrorCategory.SECURITY, context, ErrorSeverity.CRITICAL);
};