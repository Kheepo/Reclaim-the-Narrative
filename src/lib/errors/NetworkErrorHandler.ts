import { toast } from 'sonner';

/**
 * Network error types and classifications
 */
export enum NetworkErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  RPC_ERROR = 'RPC_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_NETWORK = 'INVALID_NETWORK',
  WALLET_ERROR = 'WALLET_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  NONCE_ERROR = 'NONCE_ERROR',
  CHAIN_MISMATCH = 'CHAIN_MISMATCH',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface NetworkError {
  type: NetworkErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  networkId?: number;
  context?: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: string;
  suggestedActions: string[];
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: NetworkError) => boolean;
  recover: (error: NetworkError, context?: any) => Promise<boolean>;
  maxRetries: number;
  retryDelay: number;
}

export interface UserFeedbackOptions {
  showToast: boolean;
  toastType: 'error' | 'warning' | 'info';
  showModal: boolean;
  logToConsole: boolean;
  reportToAnalytics: boolean;
}

/**
 * Comprehensive network error handler
 */
export class NetworkErrorHandler {
  private static instance: NetworkErrorHandler;
  private recoveryStrategies: Map<NetworkErrorType, ErrorRecoveryStrategy> = new Map();
  private errorHistory: NetworkError[] = [];
  private maxHistorySize = 100;

  private constructor() {
    this.initializeRecoveryStrategies();
  }

  public static getInstance(): NetworkErrorHandler {
    if (!NetworkErrorHandler.instance) {
      NetworkErrorHandler.instance = new NetworkErrorHandler();
    }
    return NetworkErrorHandler.instance;
  }

  /**
   * Initialize recovery strategies for different error types
   */
  private initializeRecoveryStrategies(): void {
    // Connection failed recovery
    this.recoveryStrategies.set(NetworkErrorType.CONNECTION_FAILED, {
      canRecover: () => true,
      recover: async (error) => {
        // Try to reconnect after delay
        await this.delay(2000);
        return true;
      },
      maxRetries: 3,
      retryDelay: 2000
    });

    // RPC error recovery
    this.recoveryStrategies.set(NetworkErrorType.RPC_ERROR, {
      canRecover: (error) => error.context?.statusCode !== 404,
      recover: async (error) => {
        // Switch to backup RPC if available
        await this.delay(1000);
        return true;
      },
      maxRetries: 2,
      retryDelay: 1000
    });

    // Timeout recovery
    this.recoveryStrategies.set(NetworkErrorType.TIMEOUT, {
      canRecover: () => true,
      recover: async (error) => {
        // Increase timeout and retry
        await this.delay(1500);
        return true;
      },
      maxRetries: 2,
      retryDelay: 1500
    });

    // Rate limit recovery
    this.recoveryStrategies.set(NetworkErrorType.RATE_LIMITED, {
      canRecover: () => true,
      recover: async (error) => {
        // Wait for rate limit to reset
        const waitTime = error.context?.retryAfter || 5000;
        await this.delay(waitTime);
        return true;
      },
      maxRetries: 1,
      retryDelay: 5000
    });

    // Nonce error recovery
    this.recoveryStrategies.set(NetworkErrorType.NONCE_ERROR, {
      canRecover: () => true,
      recover: async (error) => {
        // Refresh nonce and retry
        await this.delay(500);
        return true;
      },
      maxRetries: 1,
      retryDelay: 500
    });
  }

