/**
 * Blockchain interaction module using ethers.js
 * Handles connection to Polygon network and smart contract interactions
 */

import { ethers } from 'ethers';
import { NetworkProviderManager } from './providers/NetworkProvider';
import { SUPPORTED_NETWORKS, getNetworkById, type SupportedNetwork } from '../config/networks';

// Lazy initialization of the network provider manager
let networkManager: NetworkProviderManager | null = null;

function getNetworkManager(): NetworkProviderManager {
  if (!networkManager) {
    networkManager = new NetworkProviderManager();
  }
  return networkManager;
}

// Contract ABI for GBVReportRegistry
export const GBV_REPORT_REGISTRY_ABI = [
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_reportHash",
        "type": "bytes32"
      },
      {
        "internalType": "string[]",
        "name": "_ipfsCIDs",
        "type": "string[]"
      }
    ],
    "name": "submitReport",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_reportHash",
        "type": "bytes32"
      }
    ],
    "name": "getReport",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "reportHash",
        "type": "bytes32"
      },
      {
        "internalType": "string[]",
        "name": "ipfsCIDs",
        "type": "string[]"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "submitter",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getUserReports",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "submitter",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "reportHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "ipfsCIDs",
        "type": "string[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "ReportSubmitted",
    "type": "event"
  }
];

// Legacy interface for backward compatibility
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  contractAddress: string;
}

export interface ReportData {
  reportHash: string;
  ipfsCIDs: string[];
  timestamp: number;
  submitter: string;
}

export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: string;
  status?: number;
}

export interface TransactionDetails {
  transaction: ethers.TransactionResponse | null;
  receipt: ethers.TransactionReceipt | null;
  success: boolean;
  reportId?: number;
  blockNumber?: number;
  timestamp?: string;
}

// Convert new network config to legacy format for backward compatibility
function toLegacyNetworkConfig(network: SupportedNetwork): NetworkConfig {
  // Get contract address with proper fallback chain
  let contractAddress = '';
  
  // First try network-specific contract address
  if (network.contracts?.gbvRegistry) {
    contractAddress = network.contracts.gbvRegistry;
  } else {
    // Fallback to network-specific environment variables
    switch (network.id) {
      case 11155111: // Ethereum Sepolia
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA || '';
        break;
      case 1: // Ethereum Mainnet
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET || '';
        break;
      case 80002: // Polygon Amoy (formerly Mumbai)
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MUMBAI || '';
        break;
      case 137: // Polygon Mainnet
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON || '';
        break;
      case 1043: // BlockDAG Testnet
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BLOCKDAG_TESTNET || '';
        break;
      case 1044: // BlockDAG Mainnet
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BLOCKDAG_MAINNET || '';
        break;
      default:
        // Final fallback to generic contract address
        contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
    }
  }
  
  return {
    chainId: network.id,
    name: network.displayName,
    rpcUrl: network.rpcUrl,
    blockExplorer: network.blockExplorerUrl,
    contractAddress
  };
}

// Legacy networks mapping for backward compatibility
export const NETWORKS: Record<string, NetworkConfig> = {
  amoy: toLegacyNetworkConfig(SUPPORTED_NETWORKS[80002]), // POLYGON_AMOY
  polygon: toLegacyNetworkConfig(SUPPORTED_NETWORKS[137]), // POLYGON_MAINNET
  blockdag_testnet: toLegacyNetworkConfig(SUPPORTED_NETWORKS[1043]), // BLOCKDAG_TESTNET
  blockdag_mainnet: toLegacyNetworkConfig(SUPPORTED_NETWORKS[1044]) // BLOCKDAG_MAINNET
};

/**
 * Get the current network configuration with robust error handling
 */
