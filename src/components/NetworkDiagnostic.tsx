import React, { useState } from 'react';
import { checkNetworkStatus, submitReport } from '../lib/blockchain';
import { AlertCircle, CheckCircle, Wifi, WifiOff, TestTube } from 'lucide-react';

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
  retryCount?: number;
  lastAttempt?: number;
  errorType?: 'network' | 'provider' | 'wallet' | 'timeout' | 'unknown';
}

export function NetworkDiagnostic() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setStatus(null); // Clear previous status
    
    try {
      console.log('🔍 Starting network diagnostic...');
      const result = await checkNetworkStatus();
      setStatus(result);
      console.log('✅ Network diagnostic completed:', result);
      
      // Log specific issues if any
      if (result.error) {
        console.warn('⚠️ Diagnostic completed with warnings:', result.error);
      }
      if (!result.isConnected) {
        console.warn('🔌 Network connection issue detected');
      }
      if (!result.walletConnected) {
        console.info('👛 Wallet not connected (this is normal if no wallet is installed)');
      }
    } catch (error) {
      console.error('💥 Diagnostic failed completely:', error);
      
      // Determine error type for better user feedback
      let errorType: 'network' | 'provider' | 'wallet' | 'timeout' | 'unknown' = 'unknown';
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          errorType = 'timeout';
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          errorType = 'network';
        } else if (errorMessage.includes('provider') || errorMessage.includes('Provider')) {
          errorType = 'provider';
        } else if (errorMessage.includes('wallet') || errorMessage.includes('Wallet')) {
          errorType = 'wallet';
        }
      }
      
      setStatus({
        isConnected: false,
        chainId: 0,
        networkName: 'Unknown',
        blockNumber: 0,
        gasPrice: 'Unknown',
        walletConnected: false,
        error: errorMessage,
        errorType,
        lastAttempt: Date.now()
      });
    } finally {
      setLoading(false);
    }
  };

  const testTransaction = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      console.log('🧪 Starting test transaction...');
      // Create a minimal test report
      const testData = {
        title: 'Test Report',
        description: 'This is a test transaction to diagnose blockchain connectivity',
        category: 'Other',
        location: 'Test Location',
        timestamp: Date.now(),
        ipfsHash: 'test-ipfs-hash',
        isAnonymous: false
      };
      
      const result = await submitReport(
        testData,
        (step: string) => {
          console.log('Test transaction progress:', step);
        }
      );
      
      setTestResult(`✅ Test transaction successful! Hash: ${result}`);
      console.log('🎉 Test transaction completed:', result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setTestResult(`❌ Test transaction failed: ${errorMsg}`);
      console.error('💥 Test transaction failed:', error);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg border shadow-sm">
      <div className="p-6 pb-0">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {status?.isConnected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          Network Diagnostic
        </h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-3">
          <button 
            onClick={runDiagnostic} 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Running Diagnostic...' : 'Run Network Diagnostic'}
          </button>
          
          <button 
            onClick={testTransaction} 
            disabled={testLoading || !status?.walletConnected}
            className="w-full border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testLoading ? 'Testing Transaction...' : 'Test Blockchain Transaction'}
          </button>
        </div>

        {status && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Network Status</h3>
                <div className="flex items-center gap-2">
                  {status.isConnected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status.isConnected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {status.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Wallet Status</h3>
                <div className="flex items-center gap-2">
                  {status.walletConnected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status.walletConnected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {status.walletConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Network Details</h3>
              <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                <div><strong>Chain ID:</strong> {status.chainId}</div>
                <div><strong>Network:</strong> {status.networkName}</div>
                <div><strong>Block Number:</strong> {status.blockNumber}</div>
                <div><strong>Gas Price:</strong> {status.gasPrice}</div>
              </div>
            </div>

            {status.walletConnected && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Wallet Details</h3>
                <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                  <div><strong>Address:</strong> {status.walletAddress}</div>
                  <div><strong>Balance:</strong> {status.walletBalance}</div>
                </div>
              </div>
            )}

            {status.error && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-red-600">Error Details</h3>
                <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700 space-y-2">
                  <div className="font-medium">
                    {status.errorType === 'timeout' && '⏱️ Connection Timeout'}
                    {status.errorType === 'network' && '🌐 Network Error'}
                    {status.errorType === 'provider' && '🔌 Provider Error'}
                    {status.errorType === 'wallet' && '👛 Wallet Error'}
                    {status.errorType === 'unknown' && '❓ Unknown Error'}
                  </div>
                  <div>{status.error}</div>
                  {status.errorType === 'timeout' && (
                    <div className="text-xs mt-2 p-2 bg-yellow-50 text-yellow-700 rounded border">
                      💡 <strong>Troubleshooting Steps:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Check your internet connection</li>
                        <li>Try switching to a different network (WiFi/Mobile)</li>
                        <li>Wait a moment and try again - the network might be experiencing high traffic</li>
                        <li>For BlockDAG networks, timeouts are more common due to consensus mechanisms</li>
                      </ul>
                    </div>
                  )}
                  {status.errorType === 'provider' && (
                    <div className="text-xs mt-2 p-2 bg-blue-50 text-blue-700 rounded border">
                      💡 <strong>Provider Configuration Issues:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Install a Web3 wallet like MetaMask, Trust Wallet, or Coinbase Wallet</li>
                        <li>Check if your wallet is connected to the correct network</li>
                        <li>Verify RPC endpoint configuration in environment variables</li>
                        <li>For BlockDAG networks, ensure BLOCKDAG_TESTNET_RPC_URL is properly set</li>
                        <li>Try refreshing the page or reconnecting your wallet</li>
                      </ul>
                    </div>
                  )}
                  {status.errorType === 'network' && (
                    <div className="text-xs mt-2 p-2 bg-purple-50 text-purple-700 rounded border">
                      💡 <strong>Network Configuration Issues:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Verify you're connected to the correct blockchain network</li>
                        <li>Check if NEXT_PUBLIC_NETWORK environment variable matches supported networks</li>
                        <li>Supported networks: Polygon Amoy (testnet), Polygon Mainnet, BlockDAG Testnet/Mainnet</li>
                        <li>Update .env.local file with correct network configuration</li>
                        <li>Ensure RPC URLs are accessible and properly formatted</li>
                      </ul>
                    </div>
                  )}
                  {status.error?.includes('Failed to initialize network provider') && (
                    <div className="text-xs mt-2 p-2 bg-red-50 text-red-700 rounded border">
                      🚨 <strong>Provider Initialization Failed:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Check .env.local file for missing or invalid RPC URLs</li>
                        <li>Verify network configuration matches supported networks</li>
                        <li>Ensure environment variables are properly formatted (no 'undefined' or 'null' values)</li>
                        <li>For BlockDAG networks, confirm BLOCKDAG_TESTNET_RPC_URL and BLOCKDAG_MAINNET_RPC_URL are set</li>
                        <li>Try restarting the development server after configuration changes</li>
                      </ul>
                    </div>
                  )}
                  {status.error?.includes('mumbai') && (
                    <div className="text-xs mt-2 p-2 bg-orange-50 text-orange-700 rounded border">
                      ⚠️ <strong>Deprecated Network Configuration:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Mumbai testnet is no longer supported</li>
                        <li>Update NEXT_PUBLIC_NETWORK in .env.local to 'amoy' for Polygon testnet</li>
                        <li>Polygon Amoy is the current testnet replacement for Mumbai</li>
                        <li>Update your wallet to connect to Polygon Amoy network</li>
                      </ul>
                    </div>
                  )}
                  {status.error?.includes('Unknown network') && (
                    <div className="text-xs mt-2 p-2 bg-indigo-50 text-indigo-700 rounded border">
                      🔧 <strong>Network Not Recognized:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Check NEXT_PUBLIC_NETWORK value in .env.local</li>
                        <li>Supported values: 'amoy', 'polygon', 'blockdag_testnet', 'blockdag_mainnet'</li>
                        <li>Ensure the network is enabled in the configuration</li>
                        <li>Verify contract addresses are configured for the selected network</li>
                      </ul>
                    </div>
                  )}
                  {status.lastAttempt && (
                    <div className="text-xs text-gray-500 mt-1">
                      Last attempt: {new Date(status.lastAttempt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Test Transaction Result</h3>
            <div className={`p-3 rounded-lg text-sm ${
              testResult.includes('✅') 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {testResult}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NetworkDiagnostic;