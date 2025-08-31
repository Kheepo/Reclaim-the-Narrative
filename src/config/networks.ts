import { Chain } from 'wagmi/chains';

export interface NetworkConfig {
  id: number;
  name: string;
  displayName: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  testnet: boolean;
  enabled: boolean;
  features: {
    eip1559: boolean;
    multicall: boolean;
    ensSupport: boolean;
  };
  performance: {
    avgBlockTime: number; // in seconds
    tps: number; // transactions per second
    finality: 'instant' | 'fast' | 'standard';
  };
  contracts?: {
    gbvRegistry?: string;
    multicall?: string;
  };
}

export interface BlockDAGNetworkConfig extends NetworkConfig {
  type: 'blockdag';
  dagFeatures: {
    parallelProcessing: boolean;
    powConsensus: boolean;
    evmCompatibility: boolean;
  };
}

export interface EthereumNetworkConfig extends NetworkConfig {
  type: 'ethereum';
  layer: 1 | 2;
}

export type SupportedNetwork = BlockDAGNetworkConfig | EthereumNetworkConfig;

// BlockDAG Networks
export const BLOCKDAG_TESTNET: BlockDAGNetworkConfig = {
  id: 1043,
  name: 'blockdag-testnet',
  displayName: 'BlockDAG Testnet',
  type: 'blockdag',
  rpcUrl: process.env.NEXT_PUBLIC_BLOCKDAG_TESTNET_RPC_URL || 'https://rpc.primordial.bdagscan.com',
  blockExplorerUrl: process.env.NEXT_PUBLIC_BLOCKDAG_TESTNET_EXPLORER || 'https://primordial.bdagscan.com',
  nativeCurrency: {
    name: 'BlockDAG',
    symbol: 'BDAG',
    decimals: 18,
  },
  testnet: true,
  enabled: true,
  features: {
    eip1559: true,
    multicall: true,
    ensSupport: false,
  },
  performance: {
    avgBlockTime: 0.1, // 100ms
    tps: 100,
    finality: 'fast',
  },
  dagFeatures: {
    parallelProcessing: true,
    powConsensus: true,
    evmCompatibility: true,
  },
  contracts: {
    gbvRegistry: process.env.NEXT_PUBLIC_BLOCKDAG_TESTNET_CONTRACT_ADDRESS,
  },
};

export const BLOCKDAG_MAINNET: BlockDAGNetworkConfig = {
  id: 1044, // BlockDAG Mainnet chain ID
  name: 'blockdag-mainnet',
  displayName: 'BlockDAG Mainnet',
  type: 'blockdag',
  rpcUrl: process.env.NEXT_PUBLIC_BLOCKDAG_MAINNET_RPC_URL || '',
  blockExplorerUrl: process.env.NEXT_PUBLIC_BLOCKDAG_MAINNET_EXPLORER || 'https://bdagscan.com',
  nativeCurrency: {
    name: 'BlockDAG',
    symbol: 'BDAG',
    decimals: 18,
  },
  testnet: false,
  enabled: true, // Enable for development
  features: {
    eip1559: true,
    multicall: true,
    ensSupport: false,
  },
  performance: {
    avgBlockTime: 0.1,
    tps: 1000,
    finality: 'fast',
  },
  dagFeatures: {
    parallelProcessing: true,
    powConsensus: true,
    evmCompatibility: true,
  },
  contracts: {
    gbvRegistry: process.env.NEXT_PUBLIC_BLOCKDAG_MAINNET_CONTRACT_ADDRESS,
  },
};

// Ethereum Networks
export const ETHEREUM_SEPOLIA: EthereumNetworkConfig = {
  id: 11155111,
  name: 'sepolia',
  displayName: 'Ethereum Sepolia',
  type: 'ethereum',
  layer: 1,
  rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
  blockExplorerUrl: 'https://sepolia.etherscan.io',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'SEP',
    decimals: 18,
  },
  testnet: true,
  enabled: true,
  features: {
    eip1559: true,
    multicall: true,
    ensSupport: true,
  },
  performance: {
    avgBlockTime: 12,
    tps: 15,
    finality: 'standard',
  },
  contracts: {
    gbvRegistry: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA,
  },
};

export const ETHEREUM_MAINNET: EthereumNetworkConfig = {
  id: 1,
  name: 'mainnet',
  displayName: 'Ethereum Mainnet',
  type: 'ethereum',
  layer: 1,
  rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://ethereum.publicnode.com',
  blockExplorerUrl: 'https://etherscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  testnet: false,
  enabled: true,
  features: {
    eip1559: true,
    multicall: true,
    ensSupport: true,
  },
  performance: {
    avgBlockTime: 12,
    tps: 15,
    finality: 'standard',
  },
  contracts: {
    gbvRegistry: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET,
  },
};

// Polygon Networks
export const POLYGON_AMOY: EthereumNetworkConfig = {
  id: 80002,
  name: 'polygon-amoy',
  displayName: 'Polygon Amoy',
  type: 'ethereum',
  layer: 2,
  rpcUrl: process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
  blockExplorerUrl: 'https://amoy.polygonscan.com',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  testnet: true,
  enabled: true,
  features: {
    eip1559: true,
    multicall: true,
    ensSupport: false,
  },
  performance: {
    avgBlockTime: 2,
    tps: 65,
    finality: 'fast',
  },
  contracts: {
    gbvRegistry: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MUMBAI,
  },
};

