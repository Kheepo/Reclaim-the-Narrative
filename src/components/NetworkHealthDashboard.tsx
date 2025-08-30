import React, { useState, useEffect } from 'react';
import { useNetworkHealth, useNetworkAlerts } from '../hooks/useNetworkHealth';
import { SUPPORTED_NETWORKS } from '../config/networks';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BellIcon,
  ClockIcon,
  SignalIcon,
  ServerIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface NetworkHealthDashboardProps {
  className?: string;
  autoStart?: boolean;
  monitoringInterval?: number;
}

interface NetworkCardProps {
  networkId: number;
  metrics: any;
  onForceCheck: () => void;
}

const NetworkCard: React.FC<NetworkCardProps> = ({ networkId, metrics, onForceCheck }) => {
  const network = SUPPORTED_NETWORKS[networkId];
  
  if (!network || !metrics) {
    return null;
  }

  const getHealthIcon = () => {
    if (metrics.isHealthy) {
      return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
    }
    return <XCircleIcon className="h-6 w-6 text-red-500" />;
  };

  const getHealthColor = () => {
    if (metrics.isHealthy) {
      return 'border-green-200 bg-green-50';
    }
    return 'border-red-200 bg-red-50';
  };

  const formatLatency = (latency: number) => {
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  const formatUptime = (uptime: number) => {
    return `${(uptime * 100).toFixed(1)}%`;
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getHealthColor()}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getHealthIcon()}
          <div>
            <h3 className="font-semibold text-gray-900">{network.displayName}</h3>
            <p className="text-xs text-gray-500">Chain ID: {network.id}</p>
          </div>
        </div>
        <button
          onClick={onForceCheck}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Force health check"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <ClockIcon className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">Latency</span>
          </div>
          <div className="font-medium">{formatLatency(metrics.latency)}</div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <SignalIcon className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">Uptime</span>
          </div>
          <div className="font-medium">{formatUptime(metrics.uptime)}</div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <ServerIcon className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">Block</span>
          </div>
          <div className="font-medium">{metrics.blockHeight.toLocaleString()}</div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <ChartBarIcon className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">Gas Price</span>
          </div>
          <div className="font-medium">{parseFloat(metrics.gasPrice).toFixed(2)} Gwei</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Error Rate: {(metrics.errorRate * 100).toFixed(1)}%</span>
          <span>Last Check: {new Date(metrics.lastChecked).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

const AlertsPanel: React.FC = () => {
  const { alerts, hasAlerts, criticalAlerts, warningAlerts } = useNetworkAlerts();
  
  if (!hasAlerts) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircleIcon className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">All networks are healthy</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {criticalAlerts.map((alert, index) => (
        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <XCircleIcon className="h-4 w-4 text-red-600" />
            <span className="text-red-800 font-medium">{alert.networkName}</span>
            <span className="text-red-600 text-sm">{alert.message}</span>
          </div>
        </div>
      ))}
      
      {warningAlerts.map((alert, index) => (
        <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-800 font-medium">{alert.networkName}</span>
            <span className="text-yellow-600 text-sm">{alert.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const PerformanceChart: React.FC<{ networkId: number }> = ({ networkId }) => {
  const { getPerformanceHistory } = useNetworkHealth();
  const [timeRange, setTimeRange] = useState<number>(1); // hours
  
  const performanceData = getPerformanceHistory(networkId, timeRange);
  
  const chartData = performanceData.map(data => ({
    time: new Date(data.timestamp).toLocaleTimeString(),
    latency: data.latency,
    gasPrice: parseFloat(data.gasPrice),
  }));

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Performance History</h4>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value={1}>Last Hour</option>
          <option value={6}>Last 6 Hours</option>
          <option value={24}>Last 24 Hours</option>
        </select>
      </div>
      
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="latency" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="Latency (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-48 flex items-center justify-center text-gray-500">
          No performance data available
        </div>
      )}
    </div>
  );
};

const NetworkHealthDashboard: React.FC<NetworkHealthDashboardProps> = ({
  className = '',
  autoStart = true,
  monitoringInterval = 30000,
}) => {
  const {
    healthState,
    startMonitoring,
    stopMonitoring,
    forceHealthCheck,
    updateAlertConfig,
    getNetworkSummary,
    alertConfig,
  } = useNetworkHealth();
  
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempAlertConfig, setTempAlertConfig] = useState(alertConfig);
  
  const summary = getNetworkSummary();

  useEffect(() => {
    if (autoStart && !healthState.isMonitoring) {
      startMonitoring(monitoringInterval);
    }
  }, [autoStart, healthState.isMonitoring, startMonitoring, monitoringInterval]);

  const handleToggleMonitoring = () => {
    if (healthState.isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring(monitoringInterval);
    }
  };

  const handleSaveSettings = () => {
    updateAlertConfig(tempAlertConfig);
    setShowSettings(false);
  };

  const summaryChartData = [
    { name: 'Healthy', value: summary.healthy, color: '#10B981' },
    { name: 'Unhealthy', value: summary.unhealthy, color: '#EF4444' },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ServerIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Network Health Dashboard
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => forceHealthCheck()}
              disabled={healthState.isLoading}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              title="Force health check"
            >
              <ArrowPathIcon className={`h-5 w-5 ${healthState.isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleToggleMonitoring}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                healthState.isMonitoring
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {healthState.isMonitoring ? (
                <>
                  <StopIcon className="h-4 w-4" />
                  <span>Stop Monitoring</span>
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4" />
                  <span>Start Monitoring</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
            <div className="text-sm text-blue-800">Total Networks</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{summary.healthy}</div>
            <div className="text-sm text-green-800">Healthy Networks</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {summary.averageLatency.toFixed(0)}ms
            </div>
            <div className="text-sm text-yellow-800">Avg Latency</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {(summary.averageUptime * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-purple-800">Avg Uptime</div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latency Threshold (ms)
              </label>
              <input
                type="number"
                value={tempAlertConfig.latencyThreshold}
                onChange={(e) => setTempAlertConfig(prev => ({
                  ...prev,
                  latencyThreshold: Number(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Error Rate Threshold (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={tempAlertConfig.errorRateThreshold}
                onChange={(e) => setTempAlertConfig(prev => ({
                  ...prev,
                  errorRateThreshold: Number(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Uptime Threshold (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={tempAlertConfig.uptimeThreshold}
                onChange={(e) => setTempAlertConfig(prev => ({
                  ...prev,
                  uptimeThreshold: Number(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={tempAlertConfig.enableNotifications}
                  onChange={(e) => setTempAlertConfig(prev => ({
                    ...prev,
                    enableNotifications: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable Notifications</span>
              </label>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Settings
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {healthState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircleIcon className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-1">{healthState.error}</p>
        </div>
      )}

      {/* Alerts */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <BellIcon className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900">Network Alerts</h3>
        </div>
        <AlertsPanel />
      </div>

      {/* Network Cards */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthState.metrics.map((metrics) => (
            <NetworkCard
              key={metrics.networkId}
              networkId={metrics.networkId}
              metrics={metrics}
              onForceCheck={() => forceHealthCheck(metrics.networkId)}
            />
          ))}
        </div>
      </div>

      {/* Performance Charts */}
      {selectedNetwork && (
        <PerformanceChart networkId={selectedNetwork} />
      )}

      {/* Network Summary Chart */}
      {summary.total > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Health Overview</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Health Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={summaryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {summaryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Network Latency</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={healthState.metrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="networkName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="latency" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Status Footer */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Monitoring: {healthState.isMonitoring ? 'Active' : 'Inactive'}</span>
            {healthState.lastUpdated && (
              <span>Last Updated: {healthState.lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              healthState.isMonitoring ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span>{healthState.isMonitoring ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkHealthDashboard;