import { createConfig, http } from 'wagmi';
import { mainnet, sepolia, polygon, polygonMumbai } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';
import { SUPPORTED_NETWORKS, toWagmiChain } from './networks';

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

// Create transports for each chain
const transports = supportedChains.reduce((acc, chain) => {
  const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === chain.id);
  if (network) {
    acc[chain.id] = http(network.rpcUrl);
  }
  return acc;
}, {} as Record<number, ReturnType<typeof http>>);

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