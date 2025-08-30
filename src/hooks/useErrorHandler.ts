import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  NetworkErrorHandler, 
  NetworkError, 
  NetworkErrorType, 
  ErrorSeverity,
  UserFeedbackOptions,
  networkErrorHandler,
  handleNetworkError,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  showInfoToast
} from '../lib/errors/NetworkErrorHandler';

export interface ErrorState {
  currentError?: NetworkError;
  isRecovering: boolean;
  errorHistory: NetworkError[];
  lastRecoveryAttempt?: Date;
  recoverySuccess: boolean;
}

export interface ErrorHandlerHookReturn {
  errorState: ErrorState;
  handleError: (error: any, context?: Record<string, any>, options?: Partial<UserFeedbackOptions>) => Promise<boolean>;
  clearCurrentError: () => void;
  clearErrorHistory: () => void;
  retryLastOperation: () => Promise<boolean>;
  getErrorStats: () => ReturnType<typeof networkErrorHandler.getErrorStats>;
  showToast: {
    error: (message: string, description?: string) => void;
    success: (message: string, description?: string) => void;
    warning: (message: string, description?: string) => void;
    info: (message: string, description?: string) => void;
  };
  isErrorType: (type: NetworkErrorType) => boolean;
  getRecentErrors: (count?: number) => NetworkError[];
  hasRecoverableError: () => boolean;
}

/**
 * Main error handler hook
 */
export const useErrorHandler = (): ErrorHandlerHookReturn => {
  const [errorState, setErrorState] = useState<ErrorState>({
    isRecovering: false,
    errorHistory: [],
    recoverySuccess: false,
  });

  const lastOperationRef = useRef<{
    operation: () => Promise<any>;
    context?: Record<string, any>;
    options?: Partial<UserFeedbackOptions>;
  } | null>(null);

  // Update error history when it changes
  useEffect(() => {
    const updateHistory = () => {
      const history = networkErrorHandler.getErrorHistory();
      setErrorState(prev => ({
        ...prev,
        errorHistory: history.slice(-20) // Keep last 20 errors
      }));
    };

    // Initial load
    updateHistory();

    // Set up periodic updates (in a real app, you might use events)
    const interval = setInterval(updateHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Handle error with recovery and user feedback
   */
  const handleError = useCallback(async (
    error: any,
    context?: Record<string, any>,
    options?: Partial<UserFeedbackOptions>
  ): Promise<boolean> => {
    setErrorState(prev => ({ ...prev, isRecovering: true }));

    try {
      const { recovered, networkError } = await handleNetworkError(error, context);
      
      setErrorState(prev => ({
        ...prev,
        currentError: networkError,
        isRecovering: false,
        lastRecoveryAttempt: new Date(),
        recoverySuccess: recovered,
      }));

      return recovered;
    } catch (handlingError) {
      console.error('Error handling failed:', handlingError);
      setErrorState(prev => ({
        ...prev,
        isRecovering: false,
        recoverySuccess: false,
      }));
      return false;
    }
  }, []);

  /**
   * Clear current error
   */
  const clearCurrentError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      currentError: undefined,
      recoverySuccess: false,
    }));
  }, []);

  /**
   * Clear error history
   */
  const clearErrorHistory = useCallback(() => {
    networkErrorHandler.clearHistory();
    setErrorState(prev => ({
      ...prev,
      errorHistory: [],
      currentError: undefined,
    }));
  }, []);

  /**
   * Retry last operation
   */
  const retryLastOperation = useCallback(async (): Promise<boolean> => {
    if (!lastOperationRef.current) {
      showWarningToast('No operation to retry');
      return false;
    }

    const { operation, context, options } = lastOperationRef.current;
    
    try {
      setErrorState(prev => ({ ...prev, isRecovering: true }));
      await operation();
      setErrorState(prev => ({ ...prev, isRecovering: false, recoverySuccess: true }));
      showSuccessToast('Operation completed successfully');
      return true;
    } catch (error) {
      const recovered = await handleError(error, context, options);
      return recovered;
    }
  }, [handleError]);

  /**
   * Get error statistics
   */
  const getErrorStats = useCallback(() => {
    return networkErrorHandler.getErrorStats();
  }, []);

  /**
   * Toast utilities
   */
  const showToast = {
    error: (message: string, description?: string) => {
      showErrorToast({ 
        userMessage: message, 
        suggestedActions: description ? [description] : [] 
      } as NetworkError);
    },
    success: (message: string, description?: string) => {
      showSuccessToast(message);
    },
    warning: (message: string, description?: string) => {
      showWarningToast(message, description);
    },
    info: (message: string, description?: string) => {
      showInfoToast(message, description);
    },
  };

  /**
   * Check if current error is of specific type
   */
  const isErrorType = useCallback((type: NetworkErrorType): boolean => {
    return errorState.currentError?.type === type;
  }, [errorState.currentError]);

  /**
   * Get recent errors
   */
  const getRecentErrors = useCallback((count: number = 5): NetworkError[] => {
    return errorState.errorHistory.slice(-count);
  }, [errorState.errorHistory]);

  /**
   * Check if there's a recoverable error
   */
  const hasRecoverableError = useCallback((): boolean => {
    return errorState.currentError?.recoverable === true;
  }, [errorState.currentError]);

  return {
    errorState,
    handleError,
    clearCurrentError,
    clearErrorHistory,
    retryLastOperation,
    getErrorStats,
    showToast,
    isErrorType,
    getRecentErrors,
    hasRecoverableError,
  };
};