export function getCurrentNetwork(): NetworkConfig {
  const networkName = process.env.NEXT_PUBLIC_NETWORK || 'amoy';
  
  // Define fallback priority order
  const fallbackOrder = [
    networkName,
    process.env.NODE_ENV === 'production' ? 'polygon' : 'amoy', // Primary fallback
    'amoy', // Testnet fallback
    'polygon', // Mainnet fallback
    'blockdag_testnet', // BlockDAG testnet fallback
    'blockdag_mainnet' // BlockDAG mainnet fallback
  ];
  
  // Remove duplicates while preserving order
  const uniqueFallbacks = [...new Set(fallbackOrder)];
  
  const configurationIssues: string[] = [];
  
  for (const fallbackName of uniqueFallbacks) {
    if (NETWORKS[fallbackName]) {
      const network = NETWORKS[fallbackName];
      
      // Enhanced validation with detailed error reporting
      const validationErrors: string[] = [];
      
      if (!network.rpcUrl || network.rpcUrl === 'undefined' || network.rpcUrl === 'null' || network.rpcUrl.trim() === '') {
        validationErrors.push('missing or invalid RPC URL');
      }
      
      if (!network.chainId || network.chainId <= 0) {
        validationErrors.push('missing or invalid chain ID');
      }
      
      if (!network.contractAddress || network.contractAddress === 'undefined' || network.contractAddress === 'null' || network.contractAddress.trim() === '') {
        validationErrors.push('missing contract address');
      }
      
      if (validationErrors.length === 0) {
        if (fallbackName !== networkName) {
          console.warn(`Network '${networkName}' not available. Using fallback: ${fallbackName}`);
        }
        return network;
      } else {
        const errorMsg = `Network '${fallbackName}' has configuration issues: ${validationErrors.join(', ')}`;
        console.warn(errorMsg);
        configurationIssues.push(errorMsg);
      }
    } else {
      const errorMsg = `Network '${fallbackName}' is not defined in NETWORKS configuration`;
      console.warn(errorMsg);
      configurationIssues.push(errorMsg);
    }
  }
  
  // If no valid network found, provide comprehensive error with actionable guidance
  const availableNetworks = Object.keys(NETWORKS).filter(name => {
    const net = NETWORKS[name];
    return net.rpcUrl && net.chainId && net.rpcUrl !== 'undefined' && net.rpcUrl !== 'null' && 
           net.contractAddress && net.contractAddress !== 'undefined' && net.contractAddress !== 'null';
  });
  
  const errorMessage = [
    `❌ No valid network configuration found.`,
    `🎯 Requested network: '${networkName}'`,
    `📋 Configuration issues found:`,
    ...configurationIssues.map(issue => `   • ${issue}`),
    ``,
    `✅ Available networks: [${availableNetworks.join(', ')}]`,
    ``,
    `🔧 To fix this issue:`,
    `   1. Check your .env.local file`,
    `   2. Ensure RPC URLs are properly configured (NEXT_PUBLIC_RPC_URL_*)`,
    `   3. Ensure contract addresses are set (NEXT_PUBLIC_CONTRACT_ADDRESS_*)`,
    `   4. Verify the NEXT_PUBLIC_NETWORK environment variable`,
    ``,
    `📖 Example .env.local configuration:`,
    `   NEXT_PUBLIC_NETWORK=amoy`,
    `   NEXT_PUBLIC_RPC_URL_AMOY=https://rpc-amoy.polygon.technology/`,
    `   NEXT_PUBLIC_CONTRACT_ADDRESS_AMOY=0x...`
  ].join('\n');
  
  throw new NetworkError(errorMessage);
}

/**
 * Get provider for the current network using NetworkProviderManager
 */
export function getProvider(): ethers.JsonRpcProvider {
  const network = getCurrentNetwork();
  const manager = getNetworkManager();
  const provider = manager.getProvider(network.chainId);
  
  if (!provider) {
    console.warn(`No provider available for chain ID: ${network.chainId}, falling back to direct provider`);
    // Fallback to direct provider creation with explicit network configuration
    return new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
  }
  
  return provider;
}

/**
 * Get provider for a specific chain ID using NetworkProviderManager
 */
export function getProviderForChain(chainId: number): ethers.JsonRpcProvider | null {
  const manager = getNetworkManager();
  return manager.getProvider(chainId);
}

/**
 * Switch network using NetworkProviderManager
 */
export async function switchToNetwork(chainId: number): Promise<void> {
  try {
    const manager = getNetworkManager();
    await manager.switchNetwork(chainId);
  } catch (error) {
    console.error(`Failed to switch to network ${chainId}:`, error);
    throw error;
  }
}

/**
 * Get contract instance
 */
export function getContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  const network = getCurrentNetwork();
  const provider = signerOrProvider || getProvider();
  
  if (!network.contractAddress) {
    throw new Error('Contract address not configured');
  }
  
  return new ethers.Contract(network.contractAddress, GBV_REPORT_REGISTRY_ABI, provider);
}

// Custom error types for better error handling
export class WalletError extends Error {
  constructor(message: string, public code?: string, public cause?: Error) {
    super(message);
    this.name = 'WalletError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public chainId?: number, public cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ProviderError extends Error {
  constructor(message: string, public providerType?: string, public cause?: Error) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Check if wallet provider is available and compatible
 */
export function checkWalletProvider(): { isAvailable: boolean; provider?: any; error?: string } {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    return { isAvailable: false, error: 'Not in browser environment' };
  }

  // Check for MetaMask
  if (window.ethereum) {
    // Check if it's MetaMask
    if (window.ethereum.isMetaMask) {
      return { isAvailable: true, provider: window.ethereum };
    }
    // Check for other providers
    if (window.ethereum.providers) {
      const metaMaskProvider = window.ethereum.providers.find((p: any) => p.isMetaMask);
      if (metaMaskProvider) {
        return { isAvailable: true, provider: metaMaskProvider };
      }
    }
    // Generic Ethereum provider
    return { isAvailable: true, provider: window.ethereum };
  }

  return { isAvailable: false, error: 'No Ethereum wallet detected. Please install MetaMask or another compatible wallet.' };
}

/**
 * Validate wallet connection state
 */
export async function validateWalletConnection(provider: any): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Check if provider is still available
    if (!provider) {
      return { isValid: false, error: 'Provider is not available' };
    }

