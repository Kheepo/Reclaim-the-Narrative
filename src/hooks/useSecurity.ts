import { useState, useEffect, useCallback, useRef } from 'react';
import { SecurityValidator, SecurityValidationResult, TransactionSecurityCheck, ContractSecurityInfo, NetworkSecurityStatus } from '../lib/security/SecurityValidator';
import { getProviderManager } from '../lib/providers/NetworkProvider';
import { NetworkProviderManager } from '../lib/providers/NetworkProvider';

export interface SecurityState {
  isValidating: boolean;
  lastValidation?: Date;
  validationResults: Map<string, SecurityValidationResult>;
  contractSecurityInfo: Map<string, ContractSecurityInfo>;
  networkSecurityStatus: Map<number, NetworkSecurityStatus>;
  error?: string;
}

export interface SecurityHookReturn {
  securityState: SecurityState;
  validateMultiNetworkOperation: (
    primaryNetworkId: number,
    secondaryNetworkId: number,
    operation: 'deploy' | 'transfer' | 'verify' | 'cross-chain'
  ) => Promise<SecurityValidationResult>;
  validateTransaction: (
    transaction: TransactionSecurityCheck,
    networkId: number
  ) => Promise<SecurityValidationResult>;
  validateContract: (
    contractAddress: string,
    networkId: number
  ) => Promise<ContractSecurityInfo>;
  validateNetwork: (networkId: number) => Promise<NetworkSecurityStatus>;
  clearValidationCache: () => void;
  getValidationHistory: (operationType?: string) => SecurityValidationResult[];
  getSecuritySummary: () => {
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    averageRiskLevel: string;
    lastValidation?: Date;
  };
  isOperationSafe: (validationResult: SecurityValidationResult) => boolean;
  getRecommendations: (validationResult: SecurityValidationResult) => string[];
}

