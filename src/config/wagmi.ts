import { createConfig, http, fallback } from 'wagmi';
import { mainnet, sepolia, polygon, polygonMumbai } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';
import { SUPPORTED_NETWORKS, toWagmiChain, isBlockDAGNetwork } from './networks';

// Convert our supported networks to wagmi chains
const supportedChains = Object.values(SUPPORTED_NETWORKS)
  .filter(network => network.enabled)
  .map(network => {
    // Use predefined chains for known networks, custom for BlockDAG
    switch (network.id) {
      case 1:
        return mainnet;
      case 11155111:
        return sepolia;
      case 137:
        return polygon;
      case 80001:
        return polygonMumbai;
      default:
        return toWagmiChain(network);
    }
  });

// Create enhanced transports for each chain with BlockDAG optimizations
const transports = supportedChains.reduce((acc, chain) => {
  const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chain.id);
  if (network) {
    const isBlockDAG = isBlockDAGNetwork(chain.id);
    
    if (isBlockDAG) {
      // Enhanced transport configuration for BlockDAG networks
      const primaryRpc = http(network.rpcUrl, {
        timeout: 30000, // 30 seconds for BlockDAG
        retryCount: 5,
        retryDelay: 2000,
      });
      
      // Add fallback RPC for BlockDAG Testnet
      const fallbackRpcs = [];
      if (chain.id === 19188) { // BlockDAG Testnet
        fallbackRpcs.push(
          http('https://rpc-backup.primordial.bdagscan.com', {
            timeout: 30000,
            retryCount: 3,
            retryDelay: 1500,
          })
        );
      }
      
      acc[chain.id] = fallbackRpcs.length > 0 
        ? fallback([primaryRpc, ...fallbackRpcs])
        : primaryRpc;
    } else {
      // Standard transport configuration for Ethereum networks
      acc[chain.id] = http(network.rpcUrl, {
        timeout: 10000,
        retryCount: 3,
        retryDelay: 1000,
      });
    }
  }
  return acc;
}, {} as Record<number, any>);

// WalletConnect project ID (you should get this from WalletConnect Cloud)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id';

export const wagmiConfig = createConfig({
  chains: supportedChains as any,
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports,
  ssr: true,
});

export { supportedChains };