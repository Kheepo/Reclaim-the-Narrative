'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, Wifi, WifiOff, Zap, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useWallet, useNetworkHealth, useNetworkPerformance } from '../hooks/useWallet';
import { SupportedNetwork, isBlockDAGNetwork } from '../config/networks';
import { toast } from 'sonner';

interface NetworkSwitcherProps {
  className?: string;
  showPerformanceMetrics?: boolean;
  compact?: boolean;
}

interface NetworkItemProps {
  network: SupportedNetwork;
  isActive: boolean;
  isConnecting: boolean;
  onSelect: (network: SupportedNetwork) => void;
  showMetrics?: boolean;
}

function NetworkItem({ network, isActive, isConnecting, onSelect, showMetrics }: NetworkItemProps) {
  const health = useNetworkHealth(network.id);
  const performance = useNetworkPerformance(network.id);
  const isBlockDAG = isBlockDAGNetwork(network.id);
  
  const getStatusIcon = () => {
    if (isConnecting) {
      return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
    }
    
    if (health?.isHealthy) {
      return <div className="w-2 h-2 bg-green-500 rounded-full" />;
    }
    
    return <div className="w-2 h-2 bg-red-500 rounded-full" />;
  };
  
  const getNetworkBadge = () => {
    if (isBlockDAG) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          <Zap className="w-3 h-3 mr-1" />
          BlockDAG
        </span>
      );
    }
    
    if (network.type === 'ethereum') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Ethereum
        </span>
      );
    }
    
    return null;
  };
  
  return (
    <button
      onClick={() => onSelect(network)}
      disabled={isConnecting || !network.enabled}
      className={`
        w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 
        disabled:opacity-50 disabled:cursor-not-allowed transition-colors
        ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {network.displayName}
              </span>
              {getNetworkBadge()}
              {network.testnet && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Testnet
                </span>
              )}
            </div>
            {showMetrics && performance && (
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {performance.currentLatency}ms
                </span>
                <span>
                  {performance.tps} TPS
                </span>
                <span className="capitalize">
                  {performance.finality}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {isActive && (
          <CheckCircle className="w-4 h-4 text-blue-500" />
        )}
      </div>
    </button>
  );
}

export function NetworkSwitcher({ 
  className = '', 
  showPerformanceMetrics = false,
  compact = false 
}: NetworkSwitcherProps) {
  const { 
    wallet, 
    switchNetwork, 
    addNetwork, 
    supportedNetworks, 
    currentNetwork,
    isNetworkSupported 
  } = useWallet();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingToChainId, setConnectingToChainId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const handleNetworkSelect = async (network: SupportedNetwork) => {
    if (!network.enabled || isConnecting) return;
    
    setIsConnecting(true);
    setConnectingToChainId(network.id);
    setIsOpen(false);
    
    try {
      const result = await switchNetwork(network.id);
      
      if (result.success) {
        toast.success(`Switched to ${network.displayName}`);
      } else if (result.requiresManualAdd) {
        // Try to add the network
        const added = await addNetwork(network);
        if (added) {
          // Retry switching after adding
          const retryResult = await switchNetwork(network.id);
          if (retryResult.success) {
            toast.success(`Added and switched to ${network.displayName}`);
          } else {
            toast.error(retryResult.error || 'Failed to switch after adding network');
          }
        } else {
          toast.error('Failed to add network to wallet');
        }
      } else {
        toast.error(result.error || 'Failed to switch network');
      }
    } catch (error) {
      console.error('Network switch error:', error);
      toast.error('Unexpected error while switching networks');
    } finally {
      setIsConnecting(false);
      setConnectingToChainId(null);
    }
  };
  
  const getCurrentNetworkStatus = () => {
    // Return default state during SSR to prevent hydration mismatch
    if (!isMounted) {
      return {
        icon: <WifiOff className="w-4 h-4 text-gray-400" />,
        text: 'Loading...',
        color: 'text-gray-400'
      };
    }
    
    if (!wallet.isConnected) {
      return {
        icon: <WifiOff className="w-4 h-4 text-gray-400" />,
        text: 'Not Connected',
        color: 'text-gray-400'
      };
    }
    
    if (!currentNetwork) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
        text: 'Unknown Network',
        color: 'text-yellow-500'
      };
    }
    
    if (!isNetworkSupported(wallet.chainId!)) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        text: 'Unsupported Network',
        color: 'text-red-500'
      };
    }
    
    return {
      icon: <Wifi className="w-4 h-4 text-green-500" />,
      text: currentNetwork.displayName,
      color: 'text-gray-900 dark:text-gray-100'
    };
  };
  
  const status = getCurrentNetworkStatus();
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-network-switcher]')) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);
  
  if (compact) {
    return (
      <div className={`relative ${className}`} data-network-switcher>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={!isMounted || !wallet.isConnected || isConnecting}
          className="
            flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-300 
            dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 
            dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {status.icon}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && isMounted && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999]">
            <div className="py-1">
              {supportedNetworks.map((network) => (
                <NetworkItem
                  key={network.id}
                  network={network}
                  isActive={wallet.chainId === network.id}
                  isConnecting={connectingToChainId === network.id}
                  onSelect={handleNetworkSelect}
                  showMetrics={showPerformanceMetrics}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`} data-network-switcher>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!isMounted || !wallet.isConnected || isConnecting}
        className="
          flex items-center justify-between w-full px-4 py-3 text-left 
          border border-gray-300 dark:border-gray-600 rounded-lg 
          bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors
        "
      >
        <div className="flex items-center space-x-3">
          {status.icon}
          <div>
            <div className={`font-medium ${status.color}`}>
              {status.text}
            </div>
            {isMounted && wallet.isConnected && currentNetwork && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {isBlockDAGNetwork(wallet.chainId!) ? 'BlockDAG Network' : 'Ethereum Compatible'}
              </div>
            )}
          </div>
        </div>
        
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && isMounted && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999]">
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
              Available Networks
            </div>
            
            {supportedNetworks.map((network) => (
              <NetworkItem
                key={network.id}
                network={network}
                isActive={wallet.chainId === network.id}
                isConnecting={connectingToChainId === network.id}
                onSelect={handleNetworkSelect}
                showMetrics={showPerformanceMetrics}
              />
            ))}
            
            {showPerformanceMetrics && (
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Healthy</span>
                  <div className="w-2 h-2 bg-red-500 rounded-full ml-3"></div>
                  <span>Unhealthy</span>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full ml-3"></div>
                  <span>Connecting</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkSwitcher;