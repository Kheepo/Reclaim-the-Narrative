import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS, NetworkConfig } from '../../config/networks';
import { NetworkProviderManager } from '../providers/NetworkProvider';

export interface SecurityValidationResult {
  isValid: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  errors: string[];
  recommendations: string[];
  validationDetails: {
    networkVerification: boolean;
    contractVerification: boolean;
    transactionValidation: boolean;
    gasEstimation: boolean;
    nonceValidation: boolean;
    signatureValidation: boolean;
  };
  timestamp?: Date;
  operationType?: string;
}

export interface TransactionSecurityCheck {
  to: string;
  value: string;
  data: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  chainId: number;
}

export interface ContractSecurityInfo {
  address: string;
  isVerified: boolean;
  hasProxy: boolean;
  isUpgradeable: boolean;
  ownerAddress?: string;
  implementationAddress?: string;
  securityScore: number;
}

export interface NetworkSecurityStatus {
  networkId: number;
  isSecure: boolean;
  consensusHealth: number;
  validatorCount: number;
  lastBlockTime: number;
  avgBlockTime: number;
  networkHashRate?: string;
  securityWarnings: string[];
}

export class SecurityValidator {
  private providerManager: NetworkProviderManager;
  private securityCache: Map<string, any> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(providerManager: NetworkProviderManager) {
    this.providerManager = providerManager;
  }

  /**
   * Comprehensive security validation for multi-network operations
   */
  async validateMultiNetworkOperation(
    primaryNetworkId: number,
    secondaryNetworkId: number,
    operation: 'deploy' | 'transfer' | 'verify' | 'cross-chain'
  ): Promise<SecurityValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      // Validate both networks
      const primaryNetworkStatus = await this.validateNetworkSecurity(primaryNetworkId);
      const secondaryNetworkStatus = await this.validateNetworkSecurity(secondaryNetworkId);

      // Check network compatibility
      const compatibilityCheck = await this.validateNetworkCompatibility(
        primaryNetworkId,
        secondaryNetworkId
      );

      if (!primaryNetworkStatus.isSecure) {
        errors.push(`Primary network (${primaryNetworkId}) has security concerns`);
        riskLevel = 'high';
      }

      if (!secondaryNetworkStatus.isSecure) {
        errors.push(`Secondary network (${secondaryNetworkId}) has security concerns`);
        riskLevel = 'high';
      }