    // Check if accounts are accessible
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return { isValid: false, error: 'No accounts connected' };
    }

    // Check if provider is connected
    const isConnected = provider.isConnected ? provider.isConnected() : true;
    if (!isConnected) {
      return { isValid: false, error: 'Provider is not connected' };
    }

    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Connection validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Check network connectivity using NetworkProviderManager
 */
export async function checkNetworkConnectivity(provider: any): Promise<{ isConnected: boolean; error?: string }> {
  try {
    // Try to get the current block number using browser provider
    const ethersProvider = new ethers.BrowserProvider(provider);
    const network = await ethersProvider.getNetwork();
    const chainId = Number(network.chainId);
    
    // Use NetworkProviderManager for enhanced connectivity check
    const manager = getNetworkManager();
    const managedProvider = manager.getProvider(chainId);
    if (managedProvider) {
      // Test with managed provider for better error handling
      await managedProvider.getBlockNumber();
      console.log(`✅ Network connectivity confirmed for chain ${chainId}`);
    } else {
      // Fallback to browser provider
      await ethersProvider.getBlockNumber();
      console.log(`✅ Network connectivity confirmed (fallback) for chain ${chainId}`);
    }
    
    return { isConnected: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Network connectivity check failed:', errorMessage);
    
    return { 
      isConnected: false, 
      error: `Network connectivity check failed: ${errorMessage}` 
    };
  }
}

// Global connection state to prevent duplicate requests
let isConnecting = false;
let connectionTimeout: NodeJS.Timeout | null = null;

/**
 * Check if a wallet connection is currently in progress
 */
export function isWalletConnecting(): boolean {
  return isConnecting;
}

/**
 * Reset the connection state (for cleanup)
 */
export function resetConnectionState(): void {
  isConnecting = false;
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }
}

/**
 * Set connection state with automatic timeout
 */
function setConnectionState(connecting: boolean): void {
  isConnecting = connecting;
  
  if (connecting) {
    // Set a timeout to automatically reset the connection state after 30 seconds
    // This prevents the state from being stuck if something goes wrong
    connectionTimeout = setTimeout(() => {
      console.warn('Connection timeout reached, resetting connection state');
      resetConnectionState();
    }, 30000);
  } else {
    // Clear timeout when connection completes
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
  }
}

/**
 * Connect to MetaMask wallet with comprehensive error handling
 */
