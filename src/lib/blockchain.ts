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
 * Get the current network configuration
 */
export function getCurrentNetwork(): NetworkConfig {
  const networkName = process.env.NEXT_PUBLIC_NETWORK || 'mumbai';
  return NETWORKS[networkName];
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
    
    // Handle MetaMask specific errors
    if (error.code === 4001) {
      throw new WalletError('Connection was rejected by user', 'USER_REJECTED', error);
    }
    
    if (error.code === -32002) {
      throw new WalletError('Connection request is already pending. Please check your wallet.', 'REQUEST_PENDING', error);
    }
    
    if (error.code === -32603) {
      throw new WalletError('Internal wallet error. Please try again.', 'INTERNAL_ERROR', error);
    }
    
    // Handle network errors
    if (error.message?.includes('network') || error.message?.includes('RPC')) {
      throw new NetworkError(`Network error: ${error.message}`, undefined, error);
    }
    
    // Generic error fallback
    throw new WalletError(
      `Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      // If the network doesn't exist, add it
      if (fallbackError.code === 4902) {
        const networkConfig = getNetworkById(chainId);
        if (networkConfig) {
          await addNetworkToWallet(networkConfig);
          console.log(`✅ Added and switched to network ${chainId}`);
        } else {
          // Try legacy network config
          const legacyNetwork = Object.values(NETWORKS).find(n => n.chainId === chainId);
          if (legacyNetwork) {
            await addNetwork(legacyNetwork);
            console.log(`✅ Added and switched to network ${chainId} (legacy)`);
          } else {
            throw new Error(`Network ${chainId} not found in configuration`);
          }
        }
      } else {
        throw fallbackError;
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
 * Submit a report to the blockchain
 */
export async function submitReport(
  reportHash: string,
  ipfsCIDs: string[],
  signer: ethers.Signer
): Promise<TransactionResult> {
  try {
    const contract = getContract(signer);
    
    // Convert report hash to bytes32
    const reportHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(reportHash));
    
    // Submit the transaction
    const tx = await contract.submitReport(reportHashBytes32, ipfsCIDs);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    return {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status
    };
  } catch (error) {
    console.error('Failed to submit report:', error);
    throw new Error(`Failed to submit report: ${error instanceof Error ? error.message : 'Unknown error'}`);
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