/**
 * Network connectivity and robustness utilities
 */

import { createEnhancedError, ErrorCategory, retryWithBackoff, withTimeout } from './error-handling';

export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface ServiceEndpoint {
  name: string;
  url: string;
  timeout: number;
  critical: boolean;
}

export interface ConnectivityCheckResult {
  isConnected: boolean;
  services: Record<string, boolean>;
  networkStatus: NetworkStatus;
  timestamp: Date;
  connectedCount?: number;
  criticalConnectedCount?: number;
}

// Default service endpoints to check
const DEFAULT_ENDPOINTS: ServiceEndpoint[] = [
  {
    name: 'ipfs',
    url: 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme',
    timeout: 5000,
    critical: true
  },
  {
    name: 'ethereum',
    url: 'https://cloudflare-eth.com/',
    timeout: 5000,
    critical: true
  },
  {
    name: 'polygon',
    url: 'https://polygon-rpc.com/',
    timeout: 5000,
    critical: false
  },
  {
    name: 'dns',
    url: 'https://1.1.1.1/dns-query?name=example.com&type=A',
    timeout: 3000,
    critical: false
  }
];

/**
 * Get current network status
 */
export function getNetworkStatus(): NetworkStatus {
  const status: NetworkStatus = {
    isOnline: navigator.onLine
  };
  
  // Add connection information if available
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      status.connectionType = connection.type;
      status.effectiveType = connection.effectiveType;
      status.downlink = connection.downlink;
      status.rtt = connection.rtt;
    }
  }
  
  return status;
}

/**
 * Check connectivity to a specific endpoint
 */
export async function checkEndpointConnectivity(
  endpoint: ServiceEndpoint
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);
    
    const response = await fetch(endpoint.url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.warn(`Connectivity check failed for ${endpoint.name}:`, error);
    return false;
  }
}

/**
 * Comprehensive connectivity check
 */
export async function checkConnectivity(
  customEndpoints?: ServiceEndpoint[]
): Promise<ConnectivityCheckResult> {
  const endpoints = customEndpoints || DEFAULT_ENDPOINTS;
  const networkStatus = getNetworkStatus();
  
  // If browser reports offline, don't bother checking endpoints
  if (!networkStatus.isOnline) {
    const services: Record<string, boolean> = {};
    endpoints.forEach(endpoint => {
      services[endpoint.name] = false;
    });
    
    return {
      isConnected: false,
      services,
      networkStatus,
      timestamp: new Date()
    };
  }
  
  const serviceChecks = await Promise.allSettled(
    endpoints.map(async (endpoint) => ({
      name: endpoint.name,
      connected: await checkEndpointConnectivity(endpoint)
    }))
  );
  
  const services: Record<string, boolean> = {};
  let connectedCount = 0;
  let criticalConnectedCount = 0;
  
  serviceChecks.forEach((result, index) => {
    const endpoint = endpoints[index];
    if (result.status === 'fulfilled') {
      services[result.value.name] = result.value.connected;
      if (result.value.connected) {
        connectedCount++;
        if (endpoint.critical) {
          criticalConnectedCount++;
        }
      }
    } else {
      services[endpoints[index].name] = false;
    }
  });
  
  // Consider connected if we can reach at least one critical service
  // OR if we can reach at least 2 services (even if non-critical)
  const criticalServices = endpoints.filter(e => e.critical);
  const hasCriticalConnection = criticalConnectedCount > 0;
  const hasMinimumConnections = connectedCount >= 2;
  
  return {
    isConnected: networkStatus.isOnline && (hasCriticalConnection || hasMinimumConnections),
    services,
    networkStatus,
    timestamp: new Date(),
    connectedCount,
    criticalConnectedCount
  };
}

/**
 * Network-aware fetch with retry and fallback
 */
export async function robustFetch(
  url: string,
  options: RequestInit = {},
  fallbackUrls: string[] = []
): Promise<Response> {
  const urls = [url, ...fallbackUrls];
  let lastError: Error;
  
  for (const currentUrl of urls) {
    try {
      return await retryWithBackoff(async () => {
        const response = await withTimeout(
          fetch(currentUrl, {
            ...options,
            headers: {
              'Cache-Control': 'no-cache',
              ...options.headers
            }
          }),
          10000 // 10 second timeout
        );
        
        if (!response.ok) {
          throw createEnhancedError(
            `HTTP ${response.status}: ${response.statusText}`,
            ErrorCategory.NETWORK,
            { operation: 'fetch', additionalData: { url: currentUrl, status: response.status } }
          );
        }
        
        return response;
      }, {
        maxAttempts: 3,
        baseDelay: 1000,
        retryCondition: (error) => {
          // Retry on network errors and 5xx status codes
          return error.message.includes('fetch') ||
                 error.message.includes('timeout') ||
                 error.message.includes('50');
        }
      });
    } catch (error) {
      lastError = error as Error;
      console.warn(`Failed to fetch from ${currentUrl}:`, error);
      
      // If this is the last URL, throw the error
      if (currentUrl === urls[urls.length - 1]) {
        throw createEnhancedError(
          `All fetch attempts failed. Last error: ${lastError.message}`,
          ErrorCategory.NETWORK,
          { operation: 'robust_fetch', additionalData: { urls, lastUrl: currentUrl } },
          lastError
        );
      }
    }
  }
  
  throw lastError!;
}