export async function connectWallet(): Promise<ethers.Signer> {
  console.log('🔗 Starting wallet connection process...');
  
  // Check if a connection is already in progress
  if (isConnecting) {
    throw new WalletError('Connection request is already pending. Please check your wallet.', 'REQUEST_PENDING');
  }
  
  // Set connection flag with timeout
  setConnectionState(true);
  
  // Step 1: Check wallet provider availability
  const providerCheck = checkWalletProvider();
  if (!providerCheck.isAvailable) {
    console.error('❌ Wallet provider check failed:', providerCheck.error);
    throw new ProviderError(providerCheck.error || 'Wallet provider not available');
  }
  
  console.log('✅ Wallet provider detected:', providerCheck.provider.isMetaMask ? 'MetaMask' : 'Generic Ethereum Provider');
  
  const provider = providerCheck.provider;
  
  try {
    // Step 2: Request account access
    console.log('🔐 Requesting account access...');
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    
    if (!accounts || accounts.length === 0) {
      throw new WalletError('No accounts returned from wallet', 'NO_ACCOUNTS');
    }
    
    console.log('✅ Account access granted:', accounts[0]);
    
    // Step 3: Validate wallet connection
    const connectionValidation = await validateWalletConnection(provider);
    if (!connectionValidation.isValid) {
      throw new WalletError(connectionValidation.error || 'Wallet connection validation failed', 'CONNECTION_INVALID');
    }
    
    console.log('✅ Wallet connection validated');
    
    // Step 4: Create ethers provider and signer
    const ethersProvider = new ethers.BrowserProvider(provider);
    
    // Step 5: Check network connectivity
    const networkConnectivity = await checkNetworkConnectivity(provider);
    if (!networkConnectivity.isConnected) {
      throw new NetworkError(networkConnectivity.error || 'Network connectivity check failed');
    }
    
    console.log('✅ Network connectivity confirmed');
    
    const signer = await ethersProvider.getSigner();
    
    // Step 6: Check if we're on the correct network
    console.log('🌐 Checking network compatibility...');
    const network = await ethersProvider.getNetwork();
    const expectedNetwork = getCurrentNetwork();
    
    console.log(`Current network: ${network.chainId}, Expected: ${expectedNetwork.chainId}`);
    
    if (Number(network.chainId) !== expectedNetwork.chainId) {
      console.log('⚠️ Wrong network detected, attempting to switch...');
      await switchNetwork(expectedNetwork.chainId);
      console.log('✅ Network switched successfully');
    }
    
    console.log('🎉 Wallet connection completed successfully');
    
    // Reset connection flag on success
    setConnectionState(false);
    
    return signer;
  } catch (error: any) {
    console.error('❌ Wallet connection failed:', error);
    
    // Reset connection flag on error
    setConnectionState(false);
    
    // Handle specific error types
    if (error instanceof WalletError || error instanceof NetworkError || error instanceof ProviderError) {
      throw error;
    }
    
    // Handle MetaMask specific errors with enhanced guidance
    if (error.code === 4001) {
      const userRejectedMsg = [
        '❌ Connection was rejected by user',
        '',
        '💡 To connect your wallet:',
        '   1. Click the wallet extension icon',
        '   2. Select "Connect" when prompted',
        '   3. Choose the account you want to use',
        '   4. Click "Connect" to approve the connection'
      ].join('\n');
      throw new WalletError(userRejectedMsg, 'USER_REJECTED', error);
    }
    
    if (error.code === -32002) {
      const pendingRequestMsg = [
        '❌ Connection request is already pending',
        '',
        '🔧 To resolve this:',
        '   1. Check your wallet extension for pending requests',
        '   2. Approve or reject any pending connections',
        '   3. Try connecting again',
        '   4. If stuck, refresh the page and try again'
      ].join('\n');
      throw new WalletError(pendingRequestMsg, 'REQUEST_PENDING', error);
    }
    
    if (error.code === -32603) {
      const internalErrorMsg = [
        '❌ Internal wallet error occurred',
        '',
        '🔧 Troubleshooting steps:',
        '   1. Refresh the page and try again',
        '   2. Restart your wallet extension',
        '   3. Clear browser cache and cookies',
        '   4. Update your wallet to the latest version'
      ].join('\n');
      throw new WalletError(internalErrorMsg, 'INTERNAL_ERROR', error);
    }
    
    // Handle network errors
    if (error.message?.includes('network') || error.message?.includes('RPC')) {
      const networkErrorMsg = [
        `❌ Network error: ${error.message}`,
        '',
        '🔧 Network troubleshooting:',
        '   1. Check your internet connection',
        '   2. Verify RPC URL configuration',
        '   3. Try switching to a different network',
        '   4. Contact support if the issue persists'
      ].join('\n');
      throw new NetworkError(networkErrorMsg, undefined, error);
    }
    
    // Generic error fallback with guidance
    const genericErrorMsg = [
      `❌ Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      '',
      '🔧 General troubleshooting:',
      '   1. Ensure your wallet extension is installed and unlocked',
      '   2. Refresh the page and try again',
      '   3. Check browser console for additional error details',
      '   4. Try using a different browser or device',
      '',
      '💡 If you need help, please contact support with the error details above.'
    ].join('\n');
    
    throw new WalletError(
      genericErrorMsg,
      'UNKNOWN_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Switch to the correct network with enhanced error handling
 */
export async function switchNetwork(chainId: number): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }
  
  try {
    // Use NetworkProviderManager for enhanced switching
    const manager = getNetworkManager();
    await manager.switchNetwork(chainId);
    console.log(`✅ Successfully switched to network ${chainId}`);
  } catch (error: any) {
    console.error(`❌ Failed to switch to network ${chainId}:`, error);
    
    // Fallback to direct wallet switching
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
      console.log(`✅ Successfully switched to network ${chainId} (fallback)`);
    } catch (fallbackError: any) {
      console.error(`❌ Failed to switch to network ${chainId}:`, fallbackError);
      
      // Handle specific MetaMask errors with enhanced guidance
      if (fallbackError.code === 4902) {
        const networkConfig = getNetworkById(chainId);
        if (networkConfig) {
          const networkNotAddedMsg = [
            `❌ Network ${networkConfig.displayName} is not added to your wallet`,
            '',
            '🔧 To add this network:',
            '   1. Open your wallet extension',
            '   2. Go to Settings > Networks',
            '   3. Click "Add Network" or "Custom RPC"',
            '   4. Enter the following details:',
            `      • Network Name: ${networkConfig.displayName}`,
            `      • RPC URL: ${networkConfig.rpcUrl}`,
            `      • Chain ID: ${networkConfig.id}`,
            `      • Currency Symbol: ${networkConfig.nativeCurrency.symbol}`,
            '   5. Save and try switching again'
          ].join('\n');
          
          try {
            await addNetworkToWallet(networkConfig);
            console.log(`✅ Added and switched to network ${chainId}`);
          } catch (addError) {
            throw new NetworkError(networkNotAddedMsg, chainId, addError as Error);
          }
        } else {
          // Try legacy network config
          const legacyNetwork = Object.values(NETWORKS).find(n => n.chainId === chainId);
          if (legacyNetwork) {
            const legacyNetworkNotAddedMsg = [
              `❌ Network ${legacyNetwork.name} is not added to your wallet`,
              '',
              '🔧 To add this network:',
              '   1. Open your wallet extension',
              '   2. Go to Settings > Networks',
              '   3. Click "Add Network" or "Custom RPC"',
              '   4. Enter the following details:',
              `      • Network Name: ${legacyNetwork.name}`,
              `      • RPC URL: ${legacyNetwork.rpcUrl}`,
              `      • Chain ID: ${legacyNetwork.chainId}`,
              '   5. Save and try switching again'
            ].join('\n');
            
            try {
              await addNetwork(legacyNetwork);
              console.log(`✅ Added and switched to network ${chainId} (legacy)`);
            } catch (addError) {
              throw new NetworkError(legacyNetworkNotAddedMsg, chainId, addError as Error);
            }
          } else {
            throw new NetworkError(`Network ${chainId} not found in configuration`, chainId);
          }
        }
      } else if (fallbackError.code === 4001) {
        const userRejectedMsg = [
          '❌ Network switch was rejected by user',
          '',
          '💡 To switch networks:',
          '   1. Click your wallet extension',
          '   2. When prompted to switch networks, click "Switch"',
          '   3. Confirm the network change',
          '   4. Wait for the switch to complete'
        ].join('\n');
        
        throw new NetworkError(userRejectedMsg, chainId, fallbackError);
      } else {
        const genericSwitchErrorMsg = [
          `❌ Failed to switch to network ${chainId}: ${fallbackError.message || 'Unknown error'}`,
          '',
          '🔧 Troubleshooting steps:',
          '   1. Ensure your wallet is unlocked',
          '   2. Check if the network is properly configured',
          '   3. Try refreshing the page and switching again',
          '   4. Restart your wallet extension if needed',
          '',
          '💡 If the problem persists, contact support with the error details above.'
        ].join('\n');
        
        throw new NetworkError(genericSwitchErrorMsg, chainId, fallbackError);
      }
    }
  }
}

/**
 * Add network to MetaMask using new network configuration
 */
export async function addNetworkToWallet(network: SupportedNetwork): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }
  
  const chainParams = {
    chainId: `0x${network.id.toString(16)}`,
    chainName: network.displayName,
    rpcUrls: [network.rpcUrl],
    blockExplorerUrls: [network.blockExplorerUrl],
    nativeCurrency: {
      name: network.nativeCurrency.name,
      symbol: network.nativeCurrency.symbol,
      decimals: network.nativeCurrency.decimals
    }
  };
  
  console.log(`Adding network to wallet:`, chainParams);
  
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [chainParams]
  });
}

/**
 * Add network to MetaMask (legacy function for backward compatibility)
 */
export async function addNetwork(network: NetworkConfig): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }
  
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: `0x${network.chainId.toString(16)}`,
      chainName: network.name,
      rpcUrls: [network.rpcUrl],
      blockExplorerUrls: [network.blockExplorer],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    }]
  });
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry for user rejection or certain critical errors
      const errorMessage = lastError.message.toLowerCase();
      if (
        errorMessage.includes('user rejected') ||
        errorMessage.includes('user denied') ||
        errorMessage.includes('insufficient funds') ||
        errorMessage.includes('insufficient balance')
      ) {
        console.log(`🚫 Non-retryable error on attempt ${attempt}: ${lastError.message}`);
        throw lastError;
      }
      
      if (attempt === maxRetries) {
        console.log(`❌ Final attempt ${attempt} failed: ${lastError.message}`);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      
      console.log(`⚠️ Attempt ${attempt} failed: ${lastError.message}. Retrying in ${Math.round(delay)}ms...`);
      onRetry?.(attempt, lastError);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Submit a report to the blockchain with enhanced gas configuration and retry mechanism
 */
export async function submitReport(
  reportData: {
    title: string;
    description: string;
    category: string;
    location: string;
    timestamp: number;
    ipfsHash: string;
    isAnonymous: boolean;
  },
  onProgress?: (step: string) => void
): Promise<string> {
  return await retryWithBackoff(
    async () => {
      onProgress?.('Initializing blockchain submission...');
      console.log('🔄 Starting blockchain submission process');
      
      const provider = getProvider();
      const signer = await connectWallet();
      const contract = getContract(signer);
    
    // Get current network info
    const network = await provider.getNetwork();
    const signerAddress = await signer.getAddress();
    const balance = await provider.getBalance(signerAddress);
    
    console.log('📊 Network and wallet info:', {
      chainId: network.chainId,
      name: network.name,
      walletAddress: signerAddress,
      balance: ethers.formatEther(balance) + ' ETH'
    });
    
    // Check if we have sufficient balance
    if (balance === BigInt(0)) {
      throw new Error('Wallet has zero balance. Please add funds to your wallet.');
    }
    
    onProgress?.('Estimating gas requirements...');
    console.log('⛽ Starting gas estimation...');
    
    // Convert report hash to bytes32
    const reportHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(reportData.ipfsHash));
    
    // Enhanced gas estimation with buffer
    let gasEstimate;
    try {
      gasEstimate = await contract.submitReport.estimateGas(reportHashBytes32, [reportData.ipfsHash]);
      console.log('✅ Gas estimate successful:', gasEstimate.toString());
    } catch (estimateError: any) {
      console.error('❌ Gas estimation failed:', estimateError);
      throw new Error(`Gas estimation failed: ${estimateError.message}. The transaction may be invalid.`);
    }
    
    // Add 50% buffer to gas limit for network congestion
    const gasLimit = (gasEstimate * BigInt(150)) / BigInt(100);
    console.log('📈 Gas limit with 50% buffer:', gasLimit.toString());
    
    // Get current network fee data
    const feeData = await provider.getFeeData();
    console.log('💰 Current fee data:', {
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
    });
    
    // Prepare transaction options with enhanced gas configuration
    const txOptions: any = {
      gasLimit: gasLimit
    };
    
    // Check if network supports EIP-1559 (has maxFeePerGas)
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // Use EIP-1559 gas pricing for better reliability
      txOptions.maxFeePerGas = (feeData.maxFeePerGas * BigInt(120)) / BigInt(100);
      txOptions.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * BigInt(120)) / BigInt(100);
      console.log('🚀 Using EIP-1559 gas config:', {
        maxFeePerGas: txOptions.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txOptions.maxPriorityFeePerGas.toString(),
        gasLimit: txOptions.gasLimit.toString()
      });
    } else if (feeData.gasPrice) {
      // Fallback to legacy gas pricing with 20% buffer
      txOptions.gasPrice = (feeData.gasPrice * BigInt(120)) / BigInt(100);
      console.log('🔧 Using legacy gas config:', {
        gasPrice: txOptions.gasPrice.toString(),
        gasLimit: txOptions.gasLimit.toString()
      });
    } else {
      throw new Error('Unable to determine gas pricing. Please try again.');
    }
    
    // Calculate total transaction cost
    const estimatedCost = txOptions.maxFeePerGas 
      ? txOptions.maxFeePerGas * gasLimit
      : txOptions.gasPrice * gasLimit;
    
    console.log('💸 Estimated transaction cost:', ethers.formatEther(estimatedCost) + ' ETH');
    
    // Check if we have enough balance for the transaction
    if (balance < estimatedCost) {
      throw new Error(`Insufficient balance. Required: ${ethers.formatEther(estimatedCost)} ETH, Available: ${ethers.formatEther(balance)} ETH`);
    }
    
    onProgress?.('Submitting transaction to blockchain...');
    console.log('📤 Submitting transaction with config:', txOptions);
    
    // Submit the transaction with enhanced gas configuration
    const tx = await contract.submitReport(reportHashBytes32, [reportData.ipfsHash], txOptions);
    
    console.log('✅ Transaction submitted successfully:', {
      hash: tx.hash,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit?.toString(),
      gasPrice: tx.gasPrice?.toString(),
      maxFeePerGas: tx.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString()
    });
    
    onProgress?.('Waiting for transaction confirmation...');
    console.log('⏳ Waiting for transaction confirmation...');
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('🎉 Transaction confirmed:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      effectiveGasPrice: receipt.gasPrice?.toString(),
      status: receipt.status
    });
    
    return tx.hash;
  }, 3, 2000, (attempt: number, error: Error) => {
    console.log(`🔄 Blockchain submission retry attempt ${attempt}:`, error.message);
    onProgress?.(`Retrying submission (attempt ${attempt})...`);
  });
}

/**
 * Network diagnostic utility to check connection and chain status with comprehensive error handling
 */
export async function checkNetworkStatus(): Promise<{
  isConnected: boolean;
  chainId: number;
  networkName: string;
  blockNumber: number;
  gasPrice: string;
  walletConnected: boolean;
  walletAddress?: string;
  walletBalance?: string;
  error?: string;
}> {
  const maxRetries = 3;
  const retryDelay = 1000; // Start with 1 second
  
  // Default safe response structure
  const defaultResponse = {
    isConnected: false,
    chainId: 0,
    networkName: 'Unknown',
    blockNumber: 0,
    gasPrice: 'Unknown',
    walletConnected: false,
    walletAddress: undefined,
    walletBalance: undefined
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Starting network diagnostic (attempt ${attempt}/${maxRetries})...`);
      
      // Validate and get provider with timeout
      const provider = await validateAndGetProvider();
      if (!provider) {
        throw new Error('Failed to initialize network provider');
      }
      
      // Get network information with proper validation
      const networkInfo = await getNetworkInfoSafely(provider);
      if (!networkInfo.success) {
        throw new Error(networkInfo.error || 'Failed to retrieve network information');
      }
      
      // Get blockchain data with validation
      const blockchainData = await getBlockchainDataSafely(provider);
      
      console.log('🌐 Network status:', {
        chainId: networkInfo.chainId,
        name: networkInfo.networkName,
        blockNumber: blockchainData.blockNumber,
        gasPrice: blockchainData.gasPrice
      });
      
      // Try to get wallet info (non-critical)
      const walletInfo = await getWalletInfoSafely(provider);
      
      return {
        isConnected: true,
        chainId: networkInfo.chainId,
        networkName: networkInfo.networkName,
        blockNumber: blockchainData.blockNumber,
        gasPrice: blockchainData.gasPrice,
        ...walletInfo
      };
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error(`❌ Network diagnostic failed (attempt ${attempt}/${maxRetries}):`, errorMessage);
      
      // If this is the last attempt, return enhanced error response
      if (attempt === maxRetries) {
        const enhancedError = [
          `❌ Network diagnostic failed after ${maxRetries} attempts`,
          `🔍 Last error: ${errorMessage}`,
          ``,
          `🔧 Troubleshooting steps:`,
          `   1. Check your internet connection`,
          `   2. Verify RPC URL configuration in .env.local`,
          `   3. Ensure the selected network is available`,
          `   4. Try switching to a different network`,
          `   5. Check if your wallet is connected properly`,
          ``,
          `📋 Current configuration:`,
          `   • Network: ${process.env.NEXT_PUBLIC_NETWORK || 'amoy'}`,
          `   • Environment: ${process.env.NODE_ENV || 'development'}`,
          ``,
          `💡 If the issue persists, try refreshing the page or reconnecting your wallet.`
        ].join('\n');
        
        return {
          ...defaultResponse,
          error: enhancedError
        };
      }
      
      // Wait before retry with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Fallback return (should not reach here)
  return {
    ...defaultResponse,
    error: 'Network diagnostic failed: Maximum retries exceeded'
  };
}

/**
 * Safely validate and get provider with timeout
 */
async function validateAndGetProvider(): Promise<ethers.JsonRpcProvider | null> {
  try {
    const provider = getProvider();
    if (!provider) {
      const errorMsg = [
        '❌ Provider initialization failed',
        '',
        '🔧 Possible causes:',
        '   • Invalid RPC URL configuration',
        '   • Network configuration missing',
        '   • Environment variables not set properly',
        '',
        '💡 Check your .env.local file and ensure all required variables are set'
      ].join('\n');
      throw new Error(errorMsg);
    }
    
    // Test provider connectivity with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Provider connection timeout (10s) - RPC endpoint may be unreachable')), 10000)
    );
    
    const connectivityTest = provider.getBlockNumber();
    await Promise.race([connectivityTest, timeoutPromise]);
    
    return provider;
  } catch (error: any) {
    const enhancedError = [
      '❌ Provider validation failed',
      `🔍 Error: ${error?.message || 'Unknown error'}`,
      '',
      '🔧 Troubleshooting:',
      '   1. Verify RPC URL is accessible',
      '   2. Check network configuration',
      '   3. Ensure environment variables are correct',
      '   4. Try a different RPC endpoint if available'
    ].join('\n');
    
    console.error(enhancedError);
    return null;
  }
}

