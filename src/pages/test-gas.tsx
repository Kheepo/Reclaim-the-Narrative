import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getCurrentGasPrices, analyzeGasPrices, GasPrices } from '../utils/gas-checker';
import { checkNetworkStatus } from '../lib/blockchain';

interface NetworkStatus {
  isConnected: boolean;
  chainId: number;
  networkName: string;
  blockNumber: number;
  gasPrice: string;
  walletConnected: boolean;
  walletAddress?: string;
  walletBalance?: string;
  error?: string;
}

const TestGasPage: React.FC = () => {
  const [gasPrices, setGasPrices] = useState<GasPrices | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkGasPrices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching current gas prices...');
      const prices = await getCurrentGasPrices();
      setGasPrices(prices);
      console.log('Gas prices fetched:', prices);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error fetching gas prices:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkNetwork = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Checking network status...');
      const status = await checkNetworkStatus();
      setNetworkStatus(status);
      console.log('Network status:', status);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error checking network:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-check on component mount
    checkGasPrices();
    checkNetwork();
  }, []);

  const analysis = gasPrices ? analyzeGasPrices(gasPrices) : null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Gas Price &amp; Network Diagnostics</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gas Prices Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Current Gas Prices</h2>
              <button
                onClick={checkGasPrices}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Refresh'}
              </button>
            </div>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                Error: {error}
              </div>
            )}
            
            {gasPrices && (
              <div className="space-y-3">
                <div>
                  <span className="font-medium">Gas Price:</span>
                  <span className="ml-2 text-blue-600">{gasPrices.formatted.gasPrice}</span>
                </div>
                
                {gasPrices.formatted.maxFeePerGas && (
                  <div>
                    <span className="font-medium">Max Fee Per Gas:</span>
                    <span className="ml-2 text-blue-600">{gasPrices.formatted.maxFeePerGas}</span>
                  </div>
                )}
                
                {gasPrices.formatted.maxPriorityFeePerGas && (
                  <div>
                    <span className="font-medium">Max Priority Fee:</span>
                    <span className="ml-2 text-blue-600">{gasPrices.formatted.maxPriorityFeePerGas}</span>
                  </div>
                )}
                
                {gasPrices.formatted.baseFee && (
                  <div>
                    <span className="font-medium">Base Fee:</span>
                    <span className="ml-2 text-blue-600">{gasPrices.formatted.baseFee}</span>
                  </div>
                )}
              </div>
            )}
            
            {analysis && (
              <div className={`mt-4 p-3 rounded ${
                analysis.level === 'low' ? 'bg-green-100 text-green-800' :
                analysis.level === 'normal' ? 'bg-blue-100 text-blue-800' :
                analysis.level === 'high' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                <div className="font-medium">Analysis: {analysis.level.toUpperCase()}</div>
                <div className="text-sm mt-1">{analysis.recommendation}</div>
                <div className="text-sm mt-1">Suggested buffer: {analysis.bufferSuggestion}%</div>
              </div>
            )}
          </div>
          
          {/* Network Status Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Network Status</h2>
              <button
                onClick={checkNetwork}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Refresh'}
              </button>
            </div>
            
            {networkStatus && (
              <div className="space-y-3">
                <div>
                  <span className="font-medium">Connected:</span>
                  <span className={`ml-2 ${networkStatus.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {networkStatus.isConnected ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">Network:</span>
                  <span className="ml-2 text-blue-600">{networkStatus.networkName}</span>
                </div>
                
                {networkStatus.chainId && (
                  <div>
                    <span className="font-medium">Chain ID:</span>
                    <span className="ml-2 text-blue-600">{networkStatus.chainId}</span>
                  </div>
                )}
                
                {networkStatus.blockNumber && (
                  <div>
                    <span className="font-medium">Block Number:</span>
                    <span className="ml-2 text-blue-600">{networkStatus.blockNumber}</span>
                  </div>
                )}
                
                {networkStatus.walletAddress && (
                  <div>
                    <span className="font-medium">Wallet:</span>
                    <span className="ml-2 text-blue-600 font-mono text-sm">
                      {networkStatus.walletAddress.slice(0, 6)}...{networkStatus.walletAddress.slice(-4)}
                    </span>
                  </div>
                )}
                
                {networkStatus.walletBalance && (
                  <div>
                    <span className="font-medium">Balance:</span>
                    <span className="ml-2 text-blue-600">{networkStatus.walletBalance}</span>
                  </div>
                )}
                
                <div>
                  <span className="font-medium">Wallet Connected:</span>
                  <span className={`ml-2 ${networkStatus.walletConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {networkStatus.walletConnected ? 'Yes' : 'No'}
                  </span>
                </div>
                
                {networkStatus.error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                    {networkStatus.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Debug Information</h3>
          <p className="text-sm text-gray-600">
            This page helps diagnose blockchain transaction issues by checking current gas prices and network connectivity.
            Use this information to adjust gas settings and identify potential problems.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default TestGasPage;