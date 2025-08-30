/**
 * Wallet connection component for MetaMask and WalletConnect integration
 * Updated to use the new useWallet hook and support BlockDAG networks
 */

import React, { useState, useEffect } from 'react';
import { 
  WalletIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  GlobeAltIcon,
  SignalIcon,
  ChevronDownIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useWallet } from '../hooks/useWallet';
import { getEnabledNetworks, isBlockDAGNetwork, type SupportedNetwork } from '../config/networks';
import { toast } from 'sonner';

export interface WalletConnectionProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  onNetworkChange?: (networkId: number) => void;
  className?: string;
  showNetworkSwitcher?: boolean;
}

// Helper function to get network display info
function getNetworkDisplayInfo(network: SupportedNetwork) {
  const isBlockDAG = network.type === 'blockdag';
  const isTestnet = network.testnet;
  
  if (isBlockDAG) {
    return {
      shortName: isTestnet ? 'BlockDAG Test' : 'BlockDAG',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      textColor: 'text-purple-800 dark:text-purple-200',
      borderColor: 'border-purple-200 dark:border-purple-700',
      dotColor: 'bg-purple-500',
      icon: SparklesIcon
    };
  }
  
  if (network.name.toLowerCase().includes('polygon')) {
    return {
      shortName: isTestnet ? 'Mumbai' : 'Polygon',
      bgColor: isTestnet ? 'bg-orange-100 dark:bg-orange-900' : 'bg-purple-100 dark:bg-purple-900',
      textColor: isTestnet ? 'text-orange-800 dark:text-orange-200' : 'text-purple-800 dark:text-purple-200',
      borderColor: isTestnet ? 'border-orange-200 dark:border-orange-700' : 'border-purple-200 dark:border-purple-700',
      dotColor: isTestnet ? 'bg-orange-500' : 'bg-purple-500',
      icon: GlobeAltIcon
    };
  }
  
  // Default for other networks
  return {
    shortName: network.displayName,
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-800 dark:text-blue-200',
    borderColor: 'border-blue-200 dark:border-blue-700',
    dotColor: 'bg-blue-500',
    icon: GlobeAltIcon
  };
}