/**
 * Safely get network information with comprehensive validation
 */
async function getNetworkInfoSafely(provider: ethers.JsonRpcProvider): Promise<{
  success: boolean;
  chainId: number;
  networkName: string;
  error?: string;
}> {
  try {
    const network = await provider.getNetwork();
    
    // Validate network object
    if (!network) {
      return {
        success: false,
        chainId: 0,
        networkName: 'Unknown',
        error: 'Network object is null or undefined'
      };
    }
    
    // Validate chainId
    const chainId = network.chainId;
    if (chainId === undefined || chainId === null) {
      return {
        success: false,
        chainId: 0,
        networkName: network.name || 'Unknown',
        error: 'Network chainId is undefined or null'
      };
    }
    
    // Convert chainId to number safely
    let chainIdNumber: number;
    try {
      chainIdNumber = Number(chainId);
      if (isNaN(chainIdNumber) || chainIdNumber <= 0) {
        throw new Error('Invalid chainId format');
      }
    } catch (conversionError) {
      return {
        success: false,
        chainId: 0,
        networkName: network.name || 'Unknown',
        error: `Failed to convert chainId to number: ${conversionError}`
      };
    }
    
    return {
      success: true,
      chainId: chainIdNumber,
      networkName: network.name || `Chain ${chainIdNumber}`
    };
    
  } catch (error: any) {
    return {
      success: false,
      chainId: 0,
      networkName: 'Unknown',
      error: `Failed to get network info: ${error?.message || 'Unknown error'}`
    };
  }
}