export const POLYGON_MAINNET: EthereumNetworkConfig = {
  id: 137,
  name: 'polygon',
  displayName: 'Polygon Mainnet',
  type: 'ethereum',
  layer: 2,
  rpcUrl: process.env.NEXT_PUBLIC_POLYGON_MAINNET_RPC_URL || 'https://polygon-bor.publicnode.com',
  blockExplorerUrl: 'https://polygonscan.com',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  testnet: false,
  enabled: true,
  features: {
    eip1559: true,
    multicall: true,
    ensSupport: false,
  },
  performance: {
    avgBlockTime: 2,
    tps: 65,
    finality: 'fast',
  },
  contracts: {
    gbvRegistry: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON,
  },
};

// Network Registry
export const SUPPORTED_NETWORKS: Record<number, SupportedNetwork> = {
  [BLOCKDAG_TESTNET.id]: BLOCKDAG_TESTNET,
  [BLOCKDAG_MAINNET.id]: BLOCKDAG_MAINNET,
  [ETHEREUM_SEPOLIA.id]: ETHEREUM_SEPOLIA,
  [ETHEREUM_MAINNET.id]: ETHEREUM_MAINNET,
  [POLYGON_AMOY.id]: POLYGON_AMOY,
  [POLYGON_MAINNET.id]: POLYGON_MAINNET,
};

// Default networks for different environments
export const DEFAULT_NETWORKS = {
  development: BLOCKDAG_TESTNET,
  staging: BLOCKDAG_TESTNET,
  production: BLOCKDAG_MAINNET,
};

// Network groups
export const TESTNET_NETWORKS = Object.values(SUPPORTED_NETWORKS).filter(n => n.testnet);
export const MAINNET_NETWORKS = Object.values(SUPPORTED_NETWORKS).filter(n => !n.testnet);
export const BLOCKDAG_NETWORKS = Object.values(SUPPORTED_NETWORKS).filter(n => n.type === 'blockdag');
export const ETHEREUM_NETWORKS = Object.values(SUPPORTED_NETWORKS).filter(n => n.type === 'ethereum');

// Utility functions
export function getNetworkById(chainId: number): SupportedNetwork | undefined {
  return SUPPORTED_NETWORKS[chainId];
}

export function getNetworkByName(name: string): SupportedNetwork | undefined {
  return Object.values(SUPPORTED_NETWORKS).find(network => network.name === name);
}

export function isBlockDAGNetwork(chainId: number): boolean {
  const network = getNetworkById(chainId);
  return network?.type === 'blockdag' || false;
}

export function isEthereumNetwork(chainId: number): boolean {
  const network = getNetworkById(chainId);
  return network?.type === 'ethereum' || false;
}

export function getEnabledNetworks(): SupportedNetwork[] {
  return Object.values(SUPPORTED_NETWORKS).filter(network => network.enabled);
}

export function getNetworkDisplayName(chainId: number): string {
  const network = getNetworkById(chainId);
  return network?.displayName || `Unknown Network (${chainId})`;
}

export function getBlockExplorerUrl(chainId: number, txHash?: string): string {
  const network = getNetworkById(chainId);
  if (!network) return '';
  
  if (txHash) {
    return `${network.blockExplorerUrl}/tx/${txHash}`;
  }
  return network.blockExplorerUrl;
}

// Convert to Wagmi Chain format for wallet integration
export function toWagmiChain(network: SupportedNetwork): Chain {
  const baseChain: Chain = {
    id: network.id,
    name: network.displayName,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: {
      default: {
        http: [network.rpcUrl],
      },
      public: {
        http: [network.rpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: network.type === 'blockdag' ? 'BlockDAG Explorer' : 'Explorer',
        url: network.blockExplorerUrl,
      },
    },
    testnet: network.testnet,
  };

  // Add BlockDAG-specific enhancements
  if (network.type === 'blockdag') {
    const blockdagNetwork = network as BlockDAGNetworkConfig;
    
    // Add fallback RPC URLs for BlockDAG networks
    if (network.id === 1043) { // BlockDAG Testnet
      baseChain.rpcUrls.default.http = [...baseChain.rpcUrls.default.http, 'https://rpc-backup.primordial.bdagscan.com'];
      baseChain.rpcUrls.public.http = [...baseChain.rpcUrls.public.http, 'https://rpc-backup.primordial.bdagscan.com'];
    }
    
    // Add custom properties for BlockDAG
    return {
      ...baseChain,
      fees: {
        defaultPriorityFee: BigInt(1000000000), // 1 gwei for BlockDAG
      },
      formatters: {
        // Custom formatters for BlockDAG if needed
      },
      serializers: {
        // Custom serializers for BlockDAG if needed
      },
    };
  }

  return baseChain;
}

export const WAGMI_CHAINS = getEnabledNetworks().map(toWagmiChain);