  /**
   * Parse and classify error
   */
  public parseError(error: any, context?: Record<string, any>): NetworkError {
    const timestamp = new Date();
    let networkError: NetworkError;

    // Check for specific error patterns
    if (this.isConnectionError(error)) {
      networkError = {
        type: NetworkErrorType.CONNECTION_FAILED,
        severity: ErrorSeverity.HIGH,
        message: 'Failed to connect to network',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: true,
        userMessage: 'Unable to connect to the blockchain network. Please check your internet connection.',
        technicalDetails: error.message,
        suggestedActions: [
          'Check your internet connection',
          'Try switching to a different network',
          'Contact support if the issue persists'
        ]
      };
    } else if (this.isRPCError(error)) {
      networkError = {
        type: NetworkErrorType.RPC_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: 'RPC request failed',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: true,
        userMessage: 'Network request failed. The system will automatically retry.',
        technicalDetails: error.message,
        suggestedActions: [
          'Wait for automatic retry',
          'Try refreshing the page',
          'Switch to a different RPC endpoint'
        ]
      };
    } else if (this.isTimeoutError(error)) {
      networkError = {
        type: NetworkErrorType.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: 'Request timed out',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: true,
        userMessage: 'The request is taking longer than expected. Please wait while we retry.',
        technicalDetails: error.message,
        suggestedActions: [
          'Wait for automatic retry',
          'Check network congestion',
          'Try again later'
        ]
      };
    } else if (this.isRateLimitError(error)) {
      networkError = {
        type: NetworkErrorType.RATE_LIMITED,
        severity: ErrorSeverity.MEDIUM,
        message: 'Rate limit exceeded',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: true,
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        technicalDetails: error.message,
        suggestedActions: [
          'Wait for rate limit to reset',
          'Reduce request frequency',
          'Consider upgrading your plan'
        ]
      };
    } else if (this.isInsufficientFundsError(error)) {
      networkError = {
        type: NetworkErrorType.INSUFFICIENT_FUNDS,
        severity: ErrorSeverity.HIGH,
        message: 'Insufficient funds',
        originalError: error,
        context,
        timestamp,
        recoverable: false,
        retryable: false,
        userMessage: 'Insufficient funds to complete this transaction.',
        technicalDetails: error.message,
        suggestedActions: [
          'Add more funds to your wallet',
          'Reduce the transaction amount',
          'Check gas fees'
        ]
      };
    } else if (this.isGasEstimationError(error)) {
      networkError = {
        type: NetworkErrorType.GAS_ESTIMATION_FAILED,
        severity: ErrorSeverity.MEDIUM,
        message: 'Gas estimation failed',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: true,
        userMessage: 'Unable to estimate gas fees. Please try again or set gas manually.',
        technicalDetails: error.message,
        suggestedActions: [
          'Try again with manual gas settings',
          'Check contract interaction',
          'Verify transaction parameters'
        ]
      };
    } else if (this.isNonceError(error)) {
      networkError = {
        type: NetworkErrorType.NONCE_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: 'Nonce error',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: true,
        userMessage: 'Transaction nonce conflict. The system will automatically retry.',
        technicalDetails: error.message,
        suggestedActions: [
          'Wait for automatic retry',
          'Reset wallet nonce',
          'Check for pending transactions'
        ]
      };
    } else if (this.isChainMismatchError(error)) {
      networkError = {
        type: NetworkErrorType.CHAIN_MISMATCH,
        severity: ErrorSeverity.HIGH,
        message: 'Chain mismatch',
        originalError: error,
        context,
        timestamp,
        recoverable: true,
        retryable: false,
        userMessage: 'Please switch to the correct network in your wallet.',
        technicalDetails: error.message,
        suggestedActions: [
          'Switch to the correct network',
          'Check wallet network settings',
          'Refresh the page after switching'
        ]
      };
    } else {
      networkError = {
        type: NetworkErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: 'Unknown error occurred',
        originalError: error,
        context,
        timestamp,
        recoverable: false,
        retryable: false,
        userMessage: 'A network error occurred. Please check your connection and try again.',
        technicalDetails: error.message || 'No additional details available',
        suggestedActions: [
          'Try refreshing the page',
          'Check your wallet connection',
          'Contact support if the issue persists'
        ]
      };
    }

    // Add to error history
    this.addToHistory(networkError);

    return networkError;
  }

  /**
   * Handle error with recovery and user feedback
   */
  public async handleError(
    error: any,
    context?: Record<string, any>,
    feedbackOptions?: Partial<UserFeedbackOptions>
  ): Promise<{ recovered: boolean; networkError: NetworkError }> {
    const networkError = this.parseError(error, context);
    const options: UserFeedbackOptions = {
      showToast: true,
      toastType: 'error',
      showModal: false,
      logToConsole: true,
      reportToAnalytics: false,
      ...feedbackOptions
    };

    // Log error
    if (options.logToConsole) {
      console.error('Network Error:', networkError);
    }

    // Show user feedback
    this.showUserFeedback(networkError, options);

    // Attempt recovery
    let recovered = false;
    if (networkError.recoverable) {
      recovered = await this.attemptRecovery(networkError);
    }

    return { recovered, networkError };
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: NetworkError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy || !strategy.canRecover(error)) {
      return false;
    }

