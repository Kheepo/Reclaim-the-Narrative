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
  const providerManager = getProviderManager();
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

  // Initialize health monitor
  useEffect(() => {
    if (!providerManager) return;

    try {
      healthMonitorRef.current = getHealthMonitor(providerManager);
      
      // Subscribe to health updates
      const unsubscribe = healthMonitorRef.current.subscribe((metrics) => {
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
        isMonitoring: healthMonitorRef.current?.getMonitoringStatus() || false,
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
  }, [providerManager]);

  // Start monitoring
  const startMonitoring = useCallback(async (interval: number = 30000) => {
    if (!healthMonitorRef.current) {
      setHealthState(prev => ({
        ...prev,
        error: 'Health monitor not initialized',
      }));
      return;
    }

    setHealthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await healthMonitorRef.current.startMonitoring(interval);
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
  }, []);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!healthMonitorRef.current) return;

    try {
      healthMonitorRef.current.stopMonitoring();
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
  }, []);

  // Force health check
  const forceHealthCheck = useCallback(async (networkId?: number) => {
    if (!healthMonitorRef.current) {
      setHealthState(prev => ({
        ...prev,
        error: 'Health monitor not initialized',
      }));
      return;
    }

    setHealthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await healthMonitorRef.current.forceHealthCheck(networkId);
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
  }, []);

  // Update alert configuration
  const updateAlertConfig = useCallback((config: Partial<AlertConfig>) => {
    if (!healthMonitorRef.current) return;

    try {
      healthMonitorRef.current.updateAlertConfig(config);
      const updatedConfig = healthMonitorRef.current.getAlertConfig();
      setAlertConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update alert config:', error);
      setHealthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update alert config',
      }));
    }
  }, []);

  // Get network health
  const getNetworkHealth = useCallback((networkId: number): NetworkHealthMetrics | undefined => {
    if (!healthMonitorRef.current) return undefined;
    return healthMonitorRef.current.getNetworkHealth(networkId);
  }, []);

  // Get healthy networks
  const getHealthyNetworks = useCallback((): NetworkHealthMetrics[] => {
    if (!healthMonitorRef.current) return [];
    return healthMonitorRef.current.getHealthyNetworks();
  }, []);

  // Get unhealthy networks
  const getUnhealthyNetworks = useCallback((): NetworkHealthMetrics[] => {
    if (!healthMonitorRef.current) return [];
    return healthMonitorRef.current.getUnhealthyNetworks();
  }, []);

  // Get performance history
  const getPerformanceHistory = useCallback((
    networkId: number, 
    hours: number = 1
  ): NetworkPerformanceData[] => {
    if (!healthMonitorRef.current) return [];
    return healthMonitorRef.current.getPerformanceHistory(networkId, hours);
  }, []);

  // Get average latency
  const getAverageLatency = useCallback((
    networkId: number, 
    hours: number = 1
  ): number => {
    if (!healthMonitorRef.current) return 0;
    return healthMonitorRef.current.getAverageLatency(networkId, hours);
  }, []);

  // Get network uptime
  const getNetworkUptime = useCallback((
    networkId: number, 
    hours: number = 24
  ): number => {
    if (!healthMonitorRef.current) return 0;
    return healthMonitorRef.current.getNetworkUptime(networkId, hours);
  }, []);

  // Get network summary
  const getNetworkSummary = useCallback(() => {
    if (!healthMonitorRef.current) {
      return {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        averageLatency: 0,
        averageUptime: 0,
      };
    }
    return healthMonitorRef.current.getNetworkSummary();
  }, []);

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