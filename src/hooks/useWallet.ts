import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from 'wagmi';
import { getProviderManager } from '../lib/providers/NetworkProvider';
import { 
  getNetworkById, 
  isBlockDAGNetwork, 
  getNetworkDisplayName,
  SupportedNetwork,
  SUPPORTED_NETWORKS,
  getEnabledNetworks
} from '../config/networks';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  network: SupportedNetwork | null;
  isBlockDAG: boolean;
  balance: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface NetworkSwitchResult {
  success: boolean;
  error?: string;
  requiresManualAdd?: boolean;
}

export interface UseWalletReturn {
  // Wallet state
  wallet: WalletState;
  
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Network methods
  switchNetwork: (chainId: number) => Promise<NetworkSwitchResult>;
  addNetwork: (network: SupportedNetwork) => Promise<boolean>;
  
  // Utility methods
  getProvider: () => ethers.JsonRpcProvider | null;
  getSigner: () => Promise<ethers.JsonRpcSigner | null>;
  refreshBalance: () => Promise<void>;
  
  // Network info
  supportedNetworks: SupportedNetwork[];
  currentNetwork: SupportedNetwork | null;
  isNetworkSupported: (chainId: number) => boolean;
}

export function useWallet(): UseWalletReturn {
  const { address, isConnected } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Lazy initialization of provider manager
  const getProviderManagerLazy = useCallback(() => {
    return getProviderManager();
  }, []);
  
  // Memoized values
  const currentNetwork = useMemo(() => {
    return chainId ? getNetworkById(chainId) || null : null;
  }, [chainId]);
  
  const isBlockDAG = useMemo(() => {
    return chainId ? isBlockDAGNetwork(chainId) : false;
  }, [chainId]);
  
  const supportedNetworks = useMemo(() => {
    return getEnabledNetworks();
  }, []);
  
  const wallet: WalletState = useMemo(() => ({
    isConnected: isConnected || false,
    address: address || null,
    chainId: chainId || null,
    network: currentNetwork,
    isBlockDAG,
    balance,
    isLoading,
    error,
  }), [isConnected, address, chainId, currentNetwork, isBlockDAG, balance, isLoading, error]);
  
  // Connect wallet
  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const connector = connectors[0]; // Use first available connector
      if (connector) {
        await wagmiConnect({ connector });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [wagmiConnect, connectors]);
  
  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await wagmiDisconnect();
      setBalance(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect wallet';
      setError(errorMessage);
      console.error('Wallet disconnection error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [wagmiDisconnect]);
  
  // Switch network
  const switchNetwork = useCallback(async (targetChainId: number): Promise<NetworkSwitchResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const targetNetwork = getNetworkById(targetChainId);
      if (!targetNetwork) {
        return {
          success: false,
          error: `Network with chain ID ${targetChainId} is not supported`,
        };
      }
      
      if (!targetNetwork.enabled) {
        return {
          success: false,
          error: `Network ${targetNetwork.displayName} is currently disabled`,
        };
      }
      
      // Validate network connectivity first
      const providerManager = getProviderManagerLazy();
      const connectivityCheck = await providerManager.validateNetworkConnectivity(targetChainId);
      if (!connectivityCheck.isValid) {
        console.warn(`Network connectivity issue for ${targetNetwork.displayName}: ${connectivityCheck.error}`);
        // Continue with switch attempt even if connectivity check fails
        // as the user's wallet might still be able to connect
      }
      
      // Check if provider manager can handle the network
      const canSwitch = await providerManager.switchNetwork(targetChainId);
      if (!canSwitch) {
        return {
          success: false,
          error: connectivityCheck.error || `Failed to connect to ${targetNetwork.displayName}`,
        };
      }
      
      // Use wagmi to switch chain
      await switchChain({ chainId: targetChainId });
      
      return { success: true };
    } catch (err: any) {
      let errorMessage = 'Failed to switch network';
      let requiresManualAdd = false;
      
      if (err?.code === 4902) {
        // Network not added to wallet
        errorMessage = 'Network not added to wallet';
        requiresManualAdd = true;
      } else if (err?.code === 4001) {
        // User rejected
        errorMessage = 'Network switch rejected by user';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Network switch error:', err);
      
      return {
        success: false,
        error: errorMessage,
        requiresManualAdd,
      };
    } finally {
      setIsLoading(false);
    }
  }, [switchChain, getProviderManagerLazy]);
  
  // Add network to wallet
  const addNetwork = useCallback(async (network: SupportedNetwork): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!window.ethereum) {
        throw new Error('No wallet detected');
      }
      
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${network.id.toString(16)}`,
          chainName: network.displayName,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.blockExplorerUrl],
        }],
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add network';
      setError(errorMessage);
      console.error('Add network error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Get provider for current network
  const getProvider = useCallback((): ethers.JsonRpcProvider | null => {
    if (!chainId) return null;
    const providerManager = getProviderManagerLazy();
    return providerManager.getProvider(chainId);
  }, [chainId, getProviderManagerLazy]);
  
  // Get signer
  const getSigner = useCallback(async (): Promise<ethers.JsonRpcSigner | null> => {
    try {
      if (!window.ethereum || !isConnected || !address) {
        return null;
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      return await provider.getSigner();
    } catch (err) {
      console.error('Failed to get signer:', err);
      return null;
    }
  }, [isConnected, address]);
  
  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!address || !chainId) {
      setBalance(null);
      return;
    }
    
    try {
      const provider = getProvider();
      if (!provider) {
        setBalance(null);
        return;
      }
      
      const providerManager = getProviderManagerLazy();
      const balanceWei = await providerManager.executeWithRetry(
        chainId,
        async (p) => await p.getBalance(address)
      );
      
      const balanceEth = ethers.formatEther(balanceWei);
      setBalance(parseFloat(balanceEth).toFixed(4));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setBalance(null);
    }
  }, [address, chainId, getProvider, getProviderManagerLazy]);
  
  // Check if network is supported
  const isNetworkSupported = useCallback((targetChainId: number): boolean => {
    const network = getNetworkById(targetChainId);
    return network?.enabled || false;
  }, []);
  
  // Effects
  useEffect(() => {
    if (isConnected && address && chainId) {
      refreshBalance();
    } else {
      setBalance(null);
    }
  }, [isConnected, address, chainId, refreshBalance]);
  
  // Clear error after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  return {
    wallet,
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    getProvider,
    getSigner,
    refreshBalance,
    supportedNetworks,
    currentNetwork,
    isNetworkSupported,
  };
}

// Additional utility hooks
export function useNetworkHealth(chainId?: number) {
  const [health, setHealth] = useState<{ isHealthy: boolean } | null>(null);
  const getProviderManagerLazy = useCallback(() => getProviderManager(), []);
  
  useEffect(() => {
    if (!chainId) return;
    
    const updateHealth = () => {
      const providerManager = getProviderManagerLazy();
      const networkHealth = providerManager.getNetworkHealth(chainId);
      setHealth(networkHealth);
    };
    
    updateHealth();
    const interval = setInterval(updateHealth, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [chainId, getProviderManagerLazy]);
  
  return health;
}

export function useNetworkPerformance(chainId?: number) {
  const [metrics, setMetrics] = useState<{ currentLatency: number; tps: number; finality: string } | null>(null);
  const getProviderManagerLazy = useCallback(() => getProviderManager(), []);
  
  useEffect(() => {
    if (!chainId) return;
    
    const updateMetrics = () => {
      const providerManager = getProviderManagerLazy();
      const performanceMetrics = providerManager.getNetworkPerformanceMetrics(chainId);
      setMetrics(performanceMetrics);
    };
    
    updateMetrics();
    const interval = setInterval(updateMetrics, 15000); // Update every 15 seconds
    
    return () => clearInterval(interval);
  }, [chainId, getProviderManagerLazy]);
  
  return metrics;
}