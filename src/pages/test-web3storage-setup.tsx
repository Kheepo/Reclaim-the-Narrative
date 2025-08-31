import React, { useState } from 'react';
import { setupWeb3Storage } from '../lib/ipfs';

const TestWeb3StorageSetup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    if (!email) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    setResult(null);
    
    console.log('[Test] ========================================');
    console.log('[Test] Starting Web3.Storage setup with email:', email);
    console.log('[Test] ========================================');
    
    // Monitor network requests
    const originalFetch = window.fetch;
    const networkLogs: any[] = [];
    
    window.fetch = async (...args) => {
      const [url, options] = args;
      console.log('[Test] Network Request:', { url, method: options?.method || 'GET' });
      networkLogs.push({ url, method: options?.method || 'GET', timestamp: new Date().toISOString() });
      
      try {
        const response = await originalFetch(...args);
        console.log('[Test] Network Response:', { url, status: response.status, ok: response.ok });
        networkLogs.push({ url, status: response.status, ok: response.ok, timestamp: new Date().toISOString() });
        return response;
      } catch (error) {
        console.error('[Test] Network Error:', { url, error: error.message });
        networkLogs.push({ url, error: error.message, timestamp: new Date().toISOString() });
        throw error;
      }
    };
    
    try {
      const setupResult = await setupWeb3Storage(email);
      console.log('[Test] ========================================');
      console.log('[Test] Setup result:', setupResult);
      console.log('[Test] Network logs:', networkLogs);
      console.log('[Test] ========================================');
      
      setResult({ 
        ...setupResult, 
        networkLogs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Test] ========================================');
      console.error('[Test] Setup error:', error);
      console.error('[Test] Network logs:', networkLogs);
      console.error('[Test] ========================================');
      
      setResult({ 
        success: false, 
        message: `Error: ${error}`, 
        error: true,
        networkLogs,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Restore original fetch
      window.fetch = originalFetch;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Test Web3.Storage Setup</h1>
        
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
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          
          <button
            onClick={handleSetup}
            disabled={loading || !email}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up...' : 'Setup Web3.Storage'}
          </button>
        </div>
        
        {result && (
          <div className={`mt-6 p-4 rounded-md ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`font-medium ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? 'Success' : 'Error'}
            </h3>
            <p className={`mt-1 text-sm ${
              result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.message}
            </p>
            
            {result.timestamp && (
              <p className="text-sm text-gray-500 mt-2">Timestamp: {result.timestamp}</p>
            )}
            
            {result.networkLogs && result.networkLogs.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2">Network Activity:</h4>
                <div className="bg-gray-100 p-3 rounded text-xs max-h-40 overflow-y-auto">
                  {result.networkLogs.map((log: any, index: number) => (
                    <div key={index} className="mb-1">
                      <span className="font-mono">
                        {log.timestamp} - {log.method || 'RESPONSE'} {log.url}
                        {log.status && ` (${log.status})`}
                        {log.error && ` ERROR: ${log.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {result.needsVerification && (
              <p className="mt-2 text-sm text-blue-700">
                ✉️ Check your email for verification link
              </p>
            )}
            
            {result.error && (
              <p className="text-red-600 mt-2">Check console for detailed logs</p>
            )}
            
            <details className="mt-2">
              <summary className={`text-xs cursor-pointer ${
                result.success ? 'text-green-600' : 'text-red-600'
              }`}>
                Raw Result
              </summary>
              <pre className={`mt-1 text-xs overflow-auto ${
                result.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
        
        <div className="mt-6 text-center">
          <a 
            href="/submit" 
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Submit Report
          </a>
        </div>
      </div>
    </div>
  );
};

export default TestWeb3StorageSetup;