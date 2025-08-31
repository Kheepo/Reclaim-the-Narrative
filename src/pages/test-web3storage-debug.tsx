import React, { useState } from 'react';
import * as Client from '@storacha/client';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
  error?: any;
  timestamp: string;
}

interface NetworkLog {
  url: string;
  method?: string;
  status?: number;
  ok?: boolean;
  error?: string;
  timestamp: string;
}

export default function TestWeb3StorageDebug() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);

  const addResult = (step: string, success: boolean, message: string, data?: any, error?: any) => {
    const result: TestResult = {
      step,
      success,
      message,
      data,
      error,
      timestamp: new Date().toISOString()
    };
    setResults(prev => [...prev, result]);
    console.log(`[Debug Test] ${step}: ${success ? '✅' : '❌'} ${message}`, data || error);
  };

  const addNetworkLog = (log: NetworkLog) => {
    setNetworkLogs(prev => [...prev, log]);
    console.log(`[Network] ${log.method || 'RESPONSE'} ${log.url}`, log);
  };

  const setupNetworkMonitoring = () => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      
      addNetworkLog({
        url: url.toString(),
        method,
        timestamp: new Date().toISOString()
      });
      
      try {
        const response = await originalFetch(...args);
        
        addNetworkLog({
          url: url.toString(),
          status: response.status,
          ok: response.ok,
          timestamp: new Date().toISOString()
        });
        
        return response;
      } catch (error) {
        addNetworkLog({
          url: url.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  };

  const runComprehensiveTest = async () => {
    if (!email) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    setResults([]);
    setNetworkLogs([]);
    
    const restoreFetch = setupNetworkMonitoring();
    
    try {
      // Step 1: Email validation
      addResult('Email Validation', true, `Testing email format: ${email}`);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        addResult('Email Validation', false, 'Invalid email format');
        return;
      }
      addResult('Email Validation', true, 'Email format is valid');
      
      // Step 2: Client creation
      addResult('Client Creation', true, 'Creating Web3.Storage client...');
      let client;
      try {
        client = await Client.create();
        addResult('Client Creation', true, 'Client created successfully', { clientType: typeof client });
      } catch (error) {
        addResult('Client Creation', false, 'Failed to create client', null, error);
        return;
      }
      
      // Step 3: Check initial account status
      addResult('Initial Status Check', true, 'Checking initial account status...');
      try {
        const initialAccounts = client.accounts();
        const accountCount = Object.keys(initialAccounts).length;
        addResult('Initial Status Check', true, `Found ${accountCount} existing accounts`, { accounts: Object.keys(initialAccounts) });
      } catch (error) {
        addResult('Initial Status Check', false, 'Failed to check initial accounts', null, error);
      }
      
      // Step 4: Attempt login/email verification
      addResult('Email Login Attempt', true, `Attempting to send verification email to: ${email}`);
      try {
        const account = await client.login(email as `${string}@${string}`);
        addResult('Email Login Attempt', true, 'Login call completed successfully', { 
          accountType: typeof account,
          accountMethods: Object.getOwnPropertyNames(account)
        });
        
        // Step 5: Check account status after login attempt
        addResult('Post-Login Status Check', true, 'Checking account status after login attempt...');
        try {
          const postLoginAccounts = client.accounts();
          const postAccountCount = Object.keys(postLoginAccounts).length;
          addResult('Post-Login Status Check', true, `Found ${postAccountCount} accounts after login`, { 
            accounts: Object.keys(postLoginAccounts),
            accountDetails: postLoginAccounts
          });
        } catch (error) {
          addResult('Post-Login Status Check', false, 'Failed to check post-login accounts', null, error);
        }
        
        // Step 6: Check spaces
        addResult('Spaces Check', true, 'Checking available spaces...');
        try {
          const spaces = client.spaces();
          addResult('Spaces Check', true, `Found ${spaces.length} spaces`, { 
            spacesCount: spaces.length,
            spaces: spaces.map(s => ({ name: s.name, did: s.did() }))
          });
        } catch (error) {
          addResult('Spaces Check', false, 'Failed to check spaces', null, error);
        }
        
      } catch (loginError) {
        addResult('Email Login Attempt', false, 'Login attempt failed', null, loginError);
        
        // Analyze the specific error
        if (loginError instanceof Error) {
          if (loginError.message.includes('rate limit')) {
            addResult('Error Analysis', true, 'Rate limit detected - too many requests');
          } else if (loginError.message.includes('network') || loginError.message.includes('fetch')) {
            addResult('Error Analysis', true, 'Network error detected - connectivity issue');
          } else if (loginError.message.includes('invalid email')) {
            addResult('Error Analysis', true, 'Invalid email error detected');
          } else if (loginError.message.includes('already exists')) {
            addResult('Error Analysis', true, 'Account already exists error detected');
          } else {
            addResult('Error Analysis', true, `Unknown error type: ${loginError.message}`);
          }
        }
      }
      
      // Step 7: Final status summary
      addResult('Test Summary', true, 'Comprehensive test completed', {
        totalNetworkRequests: networkLogs.length,
        networkErrors: networkLogs.filter(log => log.error).length,
        successfulRequests: networkLogs.filter(log => log.ok).length
      });
      
    } catch (error) {
      addResult('Test Execution', false, 'Test execution failed', null, error);
    } finally {
      restoreFetch();
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🔍 Web3.Storage Debug Test
          </h1>
          
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address for Testing
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email to test Web3.Storage setup"
              disabled={loading}
            />
          </div>
          
          <button
            onClick={runComprehensiveTest}
            disabled={loading || !email}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Running Comprehensive Test...' : 'Run Debug Test'}
          </button>
          
          {results.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Test Results</h2>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        {result.success ? '✅' : '❌'} {result.step}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{result.message}</p>
                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-blue-600">View Data</summary>
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                    {result.error && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-red-600">View Error</summary>
                        <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(result.error, Object.getOwnPropertyNames(result.error), 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {networkLogs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Network Activity</h2>
              <div className="bg-gray-100 p-4 rounded-lg max-h-60 overflow-y-auto">
                {networkLogs.map((log, index) => (
                  <div key={index} className="text-xs font-mono mb-1">
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span className="ml-2">
                      {log.method && `${log.method} `}
                      {log.url}
                      {log.status && ` (${log.status})`}
                      {log.error && ` ERROR: ${log.error}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}