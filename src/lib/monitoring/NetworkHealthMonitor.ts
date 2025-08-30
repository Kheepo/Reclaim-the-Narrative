import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS, NetworkConfig } from '../../config/networks';
import { NetworkProviderManager } from '../providers/NetworkProvider';

export interface NetworkHealthMetrics {
  networkId: number;
  networkName: string;
  isHealthy: boolean;
  latency: number;
  blockHeight: number;
  gasPrice: string;
  peerCount?: number;
  syncStatus: boolean;
  lastChecked: Date;
  uptime: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
}

export interface NetworkPerformanceData {
  networkId: number;
  timestamp: Date;
  latency: number;
  blockTime: number;
  gasPrice: string;
  transactionCount: number;
  errorCount: number;
}

export interface HealthCheckResult {
  success: boolean;
  latency: number;
  blockHeight?: number;
  gasPrice?: string;
  error?: string;
  timestamp: Date;
}

export interface AlertConfig {
  latencyThreshold: number;
  errorRateThreshold: number;
  uptimeThreshold: number;
  enableNotifications: boolean;
}

export class NetworkHealthMonitor {
  private providerManager: NetworkProviderManager;
  private healthMetrics: Map<number, NetworkHealthMetrics> = new Map();
  private performanceHistory: Map<number, NetworkPerformanceData[]> = new Map();
  private monitoringIntervals: Map<number, NodeJS.Timeout> = new Map();
  private alertConfig: AlertConfig;
  private isMonitoring: boolean = false;
  private listeners: Set<(metrics: NetworkHealthMetrics[]) => void> = new Set();

  constructor(
    providerManager: NetworkProviderManager,
    alertConfig: AlertConfig = {
      latencyThreshold: 5000, // 5 seconds
      errorRateThreshold: 0.1, // 10%
      uptimeThreshold: 0.95, // 95%
      enableNotifications: true,
    }
  ) {
    this.providerManager = providerManager;
    this.alertConfig = alertConfig;
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    Object.values(SUPPORTED_NETWORKS).forEach(network => {
      this.healthMetrics.set(network.id, {
        networkId: network.id,
        networkName: network.displayName,
        isHealthy: false,
        latency: 0,
        blockHeight: 0,
        gasPrice: '0',
        syncStatus: false,
        lastChecked: new Date(),
        uptime: 0,
        errorRate: 0,
        responseTime: 0,
        throughput: 0,
      });
      this.performanceHistory.set(network.id, []);
    });
  }

  public async startMonitoring(interval: number = 30000): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Network monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting network health monitoring...');

    // Initial health check for all networks
    await this.checkAllNetworks();

    // Set up periodic monitoring for each network
    Object.values(SUPPORTED_NETWORKS).forEach(network => {
      const intervalId = setInterval(async () => {
        await this.checkNetworkHealth(network.id);
      }, interval);
      
      this.monitoringIntervals.set(network.id, intervalId);
    });

    // Set up performance data cleanup (keep last 24 hours)
    setInterval(() => {
      this.cleanupPerformanceHistory();
    }, 3600000); // Every hour
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping network health monitoring...');
    this.isMonitoring = false;

