import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Eye,
  Network,
  FileText,
  TrendingUp,
  Settings
} from 'lucide-react';
import { useSecurity, useContractSecurity, useNetworkSecurity } from '../hooks/useSecurity';
import { SecurityValidationResult, TransactionSecurityCheck } from '../lib/security/SecurityValidator';
import { SUPPORTED_NETWORKS } from '../config/networks';

interface SecurityDashboardProps {
  className?: string;
}

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ className }) => {
  const {
    securityState,
    validateMultiNetworkOperation,
    validateTransaction,
    clearValidationCache,
    getValidationHistory,
    getSecuritySummary,
    isOperationSafe,
    getRecommendations
  } = useSecurity();

  const [selectedNetworkId, setSelectedNetworkId] = useState<number>(1);
  const [contractAddress, setContractAddress] = useState('');
  const [transactionData, setTransactionData] = useState<Partial<TransactionSecurityCheck>>({});
  const [validationResults, setValidationResults] = useState<SecurityValidationResult[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  const { networkStatus, isLoading: networkLoading, refetch: refetchNetwork } = useNetworkSecurity(selectedNetworkId);
  const { contractInfo, isLoading: contractLoading, refetch: refetchContract } = useContractSecurity(
    contractAddress || undefined,
    selectedNetworkId
  );

  const securitySummary = getSecuritySummary();

  useEffect(() => {
    const history = getValidationHistory();
    setValidationResults(history.slice(-10)); // Show last 10 validations
  }, [getValidationHistory, securityState.validationResults]);

  const handleMultiNetworkValidation = async () => {
    try {
      const result = await validateMultiNetworkOperation(
        1, // Ethereum mainnet
        48899, // BlockDAG testnet
        'verify'
      );
      console.log('Multi-network validation result:', result);
    } catch (error) {
      console.error('Multi-network validation failed:', error);
    }
  };

  const handleTransactionValidation = async () => {
    if (!transactionData.to || !transactionData.value) {
      alert('Please fill in transaction details');
      return;
    }

    try {
      const transaction: TransactionSecurityCheck = {
        to: transactionData.to,
        value: transactionData.value,
        data: transactionData.data || '0x',
        gasLimit: transactionData.gasLimit || '21000',
        gasPrice: transactionData.gasPrice || '20000000000',
        nonce: transactionData.nonce || 0,
        chainId: selectedNetworkId
      };

      const result = await validateTransaction(transaction, selectedNetworkId);
      console.log('Transaction validation result:', result);
    } catch (error) {
      console.error('Transaction validation failed:', error);
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskLevelIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearValidationCache}
            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Clear Cache</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {securityState.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{securityState.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Security Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Validations</p>
              <p className="text-2xl font-bold">{securitySummary.totalValidations}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold">
                {securitySummary.totalValidations > 0 
                  ? Math.round((securitySummary.successfulValidations / securitySummary.totalValidations) * 100)
                  : 0}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Risk</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(securitySummary.averageRiskLevel)}`}>
                {securitySummary.averageRiskLevel.toUpperCase()}
              </span>
            </div>
            {getRiskLevelIcon(securitySummary.averageRiskLevel)}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-sm font-medium">
                {securityState.isValidating ? 'Validating...' : 'Ready'}
              </p>
            </div>
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview', icon: Eye },
              { id: 'network', name: 'Network Security', icon: Network },
              { id: 'validation', name: 'Validation Tools', icon: Shield },
              { id: 'settings', name: 'Settings', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Security Overview</h3>
              
              {/* Recent Validations */}
              <div>
                <h4 className="text-md font-medium mb-4">Recent Validations</h4>
                <div className="space-y-2">
                  {validationResults.length === 0 ? (
                    <p className="text-gray-500 text-sm">No recent validations</p>
                  ) : (
                    validationResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getRiskLevelIcon(result.riskLevel)}
                          <div>
                            <p className="text-sm font-medium">{result.operationType}</p>
                            <p className="text-xs text-gray-500">
                              {result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(result.riskLevel)}`}>
                          {result.riskLevel.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Network Security</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Network
                  </label>
                  <select
                    value={selectedNetworkId}
                    onChange={(e) => setSelectedNetworkId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.values(SUPPORTED_NETWORKS).map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={refetchNetwork}
                    disabled={networkLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {networkLoading ? 'Checking...' : 'Check Network'}
                  </button>
                </div>
              </div>

              {networkStatus && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Network Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Security Status:</span>
                      <span className={`text-sm font-medium ${networkStatus.isSecure ? 'text-green-600' : 'text-red-600'}`}>
                        {networkStatus.isSecure ? 'SECURE' : 'INSECURE'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Consensus Health:</span>
                      <span className="text-sm">
                        {networkStatus.consensusHealth}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Validator Count:</span>
                      <span className="text-sm">
                        {networkStatus.validatorCount}
                      </span>
                    </div>
                    {networkStatus.securityWarnings.length > 0 && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Warnings:</span>
                        <ul className="text-sm text-red-600 mt-1">
                          {networkStatus.securityWarnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Validation Tools</h3>
              
              {/* Multi-Network Validation */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-4">Multi-Network Validation</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Test cross-network operation security between Ethereum and BlockDAG networks.
                </p>
                <button
                  onClick={handleMultiNetworkValidation}
                  disabled={securityState.isValidating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {securityState.isValidating ? 'Validating...' : 'Run Validation'}
                </button>
              </div>

              {/* Transaction Validation */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-4">Transaction Validation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      To Address
                    </label>
                    <input
                      type="text"
                      value={transactionData.to || ''}
                      onChange={(e) => setTransactionData({ ...transactionData, to: e.target.value })}
                      placeholder="0x..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value (ETH)
                    </label>
                    <input
                      type="text"
                      value={transactionData.value || ''}
                      onChange={(e) => setTransactionData({ ...transactionData, value: e.target.value })}
                      placeholder="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleTransactionValidation}
                  disabled={securityState.isValidating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {securityState.isValidating ? 'Validating...' : 'Validate Transaction'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Security Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Auto-validation</h4>
                    <p className="text-sm text-gray-500">Automatically validate transactions</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Risk Notifications</h4>
                    <p className="text-sm text-gray-500">Show notifications for high-risk operations</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;