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

    // Initialize providers for enabled networks with error handling
    try {
      this.initializeProviders();
    } catch (error) {
      console.warn('Some providers failed to initialize:', error);
    }
    
    this.startHealthChecking();
  }

  private initializeProviders(): void {
    Object.values(SUPPORTED_NETWORKS).forEach(network => {
      if (network.enabled) {
        try {
          this.createProviderPool(network);
        } catch (error) {
          console.error(`Failed to initialize provider for network ${network.name} (${network.id}):`, error);
          // Continue with other networks even if one fails
        }
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

    // Validate RPC URL before creating provider
    if (!rpcUrl || rpcUrl === 'undefined' || rpcUrl === 'null' || rpcUrl.trim() === '') {
      const errorMsg = `Invalid RPC URL for network ${network.name} (${network.id}): ${rpcUrl}. Please check your environment variables.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate URL format
    try {
      new URL(rpcUrl);
    } catch (error) {
      const errorMsg = `Invalid RPC URL format for network ${network.name} (${network.id}): ${rpcUrl}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    let primaryProvider: ethers.JsonRpcProvider;
    try {
      primaryProvider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: network.id,
        name: network.name,
      });

      // Configure provider timeouts and polling intervals
      primaryProvider.pollingInterval = isBlockDAG ? 1000 : 4000; // Faster polling for BlockDAG
    } catch (error) {
      const errorMsg = `Failed to create provider for network ${network.name} (${network.id}): ${error}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const fallbackProviders: ethers.JsonRpcProvider[] = [];
    
    // Add fallback providers for BlockDAG networks
    if (isBlockDAG && network.id === 1043) {
      // Add fallback RPC endpoints when available
      const fallbackUrls = [
        'https://rpc.primordial.bdagscan.com',
        // Add more fallback URLs as they become available
      ].filter(url => url !== rpcUrl);
      
      fallbackUrls.forEach(url => {
        try {
          const fallbackProvider = new ethers.JsonRpcProvider(url, {
            chainId: network.id,
            name: `${network.name}-fallback`,
          });
          fallbackProvider.pollingInterval = 1000;
          fallbackProviders.push(fallbackProvider);
        } catch (error) {
          console.warn(`Failed to create fallback provider for ${url}:`, error);
        }
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
    
    console.debug(`Provider pool created for network ${network.name} (${network.id}) with ${fallbackProviders.length} fallback providers`);
  }

  public getProvider(chainId: number): ethers.JsonRpcProvider | null {
    // Check circuit breaker first
    if (this.isCircuitOpen(chainId)) {
      const networkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId)?.name || 'Unknown';
      console.warn(`Circuit breaker is OPEN for network ${networkName} (${chainId}). Attempting fallback networks.`);
      
      // Try fallback networks when circuit is open
      const fallbackChainIds = this.getFallbackNetworks(chainId);
      for (const fallbackChainId of fallbackChainIds) {
        if (!this.isCircuitOpen(fallbackChainId)) {
          const fallbackProvider = this.getProvider(fallbackChainId);
          if (fallbackProvider) {
            const fallbackNetworkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === fallbackChainId)?.name || 'Unknown';
            console.log(`Using fallback network ${fallbackNetworkName} (${fallbackChainId}) due to circuit breaker`);
            return fallbackProvider;
          }
        }
      }
      
      // Attempt to close circuit breaker as last resort
      console.log(`All fallbacks failed, attempting to close circuit breaker for ${networkName} (${chainId})`);
      this.attemptCircuitClose(chainId).catch(error => {
        console.warn(`Circuit breaker close attempt failed:`, error);
      });
      
      return null;
    }

    let pool = this.providers.get(chainId);
    if (!pool) {
      // Lazy initialization: create provider pool on first request
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId && n.enabled);
      if (!network) {
        console.error(`Network with chain ID ${chainId} is not supported or not enabled`);
        return null;
      }

      try {
        this.createProviderPool(network);
        pool = this.providers.get(chainId);
      } catch (error: any) {
        console.error(`Failed to initialize provider for chain ${chainId} (${network.name}):`, error?.message || error);
        
        // Check if it's a configuration issue
        if (error?.message?.includes('No RPC URL') || error?.message?.includes('Invalid RPC URL')) {
          console.error(`Configuration error for ${network.name}: Please check your environment variables for RPC URLs`);
        }
        
        return null;
      }
      
      if (!pool) {
        console.error(`Provider pool creation failed for chain ${chainId} (${network.name})`);
        return null;
      }
    }

    // Try fallback networks if requested network is unavailable or unhealthy
    if (!pool || !pool.health.isHealthy) {
      const fallbackChainIds = this.getFallbackNetworks(chainId);
      const networkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId)?.name || 'Unknown';
      
      console.warn(`Primary network ${networkName} (${chainId}) is ${!pool ? 'unavailable' : 'unhealthy'}. Attempting fallback networks...`);
      
      for (const fallbackChainId of fallbackChainIds) {
        let fallbackPool = this.providers.get(fallbackChainId);
        
        // Try to initialize fallback network if not already initialized
        if (!fallbackPool) {
          const fallbackNetwork = Object.values(SUPPORTED_NETWORKS).find(n => n.id === fallbackChainId && n.enabled);
          if (fallbackNetwork) {
            try {
              console.debug(`Initializing fallback network: ${fallbackNetwork.name} (${fallbackChainId})`);
              this.createProviderPool(fallbackNetwork);
              fallbackPool = this.providers.get(fallbackChainId);
            } catch (error: any) {
              console.warn(`Failed to initialize fallback network ${fallbackNetwork.name} (${fallbackChainId}):`, error?.message || error);
              continue;
            }
          }
        }
        
        if (fallbackPool && fallbackPool.health.isHealthy) {
          const fallbackNetworkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === fallbackChainId)?.name || 'Unknown';
          console.warn(`Successfully switched to fallback network: ${fallbackNetworkName} (${fallbackChainId})`);
          return fallbackPool.primary;
        }
      }
      
      if (!pool) {
        console.error(`No provider available for chain ID: ${chainId} (${networkName}). All fallback networks failed. Please check:
1. Network configuration in .env.local
2. RPC URL connectivity
3. Network availability
4. Firewall/proxy settings`);
        return null;
      }
      
      console.warn(`All fallback networks failed for ${networkName} (${chainId}). Attempting to use unhealthy primary provider as last resort.`);
    }

    const isBlockDAG = this.isBlockDAGNetwork(chainId);
    const maxRequests = isBlockDAG 
      ? (this.config.blockdagConfig?.maxConcurrentRequests || 20)
      : this.config.maxConcurrentRequests;

    // Check if we're exceeding concurrent request limits
    const currentRequests = this.requestCounts.get(chainId) || 0;
    if (currentRequests >= maxRequests) {
      console.warn(`Max concurrent requests reached for chain ${chainId} (${currentRequests}/${maxRequests}). Consider reducing request frequency.`);
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

    const networkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId)?.name || 'Unknown';
    console.error(`All providers failed for chain ${chainId} (${networkName}). Check RPC endpoint connectivity and network configuration.`);
    return null;
  }

  private getFallbackNetworks(chainId: number): number[] {
    // Define fallback priority based on network type and environment
    const fallbackMap: Record<number, number[]> = {
      80002: [137, 1043, 11155111], // Amoy -> Polygon, BlockDAG Testnet, Sepolia
      137: [80002, 1044, 1], // Polygon -> Amoy, BlockDAG Mainnet, Ethereum
      1043: [80002, 137, 11155111], // BlockDAG Testnet -> Amoy, Polygon, Sepolia
      1044: [137, 80002, 1], // BlockDAG Mainnet -> Polygon, Amoy, Ethereum
      11155111: [80002, 137, 1043], // Sepolia -> Amoy, Polygon, BlockDAG Testnet
      1: [137, 1044, 80002] // Ethereum Mainnet -> Polygon, BlockDAG Mainnet, Amoy
    };

    const fallbacks = fallbackMap[chainId] || [80002, 137, 1043]; // Default fallbacks
    
    // Filter fallbacks to only include enabled networks
    return fallbacks.filter(fallbackChainId => {
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === fallbackChainId);
      return network && network.enabled;
    });
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
    const maxRetries = isBlockDAG ? (this.config.blockdagConfig?.retryAttempts || 5) : this.config.maxRetries;
    const timeout = isBlockDAG ? (this.config.blockdagConfig?.timeout || 30000) : this.config.timeout;
    const retryDelay = isBlockDAG ? (this.config.blockdagConfig?.retryDelay || 2000) : this.config.retryDelay;

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



  public stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Attempts to recover unhealthy networks by reinitializing their providers
   */
  public async recoverUnhealthyNetworks(): Promise<void> {
    const unhealthyNetworks = Array.from(this.providers.entries())
      .filter(([_, pool]) => !pool.health.isHealthy)
      .map(([chainId]) => chainId);

    if (unhealthyNetworks.length === 0) {
      console.debug('All networks are healthy, no recovery needed');
      return;
    }

    console.log(`Attempting to recover ${unhealthyNetworks.length} unhealthy networks:`, unhealthyNetworks);

    for (const chainId of unhealthyNetworks) {
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId);
      if (!network || !network.enabled) {
        console.warn(`Skipping recovery for disabled network ${chainId}`);
        continue;
      }

      try {
        console.debug(`Attempting recovery for network ${network.name} (${chainId})`);
        
        // Remove the unhealthy provider
        this.providers.delete(chainId);
        this.requestCounts.delete(chainId);
        
        // Recreate the provider pool
        this.createProviderPool(network);
        
        // Test the new provider
        const newProvider = this.getProvider(chainId);
        if (newProvider) {
          await Promise.race([
            newProvider.getBlockNumber(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Recovery test timeout')), 5000)
            )
          ]);
          
          console.log(`Successfully recovered network ${network.name} (${chainId})`);
        }
      } catch (error: any) {
        console.warn(`Failed to recover network ${network.name} (${chainId}):`, error?.message || error);
      }
    }
  }

  /**
   * Circuit breaker pattern implementation for network requests
   */
  public isCircuitOpen(chainId: number): boolean {
    const pool = this.providers.get(chainId);
    if (!pool) return true;

    const health = pool.health;
    const now = Date.now();
    const timeSinceLastCheck = now - health.lastChecked;
    
    // Circuit is open if:
    // 1. Error count is very high (>= 10)
    // 2. Network has been unhealthy for more than 5 minutes
    const isCircuitOpen = health.errorCount >= 10 || 
                         (!health.isHealthy && timeSinceLastCheck > 300000);
    
    if (isCircuitOpen) {
      const networkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId)?.name || 'Unknown';
      console.warn(`Circuit breaker OPEN for network ${networkName} (${chainId}). Error count: ${health.errorCount}, Time since last check: ${timeSinceLastCheck}ms`);
    }
    
    return isCircuitOpen;
  }

  /**
   * Attempts to close the circuit breaker by testing network connectivity
   */
  public async attemptCircuitClose(chainId: number): Promise<boolean> {
    if (!this.isCircuitOpen(chainId)) {
      return true; // Circuit is already closed
    }

    const networkName = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chainId)?.name || 'Unknown';
    console.log(`Attempting to close circuit breaker for network ${networkName} (${chainId})`);

    try {
      // Try to recover the network first
      await this.recoverUnhealthyNetworks();
      
      // Test connectivity
      const result = await this.validateNetworkConnectivity(chainId);
      if (result.isValid) {
        const pool = this.providers.get(chainId);
        if (pool) {
          pool.health.errorCount = 0;
          pool.health.isHealthy = true;
          pool.health.lastChecked = Date.now();
          console.log(`Circuit breaker CLOSED for network ${networkName} (${chainId})`);
          return true;
        }
      }
    } catch (error: any) {
      console.warn(`Failed to close circuit breaker for network ${networkName} (${chainId}):`, error?.message || error);
    }

    return false;
  }

  public destroy(): void {
    this.stopHealthChecking();
    
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