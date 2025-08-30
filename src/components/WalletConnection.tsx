/**
 * Wallet connection component for MetaMask and WalletConnect integration
 */

import React, { useState, useEffect } from 'react';
import { 
  WalletIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  GlobeAltIcon,
  SignalIcon,
  ChevronDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { 
  connectWallet, 
  switchNetwork, 
  addNetwork, 
  isWalletConnected,
  getCurrentWalletAddress,
  getCurrentNetwork,
  isWalletConnecting,
  resetConnectionState,
  WalletError,
  NetworkError,
  ProviderError
} from '../lib/blockchain';

export interface WalletConnectionProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  onNetworkChange?: (networkId: number) => void;
  className?: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  networkId: number | null;
  networkName: string | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  error: string | null;
}

const SUPPORTED_NETWORKS = {
  137: {
    name: 'Polygon Mainnet',
    shortName: 'Polygon',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
    isTestnet: false
  },
  80001: {
    name: 'Polygon Mumbai',
    shortName: 'Mumbai',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
    isTestnet: true
  }
};

export default function WalletConnection({
  onConnect,
  onDisconnect,
  onNetworkChange,
  className = ''
}: WalletConnectionProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    networkId: null,
    networkName: null,
    isCorrectNetwork: false,
    isConnecting: false,
    error: null
  });

  const [showNetworkModal, setShowNetworkModal] = useState(false);

  // Check wallet connection on component mount
  useEffect(() => {
    checkWalletConnection();
    setupEventListeners();
    
    return () => {
      removeEventListeners();
      // Reset connection state on unmount to prevent stuck states
      if (walletState.isConnecting) {
        resetConnectionState();
      }
    };
  }, []);

  // Check if wallet is already connected
  const checkWalletConnection = async () => {
    try {
      const connected = await isWalletConnected();
      if (connected) {
        const address = await getCurrentWalletAddress();
        const currentNetwork = getCurrentNetwork();
        
        const isCorrectNetwork = currentNetwork.chainId === 137 || currentNetwork.chainId === 80001;
        
        setWalletState({
          isConnected: true,
          address,
          networkId: currentNetwork.chainId,
          networkName: currentNetwork.name,
          isCorrectNetwork,
          isConnecting: false,
          error: null
        });
        
        if (onConnect && address) {
          onConnect(address);
        }
        
        if (onNetworkChange) {
          onNetworkChange(currentNetwork.chainId);
        }
      }
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
    }
  };

  // Setup event listeners for wallet events
  const setupEventListeners = () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);
    }
  };

  // Remove event listeners
  const removeEventListeners = () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    }
  };

  // Handle account changes
  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      // User disconnected
      setWalletState(prev => ({
        ...prev,
        isConnected: false,
        address: null,
        networkId: null,
        networkName: null,
        isCorrectNetwork: false,
        error: null
      }));
      
      // Close any open modals
      setShowNetworkModal(false);
      
      if (onDisconnect) {
        onDisconnect();
      }
    } else {
      // Account changed - update connection state
      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        address: accounts[0],
        error: null
      }));
      
      if (onConnect) {
        onConnect(accounts[0]);
      }
    }
  };

  // Handle network changes
  const handleChainChanged = (chainId: string) => {
    const networkId = parseInt(chainId, 16);
    const networkInfo = SUPPORTED_NETWORKS[networkId as keyof typeof SUPPORTED_NETWORKS];
    const networkName = networkInfo?.name || 'Unknown Network';
    const isCorrectNetwork = networkId === 137 || networkId === 80001;
    
    setWalletState(prev => ({
      ...prev,
      networkId,
      networkName,
      isCorrectNetwork,
      error: isCorrectNetwork ? null : 'Please switch to Polygon network'
    }));
    
    if (onNetworkChange) {
      onNetworkChange(networkId);
    }
  };

  // Handle wallet disconnect
  const handleDisconnect = () => {
    // Reset connection state to ensure clean disconnect
    resetConnectionState();
    
    setWalletState({
      isConnected: false,
      address: null,
      networkId: null,
      networkName: null,
      isCorrectNetwork: false,
      isConnecting: false,
      error: null
    });
    
    // Close any open modals
    setShowNetworkModal(false);
    
    if (onDisconnect) {
      onDisconnect();
    }
  };

  // Connect to MetaMask
  const handleConnect = async () => {
    if (!window.ethereum) {
      setWalletState(prev => ({
        ...prev,
        error: 'MetaMask is not installed. Please install MetaMask to continue.'
      }));
      return;
    }

    // Check if a connection is already in progress globally
    if (isWalletConnecting()) {
      setWalletState(prev => ({
        ...prev,
        error: 'Connection request is already pending. Please check your wallet and approve the request, or wait for it to timeout.'
      }));
      return;
    }
    
    // Check if already connecting locally
    if (walletState.isConnecting) {
      return;
    }

    // Reset any previous error states before attempting connection
    setWalletState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null,
      isConnected: false,
      address: null
    }));

    try {
      const signer = await connectWallet();
      const address = await signer.getAddress();
      const currentNetwork = getCurrentNetwork();
      
      const isCorrectNetwork = currentNetwork.chainId === 137 || currentNetwork.chainId === 80001;
      
      const networkInfo = SUPPORTED_NETWORKS[currentNetwork.chainId as keyof typeof SUPPORTED_NETWORKS];
      
      setWalletState({
        isConnected: true,
        address,
        networkId: currentNetwork.chainId,
        networkName: networkInfo?.name || currentNetwork.name,
        isCorrectNetwork,
        isConnecting: false,
        error: isCorrectNetwork ? null : 'Please switch to Polygon network'
      });
      
      if (onConnect) {
        onConnect(address);
      }
      
      if (onNetworkChange) {
        onNetworkChange(currentNetwork.chainId);
      }
      
      // Show network modal if not on correct network
      if (!isCorrectNetwork) {
        setShowNetworkModal(true);
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      // Handle specific error types with user-friendly messages
      let errorMessage = 'Failed to connect wallet';
      let errorCode = 'UNKNOWN';
      
      if (error?.name === 'ProviderError') {
        errorMessage = error.message;
        errorCode = 'PROVIDER_ERROR';
      } else if (error?.name === 'WalletError') {
        switch (error.code) {
          case 'USER_REJECTED':
            errorMessage = 'Connection was rejected. Please try again and approve the connection in your wallet.';
            break;
          case 'REQUEST_PENDING':
            errorMessage = 'A connection request is already pending. Please check your wallet and approve the request.';
            break;
          case 'NO_ACCOUNTS':
            errorMessage = 'No accounts found. Please make sure your wallet is unlocked and has at least one account.';
            break;
          case 'CONNECTION_INVALID':
            errorMessage = 'Wallet connection is invalid. Please try reconnecting your wallet.';
            break;
          case 'INTERNAL_ERROR':
            errorMessage = 'An internal wallet error occurred. Please try again or restart your wallet.';
            break;
          default:
            errorMessage = error.message || 'An unknown wallet error occurred.';
        }
        errorCode = error.code || 'WALLET_ERROR';
      } else if (error?.name === 'NetworkError') {
        errorMessage = `Network error: ${error.message}. Please check your internet connection and try again.`;
        errorCode = 'NETWORK_ERROR';
      } else if (error instanceof Error) {
        // Legacy error handling for backward compatibility
        if (error.message.includes('User rejected')) {
          errorMessage = 'Connection was rejected by user';
          errorCode = 'USER_REJECTED';
        } else if (error.message.includes('MetaMask not detected')) {
          errorMessage = 'MetaMask is not installed or not available';
          errorCode = 'NO_PROVIDER';
        } else if (error.message.includes('network')) {
          errorMessage = `Network error: ${error.message}`;
          errorCode = 'NETWORK_ERROR';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Log detailed error information for debugging
      console.error('Wallet connection error details:', {
        errorType: error?.name || 'Unknown',
        errorCode: errorCode,
        errorMessage: errorMessage,
        originalError: error
      });
      
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        address: null,
        error: errorMessage
      }));
    }
  };

  // Switch to Polygon network
  const handleSwitchNetwork = async () => {
    try {
      const currentNetwork = getCurrentNetwork();
      await switchNetwork(currentNetwork.chainId);
      setShowNetworkModal(false);
    } catch (error) {
      console.error('Failed to switch network:', error);
      
      // Try to add Polygon network if switching failed
      try {
        const currentNetwork = getCurrentNetwork();
        await addNetwork(currentNetwork);
        setShowNetworkModal(false);
      } catch (addError) {
        console.error('Failed to add Polygon network:', addError);
        setWalletState(prev => ({
          ...prev,
          error: 'Failed to switch to Polygon network. Please switch manually.'
        }));
      }
    }
  };

  // Disconnect wallet
  const handleDisconnectWallet = () => {
    handleDisconnect();
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkInfo = () => {
    if (!walletState.networkId) return null;
    return SUPPORTED_NETWORKS[walletState.networkId as keyof typeof SUPPORTED_NETWORKS];
  };

  const networkInfo = getNetworkInfo();

  return (
    <div className={`wallet-connection ${className}`}>
      {/* Connection Status */}
      {walletState.isConnected ? (
        <div className="flex items-center space-x-3">
          {/* Wallet Address */}
          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
            <div className="relative">
              <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <span className="text-sm font-medium text-white">
              {formatAddress(walletState.address!)}
            </span>
          </div>
          
          {/* Network Status */}
          {walletState.isCorrectNetwork && networkInfo ? (
            <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border ${networkInfo.bgColor} ${networkInfo.textColor} ${networkInfo.borderColor} backdrop-blur-sm`}>
              <div className="relative flex items-center">
                <div className={`w-2 h-2 ${networkInfo.dotColor} rounded-full`}></div>
                <div className={`absolute w-2 h-2 ${networkInfo.dotColor} rounded-full animate-ping`}></div>
              </div>
              <GlobeAltIcon className="h-4 w-4" />
              <span className="text-xs font-medium">
                {networkInfo.shortName}
                {networkInfo.isTestnet && (
                  <span className="ml-1 text-xs opacity-75">(Testnet)</span>
                )}
              </span>
              <SignalIcon className="h-3 w-3 opacity-75" />
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg border bg-red-100 text-red-800 border-red-200 backdrop-blur-sm">
              <div className="relative flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
              </div>
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span className="text-xs font-medium">Wrong Network</span>
            </div>
          )}
          
          {/* Disconnect Button */}
          <button
            onClick={handleDisconnectWallet}
            className="text-sm text-white/70 hover:text-white transition-colors duration-200 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={walletState.isConnecting || isWalletConnecting()}
          className="group relative inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
          <div className="relative flex items-center">
            {(walletState.isConnecting || isWalletConnecting()) ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <WalletIcon className="h-4 w-4 mr-2" />
            )}
            {(walletState.isConnecting || isWalletConnecting()) ? 'Connecting...' : 'Connect Wallet'}
          </div>
        </button>
      )}

      {/* Error Message */}
      {walletState.error && (
        <div className="mt-3 flex items-center space-x-3 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-lg">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{walletState.error}</p>
          </div>
        </div>
      )}

      {/* Network Switch Modal */}
      {showNetworkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-[9999] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowNetworkModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            
            <div className="p-6">
              {/* Icon and Title */}
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
                  <ExclamationTriangleIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Switch to Polygon Network
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  This application requires the Polygon network. Please switch your wallet to continue.
                </p>
              </div>

              {/* Supported Networks */}
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Supported Networks:</h4>
                {Object.entries(SUPPORTED_NETWORKS).map(([chainId, network]) => (
                  <div key={chainId} className={`flex items-center space-x-3 p-3 rounded-lg border ${network.bgColor} ${network.borderColor}`}>
                    <div className={`w-3 h-3 ${network.dotColor} rounded-full`}></div>
                    <GlobeAltIcon className={`h-4 w-4 ${network.textColor}`} />
                    <span className={`text-sm font-medium ${network.textColor}`}>
                      {network.name}
                      {network.isTestnet && (
                        <span className="ml-1 text-xs opacity-75">(Testnet)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleSwitchNetwork}
                  className="w-full group relative px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-base font-medium rounded-xl shadow-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
                  <div className="relative flex items-center justify-center">
                    <GlobeAltIcon className="h-5 w-5 mr-2" />
                    Switch to Polygon
                  </div>
                </button>
                <button
                  onClick={() => setShowNetworkModal(false)}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 text-base font-medium rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for using wallet connection state
export function useWalletConnection() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    networkId: null,
    networkName: null,
    isCorrectNetwork: false,
    isConnecting: false,
    error: null
  });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await isWalletConnected();
        if (connected) {
          const address = await getCurrentWalletAddress();
          const currentNetwork = getCurrentNetwork();
          const networkInfo = SUPPORTED_NETWORKS[currentNetwork.chainId as keyof typeof SUPPORTED_NETWORKS];
          
          setWalletState({
            isConnected: true,
            address,
            networkId: currentNetwork.chainId,
            networkName: networkInfo?.name || currentNetwork.name,
            isCorrectNetwork: currentNetwork.chainId === 137 || currentNetwork.chainId === 80001,
            isConnecting: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    };

    checkConnection();
  }, []);

  return walletState;
}