export default function WalletConnection({
  onConnect,
  onDisconnect,
  onNetworkChange,
  className = '',
  showNetworkSwitcher = true
}: WalletConnectionProps) {
  const {
    isConnected,
    address,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    currentNetwork
  } = useWallet();
  
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const enabledNetworks = getEnabledNetworks();

  // Check wallet connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setIsCheckingConnection(true);
        // The useWallet hook handles connection checking automatically
        if (isConnected && address) {
          onConnect?.(address);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        toast.error('Failed to check wallet connection');
      } finally {
        setIsCheckingConnection(false);
      }
    };
    
    checkConnection();
  }, [isConnected, address, onConnect]);

  // Handle network changes
  useEffect(() => {
    if (chainId) {
      onNetworkChange?.(chainId);
    }
  }, [chainId, onNetworkChange]);

  // Handle disconnect
  useEffect(() => {
    if (!isConnected && address === null) {
      onDisconnect?.();
    }
  }, [isConnected, address, onDisconnect]);

  // Connect to wallet
  const handleConnect = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        toast.error('MetaMask is not installed. Please install MetaMask to continue.');
        return;
      }
      
      const result = await connect();
      
      if (result.success && result.address) {
        toast.success('Wallet connected successfully!');
        onConnect?.(result.address);
      } else {
        toast.error(result.error || 'Failed to connect wallet');
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      
      let errorMessage = 'Failed to connect wallet';
      
      if (error instanceof Error) {
        // Handle specific error codes
        if (error.message.includes('4001')) {
          errorMessage = 'Connection rejected by user';
        } else if (error.message.includes('4100')) {
          errorMessage = 'Please unlock your MetaMask wallet';
        } else if (error.message.includes('4902')) {
          errorMessage = 'Network not added to wallet';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  // Switch to a specific network
  const handleSwitchNetwork = async (network: SupportedNetwork) => {
    try {
      const result = await switchNetwork(network.chainId);
      
      if (result.success) {
        toast.success(`Switched to ${network.displayName}`);
        setShowNetworkModal(false);
      } else {
        // If switch failed, try to add the network
        if (result.error?.includes('4902') || result.error?.includes('network not added')) {
          const addResult = await addNetwork(network);
          if (addResult.success) {
            // Try switching again after adding
            const switchResult = await switchNetwork(network.chainId);
            if (switchResult.success) {
              toast.success(`Added and switched to ${network.displayName}`);
              setShowNetworkModal(false);
            } else {
              throw new Error(switchResult.error || 'Failed to switch network after adding');
            }
          } else {
            throw new Error(addResult.error || 'Failed to add network');
          }
        } else {
          throw new Error(result.error || 'Failed to switch network');
        }
      }
    } catch (error) {
      console.error('Network switch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch network';
      toast.error(errorMessage);
    }
  };

  // Disconnect wallet
  const handleDisconnectWallet = async () => {
    try {
      await disconnect();
      toast.success('Wallet disconnected');
      onDisconnect?.();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const networkDisplayInfo = currentNetwork ? getNetworkDisplayInfo(currentNetwork) : null;

  return (
    <div className={`wallet-connection ${className}`}>
      {/* Connection Status */}
      {isConnected ? (
        <div className="flex items-center space-x-3">
          {/* Wallet Address */}
          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
            <div className="relative">
              <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <span className="text-sm font-medium text-white">
              {formatAddress(address!)}
            </span>
          </div>
          
          {/* Network Status */}
          {currentNetwork && networkDisplayInfo ? (
            <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border ${networkDisplayInfo.bgColor} ${networkDisplayInfo.textColor} ${networkDisplayInfo.borderColor} backdrop-blur-sm`}>
              <div className="relative flex items-center">
                <div className={`w-2 h-2 ${networkDisplayInfo.dotColor} rounded-full`}></div>
                <div className={`absolute w-2 h-2 ${networkDisplayInfo.dotColor} rounded-full animate-ping`}></div>
              </div>
              <networkDisplayInfo.icon className="h-4 w-4" />
              <span className="text-xs font-medium">
                {networkDisplayInfo.shortName}
                {currentNetwork.testnet && (
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
          disabled={isConnecting || isCheckingConnection}
          className="group relative inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-200"></div>
          <div className="relative flex items-center">
            {(isConnecting || isCheckingConnection) ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <WalletIcon className="h-4 w-4 mr-2" />
            )}
            {(isConnecting || isCheckingConnection) ? 'Connecting...' : 'Connect Wallet'}
          </div>
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 flex items-center space-x-3 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-lg">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
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
                {enabledNetworks.map((network) => {
                  const displayInfo = getNetworkDisplayInfo(network);
                  return (
                    <button
                      key={network.chainId}
                      onClick={() => handleSwitchNetwork(network)}
                      className={`w-full flex items-center space-x-3 p-3 rounded-lg border ${displayInfo.bgColor} ${displayInfo.borderColor} hover:opacity-80 transition-opacity`}
                    >
                      <div className={`w-3 h-3 ${displayInfo.dotColor} rounded-full`}></div>
                      <displayInfo.icon className={`h-4 w-4 ${displayInfo.textColor}`} />
                      <span className={`text-sm font-medium ${displayInfo.textColor}`}>
                        {network.displayName}
                        {network.testnet && (
                          <span className="ml-1 text-xs opacity-75">(Testnet)</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
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

// Hook for using wallet connection state (deprecated - use useWallet instead)
export function useWalletConnection() {
  const walletHook = useWallet();
  
  return {
    isConnected: walletHook.isConnected,
    address: walletHook.address,
    networkId: walletHook.chainId,
    networkName: walletHook.currentNetwork?.displayName || null,
    isCorrectNetwork: walletHook.currentNetwork ? enabledNetworks.some(n => n.chainId === walletHook.chainId) : false,
    isConnecting: walletHook.isConnecting,
    error: walletHook.error
  };
}