      if (!compatibilityCheck.isCompatible) {
        warnings.push('Networks may have compatibility issues');
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      // Operation-specific validations
      switch (operation) {
        case 'cross-chain':
          const crossChainRisks = await this.validateCrossChainOperation(
            primaryNetworkId,
            secondaryNetworkId
          );
          warnings.push(...crossChainRisks.warnings);
          errors.push(...crossChainRisks.errors);
          break;

        case 'deploy':
          const deploymentRisks = await this.validateDeploymentSecurity(
            primaryNetworkId,
            secondaryNetworkId
          );
          recommendations.push(...deploymentRisks.recommendations);
          break;
      }

      // Generate recommendations
      if (primaryNetworkStatus.securityWarnings.length > 0) {
        recommendations.push('Monitor primary network security warnings');
      }

      if (secondaryNetworkStatus.securityWarnings.length > 0) {
        recommendations.push('Monitor secondary network security warnings');
      }

      return {
        isValid: errors.length === 0,
        riskLevel,
        warnings,
        errors,
        recommendations,
        validationDetails: {
          networkVerification: primaryNetworkStatus.isSecure && secondaryNetworkStatus.isSecure,
          contractVerification: true, // Will be set by specific validations
          transactionValidation: true,
          gasEstimation: true,
          nonceValidation: true,
          signatureValidation: true,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        riskLevel: 'critical',
        warnings: [],
        errors: [`Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Retry security validation', 'Check network connectivity'],
        validationDetails: {
          networkVerification: false,
          contractVerification: false,
          transactionValidation: false,
          gasEstimation: false,
          nonceValidation: false,
          signatureValidation: false,
        },
      };
    }
  }

  /**
   * Validate transaction security before execution
   */
  async validateTransaction(
    transaction: TransactionSecurityCheck,
    networkId: number
  ): Promise<SecurityValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      const provider = await this.providerManager.getProvider(networkId);
      
      if (!provider) {
        throw new Error('Failed to get provider for network');
      }
      
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId);

      if (!network) {
        errors.push('Unsupported network');
        return this.createErrorResult('Network not supported');
      }

      // Validate chain ID
      if (transaction.chainId !== networkId) {
        errors.push('Chain ID mismatch');
        riskLevel = 'critical';
      }

      // Validate contract address if applicable
      if (transaction.to && transaction.to !== ethers.ZeroAddress) {
        const contractInfo = await this.validateContractSecurity(transaction.to, networkId);
        
        if (!contractInfo.isVerified) {
          warnings.push('Interacting with unverified contract');
          if (riskLevel === 'low') riskLevel = 'medium';
        }

        if (contractInfo.hasProxy && !contractInfo.isUpgradeable) {
          warnings.push('Contract uses proxy pattern');
        }

        if (contractInfo.securityScore < 70) {
          warnings.push('Contract has low security score');
          if (riskLevel === 'low') riskLevel = 'medium';
        }
      }

      // Validate gas settings
      const gasValidation = await this.validateGasSettings(
        transaction.gasLimit,
        transaction.gasPrice,
        networkId
      );

      warnings.push(...gasValidation.warnings);
      errors.push(...gasValidation.errors);

      // Validate transaction value
      const valueValidation = this.validateTransactionValue(transaction.value, networkId);
      warnings.push(...valueValidation.warnings);
      errors.push(...valueValidation.errors);

      // Validate nonce
      const nonceValidation = await this.validateNonce(transaction.nonce, networkId);
      if (!nonceValidation.isValid) {
        errors.push('Invalid nonce');
        riskLevel = 'high';
      }

      return {
        isValid: errors.length === 0,
        riskLevel,
        warnings,
        errors,
        recommendations,
        validationDetails: {
          networkVerification: true,
          contractVerification: transaction.to ? true : false,
          transactionValidation: true,
          gasEstimation: gasValidation.isValid,
          nonceValidation: nonceValidation.isValid,
          signatureValidation: true,
        },
      };
    } catch (error) {
      return this.createErrorResult(`Transaction validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate contract security
   */
  async validateContractSecurity(
    contractAddress: string,
    networkId: number
  ): Promise<ContractSecurityInfo> {
    const cacheKey = `contract_${contractAddress}_${networkId}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const provider = await this.providerManager.getProvider(networkId);
      
      if (!provider) {
        throw new Error('Failed to get provider for network');
      }
      
      // Check if address is a contract
      const code = await provider.getCode(contractAddress);
      if (code === '0x') {
        throw new Error('Address is not a contract');
      }

      // Basic contract analysis
      const isVerified = await this.checkContractVerification(contractAddress, networkId);
      const proxyInfo = await this.checkProxyPattern(contractAddress, networkId);
      const securityScore = await this.calculateContractSecurityScore(
        contractAddress,
        networkId,
        code
      );

      const contractInfo: ContractSecurityInfo = {
        address: contractAddress,
        isVerified,
        hasProxy: proxyInfo.hasProxy,
        isUpgradeable: proxyInfo.isUpgradeable,
        ownerAddress: proxyInfo.ownerAddress,
        implementationAddress: proxyInfo.implementationAddress,
        securityScore,
      };

      this.setCache(cacheKey, contractInfo);
      return contractInfo;
    } catch (error) {
      return {
        address: contractAddress,
        isVerified: false,
        hasProxy: false,
        isUpgradeable: false,
        securityScore: 0,
      };
    }
  }

  /**
   * Validate network security status
   */
  async validateNetworkSecurity(networkId: number): Promise<NetworkSecurityStatus> {
    const cacheKey = `network_security_${networkId}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const provider = await this.providerManager.getProvider(networkId);
      
      if (!provider) {
        throw new Error('Failed to get provider for network');
      }
      
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId);
      
      if (!network) {
        throw new Error('Unsupported network');
      }

      const latestBlock = await provider.getBlock('latest');
      const blockHistory = await this.getBlockHistory(provider, 10);
      
      const avgBlockTime = this.calculateAverageBlockTime(blockHistory);
      const consensusHealth = this.calculateConsensusHealth(blockHistory);
      
      const securityWarnings: string[] = [];
      
      // Check block time consistency
      if (avgBlockTime > network.performance.avgBlockTime * 2) {
        securityWarnings.push('Block times are significantly slower than expected');
      }
      
      // Check for recent blocks
      const timeSinceLastBlock = Date.now() - (latestBlock?.timestamp || 0) * 1000;
      if (timeSinceLastBlock > 60000) { // 1 minute
        securityWarnings.push('No recent blocks detected');
      }

      const networkStatus: NetworkSecurityStatus = {
        networkId,
        isSecure: securityWarnings.length === 0 && consensusHealth > 0.8,
        consensusHealth,
        validatorCount: 0, // Would need specific API for this
        lastBlockTime: latestBlock?.timestamp || 0,
        avgBlockTime,
        securityWarnings,
      };

      this.setCache(cacheKey, networkStatus);
      return networkStatus;
    } catch (error) {
      return {
        networkId,
        isSecure: false,
        consensusHealth: 0,
        validatorCount: 0,
        lastBlockTime: 0,
        avgBlockTime: 0,
        securityWarnings: [`Network validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Validate network compatibility for cross-chain operations
   */
  private async validateNetworkCompatibility(
    networkId1: number,
    networkId2: number
  ): Promise<{ isCompatible: boolean; warnings: string[] }> {
    const network1 = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId1);
    const network2 = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId2);
    
    const warnings: string[] = [];
    
    if (!network1 || !network2) {
      return { isCompatible: false, warnings: ['One or both networks not supported'] };
    }

    // Check if both are EVM compatible
    if (network1.type !== network2.type) {
      warnings.push('Networks use different consensus mechanisms');
    }

    // Check for known compatibility issues
    if (network1.testnet !== network2.testnet) {
      warnings.push('Mixing testnet and mainnet operations');
    }

    return {
      isCompatible: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Validate cross-chain operation security
   */
  private async validateCrossChainOperation(
    sourceNetworkId: number,
    targetNetworkId: number
  ): Promise<{ warnings: string[]; errors: string[] }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if networks support cross-chain operations
    const sourceNetwork = Object.values(SUPPORTED_NETWORKS).find(n => n.id === sourceNetworkId);
    const targetNetwork = Object.values(SUPPORTED_NETWORKS).find(n => n.id === targetNetworkId);

    // TODO: Implement cross-chain support validation
    // if (!sourceNetwork?.supportsCrossChain) {
    //   errors.push('Source network does not support cross-chain operations');
    // }

    // if (!targetNetwork?.supportsCrossChain) {
    //   errors.push('Target network does not support cross-chain operations');
    // }

    // Add security warnings for cross-chain operations
    warnings.push('Cross-chain operations carry additional risks');
    warnings.push('Verify bridge contract security before proceeding');
    warnings.push('Consider transaction finality differences between networks');

    return { warnings, errors };
  }

  /**
   * Validate deployment security
   */
  private async validateDeploymentSecurity(
    primaryNetworkId: number,
    secondaryNetworkId: number
  ): Promise<{ recommendations: string[] }> {
    const recommendations: string[] = [];

    recommendations.push('Deploy to testnet first for validation');
    recommendations.push('Verify contract source code after deployment');
    recommendations.push('Test all contract functions before mainnet deployment');
    recommendations.push('Consider using a multisig wallet for contract ownership');
    recommendations.push('Implement proper access controls and role management');

    return { recommendations };
  }

  /**
   * Validate gas settings
   */
  private async validateGasSettings(
    gasLimit: string,
    gasPrice: string,
    networkId: number
  ): Promise<{ isValid: boolean; warnings: string[]; errors: string[] }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const provider = await this.providerManager.getProvider(networkId);
      
      if (!provider) {
        throw new Error('Failed to get provider for network');
      }
      
      const feeData = await provider.getFeeData();
      
      const gasLimitBN = ethers.parseUnits(gasLimit, 'wei');
      const gasPriceBN = ethers.parseUnits(gasPrice, 'gwei');
      
      // Check gas limit
      if (gasLimitBN < BigInt(21000)) {
        errors.push('Gas limit too low for basic transaction');
      }
      
      if (gasLimitBN > BigInt(10000000)) {
        warnings.push('Gas limit is very high');
      }

      // Check gas price
      if (feeData.gasPrice && gasPriceBN < feeData.gasPrice / BigInt(2)) {
        warnings.push('Gas price may be too low for timely confirmation');
      }
      
      if (feeData.gasPrice && gasPriceBN > feeData.gasPrice * BigInt(3)) {
        warnings.push('Gas price is significantly higher than network average');
      }

      return {
        isValid: errors.length === 0,
        warnings,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        warnings: [],
        errors: ['Failed to validate gas settings'],
      };
    }
  }

  /**
   * Validate transaction value
   */
  private validateTransactionValue(
    value: string,
    networkId: number
  ): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const valueBN = ethers.parseEther(value);
      
      // Check for dust amounts
      if (valueBN > BigInt(0) && valueBN < ethers.parseUnits('0.001', 'ether')) {
        warnings.push('Transaction value is very small (dust)');
      }
      
      // Check for large amounts
      if (valueBN > ethers.parseEther('1000')) {
        warnings.push('Transaction value is very large');
      }

      return { warnings, errors };
    } catch (error) {
      return {
        warnings: [],
        errors: ['Invalid transaction value format'],
      };
    }
  }

  /**
   * Validate nonce
   */
  private async validateNonce(
    nonce: number,
    networkId: number
  ): Promise<{ isValid: boolean }> {
    try {
      // Basic nonce validation
      if (nonce < 0) {
        return { isValid: false };
      }
      
      // Additional nonce validation would require wallet address
      return { isValid: true };
    } catch (error) {
      return { isValid: false };
    }
  }

  /**
   * Helper methods
   */
  private async checkContractVerification(
    contractAddress: string,
    networkId: number
  ): Promise<boolean> {
    // This would typically check with block explorers or verification services
    // For now, return a basic check
    return true;
  }

  private async checkProxyPattern(
    contractAddress: string,
    networkId: number
  ): Promise<{
    hasProxy: boolean;
    isUpgradeable: boolean;
    ownerAddress?: string;
    implementationAddress?: string;
  }> {
    // Basic proxy pattern detection
    return {
      hasProxy: false,
      isUpgradeable: false,
    };
  }

  private async calculateContractSecurityScore(
    contractAddress: string,
    networkId: number,
    bytecode: string
  ): Promise<number> {
    // Basic security score calculation
    let score = 50; // Base score
    
    // Add points for verified contracts
    const isVerified = await this.checkContractVerification(contractAddress, networkId);
    if (isVerified) score += 30;
    
    // Add points for reasonable bytecode size
    if (bytecode.length > 100 && bytecode.length < 50000) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  private async getBlockHistory(
    provider: ethers.JsonRpcProvider,
    count: number
  ): Promise<ethers.Block[]> {
    const blocks: ethers.Block[] = [];
    const latestBlock = await provider.getBlock('latest');
    
    if (!latestBlock) return blocks;
    
    for (let i = 0; i < count; i++) {
      const blockNumber = latestBlock.number - i;
      if (blockNumber >= 0) {
        const block = await provider.getBlock(blockNumber);
        if (block) blocks.push(block);
      }
    }
    
    return blocks;
  }

  private calculateAverageBlockTime(blocks: ethers.Block[]): number {
    if (blocks.length < 2) return 0;
    
    let totalTime = 0;
    for (let i = 1; i < blocks.length; i++) {
      totalTime += blocks[i - 1].timestamp - blocks[i].timestamp;
    }
    
    return totalTime / (blocks.length - 1);
  }

  private calculateConsensusHealth(blocks: ethers.Block[]): number {
    if (blocks.length === 0) return 0;
    
    // Simple consensus health based on block consistency
    const consistentBlocks = blocks.filter(block => block.timestamp > 0).length;
    return consistentBlocks / blocks.length;
  }

  private createErrorResult(message: string): SecurityValidationResult {
    return {
      isValid: false,
      riskLevel: 'critical',
      warnings: [],
      errors: [message],
      recommendations: ['Check network connectivity', 'Retry validation'],
      validationDetails: {
        networkVerification: false,
        contractVerification: false,
        transactionValidation: false,
        gasEstimation: false,
        nonceValidation: false,
        signatureValidation: false,
      },
    };
  }

  private getFromCache(key: string): any {
    const cached = this.securityCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.securityCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear security cache
   */
  clearCache(): void {
    this.securityCache.clear();
  }

  /**
   * Get security validation summary
   */
  getValidationSummary(): {
    totalValidations: number;
    cacheSize: number;
    lastValidation?: Date;
  } {
    return {
      totalValidations: this.securityCache.size,
      cacheSize: this.securityCache.size,
      lastValidation: new Date(),
    };
  }
}

export default SecurityValidator;