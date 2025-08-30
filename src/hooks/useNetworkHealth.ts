import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkHealthMetrics, NetworkPerformanceData, AlertConfig, getHealthMonitor } from '../lib/monitoring/NetworkHealthMonitor';
import { getProviderManager } from '../lib/providers/NetworkProvider';

export interface NetworkHealthState {
  metrics: NetworkHealthMetrics[];
  isMonitoring: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface NetworkHealthHookReturn {
  // State
  healthState: NetworkHealthState;
  
  // Actions
  startMonitoring: (interval?: number) => Promise<void>;
  stopMonitoring: () => void;
  forceHealthCheck: (networkId?: number) => Promise<void>;
  updateAlertConfig: (config: Partial<AlertConfig>) => void;
  
  // Getters
  getNetworkHealth: (networkId: number) => NetworkHealthMetrics | undefined;
  getHealthyNetworks: () => NetworkHealthMetrics[];
  getUnhealthyNetworks: () => NetworkHealthMetrics[];
  getPerformanceHistory: (networkId: number, hours?: number) => NetworkPerformanceData[];
  getAverageLatency: (networkId: number, hours?: number) => number;
  getNetworkUptime: (networkId: number, hours?: number) => number;
  getNetworkSummary: () => {
    total: number;
    healthy: number;
    unhealthy: number;
    averageLatency: number;
    averageUptime: number;
  };
  
  // Configuration
  alertConfig: AlertConfig;
}

export const useNetworkHealth = (): NetworkHealthHookReturn => {
  const getProviderManagerLazy = useCallback(() => getProviderManager(), []);
  const [healthState, setHealthState] = useState<NetworkHealthState>({
    metrics: [],
    isMonitoring: false,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });
  
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    latencyThreshold: 5000,
    errorRateThreshold: 0.1,
    uptimeThreshold: 0.95,
    enableNotifications: true,
  });
  
  const healthMonitorRef = useRef<ReturnType<typeof getHealthMonitor> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize health monitor lazily
  const getHealthMonitorLazy = useCallback(() => {
    if (!healthMonitorRef.current) {
      const providerManager = getProviderManagerLazy();
      healthMonitorRef.current = getHealthMonitor(providerManager);
    }
    return healthMonitorRef.current;
  }, [getProviderManagerLazy]);

  // Initialize health monitor
  useEffect(() => {
    try {
      const monitor = getHealthMonitorLazy();
      
      // Subscribe to health updates
      const unsubscribe = monitor.subscribe((metrics) => {
        setHealthState(prev => ({
          ...prev,
          metrics,
          lastUpdated: new Date(),
          error: null,
        }));
      });
      
      unsubscribeRef.current = unsubscribe;
      
      // Update monitoring status
      setHealthState(prev => ({
        ...prev,
        isMonitoring: monitor.getMonitoringStatus() || false,
      }));
      
    } catch (error) {
      console.error('Failed to initialize network health monitor:', error);
      setHealthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize health monitor',
      }));
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [getHealthMonitorLazy]);

  // Start monitoring
  const startMonitoring = useCallback(async (interval: number = 30000) => {
    setHealthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const monitor = getHealthMonitorLazy();
      await monitor.startMonitoring(interval);
      setHealthState(prev => ({
        ...prev,
        isMonitoring: true,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to start network monitoring:', error);
      setHealthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start monitoring',
      }));
    }
  }, [getHealthMonitorLazy]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    try {
      const monitor = getHealthMonitorLazy();
      monitor.stopMonitoring();
      setHealthState(prev => ({
        ...prev,
        isMonitoring: false,
      }));
    } catch (error) {
      console.error('Failed to stop network monitoring:', error);
      setHealthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to stop monitoring',
      }));
    }
  }, [getHealthMonitorLazy]);

  // Force health check
  const forceHealthCheck = useCallback(async (networkId?: number) => {
    setHealthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const monitor = getHealthMonitorLazy();
      await monitor.forceHealthCheck(networkId);
      setHealthState(prev => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to perform health check:', error);
      setHealthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to perform health check',
      }));
    }
  }, [getHealthMonitorLazy]);

  // Update alert configuration
  const updateAlertConfig = useCallback((config: Partial<AlertConfig>) => {
    try {
      const monitor = getHealthMonitorLazy();
      monitor.updateAlertConfig(config);
      const updatedConfig = monitor.getAlertConfig();
      setAlertConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update alert config:', error);
      setHealthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update alert config',
      }));
    }
  }, [getHealthMonitorLazy]);

  // Get network health
  const getNetworkHealth = useCallback((networkId: number): NetworkHealthMetrics | undefined => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getNetworkHealth(networkId);
    } catch {
      return undefined;
    }
  }, [getHealthMonitorLazy]);

  // Get healthy networks
  const getHealthyNetworks = useCallback((): NetworkHealthMetrics[] => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getHealthyNetworks();
    } catch {
      return [];
    }
  }, [getHealthMonitorLazy]);

  // Get unhealthy networks
  const getUnhealthyNetworks = useCallback((): NetworkHealthMetrics[] => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getUnhealthyNetworks();
    } catch {
      return [];
    }
  }, [getHealthMonitorLazy]);

  // Get performance history
  const getPerformanceHistory = useCallback((
    networkId: number, 
    hours: number = 1
  ): NetworkPerformanceData[] => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getPerformanceHistory(networkId, hours);
    } catch {
      return [];
    }
  }, [getHealthMonitorLazy]);

  // Get average latency
  const getAverageLatency = useCallback((
    networkId: number, 
    hours: number = 1
  ): number => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getAverageLatency(networkId, hours);
    } catch {
      return 0;
    }
  }, [getHealthMonitorLazy]);

  // Get network uptime
  const getNetworkUptime = useCallback((
    networkId: number, 
    hours: number = 24
  ): number => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getNetworkUptime(networkId, hours);
    } catch {
      return 0;
    }
  }, [getHealthMonitorLazy]);

  // Get network summary
  const getNetworkSummary = useCallback(() => {
    try {
      const monitor = getHealthMonitorLazy();
      return monitor.getNetworkSummary();
    } catch {
      return {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        averageLatency: 0,
        averageUptime: 0,
      };
    }
  }, [getHealthMonitorLazy]);

  return {
    healthState,
    startMonitoring,
    stopMonitoring,
    forceHealthCheck,
    updateAlertConfig,
    getNetworkHealth,
    getHealthyNetworks,
    getUnhealthyNetworks,
    getPerformanceHistory,
    getAverageLatency,
    getNetworkUptime,
    getNetworkSummary,
    alertConfig,
  };
};

