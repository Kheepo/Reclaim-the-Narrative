import React, { useState, useEffect } from 'react';
import { checkNetworkStatus } from '../lib/blockchain';
import Layout from '../components/Layout';

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

export default function DebugBlockchain() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkNetwork = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Starting network diagnostic check...');
      const status = await checkNetworkStatus();
      console.log('📊 Network status result:', status);
      setNetworkStatus(status);
    } catch (err: any) {
      console.error('❌ Network check failed:', err);
      setError(err.message || 'Failed to check network status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkNetwork();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              Blockchain Network Diagnostic
            </h1>
            
            <div className="mb-6">
              <button
                onClick={checkNetwork}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md font-medium"
              >
                {loading ? 'Checking...' : 'Refresh Network Status'}
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            )}

            {networkStatus && (
              <div className="space-y-6">
                {/* Network Connection Status */}
                <div className="border rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-3 flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${
                      networkStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}></span>
                    Network Connection
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 ${
                        networkStatus.isConnected ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {networkStatus.isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Chain ID:</span>
                      <span className="ml-2">{networkStatus.chainId}</span>
                    </div>
                    <div>
                      <span className="font-medium">Network:</span>
                      <span className="ml-2">{networkStatus.networkName}</span>
                    </div>
                    <div>
                      <span className="font-medium">Block Number:</span>
                      <span className="ml-2">{networkStatus.blockNumber}</span>
                    </div>
                  </div>
                </div>

                {/* Gas Price Information */}
                <div className="border rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-3">⛽ Gas Information</h2>
                  <div>
                    <span className="font-medium">Current Gas Price:</span>
                    <span className="ml-2 font-mono">{networkStatus.gasPrice}</span>
                    {networkStatus.gasPrice !== 'Unknown' && (
                      <span className="ml-2 text-gray-600">
                        ({(parseInt(networkStatus.gasPrice) / 1e9).toFixed(2)} Gwei)
                      </span>
                    )}
                  </div>
                </div>

                {/* Wallet Status */}
                <div className="border rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-3 flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${
                      networkStatus.walletConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}></span>
                    Wallet Status
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Connection:</span>
                      <span className={`ml-2 ${
                        networkStatus.walletConnected ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {networkStatus.walletConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    {networkStatus.walletAddress && (
                      <div>
                        <span className="font-medium">Address:</span>
                        <span className="ml-2 font-mono text-sm break-all">
                          {networkStatus.walletAddress}
                        </span>
                      </div>
                    )}
                    {networkStatus.walletBalance && (
                      <div>
                        <span className="font-medium">Balance:</span>
                        <span className={`ml-2 font-mono ${
                          parseFloat(networkStatus.walletBalance) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {networkStatus.walletBalance}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Diagnostic Summary */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h2 className="text-lg font-semibold mb-3">🔍 Diagnostic Summary</h2>
                  <div className="space-y-2">
                    {!networkStatus.isConnected && (
                      <div className="text-red-600">❌ Network connection failed</div>
                    )}
                    {!networkStatus.walletConnected && (
                      <div className="text-yellow-600">⚠️ Wallet not connected</div>
                    )}
                    {networkStatus.walletConnected && networkStatus.walletBalance && 
                     parseFloat(networkStatus.walletBalance) === 0 && (
                      <div className="text-red-600">❌ Wallet has zero balance</div>
                    )}
                    {networkStatus.gasPrice === 'Unknown' && (
                      <div className="text-yellow-600">⚠️ Unable to determine gas price</div>
                    )}
                    {networkStatus.isConnected && networkStatus.walletConnected && 
                     networkStatus.walletBalance && parseFloat(networkStatus.walletBalance) > 0 && (
                      <div className="text-green-600">✅ All systems appear operational</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}