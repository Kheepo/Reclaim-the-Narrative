import { ethers } from 'ethers';
import { SupportedNetwork, getNetworkById, SUPPORTED_NETWORKS } from '../../config/networks';

export interface ProviderConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  maxConcurrentRequests: number;
}

export interface NetworkHealth {
  chainId: number;
  isHealthy: boolean;
  latency: number;
  blockNumber: number;
  lastChecked: number;
  errorCount: number;
}

export interface ProviderPool {
  primary: ethers.JsonRpcProvider;
  fallbacks: ethers.JsonRpcProvider[];
  health: NetworkHealth;
}

class NetworkProviderManager {
  private providers: Map<number, ProviderPool> = new Map();
  private config: ProviderConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private requestCounts: Map<number, number> = new Map();

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      maxConcurrentRequests: 10,
      ...config,
    };

    this.initializeProviders();
    this.startHealthChecking();
  }

  private initializeProviders(): void {
    Object.values(SUPPORTED_NETWORKS).forEach(network => {
      if (network.enabled) {
        this.createProviderPool(network);
      }
    });
  }

  private createProviderPool(network: SupportedNetwork): void {
    const primaryProvider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.id,
      name: network.name,
    });

    // Configure provider timeouts
    primaryProvider.pollingInterval = network.type === 'blockdag' ? 1000 : 4000;

    const fallbackProviders: ethers.JsonRpcProvider[] = [];
    
    // Add fallback providers for critical networks
    if (network.id === 1043) { // BlockDAG Testnet
      // Add additional RPC endpoints when available
    }

    const health: NetworkHealth = {
      chainId: network.id,
      isHealthy: true,
      latency: 0,
      blockNumber: 0,
      lastChecked: Date.now(),
      errorCount: 0,
    };

    this.providers.set(network.id, {
      primary: primaryProvider,
      fallbacks: fallbackProviders,
      health,
    });

    this.requestCounts.set(network.id, 0);
  }

  public getProvider(chainId: number): ethers.JsonRpcProvider | null {
    const pool = this.providers.get(chainId);
    if (!pool) {
      console.warn(`No provider available for chain ID: ${chainId}`);
      return null;
    }

    // Check if we're exceeding concurrent request limits
    const currentRequests = this.requestCounts.get(chainId) || 0;
    if (currentRequests >= this.config.maxConcurrentRequests) {
      console.warn(`Max concurrent requests reached for chain ${chainId}`);
      return null;
    }

    // Return healthy primary provider or fallback
    if (pool.health.isHealthy) {
      return pool.primary;
    }

    // Try fallback providers
    for (const fallback of pool.fallbacks) {
      try {
        return fallback;
      } catch (error) {
        console.warn(`Fallback provider failed for chain ${chainId}:`, error);
      }
    }

    console.error(`All providers failed for chain ${chainId}`);
    return null;
  }

  public async executeWithRetry<T>(
    chainId: number,
    operation: (provider: ethers.JsonRpcProvider) => Promise<T>
  ): Promise<T> {
    const provider = this.getProvider(chainId);
    if (!provider) {
      throw new Error(`No provider available for chain ${chainId}`);
    }

    this.incrementRequestCount(chainId);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          operation(provider),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
          )
        ]);
        
        this.decrementRequestCount(chainId);
        this.updateHealth(chainId, true);
        return result;
      } catch (error: any) {
        lastError = error as Error;
        
        // Enhanced error categorization
        const isNetworkError = error?.message?.includes('Failed to fetch') ||
                              error?.message?.includes('fetch') ||
                              error?.code === 'NETWORK_ERROR' ||
                              error?.code === 'ENOTFOUND' ||
                              error?.code === 'ECONNREFUSED';
        
        const isTimeoutError = error?.message?.includes('timeout') ||
                              error?.code === 'TIMEOUT';
        
        this.updateHealth(chainId, false, error as Error);
        
        // Log detailed error information
        console.warn(`Attempt ${attempt + 1}/${this.config.maxRetries + 1} failed for chain ${chainId}:`, {
          message: error?.message,
          code: error?.code,
          isNetworkError,
          isTimeoutError
        });
        
        if (attempt < this.config.maxRetries) {
          // Use exponential backoff with jitter for network errors
          const baseDelay = this.config.retryDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 1000; // Add up to 1 second jitter
          const delay = isNetworkError ? baseDelay + jitter : baseDelay;
          
          await this.delay(delay);
        }
      }
    }

    this.decrementRequestCount(chainId);
    throw lastError || new Error('Operation failed after retries');
  }

  private incrementRequestCount(chainId: number): void {
    const current = this.requestCounts.get(chainId) || 0;
    this.requestCounts.set(chainId, current + 1);
  }

  private decrementRequestCount(chainId: number): void {
    const current = this.requestCounts.get(chainId) || 0;
    this.requestCounts.set(chainId, Math.max(0, current - 1));
  }

  private updateHealth(chainId: number, success: boolean, error?: Error): void {
    const pool = this.providers.get(chainId);
    if (!pool) return;

    const health = pool.health;
    health.lastChecked = Date.now();

    if (success) {
      health.errorCount = Math.max(0, health.errorCount - 1);
      health.isHealthy = health.errorCount < 3;
    } else {
      health.errorCount += 1;
      health.isHealthy = health.errorCount < 5;
      
      if (error) {
        console.warn(`Provider error for chain ${chainId}:`, error.message);
      }
    }
  }

  private async startHealthChecking(): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.providers.entries()).map(
      async ([chainId, pool]) => {
        try {
          const startTime = Date.now();
          
          // Use a shorter timeout for health checks
          const blockNumber = await Promise.race([
            pool.primary.getBlockNumber(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Health check timeout')), 10000)
            )
          ]);
          
          const latency = Date.now() - startTime;

          pool.health.latency = latency;
          pool.health.blockNumber = blockNumber;
          pool.health.lastChecked = Date.now();
          
          // Consider healthy if latency is reasonable
          if (latency < 5000) {
            pool.health.isHealthy = true;
            pool.health.errorCount = Math.max(0, pool.health.errorCount - 1);
          }
        } catch (error: any) {
          pool.health.errorCount += 1;
          pool.health.isHealthy = pool.health.errorCount < 5;
          pool.health.lastChecked = Date.now();
          
          // Only log non-network errors to reduce noise
          if (!error?.message?.includes('Failed to fetch') && 
              !error?.message?.includes('timeout')) {
            console.warn(`Health check failed for chain ${chainId}:`, error?.message);
          }
        }
      }
    );

    await Promise.allSettled(healthPromises);
  }

  public getNetworkHealth(chainId: number): NetworkHealth | null {
    const pool = this.providers.get(chainId);
    return pool ? { ...pool.health } : null;
  }

  public getAllNetworkHealth(): NetworkHealth[] {
    return Array.from(this.providers.values()).map(pool => ({ ...pool.health }));
  }

  public async validateNetworkConnectivity(chainId: number): Promise<{ isValid: boolean; error?: string }> {
    const network = getNetworkById(chainId);
    if (!network || !network.enabled) {
      return { isValid: false, error: `Network ${chainId} is not supported or enabled` };
    }

    const provider = this.getProvider(chainId);
    if (!provider) {
      return { isValid: false, error: `No provider available for network ${chainId}` };
    }

    try {
      // Quick connectivity check with shorter timeout
      await Promise.race([
        provider.getNetwork(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network connectivity check timeout')), 3000)
        )
      ]);
      
      return { isValid: true };
    } catch (error: any) {
      const errorMessage = error?.message?.includes('Failed to fetch') 
        ? 'RPC endpoint unreachable'
        : error?.message?.includes('timeout')
        ? 'Network connection timeout'
        : error?.message || 'Unknown network error';
      
      return { isValid: false, error: errorMessage };
    }
  }

  public async switchNetwork(chainId: number): Promise<boolean> {
    const network = getNetworkById(chainId);
    if (!network || !network.enabled) {
      console.error(`Network ${chainId} is not supported or enabled`);
      return false;
    }

    const provider = this.getProvider(chainId);
    if (!provider) {
      console.error(`No provider available for network ${chainId}`);
      return false;
    }

    try {
      // Use executeWithRetry for robust network connectivity check
      await this.executeWithRetry(chainId, async (p) => {
        const network = await Promise.race([
          p.getNetwork(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network connectivity check timeout')), 5000)
          )
        ]);
        return network;
      });
      
      console.log(`Successfully verified connectivity to network ${chainId}`);
      return true;
    } catch (error: any) {
      // Enhanced error handling with specific error types
      let errorMessage = 'Unknown network error';
      
      if (error?.message?.includes('timeout')) {
        errorMessage = 'Network connection timeout';
      } else if (error?.message?.includes('Failed to fetch')) {
        errorMessage = 'RPC endpoint unreachable';
      } else if (error?.code === 'NETWORK_ERROR') {
        errorMessage = 'Network connectivity issue';
      } else if (error?.code === 'TIMEOUT') {
        errorMessage = 'Request timeout';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      console.warn(`Network switch validation failed for ${chainId}: ${errorMessage}`);
      
      // For network connectivity issues, we'll allow the switch to proceed
      // as the user's wallet might still be able to connect
      if (error?.message?.includes('Failed to fetch') || 
          error?.message?.includes('timeout') ||
          error?.code === 'NETWORK_ERROR') {
        console.log(`Allowing network switch despite connectivity check failure for ${chainId}`);
        return true;
      }
      
      return false;
    }
  }

  public isBlockDAGNetwork(chainId: number): boolean {
    const network = getNetworkById(chainId);
    return network?.type === 'blockdag' || false;
  }

  public getNetworkPerformanceMetrics(chainId: number) {
    const network = getNetworkById(chainId);
    const health = this.getNetworkHealth(chainId);
    
    if (!network || !health) return null;

    return {
      network: network.displayName,
      type: network.type,
      avgBlockTime: network.performance.avgBlockTime,
      tps: network.performance.tps,
      finality: network.performance.finality,
      currentLatency: health.latency,
      isHealthy: health.isHealthy,
      blockNumber: health.blockNumber,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clean up providers
    this.providers.forEach(pool => {
      pool.primary.destroy();
      pool.fallbacks.forEach(provider => provider.destroy());
    });

    this.providers.clear();
    this.requestCounts.clear();
  }
}

// Singleton instance
let providerManager: NetworkProviderManager | null = null;

export function getProviderManager(): NetworkProviderManager {
  if (!providerManager) {
    providerManager = new NetworkProviderManager();
  }
  return providerManager;
}

export function createProviderManager(config?: Partial<ProviderConfig>): NetworkProviderManager {
  if (providerManager) {
    providerManager.destroy();
  }
  providerManager = new NetworkProviderManager(config);
  return providerManager;
}

export { NetworkProviderManager };