    // Clear all monitoring intervals
    this.monitoringIntervals.forEach(intervalId => {
      clearInterval(intervalId);
    });
    this.monitoringIntervals.clear();
  }

  public async checkAllNetworks(): Promise<void> {
    const promises = Object.values(SUPPORTED_NETWORKS).map(network => 
      this.checkNetworkHealth(network.id)
    );
    
    await Promise.allSettled(promises);
    this.notifyListeners();
  }

  public async checkNetworkHealth(networkId: number): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId);
    
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    try {
      const provider = await this.providerManager.getProvider(networkId);
      if (!provider) {
        throw new Error(`Provider not available for network ${networkId}`);
      }

      // Perform health checks
      const [blockHeight, feeData, network_info] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
        provider.getNetwork(),
      ]);

      const latency = Date.now() - startTime;
      const result: HealthCheckResult = {
        success: true,
        latency,
        blockHeight,
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : '0',
        timestamp: new Date(),
      };

      // Update metrics
      await this.updateNetworkMetrics(networkId, result);
      
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      const result: HealthCheckResult = {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };

      // Update metrics with error
      await this.updateNetworkMetrics(networkId, result);
      
      return result;
    }
  }

  private async updateNetworkMetrics(
    networkId: number, 
    result: HealthCheckResult
  ): Promise<void> {
    const currentMetrics = this.healthMetrics.get(networkId);
    if (!currentMetrics) return;

    const history = this.performanceHistory.get(networkId) || [];
    
    // Add performance data point
    const performanceData: NetworkPerformanceData = {
      networkId,
      timestamp: result.timestamp,
      latency: result.latency,
      blockTime: 0, // Will be calculated from block height changes
      gasPrice: result.gasPrice || '0',
      transactionCount: 0, // Could be enhanced to track tx count
      errorCount: result.success ? 0 : 1,
    };
    
    history.push(performanceData);
    this.performanceHistory.set(networkId, history);

    // Calculate metrics from recent history (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentHistory = history.filter(h => h.timestamp > oneHourAgo);
    
    const totalChecks = recentHistory.length;
    const errorCount = recentHistory.filter(h => h.errorCount > 0).length;
    const successfulChecks = totalChecks - errorCount;
    
    const avgLatency = totalChecks > 0 
      ? recentHistory.reduce((sum, h) => sum + h.latency, 0) / totalChecks 
      : 0;
    
    const errorRate = totalChecks > 0 ? errorCount / totalChecks : 0;
    const uptime = totalChecks > 0 ? successfulChecks / totalChecks : 0;

    // Update metrics
    const updatedMetrics: NetworkHealthMetrics = {
      ...currentMetrics,
      isHealthy: result.success && 
                 result.latency < this.alertConfig.latencyThreshold &&
                 errorRate < this.alertConfig.errorRateThreshold,
      latency: result.latency,
      blockHeight: result.blockHeight || currentMetrics.blockHeight,
      gasPrice: result.gasPrice || currentMetrics.gasPrice,
      syncStatus: result.success,
      lastChecked: result.timestamp,
      uptime,
      errorRate,
      responseTime: avgLatency,
      throughput: successfulChecks, // Simplified throughput metric
    };

    this.healthMetrics.set(networkId, updatedMetrics);

    // Check for alerts
    this.checkAlerts(updatedMetrics);
  }

  private checkAlerts(metrics: NetworkHealthMetrics): void {
    if (!this.alertConfig.enableNotifications) return;

    const alerts: string[] = [];

    if (metrics.latency > this.alertConfig.latencyThreshold) {
      alerts.push(`High latency detected on ${metrics.networkName}: ${metrics.latency}ms`);
    }

    if (metrics.errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push(`High error rate on ${metrics.networkName}: ${(metrics.errorRate * 100).toFixed(1)}%`);
    }

    if (metrics.uptime < this.alertConfig.uptimeThreshold) {
      alerts.push(`Low uptime on ${metrics.networkName}: ${(metrics.uptime * 100).toFixed(1)}%`);
    }

    if (!metrics.isHealthy) {
      alerts.push(`Network ${metrics.networkName} is unhealthy`);
    }

    // Log alerts (could be enhanced to send notifications)
    alerts.forEach(alert => {
      console.warn(`[NETWORK ALERT] ${alert}`);
    });
  }

  private cleanupPerformanceHistory(): void {
    const twentyFourHoursAgo = new Date(Date.now() - 86400000);
    
    this.performanceHistory.forEach((history, networkId) => {
      const filteredHistory = history.filter(h => h.timestamp > twentyFourHoursAgo);
      this.performanceHistory.set(networkId, filteredHistory);
    });
  }

  private notifyListeners(): void {
    const allMetrics = Array.from(this.healthMetrics.values());
    this.listeners.forEach(listener => {
      try {
        listener(allMetrics);
      } catch (error) {
        console.error('Error notifying health monitor listener:', error);
      }
    });
  }

  // Public API methods
  public getNetworkHealth(networkId: number): NetworkHealthMetrics | undefined {
    return this.healthMetrics.get(networkId);
  }

  public getAllNetworkHealth(): NetworkHealthMetrics[] {
    return Array.from(this.healthMetrics.values());
  }

  public getHealthyNetworks(): NetworkHealthMetrics[] {
    return this.getAllNetworkHealth().filter(metrics => metrics.isHealthy);
  }

  public getUnhealthyNetworks(): NetworkHealthMetrics[] {
    return this.getAllNetworkHealth().filter(metrics => !metrics.isHealthy);
  }

  public getPerformanceHistory(
    networkId: number, 
    hours: number = 1
  ): NetworkPerformanceData[] {
    const history = this.performanceHistory.get(networkId) || [];
    const cutoffTime = new Date(Date.now() - hours * 3600000);
    return history.filter(h => h.timestamp > cutoffTime);
  }

  public getAverageLatency(networkId: number, hours: number = 1): number {
    const history = this.getPerformanceHistory(networkId, hours);
    if (history.length === 0) return 0;
    
    return history.reduce((sum, h) => sum + h.latency, 0) / history.length;
  }

  public getNetworkUptime(networkId: number, hours: number = 24): number {
    const history = this.getPerformanceHistory(networkId, hours);
    if (history.length === 0) return 0;
    
    const successfulChecks = history.filter(h => h.errorCount === 0).length;
    return successfulChecks / history.length;
  }

  public subscribe(listener: (metrics: NetworkHealthMetrics[]) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current metrics
    listener(this.getAllNetworkHealth());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  public getAlertConfig(): AlertConfig {
    return { ...this.alertConfig };
  }

  public async forceHealthCheck(networkId?: number): Promise<void> {
    if (networkId) {
      await this.checkNetworkHealth(networkId);
    } else {
      await this.checkAllNetworks();
    }
    this.notifyListeners();
  }

  public getMonitoringStatus(): boolean {
    return this.isMonitoring;
  }

  public getNetworkSummary(): {
    total: number;
    healthy: number;
    unhealthy: number;
    averageLatency: number;
    averageUptime: number;
  } {
    const allMetrics = this.getAllNetworkHealth();
    const healthyCount = allMetrics.filter(m => m.isHealthy).length;
    
    const avgLatency = allMetrics.length > 0 
      ? allMetrics.reduce((sum, m) => sum + m.latency, 0) / allMetrics.length 
      : 0;
    
    const avgUptime = allMetrics.length > 0 
      ? allMetrics.reduce((sum, m) => sum + m.uptime, 0) / allMetrics.length 
      : 0;

    return {
      total: allMetrics.length,
      healthy: healthyCount,
      unhealthy: allMetrics.length - healthyCount,
      averageLatency: avgLatency,
      averageUptime: avgUptime,
    };
  }
}

// Singleton instance
let healthMonitorInstance: NetworkHealthMonitor | null = null;

export const getHealthMonitor = (providerManager?: NetworkProviderManager): NetworkHealthMonitor => {
  if (!healthMonitorInstance && providerManager) {
    healthMonitorInstance = new NetworkHealthMonitor(providerManager);
  }
  
  if (!healthMonitorInstance) {
    throw new Error('NetworkHealthMonitor not initialized. Provide a NetworkProviderManager.');
  }
  
  return healthMonitorInstance;
};

export const initializeHealthMonitor = (providerManager: NetworkProviderManager): NetworkHealthMonitor => {
  healthMonitorInstance = new NetworkHealthMonitor(providerManager);
  return healthMonitorInstance;
};