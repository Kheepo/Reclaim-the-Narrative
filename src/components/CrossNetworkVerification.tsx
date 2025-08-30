import React, { useState, useEffect } from 'react';
import { useCrossNetworkVerification } from '../hooks/useCrossNetworkVerification';
import { SUPPORTED_NETWORKS } from '../config/networks';
import type { CrossNetworkVerificationResult } from '../lib/verification/CrossNetworkVerifier';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface CrossNetworkVerificationProps {
  reportId?: string;
  contractAddresses?: Record<string, string>;
  onVerificationComplete?: (result: CrossNetworkVerificationResult) => void;
  className?: string;
}

interface NetworkStatusCardProps {
  network: {
    id: number;
    name: string;
    displayName: string;
  };
  status: {
    verified: boolean;
    reportExists: boolean;
    networkName: string;
    networkId: number;
    contractAddress?: string;
    blockNumber?: number;
    transactionHash?: string;
    error?: string;
  };
}

const NetworkStatusCard: React.FC<NetworkStatusCardProps> = ({ network, status }) => {
  const getStatusIcon = () => {
    if (!status.verified) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
    if (!status.reportExists) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = () => {
    if (!status.verified) {
      return 'Verification Failed';
    }
    if (!status.reportExists) {
      return 'Report Not Found';
    }
    return 'Verified';
  };

  const getStatusColor = () => {
    if (!status.verified) return 'border-red-200 bg-red-50';
    if (!status.reportExists) return 'border-yellow-200 bg-yellow-50';
    return 'border-green-200 bg-green-50';
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium text-gray-900">{status.networkName}</span>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${
          status.verified && status.reportExists
            ? 'bg-green-100 text-green-800'
            : status.verified
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className="text-sm text-gray-600 space-y-1">
        <div>Chain ID: {status.networkId}</div>
        {status.contractAddress && (
          <div className="truncate">
            Contract: {status.contractAddress.slice(0, 10)}...{status.contractAddress.slice(-8)}
          </div>
        )}
        {status.blockNumber && (
          <div>Block: {status.blockNumber}</div>
        )}
        {status.transactionHash && (
          <div className="truncate">
            Tx: {status.transactionHash.slice(0, 10)}...{status.transactionHash.slice(-8)}
          </div>
        )}
        {status.error && (
          <div className="text-red-600 text-xs mt-2">
            Error: {status.error}
          </div>
        )}
      </div>
    </div>
  );
};

const CrossNetworkVerification: React.FC<CrossNetworkVerificationProps> = ({
  reportId,
  onVerificationComplete,
  className = '',
}) => {
  const {
    isVerifying,
    currentVerification,
    error,
    progress,
    verifyReport,
    getVerificationSummary,
    getAvailableNetworks,
    isInitialized,
  } = useCrossNetworkVerification();

  const [selectedReportId, setSelectedReportId] = useState(reportId || '');
  const [selectedNetworks, setSelectedNetworks] = useState<number[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const availableNetworks = getAvailableNetworks();
  const summary = getVerificationSummary();

  useEffect(() => {
    if (reportId) {
      setSelectedReportId(reportId);
    }
  }, [reportId]);

  useEffect(() => {
    if (currentVerification && onVerificationComplete) {
      onVerificationComplete(currentVerification);
    }
  }, [currentVerification, onVerificationComplete]);

  const handleVerify = async () => {
    if (!selectedReportId.trim()) {
      alert('Please enter a report ID');
      return;
    }

    const targetNetworks = selectedNetworks.length > 0 
      ? selectedNetworks 
      : availableNetworks.map((n: any) => n.id);

    await verifyReport(selectedReportId, { targetNetworks });
  };

  const toggleNetworkSelection = (networkId: number) => {
    setSelectedNetworks(prev => 
      prev.includes(networkId)
        ? prev.filter(id => id !== networkId)
        : [...prev, networkId]
    );
  };

  if (!isInitialized) {
    return (
      <div className={`p-6 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
          <span className="text-yellow-800">Cross-network verification not available</span>
        </div>
        <p className="text-sm text-yellow-700 mt-2">
          Contract addresses not configured for supported networks.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <ChartBarIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Cross-Network Verification
          </h2>
        </div>
        
        <p className="text-gray-600 mb-4">
          Verify report integrity across multiple blockchain networks to ensure data consistency and authenticity.
        </p>

        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label htmlFor="reportId" className="block text-sm font-medium text-gray-700 mb-1">
              Report ID
            </label>
            <input
              type="text"
              id="reportId"
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              placeholder="Enter report ID to verify"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isVerifying}
            />
          </div>

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Networks (leave empty for all available)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableNetworks.map((network: any) => (
                    <label key={network.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedNetworks.includes(network.id)}
                        onChange={() => toggleNetworkSelection(network.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{network.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={isVerifying || !selectedReportId.trim()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isVerifying ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                <span>Verify Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isVerifying && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-2">
            <ClockIcon className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">Verification Progress</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          
          <div className="text-sm text-gray-600">
            {progress.currentNetwork && (
              <div>{progress.currentNetwork}</div>
            )}
            <div>{progress.current} of {progress.total} networks processed</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircleIcon className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-800">Verification Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {currentVerification && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Verification Results
            </h3>
            <div className="flex items-center space-x-2">
              {currentVerification.consensusReached ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              )}
              <span className={`font-medium ${
                currentVerification.consensusReached ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {currentVerification.consensusReached ? 'Consensus Reached' : 'No Consensus'}
              </span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {currentVerification.consensusPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-blue-800">Consensus</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {currentVerification.networks.filter(n => n.verified && n.reportExists).length}
              </div>
              <div className="text-sm text-green-800">Networks Verified</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {currentVerification.discrepancies.length}
              </div>
              <div className="text-sm text-red-800">Discrepancies</div>
            </div>
          </div>

          {/* Network Status */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Network Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentVerification.networks.map((status) => {
                const network = SUPPORTED_NETWORKS[status.networkId];
                return (
                  <NetworkStatusCard
                    key={status.networkId}
                    network={network}
                    status={status}
                  />
                );
              })}
            </div>
          </div>

          {/* Discrepancies */}
          {currentVerification.discrepancies.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                <span>Data Discrepancies</span>
              </h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <ul className="space-y-1">
                  {currentVerification.discrepancies.map((discrepancy, index) => (
                    <li key={index} className="text-sm text-yellow-800">
                      • {discrepancy}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {currentVerification.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                <span>Recommendations</span>
              </h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ul className="space-y-1">
                  {currentVerification.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-sm text-blue-800">
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Statistics */}
      {summary && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Verification Summary
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{summary.totalReports}</div>
              <div className="text-sm text-gray-600">Total Reports</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.consensusReached}</div>
              <div className="text-sm text-gray-600">Consensus Reached</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.discrepanciesFound}</div>
              <div className="text-sm text-gray-600">Discrepancies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.averageConsensus.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Avg Consensus</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossNetworkVerification;