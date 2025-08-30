import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  globalErrorHandler, 
  CircuitBreaker, 
  RetryQueue,
  ErrorSeverity,
  ErrorCategory 
} from '../error-handler';
import { testHelpers } from '@/test/test-utils';

describe('Enhanced Error Handler', () => {
  beforeEach(() => {
    // Reset error handler state
    globalErrorHandler.clearReports();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringPeriod: 5000
      });
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should open circuit after failure threshold', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test error'));

      // Execute failing operation multiple times
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should reject immediately when circuit is open', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Should reject immediately without calling the operation
      const callCountBefore = failingOperation.mock.calls.length;
      
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        expect(error).toEqual(expect.objectContaining({
          message: expect.stringContaining('Circuit breaker is OPEN')
        }));
      }

      expect(failingOperation.mock.calls.length).toBe(callCountBefore);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for reset timeout
      await testHelpers.waitForCondition(() => {
        return circuitBreaker.getState() === 'HALF_OPEN';
      }, 2000);

      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });

    it('should close circuit on successful operation in HALF_OPEN state', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValueOnce('Success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for HALF_OPEN state
      await testHelpers.waitForCondition(() => {
        return circuitBreaker.getState() === 'HALF_OPEN';
      }, 2000);

      // Execute successful operation
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('Success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('RetryQueue', () => {
    let retryQueue: RetryQueue;

    beforeEach(() => {
      retryQueue = new RetryQueue();
    });

    it('should add operations to queue', () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      retryQueue.add(operation, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000
      });

      expect(retryQueue.size()).toBe(1);
    });

    it('should process operations with exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success');

      retryQueue.add(operation, {
        maxRetries: 3,
        baseDelay: 10, // Short delay for testing
        maxDelay: 100
      });

      await retryQueue.processQueue();

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect max retries limit', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      retryQueue.add(operation, {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 100
      });

      await retryQueue.processQueue();

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Global Error Handler', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';

      const result = await globalErrorHandler.handleError(networkError, {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        operation: 'test-network-operation',
        metadata: { url: 'https://test.api.com' }
      });

      expect(result.handled).toBe(true);
      expect(result.shouldRetry).toBe(true);
      expect(result.userMessage).toContain('network');
    });

    it('should handle blockchain errors', async () => {
      const blockchainError = new Error('Transaction failed');
      blockchainError.name = 'TransactionError';

      const result = await globalErrorHandler.handleError(blockchainError, {
        category: ErrorCategory.BLOCKCHAIN,
        severity: ErrorSeverity.CRITICAL,
        operation: 'submit-transaction',
        metadata: { transactionHash: '0x123' }
      });

      expect(result.handled).toBe(true);
      expect(result.shouldRetry).toBe(false); // Blockchain errors typically shouldn't retry
      expect(result.userMessage).toContain('blockchain');
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid input format');
      validationError.name = 'ValidationError';

      const result = await globalErrorHandler.handleError(validationError, {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        operation: 'validate-form',
        metadata: { field: 'email' }
      });

      expect(result.handled).toBe(true);
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('validation');
    });

    it('should handle security errors', async () => {
      const securityError = new Error('Unauthorized access');
      securityError.name = 'SecurityError';

      const result = await globalErrorHandler.handleError(securityError, {
        category: ErrorCategory.SECURITY,
        severity: ErrorSeverity.CRITICAL,
        operation: 'access-protected-resource',
        metadata: { userId: 'test-user' }
      });

      expect(result.handled).toBe(true);
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('security');
    });

    it('should generate error reports', async () => {
      const error = new Error('Test error');
      
      await globalErrorHandler.handleError(error, {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        operation: 'test-operation'
      });

      const reports = globalErrorHandler.getReports();
      expect(reports).toHaveLength(1);
      expect(reports[0]).toEqual(expect.objectContaining({
        id: expect.any(String),
        timestamp: expect.any(Number),
        error: expect.objectContaining({
          message: 'Test error',
          name: 'Error'
        }),
        context: expect.objectContaining({
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.HIGH,
          operation: 'test-operation'
        })
      }));
    });

    it('should clear error reports', async () => {
      const error = new Error('Test error');
      
      await globalErrorHandler.handleError(error, {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.LOW,
        operation: 'test-operation'
      });

      expect(globalErrorHandler.getReports()).toHaveLength(1);
      
      globalErrorHandler.clearReports();
      expect(globalErrorHandler.getReports()).toHaveLength(0);
    });

    it('should respect circuit breaker for network operations', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';

      // Trigger multiple network errors to open circuit breaker
      for (let i = 0; i < 5; i++) {
        await globalErrorHandler.handleError(networkError, {
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.HIGH,
          operation: 'test-network-operation'
        });
      }

      // Next network operation should be rejected by circuit breaker
      const result = await globalErrorHandler.handleError(networkError, {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        operation: 'test-network-operation'
      });

      expect(result.handled).toBe(true);
      expect(result.userMessage).toContain('temporarily unavailable');
    });
  });
});