export const useSecurity = (): SecurityHookReturn => {
  const getProviderManagerLazy = useCallback(() => getProviderManager(), []);
  const [securityState, setSecurityState] = useState<SecurityState>({
    isValidating: false,
    validationResults: new Map(),
    contractSecurityInfo: new Map(),
    networkSecurityStatus: new Map(),
  });
  
  const securityValidatorRef = useRef<SecurityValidator | null>(null);
  const validationHistoryRef = useRef<Array<SecurityValidationResult & { timestamp: Date; operationType: string }>>([]);

  // Initialize security validator lazily
  const getSecurityValidator = useCallback(() => {
    if (!securityValidatorRef.current) {
      const providerManager = getProviderManagerLazy();
      securityValidatorRef.current = new SecurityValidator(providerManager);
    }
    return securityValidatorRef.current;
  }, [getProviderManagerLazy]);

  /**
   * Validate multi-network operation
   */
  const validateMultiNetworkOperation = useCallback(async (
    primaryNetworkId: number,
    secondaryNetworkId: number,
    operation: 'deploy' | 'transfer' | 'verify' | 'cross-chain'
  ): Promise<SecurityValidationResult> => {
    setSecurityState(prev => ({ ...prev, isValidating: true, error: undefined }));

    try {
      const securityValidator = getSecurityValidator();
      const result = await securityValidator.validateMultiNetworkOperation(
        primaryNetworkId,
        secondaryNetworkId,
        operation
      );

      const validationKey = `multi_${primaryNetworkId}_${secondaryNetworkId}_${operation}`;
      
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        lastValidation: new Date(),
        validationResults: new Map(prev.validationResults.set(validationKey, result)),
      }));

      // Add to history
      validationHistoryRef.current.push({
        ...result,
        timestamp: new Date(),
        operationType: `multi-network-${operation}`,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [getSecurityValidator]);

  /**
   * Validate transaction
   */
  const validateTransaction = useCallback(async (
    transaction: TransactionSecurityCheck,
    networkId: number
  ): Promise<SecurityValidationResult> => {
    setSecurityState(prev => ({ ...prev, isValidating: true, error: undefined }));

    try {
      const securityValidator = getSecurityValidator();
      const result = await securityValidator.validateTransaction(transaction, networkId);
      
      const validationKey = `tx_${transaction.to}_${networkId}_${Date.now()}`;
      
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        lastValidation: new Date(),
        validationResults: new Map(prev.validationResults.set(validationKey, result)),
      }));

      // Add to history
      validationHistoryRef.current.push({
        ...result,
        timestamp: new Date(),
        operationType: 'transaction',
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [getSecurityValidator]);

  /**
   * Validate contract security
   */
  const validateContract = useCallback(async (
    contractAddress: string,
    networkId: number
  ): Promise<ContractSecurityInfo> => {
    setSecurityState(prev => ({ ...prev, isValidating: true, error: undefined }));

    try {
      const securityValidator = getSecurityValidator();
      const result = await securityValidator.validateContractSecurity(
        contractAddress,
        networkId
      );
      
      const contractKey = `${contractAddress}_${networkId}`;
      
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        lastValidation: new Date(),
        contractSecurityInfo: new Map(prev.contractSecurityInfo.set(contractKey, result)),
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [getSecurityValidator]);

  /**
   * Validate network security
   */
  const validateNetwork = useCallback(async (networkId: number): Promise<NetworkSecurityStatus> => {
    setSecurityState(prev => ({ ...prev, isValidating: true, error: undefined }));

    try {
      const securityValidator = getSecurityValidator();
      const result = await securityValidator.validateNetworkSecurity(networkId);
      
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        lastValidation: new Date(),
        networkSecurityStatus: new Map(prev.networkSecurityStatus.set(networkId, result)),
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSecurityState(prev => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [getSecurityValidator]);

  /**
   * Clear validation cache
   */
  const clearValidationCache = useCallback(() => {
    try {
      const securityValidator = getSecurityValidator();
      securityValidator.clearCache();
    } catch (error) {
      // Ignore errors if validator not initialized yet
    }
    
    setSecurityState(prev => ({
      ...prev,
      validationResults: new Map(),
      contractSecurityInfo: new Map(),
      networkSecurityStatus: new Map(),
    }));
    
    validationHistoryRef.current = [];
  }, [getSecurityValidator]);

  /**
   * Get validation history
   */
  const getValidationHistory = useCallback((operationType?: string): SecurityValidationResult[] => {
    let history = validationHistoryRef.current;
    
    if (operationType) {
      history = history.filter(item => item.operationType === operationType);
    }
    
    return history;
  }, []);

  /**
   * Get security summary
   */
  const getSecuritySummary = useCallback(() => {
    const history = validationHistoryRef.current;
    const totalValidations = history.length;
    const successfulValidations = history.filter(item => item.isValid).length;
    const failedValidations = totalValidations - successfulValidations;
    
    // Calculate average risk level
    const riskLevels = history.map(item => item.riskLevel);
    const riskScores = riskLevels.map(level => {
      switch (level) {
        case 'low': return 1;
        case 'medium': return 2;
        case 'high': return 3;
        case 'critical': return 4;
        default: return 0;
      }
    });
    
    const averageRiskScore = riskScores.length > 0 
      ? riskScores.reduce((sum: number, score) => sum + score, 0) / riskScores.length
      : 0;
    
    const averageRiskLevel = averageRiskScore <= 1.5 ? 'low' 
      : averageRiskScore <= 2.5 ? 'medium'
      : averageRiskScore <= 3.5 ? 'high'
      : 'critical';
    
    return {
      totalValidations,
      successfulValidations,
      failedValidations,
      averageRiskLevel,
      lastValidation: history.length > 0 ? history[history.length - 1].timestamp : undefined,
    };
  }, []);

  /**
   * Check if operation is safe
   */
  const isOperationSafe = useCallback((validationResult: SecurityValidationResult): boolean => {
    return validationResult.isValid && 
           validationResult.riskLevel !== 'critical' && 
           validationResult.errors.length === 0;
  }, []);

  /**
   * Get recommendations based on validation result
   */
  const getRecommendations = useCallback((validationResult: SecurityValidationResult): string[] => {
    const recommendations = [...validationResult.recommendations];
    
    // Add risk-level specific recommendations
    switch (validationResult.riskLevel) {
      case 'critical':
        recommendations.unshift('⚠️ CRITICAL: Do not proceed with this operation');
        recommendations.push('Review all errors and warnings before retrying');
        break;
      case 'high':
        recommendations.unshift('⚠️ HIGH RISK: Proceed with extreme caution');
        recommendations.push('Consider additional security measures');
        break;
      case 'medium':
        recommendations.unshift('⚠️ MEDIUM RISK: Review warnings carefully');
        break;
      case 'low':
        recommendations.unshift('✅ LOW RISK: Operation appears safe');
        break;
    }
    
    // Add validation-specific recommendations
    if (!validationResult.validationDetails.networkVerification) {
      recommendations.push('Verify network connectivity and security');
    }
    
    if (!validationResult.validationDetails.contractVerification) {
      recommendations.push('Verify contract source code and security audit');
    }
    
    if (!validationResult.validationDetails.gasEstimation) {
      recommendations.push('Review gas settings and network fees');
    }
    
    return recommendations;
  }, []);

  return {
    securityState,
    validateMultiNetworkOperation,
    validateTransaction,
    validateContract,
    validateNetwork,
    clearValidationCache,
    getValidationHistory,
    getSecuritySummary,
    isOperationSafe,
    getRecommendations,
  };
};

/**
 * Hook for contract-specific security validation
 */
export const useContractSecurity = (contractAddress?: string, networkId?: number) => {
  const { validateContract, securityState } = useSecurity();
  const [contractInfo, setContractInfo] = useState<ContractSecurityInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const validateContractSecurity = useCallback(async () => {
    if (!contractAddress || !networkId) return;
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      const result = await validateContract(contractAddress, networkId);
      setContractInfo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, networkId, validateContract]);

  useEffect(() => {
    if (contractAddress && networkId) {
      validateContractSecurity();
    }
  }, [contractAddress, networkId, validateContractSecurity]);

  return {
    contractInfo,
    isLoading,
    error,
    refetch: validateContractSecurity,
  };
};

/**
 * Hook for network-specific security monitoring
 */
export const useNetworkSecurity = (networkId?: number) => {
  const { validateNetwork, securityState } = useSecurity();
  const [networkStatus, setNetworkStatus] = useState<NetworkSecurityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const validateNetworkSecurity = useCallback(async () => {
    if (!networkId) return;
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      const result = await validateNetwork(networkId);
      setNetworkStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [networkId, validateNetwork]);

  useEffect(() => {
    if (networkId) {
      validateNetworkSecurity();
    }
  }, [networkId, validateNetworkSecurity]);

  return {
    networkStatus,
    isLoading,
    error,
    refetch: validateNetworkSecurity,
  };
};

export default useSecurity;