/**
 * Safely get blockchain data (block number and gas price)
 */
async function getBlockchainDataSafely(provider: ethers.JsonRpcProvider): Promise<{
  blockNumber: number;
  gasPrice: string;
}> {
  let blockNumber = 0;
  let gasPrice = 'Unknown';
  
  try {
    // Get block number with timeout
    const blockNumberPromise = provider.getBlockNumber();
    const timeoutPromise = new Promise<number>((_, reject) => 
      setTimeout(() => reject(new Error('Block number timeout')), 5000)
    );
    
    blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Failed to get block number:', error);
  }
  
  try {
    // Get fee data with timeout
    const feeDataPromise = provider.getFeeData();
    const timeoutPromise = new Promise<ethers.FeeData>((_, reject) => 
      setTimeout(() => reject(new Error('Fee data timeout')), 5000)
    );
    
    const feeData = await Promise.race([feeDataPromise, timeoutPromise]);
    if (feeData?.gasPrice) {
      gasPrice = feeData.gasPrice.toString();
    }
  } catch (error) {
    console.warn('Failed to get gas price:', error);
  }
  
  return { blockNumber, gasPrice };
}

/**
 * Safely get wallet information (non-critical operation)
 */
async function getWalletInfoSafely(provider: ethers.JsonRpcProvider): Promise<{
  walletConnected: boolean;
  walletAddress?: string;
  walletBalance?: string;
}> {
  const defaultWalletInfo = {
    walletConnected: false,
    walletAddress: undefined,
    walletBalance: undefined
  };
  
  try {
    const signer = await connectWallet();
    if (!signer) {
      return defaultWalletInfo;
    }
    
    const address = await signer.getAddress();
    if (!address) {
      return defaultWalletInfo;
    }
    
    const balance = await provider.getBalance(address);
    const balanceFormatted = balance ? ethers.formatEther(balance) + ' ETH' : 'Unknown';
    
    const walletInfo = {
      walletConnected: true,
      walletAddress: address,
      walletBalance: balanceFormatted
    };
    
    console.log('👛 Wallet info:', walletInfo);
    return walletInfo;
    
  } catch (walletError) {
    console.log('⚠️ Wallet not connected or error:', walletError);
    return defaultWalletInfo;
  }
}

