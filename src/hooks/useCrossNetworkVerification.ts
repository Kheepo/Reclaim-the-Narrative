import { useState, useCallback, useEffect } from 'react';
import { CrossNetworkVerifier, CrossNetworkVerificationResult, ContractAddresses } from '../lib/verification/CrossNetworkVerifier';
import { useWallet } from './useWallet';
import { SUPPORTED_NETWORKS } from '../config/networks';

// Contract ABI for GBVReportRegistry (simplified)
const GBV_REGISTRY_ABI = [
  {
    "inputs": [{"internalType": "string", "name": "reportId", "type": "string"}],
    "name": "getReport",
    "outputs": [
      {"internalType": "address", "name": "reporter", "type": "address"},
      {"internalType": "string", "name": "incidentType", "type": "string"},
      {"internalType": "string", "name": "location", "type": "string"},
      {"internalType": "string", "name": "description", "type": "string"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "string", "name": "ipfsHash", "type": "string"},
      {"internalType": "string[]", "name": "evidenceHashes", "type": "string[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getReportCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Default contract addresses (these should be loaded from environment or config)
const DEFAULT_CONTRACT_ADDRESSES: ContractAddresses = {
  // Ethereum Sepolia
  11155111: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA || '',
  // Ethereum Mainnet
  1: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET || '',
  // Polygon Mumbai
  80001: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MUMBAI || '',
  // Polygon Mainnet
  137: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON || '',
  // BlockDAG Testnet
  24171: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BLOCKDAG_TESTNET || '',
  // BlockDAG Mainnet (placeholder)
  1043: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BLOCKDAG_MAINNET || '',
};

interface VerificationState {
  isVerifying: boolean;
  results: CrossNetworkVerificationResult[];
  currentVerification: CrossNetworkVerificationResult | null;
  error: string | null;
  progress: {
    current: number;
    total: number;
    currentNetwork?: string;
  };
}

interface VerificationOptions {
  targetNetworks?: number[];
  includeOriginalNetwork?: boolean;
  timeoutMs?: number;
}

interface VerificationSummary {
  totalReports: number;
  consensusReached: number;
  discrepanciesFound: number;
  averageConsensus: number;
  networkReliability: { [networkId: number]: number };
}

export function useCrossNetworkVerification() {
  const { currentNetwork } = useWallet();
  const [state, setState] = useState<VerificationState>({
    isVerifying: false,
    results: [],
    currentVerification: null,
    error: null,
    progress: { current: 0, total: 0 },
  });
  
  const [verifier, setVerifier] = useState<CrossNetworkVerifier | null>(null);
  const [contractAddresses, setContractAddresses] = useState<ContractAddresses>(DEFAULT_CONTRACT_ADDRESSES);

  // Initialize verifier when contract addresses change
  useEffect(() => {
    const filteredAddresses = Object.fromEntries(
      Object.entries(contractAddresses).filter(([_, address]) => address && address.length > 0)
    );
    
    if (Object.keys(filteredAddresses).length > 0) {
      const newVerifier = new CrossNetworkVerifier(filteredAddresses, GBV_REGISTRY_ABI);
      setVerifier(newVerifier);
    }
  }, [contractAddresses]);

  /**
   * Update contract addresses
   */
  const updateContractAddresses = useCallback((addresses: Partial<ContractAddresses>) => {
    // Filter out undefined values to maintain ContractAddresses type constraint
    const filteredAddresses = Object.fromEntries(
      Object.entries(addresses).filter(([_, address]) => address !== undefined)
    ) as ContractAddresses;
    
    setContractAddresses(prev => ({ ...prev, ...filteredAddresses }));
  }, []);

  /**
   * Verify a single report across networks
   */
  const verifyReport = useCallback(async (
    reportId: string,
    options: VerificationOptions = {}
  ): Promise<CrossNetworkVerificationResult | null> => {
    if (!verifier) {
      setState(prev => ({ ...prev, error: 'Verifier not initialized' }));
      return null;
    }

    if (!currentNetwork) {
      setState(prev => ({ ...prev, error: 'No network connected' }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isVerifying: true,
      error: null,
      progress: { current: 0, total: 1, currentNetwork: 'Initializing...' },
    }));

    try {
      const targetNetworks = options.targetNetworks || Object.keys(contractAddresses).map(Number);
      const originalNetworkId = currentNetwork.id;

      setState(prev => ({
        ...prev,
        progress: { current: 0, total: targetNetworks.length, currentNetwork: 'Starting verification...' },
      }));

      const result = await verifier.verifyReportAcrossNetworks(
        reportId,
        originalNetworkId,
        targetNetworks
      );

      setState(prev => ({
        ...prev,
        isVerifying: false,
        currentVerification: result,
        results: [result, ...prev.results.filter(r => r.reportId !== reportId)],
        progress: { current: targetNetworks.length, total: targetNetworks.length },
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
        progress: { current: 0, total: 0 },
      }));
      return null;
    }
  }, [verifier, currentNetwork, contractAddresses]);

  /**
   * Batch verify multiple reports
   */
  const batchVerifyReports = useCallback(async (
    reportIds: string[],
    options: VerificationOptions = {}
  ): Promise<CrossNetworkVerificationResult[]> => {
    if (!verifier) {
      setState(prev => ({ ...prev, error: 'Verifier not initialized' }));
      return [];
    }

    if (!currentNetwork) {
      setState(prev => ({ ...prev, error: 'No network connected' }));
      return [];
    }

    setState(prev => ({
      ...prev,
      isVerifying: true,
      error: null,
      progress: { current: 0, total: reportIds.length, currentNetwork: 'Starting batch verification...' },
    }));

    try {
      const targetNetworks = options.targetNetworks || Object.keys(contractAddresses).map(Number);
      const originalNetworkId = currentNetwork.id;
      const results: CrossNetworkVerificationResult[] = [];

      for (let i = 0; i < reportIds.length; i++) {
        const reportId = reportIds[i];
        
        setState(prev => ({
          ...prev,
          progress: {
            current: i,
            total: reportIds.length,
            currentNetwork: `Verifying report ${i + 1}/${reportIds.length}: ${reportId}`,
          },
        }));

        try {
          const result = await verifier.verifyReportAcrossNetworks(
            reportId,
            originalNetworkId,
            targetNetworks
          );
          results.push(result);
        } catch (error) {
          console.error(`Failed to verify report ${reportId}:`, error);
          // Continue with other reports
        }
      }

      setState(prev => ({
        ...prev,
        isVerifying: false,
        results: [...results, ...prev.results.filter(r => !reportIds.includes(r.reportId))],
        progress: { current: reportIds.length, total: reportIds.length },
      }));

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch verification failed';
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: errorMessage,
        progress: { current: 0, total: 0 },
      }));
      return [];
    }
  }, [verifier, currentNetwork, contractAddresses]);

  /**
   * Get verification summary statistics
   */
  const getVerificationSummary = useCallback((): VerificationSummary | null => {
    if (!verifier || state.results.length === 0) {
      return null;
    }

    return verifier.getVerificationSummary(state.results);
  }, [verifier, state.results]);

  /**
   * Clear verification results
   */
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      currentVerification: null,
      error: null,
    }));
  }, []);

  /**
   * Get verification result for a specific report
   */
  const getVerificationResult = useCallback((reportId: string): CrossNetworkVerificationResult | null => {
    return state.results.find(r => r.reportId === reportId) || null;
  }, [state.results]);

  /**
   * Check if a report has been verified
   */
  const isReportVerified = useCallback((reportId: string): boolean => {
    const result = getVerificationResult(reportId);
    return result?.consensusReached || false;
  }, [getVerificationResult]);

  /**
   * Get available networks for verification
   */
  const getAvailableNetworks = useCallback(() => {
    return Object.values(SUPPORTED_NETWORKS).filter(network => 
      contractAddresses[network.id] && contractAddresses[network.id].length > 0
    );
  }, [contractAddresses]);

  /**
   * Get network reliability score
   */
  const getNetworkReliability = useCallback((networkId: number): number => {
    const summary = getVerificationSummary();
    return summary?.networkReliability[networkId] || 0;
  }, [getVerificationSummary]);

  return {
    // State
    isVerifying: state.isVerifying,
    results: state.results,
    currentVerification: state.currentVerification,
    error: state.error,
    progress: state.progress,
    
    // Configuration
    contractAddresses,
    updateContractAddresses,
    
    // Actions
    verifyReport,
    batchVerifyReports,
    clearResults,
    
    // Getters
    getVerificationResult,
    isReportVerified,
    getVerificationSummary,
    getAvailableNetworks,
    getNetworkReliability,
    
    // Utils
    isInitialized: !!verifier,
  };
}

export type {
  VerificationState,
  VerificationOptions,
  VerificationSummary,
  CrossNetworkVerificationResult,
};