/**
 * Monitor network status changes
 */
export class NetworkMonitor {
  private listeners: Array<(status: NetworkStatus) => void> = [];
  private currentStatus: NetworkStatus;
  private checkInterval?: NodeJS.Timeout;
  
  constructor(private checkIntervalMs = 30000) {
    this.currentStatus = getNetworkStatus();
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    window.addEventListener('online', this.handleStatusChange.bind(this));
    window.addEventListener('offline', this.handleStatusChange.bind(this));
    
    // Monitor connection changes if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', this.handleStatusChange.bind(this));
      }
    }
  }
  
  private handleStatusChange() {
    const newStatus = getNetworkStatus();
    const statusChanged = JSON.stringify(newStatus) !== JSON.stringify(this.currentStatus);
    
    if (statusChanged) {
      this.currentStatus = newStatus;
      this.notifyListeners(newStatus);
    }
  }
  
  private notifyListeners(status: NetworkStatus) {
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }
  
  public addListener(listener: (status: NetworkStatus) => void) {
    this.listeners.push(listener);
  }
  
  public removeListener(listener: (status: NetworkStatus) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  public startPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      try {
        const connectivity = await checkConnectivity();
        if (!connectivity.isConnected && this.currentStatus.isOnline) {
          // Network appears online but services are unreachable
          this.handleStatusChange();
        }
      } catch (error) {
        console.warn('Periodic connectivity check failed:', error);
      }
    }, this.checkIntervalMs);
  }
  
  public stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }
  
  public getCurrentStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }
  
  public async getDetailedStatus(): Promise<ConnectivityCheckResult> {
    return await checkConnectivity();
  }
  
  public destroy() {
    this.stopPeriodicCheck();
    window.removeEventListener('online', this.handleStatusChange.bind(this));
    window.removeEventListener('offline', this.handleStatusChange.bind(this));
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.removeEventListener('change', this.handleStatusChange.bind(this));
      }
    }
    
    this.listeners = [];
  }
}

/**
 * Estimate network speed
 */
export async function estimateNetworkSpeed(): Promise<{
  downloadSpeed: number; // Mbps
  latency: number; // ms
  timestamp: Date;
}> {
  const testUrl = 'https://httpbin.org/bytes/1024'; // 1KB test file
  const startTime = performance.now();
  
  try {
    const response = await fetch(testUrl, { cache: 'no-cache' });
    const endTime = performance.now();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.arrayBuffer();
    const totalTime = endTime - startTime;
    const sizeInBits = data.byteLength * 8;
    const speedBps = sizeInBits / (totalTime / 1000);
    const speedMbps = speedBps / (1024 * 1024);
    
    return {
      downloadSpeed: Math.round(speedMbps * 100) / 100,
      latency: Math.round(totalTime),
      timestamp: new Date()
    };
  } catch (error) {
    throw createEnhancedError(
      'Failed to estimate network speed',
      ErrorCategory.NETWORK,
      { operation: 'speed_test' },
      error as Error
    );
  }
}

/**
 * Check if a URL is reachable
 */
export async function isUrlReachable(
  url: string,
  timeout = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get optimal RPC endpoint based on latency
 */
export async function getOptimalRpcEndpoint(
  endpoints: string[]
): Promise<string> {
  if (endpoints.length === 0) {
    throw createEnhancedError(
      'No RPC endpoints provided',
      ErrorCategory.NETWORK,
      { operation: 'rpc_selection' }
    );
  }
  
  if (endpoints.length === 1) {
    return endpoints[0];
  }
  
  const latencyTests = endpoints.map(async (endpoint) => {
    const startTime = performance.now();
    
    try {
      const response = await withTimeout(
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        }),
        5000
      );
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      if (response.ok) {
        return { endpoint, latency, success: true };
      } else {
        return { endpoint, latency: Infinity, success: false };
      }
    } catch (error) {
      return { endpoint, latency: Infinity, success: false };
    }
  });
  
  const results = await Promise.all(latencyTests);
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    throw createEnhancedError(
      'All RPC endpoints are unreachable',
      ErrorCategory.NETWORK,
      { operation: 'rpc_selection', additionalData: { endpoints } }
    );
  }
  
  // Return the endpoint with the lowest latency
  const optimal = successfulResults.reduce((best, current) => 
    current.latency < best.latency ? current : best
  );
  
  console.log(`Selected optimal RPC endpoint: ${optimal.endpoint} (${optimal.latency}ms)`);
  return optimal.endpoint;
}

/**
 * Create a network-aware cache
 */
export class NetworkAwareCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private networkMonitor: NetworkMonitor;
  
  constructor(private defaultTtl = 300000) { // 5 minutes default
    this.networkMonitor = new NetworkMonitor();
    this.networkMonitor.addListener(this.handleNetworkChange.bind(this));
  }
  
  private handleNetworkChange(status: NetworkStatus) {
    if (!status.isOnline) {
      // Extend TTL when offline to preserve cached data
      this.cache.forEach((entry) => {
        entry.ttl = Math.max(entry.ttl, Date.now() + 3600000); // Extend by 1 hour
      });
    }
  }
  
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: Date.now() + (ttl || this.defaultTtl)
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  destroy(): void {
    this.networkMonitor.destroy();
    this.clear();
  }
}