// Utility hook for specific network health
export const useSpecificNetworkHealth = (networkId: number) => {
  const { getNetworkHealth, getPerformanceHistory, getAverageLatency, getNetworkUptime } = useNetworkHealth();
  
  const [networkHealth, setNetworkHealth] = useState<NetworkHealthMetrics | undefined>();
  
  useEffect(() => {
    const updateHealth = () => {
      const health = getNetworkHealth(networkId);
      setNetworkHealth(health);
    };
    
    updateHealth();
    const interval = setInterval(updateHealth, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, [networkId, getNetworkHealth]);
  
  return {
    networkHealth,
    performanceHistory: getPerformanceHistory(networkId),
    averageLatency: getAverageLatency(networkId),
    uptime: getNetworkUptime(networkId),
  };
};

// Utility hook for monitoring alerts
export const useNetworkAlerts = () => {
  const { healthState, alertConfig } = useNetworkHealth();
  const [alerts, setAlerts] = useState<{
    networkId: number;
    networkName: string;
    type: 'latency' | 'error_rate' | 'uptime' | 'unhealthy';
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }[]>([]);
  
  useEffect(() => {
    const newAlerts: typeof alerts = [];
    
    healthState.metrics.forEach(metrics => {
      // High latency alert
      if (metrics.latency > alertConfig.latencyThreshold) {
        newAlerts.push({
          networkId: metrics.networkId,
          networkName: metrics.networkName,
          type: 'latency',
          message: `High latency: ${metrics.latency}ms`,
          severity: metrics.latency > alertConfig.latencyThreshold * 2 ? 'high' : 'medium',
          timestamp: new Date(),
        });
      }
      
      // High error rate alert
      if (metrics.errorRate > alertConfig.errorRateThreshold) {
        newAlerts.push({
          networkId: metrics.networkId,
          networkName: metrics.networkName,
          type: 'error_rate',
          message: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
          severity: metrics.errorRate > alertConfig.errorRateThreshold * 2 ? 'high' : 'medium',
          timestamp: new Date(),
        });
      }
      
      // Low uptime alert
      if (metrics.uptime < alertConfig.uptimeThreshold) {
        newAlerts.push({
          networkId: metrics.networkId,
          networkName: metrics.networkName,
          type: 'uptime',
          message: `Low uptime: ${(metrics.uptime * 100).toFixed(1)}%`,
          severity: metrics.uptime < alertConfig.uptimeThreshold * 0.8 ? 'high' : 'medium',
          timestamp: new Date(),
        });
      }
      
      // Unhealthy network alert
      if (!metrics.isHealthy) {
        newAlerts.push({
          networkId: metrics.networkId,
          networkName: metrics.networkName,
          type: 'unhealthy',
          message: 'Network is unhealthy',
          severity: 'high',
          timestamp: new Date(),
        });
      }
    });
    
    setAlerts(newAlerts);
  }, [healthState.metrics, alertConfig]);
  
  return {
    alerts,
    hasAlerts: alerts.length > 0,
    criticalAlerts: alerts.filter(a => a.severity === 'high'),
    warningAlerts: alerts.filter(a => a.severity === 'medium'),
    infoAlerts: alerts.filter(a => a.severity === 'low'),
  };
};