/**
 * Hook for handling async operations with automatic error handling
 */
export const useAsyncOperation = <T = any>() => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<NetworkError | null>(null);
  const { handleError } = useErrorHandler();

  const execute = useCallback(async (
    operation: () => Promise<T>,
    context?: Record<string, any>,
    options?: Partial<UserFeedbackOptions>
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      const recovered = await handleError(err, context, options);
      if (!recovered) {
        const networkError = networkErrorHandler.parseError(err, context);
        setError(networkError);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    data,
    error,
    execute,
    reset,
  };
};

/**
 * Hook for network-specific error handling
 */
export const useNetworkErrorHandler = (networkId?: number) => {
  const { handleError, errorState, showToast } = useErrorHandler();
  const [networkErrors, setNetworkErrors] = useState<NetworkError[]>([]);

  // Filter errors for specific network
  useEffect(() => {
    if (networkId) {
      const filtered = errorState.errorHistory.filter(
        error => error.networkId === networkId
      );
      setNetworkErrors(filtered);
    } else {
      setNetworkErrors(errorState.errorHistory);
    }
  }, [errorState.errorHistory, networkId]);

  const handleNetworkError = useCallback(async (
    error: any,
    context?: Record<string, any>
  ): Promise<boolean> => {
    const networkContext = {
      ...context,
      networkId,
      timestamp: new Date().toISOString(),
    };

    return handleError(error, networkContext, {
      showToast: true,
      toastType: 'error',
      logToConsole: true,
    });
  }, [handleError, networkId]);

  const getNetworkErrorStats = useCallback(() => {
    const total = networkErrors.length;
    const byType = {} as Record<NetworkErrorType, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    let recovered = 0;

    networkErrors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      if (error.recoverable) recovered++;
    });

    return {
      total,
      byType,
      bySeverity,
      recoveryRate: total > 0 ? recovered / total : 0,
    };
  }, [networkErrors]);

  return {
    networkErrors,
    handleNetworkError,
    getNetworkErrorStats,
    showToast,
    isRecovering: errorState.isRecovering,
  };
};

/**
 * Hook for transaction error handling
 */
export const useTransactionErrorHandler = () => {
  const { handleError, showToast } = useErrorHandler();
  const [transactionErrors, setTransactionErrors] = useState<Map<string, NetworkError>>(new Map());

  const handleTransactionError = useCallback(async (
    error: any,
    transactionHash?: string,
    context?: Record<string, any>
  ): Promise<boolean> => {
    const txContext = {
      ...context,
      transactionHash,
      operationType: 'transaction',
      timestamp: new Date().toISOString(),
    };

    const recovered = await handleError(error, txContext, {
      showToast: true,
      toastType: 'error',
      logToConsole: true,
    });

    // Store transaction-specific error
    if (transactionHash && !recovered) {
      const networkError = networkErrorHandler.parseError(error, txContext);
      setTransactionErrors(prev => new Map(prev.set(transactionHash, networkError)));
    }

    return recovered;
  }, [handleError]);

  const clearTransactionError = useCallback((transactionHash: string) => {
    setTransactionErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(transactionHash);
      return newMap;
    });
  }, []);

  const getTransactionError = useCallback((transactionHash: string): NetworkError | undefined => {
    return transactionErrors.get(transactionHash);
  }, [transactionErrors]);

  const hasTransactionError = useCallback((transactionHash: string): boolean => {
    return transactionErrors.has(transactionHash);
  }, [transactionErrors]);

  return {
    handleTransactionError,
    clearTransactionError,
    getTransactionError,
    hasTransactionError,
    transactionErrors: Array.from(transactionErrors.entries()),
    showToast,
  };
};

/**
 * Hook for contract interaction error handling
 */
export const useContractErrorHandler = (contractAddress?: string) => {
  const { handleError, showToast } = useErrorHandler();
  const [contractErrors, setContractErrors] = useState<NetworkError[]>([]);

  const handleContractError = useCallback(async (
    error: any,
    methodName?: string,
    context?: Record<string, any>
  ): Promise<boolean> => {
    const contractContext = {
      ...context,
      contractAddress,
      methodName,
      operationType: 'contract-interaction',
      timestamp: new Date().toISOString(),
    };

    const recovered = await handleError(error, contractContext, {
      showToast: true,
      toastType: 'error',
      logToConsole: true,
    });

    // Store contract-specific error
    if (!recovered) {
      const networkError = networkErrorHandler.parseError(error, contractContext);
      setContractErrors(prev => [...prev, networkError].slice(-10)); // Keep last 10
    }

    return recovered;
  }, [handleError, contractAddress]);

  const clearContractErrors = useCallback(() => {
    setContractErrors([]);
  }, []);

  return {
    contractErrors,
    handleContractError,
    clearContractErrors,
    showToast,
  };
};

export default useErrorHandler;