/**
 * Estimate gas for submitting a report to the blockchain with buffer
 */
export async function estimateSubmitReportGas(
  reportHash: string,
  ipfsCIDs: string[],
  signer: ethers.Signer
): Promise<bigint> {
  try {
    const contract = getContract(signer);
    
    // Convert report hash to bytes32
    const reportHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(reportHash));
    
    // Estimate gas for the transaction
    const gasEstimate = await contract.submitReport.estimateGas(reportHashBytes32, ipfsCIDs);
    
    // Add 50% buffer to gas estimate for network congestion
    const gasWithBuffer = (gasEstimate * BigInt(150)) / BigInt(100);
    
    return gasWithBuffer;
  } catch (error) {
    console.error('Failed to estimate gas for report submission:', error);
    
    // Enhanced error handling for gas estimation failures
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
        throw new Error('Insufficient funds to estimate gas. Please add more funds to your wallet.');
      } else if (errorMessage.includes('revert') || errorMessage.includes('execution reverted')) {
        throw new Error('Transaction would fail. Please check your inputs and try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        throw new Error('Network error during gas estimation. Please check your connection and try again.');
      }
    }
    
    throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a report from the blockchain
 */
export async function getReport(reportHash: string): Promise<ReportData> {
  try {
    const contract = getContract();
    
    // Convert report hash to bytes32
    const reportHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(reportHash));
    
    // Get the report
    const result = await contract.getReport(reportHashBytes32);
    
    return {
      reportHash: result[0],
      ipfsCIDs: result[1],
      timestamp: Number(result[2]),
      submitter: result[3]
    };
  } catch (error) {
    console.error('Failed to get report:', error);
    throw new Error(`Failed to get report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(txHash: string): Promise<TransactionDetails> {
  try {
    const provider = getProvider();
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    const success = receipt ? receipt.status === 1 : false;
    const blockNumber = receipt ? receipt.blockNumber : undefined;
    
    // Get timestamp from block
    let timestamp: string | undefined;
    if (blockNumber) {
      try {
        const block = await provider.getBlock(blockNumber);
        timestamp = block ? new Date(block.timestamp * 1000).toISOString() : undefined;
      } catch (e) {
        // If we can't get block, continue without timestamp
      }
    }
    
    // Try to extract reportId from transaction logs if available
    let reportId: number | undefined;
    if (receipt && success) {
      try {
        const contract = getContract();
        const logs = receipt.logs;
        
        for (const log of logs) {
          try {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === 'ReportSubmitted') {
              // Assuming reportId is available in the event args
              reportId = Number(parsedLog.args[0]) || 0;
              break;
            }
          } catch (e) {
            // Skip logs that can't be parsed
            continue;
          }
        }
      } catch (e) {
        // If we can't parse logs, continue without reportId
      }
    }
    
    return {
      transaction: tx,
      receipt: receipt,
      success,
      reportId,
      blockNumber,
      timestamp
    };
  } catch (error) {
    console.error('Failed to get transaction details:', error);
    throw new Error(`Failed to get transaction details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a report exists on the blockchain
 */
export async function verifyReport(txHash: string): Promise<{ exists: boolean; reportData?: ReportData }> {
  try {
    const { receipt } = await getTransactionDetails(txHash);
    
    if (!receipt || receipt.status !== 1) {
      return { exists: false };
    }
    
    // Parse the ReportSubmitted event from the transaction receipt
    const contract = getContract();
    const logs = receipt.logs;
    
    for (const log of logs) {
      try {
        const parsedLog = contract.interface.parseLog(log);
        if (parsedLog && parsedLog.name === 'ReportSubmitted') {
          const reportData: ReportData = {
            reportHash: parsedLog.args[1],
            ipfsCIDs: parsedLog.args[2],
            timestamp: Number(parsedLog.args[3]),
            submitter: parsedLog.args[0]
          };
          return { exists: true, reportData };
        }
      } catch (e) {
        // Skip logs that can't be parsed
        continue;
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Failed to verify report:', error);
    throw new Error(`Failed to verify report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get block explorer URL for transaction
 */
export function getBlockExplorerURL(txHash: string): string {
  const network = getCurrentNetwork();
  return `${network.blockExplorer}/tx/${txHash}`;
}

/**
 * Check if wallet is connected
 */
export async function isWalletConnected(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return false;
  }
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get current wallet address
 */
export async function getCurrentWalletAddress(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    return null;
  }
}