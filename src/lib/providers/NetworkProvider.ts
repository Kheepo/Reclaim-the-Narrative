import { ethers } from 'ethers';
import { SupportedNetwork, getNetworkById, SUPPORTED_NETWORKS } from '../../config/networks';

export interface ProviderConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  maxConcurrentRequests: number;
  healthCheckInterval: number;
  blockdagConfig?: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    healthCheckInterval: number;
    maxConcurrentRequests: number;
  };
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
      healthCheckInterval: 30000,
      blockdagConfig: {
        timeout: 30000, // Increased for DAG consensus
        retryAttempts: 5,
        retryDelay: 2000,
        healthCheckInterval: 60000,
        maxConcurrentRequests: 20 // Higher for parallel processing
      },
      ...config,
    };

    // Delay provider initialization to avoid startup errors
    // Providers will be created on-demand when first requested
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
    const isBlockDAG = network.type === 'blockdag';
    const config = isBlockDAG ? this.config.blockdagConfig : this.config;
    
    // Use environment variables for RPC URLs with fallbacks
    let rpcUrl = network.rpcUrl;
    if (isBlockDAG) {
      if (network.id === 1043) { // BlockDAG Testnet
        rpcUrl = process.env.NEXT_PUBLIC_BLOCKDAG_TESTNET_RPC_URL || process.env.BLOCKDAG_TESTNET_RPC_URL || network.rpcUrl;
      } else if (network.id === 1044) { // BlockDAG Mainnet
        rpcUrl = process.env.NEXT_PUBLIC_BLOCKDAG_MAINNET_RPC_URL || process.env.BLOCKDAG_MAINNET_RPC_URL || network.rpcUrl;
      }
    }

    const primaryProvider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: network.id,
      name: network.name,
    });

    // Configure provider timeouts and polling intervals
    primaryProvider.pollingInterval = isBlockDAG ? 1000 : 4000; // Faster polling for BlockDAG
    
    const fallbackProviders: ethers.JsonRpcProvider[] = [];
    
    // Add fallback providers for BlockDAG networks
    if (isBlockDAG && network.id === 1043) {
      // Add fallback RPC endpoints when available
      const fallbackUrls = [
        'https://rpc.primordial.bdagscan.com',
        // Add more fallback URLs as they become available
      ].filter(url => url !== rpcUrl);
      
      fallbackUrls.forEach(url => {
        const fallbackProvider = new ethers.JsonRpcProvider(url, {
          chainId: network.id,
          name: `${network.name}-fallback`,
        });
        fallbackProvider.pollingInterval = 1000;
        fallbackProviders.push(fallbackProvider);
      });
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
    let pool = this.providers.get(chainId);
    if (!pool) {
      // Lazy initialization: create provider pool on first request
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId && n.enabled);
      if (network) {
        this.createProviderPool(network);
        pool = this.providers.get(chainId);
      }
      
      if (!pool) {
        console.warn(`No provider available for chain ID: ${chainId}`);
        return null;
      }
    }

    const isBlockDAG = this.isBlockDAGNetwork(chainId);
    const maxRequests = isBlockDAG 
      ? (this.config.blockdagConfig?.maxConcurrentRequests || 20)
      : this.config.maxConcurrentRequests;

    // Check if we're exceeding concurrent request limits
    const currentRequests = this.requestCounts.get(chainId) || 0;
    if (currentRequests >= maxRequests) {
      console.warn(`Max concurrent requests reached for chain ${chainId} (${currentRequests}/${maxRequests})`);
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

    const isBlockDAG = this.isBlockDAGNetwork(chainId);
    const config = isBlockDAG ? this.config.blockdagConfig : this.config;
    const maxRetries = isBlockDAG ? (config?.retryAttempts || 5) : this.config.maxRetries;
    const timeout = isBlockDAG ? (config?.timeout || 30000) : this.config.timeout;
    const retryDelay = isBlockDAG ? (config?.retryDelay || 2000) : this.config.retryDelay;

    this.incrementRequestCount(chainId);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          operation(provider),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeout)
          )
        ]);
        
        this.decrementRequestCount(chainId);
        this.updateHealth(chainId, true);
        return result;
      } catch (error: any) {
        lastError = error as Error;
        
        // Enhanced error categorization for BlockDAG
        const isNetworkError = error?.message?.includes('Failed to fetch') ||
                              error?.message?.includes('fetch') ||
                              error?.code === 'NETWORK_ERROR' ||
                              error?.code === 'ENOTFOUND' ||
                              error?.code === 'ECONNREFUSED';
        
        const isTimeoutError = error?.message?.includes('timeout') ||
                              error?.code === 'TIMEOUT';
        
        const isDAGConsensusError = isBlockDAG && (
          error?.message?.includes('consensus') ||
          error?.message?.includes('DAG') ||
          error?.message?.includes('block confirmation')
        );
        
        this.updateHealth(chainId, false, error as Error);
        
        // Log detailed error information
        console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed for chain ${chainId}:`, {
          message: error?.message,
          code: error?.code,
          isNetworkError,
          isTimeoutError,
          isDAGConsensusError,
          isBlockDAG
        });
        
        if (attempt < maxRetries) {
          // Use exponential backoff with jitter, enhanced for BlockDAG
          let baseDelay = retryDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 1000; // Add up to 1 second jitter
          
          // Special handling for BlockDAG consensus errors
          if (isBlockDAG && isDAGConsensusError) {
            baseDelay = Math.min(baseDelay * 1.5, 10000); // Cap at 10 seconds for consensus issues
          }
          
          const delay = isNetworkError || isDAGConsensusError ? baseDelay + jitter : baseDelay;
          
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

  public startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Perform initial health check
    this.performHealthChecks();

    // Determine health check interval based on network types
    const hasBlockDAG = Array.from(this.providers.keys()).some(chainId => this.isBlockDAGNetwork(chainId));
    const interval = hasBlockDAG 
      ? (this.config.blockdagConfig?.healthCheckInterval || 45000) // 45 seconds for BlockDAG
      : 30000; // 30 seconds for standard networks

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, interval);

    console.debug(`Health checking started with ${interval}ms interval (BlockDAG optimized: ${hasBlockDAG})`);
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.providers.entries()).map(
      async ([chainId, pool]) => {
        try {
          const startTime = Date.now();
          const isBlockDAG = this.isBlockDAGNetwork(chainId);
          const timeout = isBlockDAG 
            ? (this.config.blockdagConfig?.timeout || 30000)
            : 10000;
          
          // Use appropriate timeout for health checks based on network type
          const blockNumber = await Promise.race([
            pool.primary.getBlockNumber(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Health check timeout')), timeout)
            )
          ]);
          
          const latency = Date.now() - startTime;

          pool.health.latency = latency;
          pool.health.blockNumber = blockNumber;
          pool.health.lastChecked = Date.now();
          
          // Consider healthy if latency is reasonable (higher threshold for BlockDAG)
          const latencyThreshold = isBlockDAG ? 10000 : 5000;
          if (latency < latencyThreshold) {
            pool.health.isHealthy = true;
            pool.health.errorCount = Math.max(0, pool.health.errorCount - 1);
          }
          
          console.debug(`Health check passed for chain ${chainId} (${isBlockDAG ? 'BlockDAG' : 'Standard'}), latency: ${latency}ms`);
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

  private isBlockDAGNetwork(chainId: number): boolean {
    // BlockDAG Testnet: 19188, BlockDAG Mainnet: 19189 (placeholder)
    return chainId === 19188 || chainId === 19189;
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