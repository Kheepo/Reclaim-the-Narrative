/**
 * Enhanced wallet utilities for robust connection and transaction handling
 */

import { createEnhancedError, ErrorCategory, retryWithBackoff } from './error-handling';
import { getNetworkStatus, checkConnectivity } from './network-utils';

export interface WalletInfo {
  address: string;
  chainId: number;
  balance: string;
  isConnected: boolean;
  provider: any;
  signer: any;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  contractAddress?: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  estimatedCostUSD?: string;
}

export interface TransactionOptions {
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  value?: string;
}

// Supported networks configuration
const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrls: [
      'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      'https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY',
      'https://cloudflare-eth.com'
    ],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrls: ['https://etherscan.io']
  },
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc-mainnet.maticvigil.com',
      'https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY'
    ],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorerUrls: ['https://polygonscan.com']
  },
  80001: {
    chainId: 80001,
    name: 'Polygon Mumbai Testnet',
    rpcUrls: [
      'https://rpc-mumbai.maticvigil.com',
      'https://polygon-mumbai.infura.io/v3/YOUR_INFURA_KEY'
    ],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorerUrls: ['https://mumbai.polygonscan.com']
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrls: [
      'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      'https://rpc.sepolia.org'
    ],
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18
    },
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  }
};

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.ethereum !== 'undefined' && 
         window.ethereum.isMetaMask;
}

/**
 * Check if any wallet is available
 */
export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Get available wallet providers
 */
export function getAvailableWallets(): string[] {
  const wallets: string[] = [];
  
  if (typeof window === 'undefined') {
    return wallets;
  }
  
  if (window.ethereum) {
    if (window.ethereum.isMetaMask) {
      wallets.push('MetaMask');
    }
    if (window.ethereum.isCoinbaseWallet) {
      wallets.push('Coinbase Wallet');
    }
    if (window.ethereum.isWalletConnect) {
      wallets.push('WalletConnect');
    }
    if (wallets.length === 0) {
      wallets.push('Unknown Wallet');
    }
  }
  
  return wallets;
}

/**
 * Connect to wallet with retry mechanism
 */
export async function connectWallet(): Promise<WalletInfo> {
  if (!isWalletAvailable()) {
    throw createEnhancedError(
      'No wallet detected. Please install MetaMask or another Web3 wallet.',
      ErrorCategory.WALLET,
      { operation: 'wallet_detection' }
    );
  }
  
  try {
    return await retryWithBackoff(async () => {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || accounts.length === 0) {
        throw createEnhancedError(
          'No accounts found. Please unlock your wallet.',
          ErrorCategory.WALLET,
          { operation: 'account_access' }
        );
      }
      
      // Get chain ID
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });
      
      // Get balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [accounts[0], 'latest']
      });
      
      // Create provider and signer (assuming ethers.js)
      const provider = new (window as any).ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      return {
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        balance: balance,
        isConnected: true,
        provider,
        signer
      };
    }, {
      maxAttempts: 3,
      baseDelay: 1000,
      retryCondition: (error) => {
        // Retry on network errors but not on user rejection
        return !error.message.includes('User rejected') &&
               !error.message.includes('User denied');
      }
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
      throw createEnhancedError(
        'Wallet connection was rejected by user.',
        ErrorCategory.WALLET,
        { operation: 'user_rejection' },
        error as Error
      );
    }
    
    throw createEnhancedError(
      'Failed to connect to wallet. Please try again.',
      ErrorCategory.WALLET,
      { operation: 'wallet_connection' },
      error as Error
    );
  }
}

/**
 * Switch to a specific network
 */
