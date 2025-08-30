import React, { useState, useEffect } from 'react';
import {
  useErrorHandler,
  useNetworkErrorHandler,
  useTransactionErrorHandler,
  useContractErrorHandler,
} from '../hooks/useErrorHandler';
import { NetworkErrorType, ErrorSeverity } from '../lib/errors/NetworkErrorHandler';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Trash2,
  Clock,
  Network,
  FileText,
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  X,
} from 'lucide-react';

interface ErrorDashboardProps {
  networkId?: number;
  contractAddress?: string;
  className?: string;
}

const ErrorDashboard: React.FC<ErrorDashboardProps> = ({
  networkId,
  contractAddress,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'transactions' | 'contracts'>('overview');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    errorState,
    clearCurrentError,
    clearErrorHistory,
    retryLastOperation,
    getErrorStats,
    showToast,
    getRecentErrors,
    hasRecoverableError,
  } = useErrorHandler();

  const {
    networkErrors,
    getNetworkErrorStats,
    isRecovering: isNetworkRecovering,
  } = useNetworkErrorHandler(networkId);

  const {
    transactionErrors,
    clearTransactionError,
    hasTransactionError,
  } = useTransactionErrorHandler();

  const {
    contractErrors,
    clearContractErrors,
  } = useContractErrorHandler(contractAddress);

  const [stats, setStats] = useState(getErrorStats());
  const [networkStats, setNetworkStats] = useState(getNetworkErrorStats());

  // Auto-refresh stats
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setStats(getErrorStats());
      setNetworkStats(getNetworkErrorStats());
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, getErrorStats, getNetworkErrorStats]);

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return <XCircle className="w-5 h-5 text-red-500" />;
      case ErrorSeverity.HIGH:
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case ErrorSeverity.MEDIUM:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case ErrorSeverity.LOW:
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 border-red-200 text-red-800';
      case ErrorSeverity.HIGH:
        return 'bg-orange-100 border-orange-200 text-orange-800';
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-100 border-yellow-200 text-yellow-800';
      case ErrorSeverity.LOW:
        return 'bg-blue-100 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-200 text-gray-800';
    }
  };

  const getTypeIcon = (type: NetworkErrorType) => {
    switch (type) {
      case NetworkErrorType.CONNECTION_FAILED:
        return <Network className="w-4 h-4" />;
      case NetworkErrorType.TRANSACTION_FAILED:
        return <FileText className="w-4 h-4" />;
      case NetworkErrorType.CONTRACT_ERROR:
        return <Activity className="w-4 h-4" />;
      case NetworkErrorType.RATE_LIMITED:
        return <TrendingUp className="w-4 h-4" />;
      case NetworkErrorType.INSUFFICIENT_FUNDS:
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: 'short',
      day: 'numeric',
    }).format(timestamp);
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Current Error Alert */}
      {errorState.currentError && (
        <div className={`p-4 rounded-lg border-2 ${getSeverityColor(errorState.currentError.severity)}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {getSeverityIcon(errorState.currentError.severity)}
              <div className="flex-1">
                <h3 className="font-semibold">{errorState.currentError.userMessage}</h3>
                <p className="text-sm mt-1">{errorState.currentError.technicalDetails}</p>
                {errorState.currentError.suggestedActions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Suggested Actions:</p>
                    <ul className="text-sm list-disc list-inside mt-1">
                      {errorState.currentError.suggestedActions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              {hasRecoverableError() && (
                <button
                  onClick={retryLastOperation}
                  disabled={errorState.isRecovering}
                  className="px-3 py-1 bg-blue-500 text-gray-900 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                >
                  {errorState.isRecovering ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Retry'
                  )}
                </button>
              )}
              <button
                onClick={clearCurrentError}
                className="px-3 py-1 bg-gray-500 text-gray-900 rounded text-sm hover:bg-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recovery Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {(stats.recoveryRate * 100).toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Errors</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.bySeverity[ErrorSeverity.CRITICAL] || 0}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recent Errors</p>
              <p className="text-2xl font-bold text-gray-900">
                {getRecentErrors(5).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Errors</h3>
            <button
              onClick={clearErrorHistory}
              className="px-3 py-1 bg-red-500 text-gray-900 rounded text-sm hover:bg-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="divide-y">
          {getRecentErrors(10).map((error, index) => (
            <div key={`${error.timestamp}-${index}`} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(error.severity)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(error.type)}
                      <span className="font-medium">{error.userMessage}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatTimestamp(error.timestamp)}
                    </p>
                    {error.networkId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Network: {error.networkId}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(showDetails === `${error.timestamp}-${index}` ? null : `${error.timestamp}-${index}`)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  {showDetails === `${error.timestamp}-${index}` ? 'Hide' : 'Details'}
                </button>
              </div>
              {showDetails === `${error.timestamp}-${index}` && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                  <p><strong>Technical Details:</strong> {error.technicalDetails}</p>
                  {error.context && Object.keys(error.context).length > 0 && (
                    <div className="mt-2">
                      <strong>Context:</strong>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(error.context, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {getRecentErrors(10).length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No recent errors</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderNetworkTab = () => (
    <div className="space-y-6">
      {/* Network Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Network Errors</p>
              <p className="text-2xl font-bold text-gray-900">{networkStats.total}</p>
            </div>
            <Network className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recovery Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {(networkStats.recoveryRate * 100).toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recovering</p>
              <p className="text-2xl font-bold text-orange-600">
                {isNetworkRecovering ? 'Yes' : 'No'}
              </p>
            </div>
            <RefreshCw className={`w-8 h-8 text-orange-500 ${isNetworkRecovering ? 'animate-spin' : ''}`} />
          </div>
        </div>
      </div>

      {/* Network Errors List */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Network Errors</h3>
        </div>
        <div className="divide-y">
          {networkErrors.slice(-10).map((error, index) => (
            <div key={`network-${error.timestamp}-${index}`} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(error.severity)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(error.type)}
                      <span className="font-medium">{error.userMessage}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatTimestamp(error.timestamp)}
                    </p>
                    {error.networkId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Network: {error.networkId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {networkErrors.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No network errors</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTransactionsTab = () => (
    <div className="space-y-6">
      {/* Transaction Errors */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Transaction Errors</h3>
        </div>
        <div className="divide-y">
          {transactionErrors.map(([txHash, error]) => (
            <div key={txHash} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(error.severity)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-medium">{error.userMessage}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatTimestamp(error.timestamp)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => clearTransactionError(txHash)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {transactionErrors.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No transaction errors</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderContractsTab = () => (
    <div className="space-y-6">
      {/* Contract Errors */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Contract Errors</h3>
            <button
              onClick={clearContractErrors}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="divide-y">
          {contractErrors.map((error, index) => (
            <div key={`contract-${error.timestamp}-${index}`} className="p-4 hover:bg-gray-50">
              <div className="flex items-start space-x-3">
                {getSeverityIcon(error.severity)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4" />
                    <span className="font-medium">{error.userMessage}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatTimestamp(error.timestamp)}
                  </p>
                  {error.context?.contractAddress && (
                    <p className="text-xs text-gray-500 mt-1">
                      Contract: {error.context.contractAddress.slice(0, 10)}...{error.context.contractAddress.slice(-8)}
                    </p>
                  )}
                  {error.context?.methodName && (
                    <p className="text-xs text-gray-500">
                      Method: {error.context.methodName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {contractErrors.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No contract errors</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-gray-50 rounded-lg ${className}`}>
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Error Dashboard</h2>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>Auto-refresh</span>
            </label>
            <button
              onClick={() => {
                setStats(getErrorStats());
                setNetworkStats(getNetworkErrorStats());
                showToast.info('Dashboard refreshed');
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white">
        <nav className="flex space-x-8 px-4">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'network', label: 'Network', icon: Network },
            { id: 'transactions', label: 'Transactions', icon: FileText },
            { id: 'contracts', label: 'Contracts', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as 'overview' | 'network' | 'transactions' | 'contracts')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'network' && renderNetworkTab()}
        {activeTab === 'transactions' && renderTransactionsTab()}
        {activeTab === 'contracts' && renderContractsTab()}
      </div>
    </div>
  );
};

export default ErrorDashboard;