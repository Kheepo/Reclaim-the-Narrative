import React, { useState } from 'react';
import { setupWeb3Storage, checkWeb3StorageStatus } from '../lib/ipfs';

const TestWeb3Storage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    console.log('[TEST]', message);
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const handleSetup = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    setError(null);
    setStatus('setting-up');
    addLog(`Starting Web3.Storage setup for email: ${email}`);

    try {
      const result = await setupWeb3Storage(email);
      addLog(`Setup result: ${JSON.stringify(result)}`);
      
      if (result.success) {
        setStatus('setup-complete');
        addLog('Setup completed successfully');
      } else {
        setStatus('setup-failed');
        addLog(`Setup failed: ${result.message}`);
        setError(result.message || 'Setup failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Setup error: ${errorMessage}`);
      setError(errorMessage);
      setStatus('setup-failed');
    }
  };

  const handleCheckStatus = async () => {
    setStatus('checking');
    addLog('Checking Web3.Storage status...');

    try {
      const result = await checkWeb3StorageStatus();
      addLog(`Status check result: ${JSON.stringify(result)}`);
      
      if (result.configured) {
        setStatus('configured');
        addLog('Web3.Storage is properly configured');
      } else {
        setStatus('not-configured');
        addLog(`Status check failed: ${result.error || 'Not configured'}`);
        setError(result.error || 'Status check failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Status check error: ${errorMessage}`);
      setError(errorMessage);
      setStatus('check-failed');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Web3.Storage Test Page</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Setup Web3.Storage</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email address"
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleSetup}
                disabled={status === 'setting-up' || !email}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'setting-up' ? 'Setting up...' : 'Setup Web3.Storage'}
              </button>
              
              <button
                onClick={handleCheckStatus}
                disabled={status === 'checking'}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'checking' ? 'Checking...' : 'Check Status'}
              </button>
              
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Clear Logs
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              Status: <span className="font-medium">{status}</span>
            </div>
            
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          
          <div className="bg-gray-100 rounded p-4 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 italic">No logs yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-gray-800">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestWeb3Storage;