export async function switchNetwork(chainId: number): Promise<void> {
  if (!isWalletAvailable()) {
    throw createEnhancedError(
      'No wallet available for network switching.',
      ErrorCategory.WALLET,
      { operation: 'network_switch_no_wallet' }
    );
  }
  
  const networkConfig = SUPPORTED_NETWORKS[chainId];
  if (!networkConfig) {
    throw createEnhancedError(
      `Unsupported network with chain ID: ${chainId}`,
      ErrorCategory.WALLET,
      { operation: 'unsupported_network', additionalData: { chainId } }
    );
  }
  
  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }]
    });
  } catch (error: any) {
    // If the network is not added, add it
    if (error.code === 4902 || error.message.includes('Unrecognized chain ID')) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${chainId.toString(16)}`,
            chainName: networkConfig.name,
            rpcUrls: networkConfig.rpcUrls,
            nativeCurrency: networkConfig.nativeCurrency,
            blockExplorerUrls: networkConfig.blockExplorerUrls
          }]
        });
      } catch (addError) {
        throw createEnhancedError(
          `Failed to add network ${networkConfig.name}`,
          ErrorCategory.WALLET,
          { operation: 'add_network', additionalData: { chainId, networkName: networkConfig.name } },
          addError as Error
        );
      }
    } else if (error.code === 4001) {
      throw createEnhancedError(
        'Network switch was rejected by user.',
        ErrorCategory.WALLET,
        { operation: 'network_switch_rejected' },
        error
      );
    } else {
      throw createEnhancedError(
        `Failed to switch to network ${networkConfig.name}`,
        ErrorCategory.WALLET,
        { operation: 'network_switch_failed', additionalData: { chainId, networkName: networkConfig.name } },
        error
      );
    }
  }
}

/**
 * Get current wallet info
 */
export async function getCurrentWalletInfo(): Promise<WalletInfo | null> {
  if (!isWalletAvailable()) {
    return null;
  }
  
  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    });
    
    if (!accounts || accounts.length === 0) {
      return null;
    }
    
    const chainId = await window.ethereum.request({
      method: 'eth_chainId'
    });
    
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest']
    });
    
    const provider = new (window as any).ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    return {
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      balance: balance,
      isConnected: true,
      provider,
      signer
    };
  } catch (error) {
    console.warn('Failed to get current wallet info:', error);
    return null;
  }
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  to: string,
  data: string,
  value: string = '0x0',
  from?: string
): Promise<GasEstimate> {
  if (!isWalletAvailable()) {
    throw createEnhancedError(
      'No wallet available for gas estimation.',
      ErrorCategory.WALLET,
      { operation: 'gas_estimation_no_wallet' }
    );
  }
  
  try {
    const walletInfo = await getCurrentWalletInfo();
    if (!walletInfo) {
      throw createEnhancedError(
        'Wallet not connected for gas estimation.',
        ErrorCategory.WALLET,
        { operation: 'gas_estimation_not_connected' }
      );
    }
    
    const fromAddress = from || walletInfo.address;
    
    // Estimate gas limit
    const gasLimit = await window.ethereum.request({
      method: 'eth_estimateGas',
      params: [{
        from: fromAddress,
        to: to,
        data: data,
        value: value
      }]
    });
    
    // Get gas price
    const gasPrice = await window.ethereum.request({
      method: 'eth_gasPrice'
    });
    
    // Try to get EIP-1559 gas prices
    let maxFeePerGas: string | undefined;
    let maxPriorityFeePerGas: string | undefined;
    
    try {
      const feeData = await window.ethereum.request({
        method: 'eth_feeHistory',
        params: ['0x1', 'latest', [25, 50, 75]]
      });
      
      if (feeData && feeData.baseFeePerGas && feeData.baseFeePerGas.length > 0) {
        const baseFee = parseInt(feeData.baseFeePerGas[feeData.baseFeePerGas.length - 1], 16);
        const priorityFee = Math.floor(baseFee * 0.1); // 10% of base fee as priority
        
        maxPriorityFeePerGas = `0x${priorityFee.toString(16)}`;
        maxFeePerGas = `0x${(baseFee + priorityFee).toString(16)}`;
      }
    } catch (eip1559Error) {
      // EIP-1559 not supported, use legacy gas pricing
      console.warn('EIP-1559 not supported, using legacy gas pricing');
    }
    
    // Calculate estimated cost
    const gasLimitNum = parseInt(gasLimit, 16);
    const gasPriceNum = parseInt(gasPrice, 16);
    const estimatedCost = (gasLimitNum * gasPriceNum).toString();
    
    return {
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      estimatedCost
    };
  } catch (error) {
    throw createEnhancedError(
      'Failed to estimate gas for transaction.',
      ErrorCategory.BLOCKCHAIN,
      { operation: 'gas_estimation', additionalData: { to, data, value, from } },
      error as Error
    );
  }
}

/**
 * Check if user has sufficient balance for transaction
 */
export async function checkSufficientBalance(
  requiredAmount: string,
  address?: string
): Promise<{ sufficient: boolean; balance: string; required: string }> {
  const walletInfo = await getCurrentWalletInfo();
  if (!walletInfo) {
    throw createEnhancedError(
      'Wallet not connected for balance check.',
      ErrorCategory.WALLET,
      { operation: 'balance_check_not_connected' }
    );
  }
  
  const checkAddress = address || walletInfo.address;
  const balance = walletInfo.balance;
  
  const balanceNum = BigInt(balance);
  const requiredNum = BigInt(requiredAmount);
  
  return {
    sufficient: balanceNum >= requiredNum,
    balance: balance,
    required: requiredAmount
  };
}

/**
 * Monitor wallet events
 */
export class WalletMonitor {
  private listeners: {
    accountsChanged: Array<(accounts: string[]) => void>;
    chainChanged: Array<(chainId: string) => void>;
    disconnect: Array<() => void>;
  } = {
    accountsChanged: [],
    chainChanged: [],
    disconnect: []
  };
  
  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    if (!isWalletAvailable()) {
      return;
    }
    
    window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
    window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
    window.ethereum.on('disconnect', this.handleDisconnect.bind(this));
  }
  
  private handleAccountsChanged(accounts: string[]) {
    this.listeners.accountsChanged.forEach(listener => {
      try {
        listener(accounts);
      } catch (error) {
        console.error('Error in accounts changed listener:', error);
      }
    });
  }
  
  private handleChainChanged(chainId: string) {
    this.listeners.chainChanged.forEach(listener => {
      try {
        listener(chainId);
      } catch (error) {
        console.error('Error in chain changed listener:', error);
      }
    });
  }
  
  private handleDisconnect() {
    this.listeners.disconnect.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in disconnect listener:', error);
      }
    });
  }
  
  public onAccountsChanged(listener: (accounts: string[]) => void) {
    this.listeners.accountsChanged.push(listener);
  }
  
  public onChainChanged(listener: (chainId: string) => void) {
    this.listeners.chainChanged.push(listener);
  }
  
  public onDisconnect(listener: () => void) {
    this.listeners.disconnect.push(listener);
  }
  
  public removeListener(event: keyof typeof this.listeners, listener: Function) {
    const eventListeners = this.listeners[event] as Function[];
    const index = eventListeners.indexOf(listener);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  }
  
  public destroy() {
    if (isWalletAvailable()) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
      window.ethereum.removeAllListeners('disconnect');
    }
    
    this.listeners.accountsChanged = [];
    this.listeners.chainChanged = [];
    this.listeners.disconnect = [];
  }
}

/**
 * Get supported networks
 */
export function getSupportedNetworks(): NetworkConfig[] {
  return Object.values(SUPPORTED_NETWORKS);
}

/**
 * Get network config by chain ID
 */
export function getNetworkConfig(chainId: number): NetworkConfig | null {
  return SUPPORTED_NETWORKS[chainId] || null;
}

/**
 * Check if network is supported
 */
export function isNetworkSupported(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS;
}

/**
 * Format balance for display
 */
export function formatBalance(balance: string, decimals = 18, precision = 4): string {
  try {
    const balanceNum = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceNum / divisor;
    const fractionalPart = balanceNum % divisor;
    
    if (fractionalPart === 0n) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.slice(0, precision).replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedFractional}`;
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0';
  }
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get transaction receipt with retry
 */
export async function getTransactionReceipt(
  txHash: string,
  maxWaitTime = 300000 // 5 minutes
): Promise<any> {
  const startTime = Date.now();
  
  return await retryWithBackoff(async () => {
    if (Date.now() - startTime > maxWaitTime) {
      throw createEnhancedError(
        `Transaction receipt timeout after ${maxWaitTime}ms`,
        ErrorCategory.BLOCKCHAIN,
        { operation: 'transaction_receipt_timeout', additionalData: { txHash } }
      );
    }
    
    const receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash]
    });
    
    if (!receipt) {
      throw new Error('Receipt not yet available');
    }
    
    return receipt;
  }, {
    maxAttempts: 60, // 5 minutes with 5 second intervals
    baseDelay: 5000,
    retryCondition: (error) => {
      return error.message.includes('not yet available') ||
             error.message.includes('not found');
    }
  });
}