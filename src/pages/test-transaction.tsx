import React, { useState } from 'react';
import Layout from '../components/Layout';
import { connectWallet, getProvider } from '../lib/blockchain';
import { ethers } from 'ethers';
import { toast } from 'sonner';

interface TransactionTest {
  type: 'balance' | 'simple_transfer' | 'gas_estimation';
  status: 'idle' | 'running' | 'success' | 'error';
  result?: string;
  error?: string;
  gasUsed?: string;
  transactionHash?: string;
}

const TestTransactionPage: React.FC = () => {
  const [tests, setTests] = useState<Record<string, TransactionTest>>({
    balance: { type: 'balance', status: 'idle' },
    gas_estimation: { type: 'gas_estimation', status: 'idle' },
    simple_transfer: { type: 'simple_transfer', status: 'idle' }
  });
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('0x0000000000000000000000000000000000000001');
  const [transferAmount, setTransferAmount] = useState<string>('0.001');

  const updateTest = (testId: string, updates: Partial<TransactionTest>) => {
    setTests(prev => ({
      ...prev,
      [testId]: { ...prev[testId], ...updates }
    }));
  };

  const testWalletConnection = async () => {
    updateTest('balance', { status: 'running', error: undefined, result: undefined });
    
    try {
      console.log('🔗 Testing wallet connection...');
      const signer = await connectWallet();
      const address = await signer.getAddress();
      const provider = getProvider();
      const balance = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balance);
      
      setWalletAddress(address);
      updateTest('balance', {
        status: 'success',
        result: `Address: ${address}\nBalance: ${balanceEth} ETH`
      });
      
      console.log('✅ Wallet connection successful:', { address, balance: balanceEth });
      toast.success('Wallet connected successfully');
    } catch (error: any) {
      console.error('❌ Wallet connection failed:', error);
      updateTest('balance', {
        status: 'error',
        error: error.message || 'Unknown error'
      });
      toast.error('Wallet connection failed');
    }
  };

  const testGasEstimation = async () => {
    updateTest('gas_estimation', { status: 'running', error: undefined, result: undefined });
    
    try {
      console.log('⛽ Testing gas estimation...');
      const signer = await connectWallet();
      const provider = getProvider();
      
      // Test gas estimation for a simple transfer
      const gasEstimate = await provider.estimateGas({
        to: recipientAddress,
        value: ethers.parseEther(transferAmount)
      });
      
      const feeData = await provider.getFeeData();
      const gasCost = gasEstimate * (feeData.gasPrice || BigInt(0));
      const gasCostEth = ethers.formatEther(gasCost);
      
      updateTest('gas_estimation', {
        status: 'success',
        result: `Gas Estimate: ${gasEstimate.toString()}\nGas Price: ${feeData.gasPrice?.toString() || 'N/A'}\nEstimated Cost: ${gasCostEth} ETH`
      });
      
      console.log('✅ Gas estimation successful:', {
        gasEstimate: gasEstimate.toString(),
        gasPrice: feeData.gasPrice?.toString(),
        gasCost: gasCostEth
      });
      toast.success('Gas estimation completed');
    } catch (error: any) {
      console.error('❌ Gas estimation failed:', error);
      updateTest('gas_estimation', {
        status: 'error',
        error: error.message || 'Unknown error'
      });
      toast.error('Gas estimation failed');
    }
  };

  const testSimpleTransaction = async () => {
    updateTest('simple_transfer', { status: 'running', error: undefined, result: undefined, transactionHash: undefined });
    
    try {
      console.log('💸 Testing simple transaction...');
      const signer = await connectWallet();
      
      // Send a very small amount to test transaction
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther(transferAmount),
        gasLimit: 21000 // Standard gas limit for simple transfer
      });
      
      console.log('📤 Transaction sent:', tx.hash);
      updateTest('simple_transfer', {
        status: 'running',
        result: `Transaction sent: ${tx.hash}\nWaiting for confirmation...`,
        transactionHash: tx.hash
      });
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        updateTest('simple_transfer', {
          status: 'success',
          result: `Transaction confirmed!\nHash: ${tx.hash}\nBlock: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed.toString()}`,
          gasUsed: receipt.gasUsed.toString()
        });
        console.log('✅ Transaction confirmed:', receipt);
        toast.success('Transaction confirmed!');
      } else {
        throw new Error('Transaction failed or reverted');
      }
    } catch (error: any) {
      console.error('❌ Transaction failed:', error);
      updateTest('simple_transfer', {
        status: 'error',
        error: error.message || 'Unknown error'
      });
      toast.error('Transaction failed');
    }
  };

  const getStatusColor = (status: TransactionTest['status']) => {
    switch (status) {
      case 'running': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: TransactionTest['status']) => {
    switch (status) {
      case 'running': return '🔄';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '⏸️';
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Blockchain Transaction Tests</h1>
        
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          <p className="font-medium">⚠️ Test Environment</p>
          <p className="text-sm mt-1">
            These tests will perform actual blockchain transactions. Make sure you're on a testnet and have sufficient funds.
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Address (for transfer test)
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Amount (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.001"
              />
            </div>
          </div>
          {walletAddress && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Connected Wallet:</span> {walletAddress}
              </p>
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className="space-y-6">
          {/* Wallet Connection Test */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                {getStatusIcon(tests.balance.status)} Wallet Connection Test
              </h3>
              <button
                onClick={testWalletConnection}
                disabled={tests.balance.status === 'running'}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {tests.balance.status === 'running' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            
            <div className={`text-sm ${getStatusColor(tests.balance.status)}`}>
              Status: {tests.balance.status.toUpperCase()}
            </div>
            
            {tests.balance.result && (
              <div className="mt-3 p-3 bg-green-50 rounded">
                <pre className="text-sm text-green-800 whitespace-pre-wrap">{tests.balance.result}</pre>
              </div>
            )}
            
            {tests.balance.error && (
              <div className="mt-3 p-3 bg-red-50 rounded">
                <p className="text-sm text-red-800">{tests.balance.error}</p>
              </div>
            )}
          </div>

          {/* Gas Estimation Test */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                {getStatusIcon(tests.gas_estimation.status)} Gas Estimation Test
              </h3>
              <button
                onClick={testGasEstimation}
                disabled={tests.gas_estimation.status === 'running'}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {tests.gas_estimation.status === 'running' ? 'Testing...' : 'Test Gas Estimation'}
              </button>
            </div>
            
            <div className={`text-sm ${getStatusColor(tests.gas_estimation.status)}`}>
              Status: {tests.gas_estimation.status.toUpperCase()}
            </div>
            
            {tests.gas_estimation.result && (
              <div className="mt-3 p-3 bg-green-50 rounded">
                <pre className="text-sm text-green-800 whitespace-pre-wrap">{tests.gas_estimation.result}</pre>
              </div>
            )}
            
            {tests.gas_estimation.error && (
              <div className="mt-3 p-3 bg-red-50 rounded">
                <p className="text-sm text-red-800">{tests.gas_estimation.error}</p>
              </div>
            )}
          </div>

          {/* Simple Transaction Test */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                {getStatusIcon(tests.simple_transfer.status)} Simple Transaction Test
              </h3>
              <button
                onClick={testSimpleTransaction}
                disabled={tests.simple_transfer.status === 'running'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {tests.simple_transfer.status === 'running' ? 'Testing...' : 'Test Transaction'}
              </button>
            </div>
            
            <div className={`text-sm ${getStatusColor(tests.simple_transfer.status)}`}>
              Status: {tests.simple_transfer.status.toUpperCase()}
            </div>
            
            {tests.simple_transfer.result && (
              <div className="mt-3 p-3 bg-green-50 rounded">
                <pre className="text-sm text-green-800 whitespace-pre-wrap">{tests.simple_transfer.result}</pre>
              </div>
            )}
            
            {tests.simple_transfer.error && (
              <div className="mt-3 p-3 bg-red-50 rounded">
                <p className="text-sm text-red-800">{tests.simple_transfer.error}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Debug Information</h3>
          <p className="text-sm text-gray-600">
            This page tests basic blockchain functionality to isolate transaction issues.
            Run tests in order: Connection → Gas Estimation → Transaction.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default TestTransactionPage;