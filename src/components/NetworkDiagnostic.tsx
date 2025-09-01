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
}

export function NetworkDiagnostic() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const result = await checkNetworkStatus();
      setStatus(result);
      console.log('Network diagnostic result:', result);
    } catch (error) {
      console.error('Diagnostic failed:', error);
      setStatus({
        isConnected: false,
        chainId: 0,
        networkName: 'Unknown',
        blockNumber: 0,
        gasPrice: 'Unknown',
        walletConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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
                <h3 className="font-semibold text-sm text-red-600">Error</h3>
                <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700">
                  {status.error}
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