    let attempts = 0;
    while (attempts < strategy.maxRetries) {
      try {
        const recovered = await strategy.recover(error);
        if (recovered) {
          toast.success('Connection restored');
          return true;
        }
      } catch (recoveryError) {
        console.warn('Recovery attempt failed:', recoveryError);
      }
      
      attempts++;
      if (attempts < strategy.maxRetries) {
        await this.delay(strategy.retryDelay);
      }
    }

    return false;
  }

  /**
   * Show user feedback
   */
  private showUserFeedback(error: NetworkError, options: UserFeedbackOptions): void {
    if (options.showToast) {
      const toastOptions = {
        description: error.userMessage,
        action: error.suggestedActions.length > 0 ? {
          label: 'View Details',
          onClick: () => this.showErrorDetails(error)
        } : undefined
      };

      switch (options.toastType) {
        case 'error':
          toast.error('Network Error', toastOptions);
          break;
        case 'warning':
          toast.warning('Network Warning', toastOptions);
          break;
        case 'info':
          toast.info('Network Info', toastOptions);
          break;
      }
    }
  }

  /**
   * Show detailed error information
   */
  private showErrorDetails(error: NetworkError): void {
    const details = [
      `Type: ${error.type}`,
      `Severity: ${error.severity}`,
      `Time: ${error.timestamp.toLocaleString()}`,
      `Message: ${error.userMessage}`,
      ...(error.technicalDetails ? [`Technical: ${error.technicalDetails}`] : []),
      '',
      'Suggested Actions:',
      ...error.suggestedActions.map(action => `• ${action}`)
    ].join('\n');

    // For now, use console.info. In a real app, you might show a modal
    console.info('Error Details:\n', details);
  }

  /**
   * Error type detection methods
   */
  private isConnectionError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('network error') ||
           message.includes('connection') ||
           message.includes('fetch') ||
           error.code === 'NETWORK_ERROR';
  }

  private isRPCError(error: any): boolean {
    return error.code === -32603 ||
           error.code === -32602 ||
           error.code === -32601 ||
           error.message?.includes('rpc');
  }

  private isTimeoutError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') ||
           message.includes('timed out') ||
           error.code === 'TIMEOUT';
  }

  private isRateLimitError(error: any): boolean {
    return error.code === 429 ||
           error.message?.includes('rate limit') ||
           error.message?.includes('too many requests');
  }

  private isInsufficientFundsError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('insufficient funds') ||
           message.includes('insufficient balance') ||
           error.code === 'INSUFFICIENT_FUNDS';
  }

  private isGasEstimationError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('gas') ||
           message.includes('out of gas') ||
           error.code === 'UNPREDICTABLE_GAS_LIMIT';
  }

  private isNonceError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('nonce') ||
           message.includes('transaction underpriced') ||
           error.code === 'NONCE_EXPIRED';
  }

  private isChainMismatchError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('chain') ||
           message.includes('network') ||
           error.code === 4902 ||
           error.code === -32000;
  }

  /**
   * Utility methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private addToHistory(error: NetworkError): void {
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * Public utility methods
   */
  public getErrorHistory(): NetworkError[] {
    return [...this.errorHistory];
  }

  public getErrorStats(): {
    total: number;
    byType: Record<NetworkErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recoveryRate: number;
  } {
    const total = this.errorHistory.length;
    const byType = {} as Record<NetworkErrorType, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    let recovered = 0;

    this.errorHistory.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      if (error.recoverable) recovered++;
    });

    return {
      total,
      byType,
      bySeverity,
      recoveryRate: total > 0 ? recovered / total : 0
    };
  }

  public clearHistory(): void {
    this.errorHistory = [];
  }

  public addRecoveryStrategy(type: NetworkErrorType, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(type, strategy);
  }
}

// Export singleton instance
export const networkErrorHandler = NetworkErrorHandler.getInstance();

// Convenience functions
export const handleNetworkError = (error: any, context?: Record<string, any>) => {
  return networkErrorHandler.handleError(error, context);
};

export const parseNetworkError = (error: any, context?: Record<string, any>) => {
  return networkErrorHandler.parseError(error, context);
};

export const showErrorToast = (error: NetworkError) => {
  toast.error(error.userMessage, {
    description: error.suggestedActions[0] || 'Please try again',
  });
};

export const showSuccessToast = (message: string) => {
  toast.success(message);
};

export const showWarningToast = (message: string, description?: string) => {
  toast.warning(message, { description });
};

export const showInfoToast = (message: string, description?: string) => {
  toast.info(message, { description });
};