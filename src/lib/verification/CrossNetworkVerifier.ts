import { ethers } from 'ethers';
import { getProviderManager } from '../providers/NetworkProvider';
import { SUPPORTED_NETWORKS, NetworkConfig } from '../../config/networks';

interface ReportData {
  id: string;
  reporterAddress: string;
  incidentType: string;
  location: string;
  description: string;
  timestamp: number;
  ipfsHash?: string;
  evidenceHashes?: string[];
}

interface NetworkReportStatus {
  networkId: number;
  networkName: string;
  contractAddress?: string;
  reportExists: boolean;
  reportId?: string;
  blockNumber?: number;
  transactionHash?: string;
  gasUsed?: string;
  timestamp?: number;
  verified: boolean;
  error?: string;
}

interface CrossNetworkVerificationResult {
  reportId: string;
  originalNetwork: number;
  verificationTimestamp: number;
  networks: NetworkReportStatus[];
  consensusReached: boolean;
  consensusPercentage: number;
  discrepancies: string[];
  recommendations: string[];
}

interface ContractAddresses {
  [networkId: number]: string;
}

class CrossNetworkVerifier {
  private providerManager = getProviderManager();
  private contractAddresses: ContractAddresses = {};
  private contractABI: any[] = [];

  constructor(contractAddresses: ContractAddresses, contractABI: any[]) {
    this.contractAddresses = contractAddresses;
    this.contractABI = contractABI;
  }

  /**
   * Verify a report across multiple networks
   */
  async verifyReportAcrossNetworks(
    reportId: string,
    originalNetworkId: number,
    targetNetworks?: number[]
  ): Promise<CrossNetworkVerificationResult> {
    console.log(`🔍 Starting cross-network verification for report ${reportId}`);
    
    const networks = targetNetworks || Object.keys(this.contractAddresses).map(Number);
    const verificationResults: NetworkReportStatus[] = [];
    const discrepancies: string[] = [];
    
    // Get original report data
    const originalReport = await this.getReportFromNetwork(reportId, originalNetworkId);
    if (!originalReport) {
      throw new Error(`Report ${reportId} not found on original network ${originalNetworkId}`);
    }

    // Verify on each target network
    for (const networkId of networks) {
      try {
        const status = await this.verifyReportOnNetwork(reportId, networkId, originalReport);
        verificationResults.push(status);
        
        // Check for discrepancies
        if (status.reportExists && originalReport) {
          const networkReport = await this.getReportFromNetwork(reportId, networkId);
          if (networkReport) {
            const reportDiscrepancies = this.compareReports(originalReport, networkReport, networkId);
            discrepancies.push(...reportDiscrepancies);
          }
        }
      } catch (error) {
        console.error(`❌ Verification failed on network ${networkId}:`, error);
        verificationResults.push({
          networkId,
          networkName: this.getNetworkName(networkId),
          reportExists: false,
          verified: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Calculate consensus
    const verifiedNetworks = verificationResults.filter(r => r.verified && r.reportExists);
    const consensusPercentage = (verifiedNetworks.length / verificationResults.length) * 100;
    const consensusReached = consensusPercentage >= 66.67; // 2/3 majority

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      verificationResults,
      discrepancies,
      consensusReached
    );

    const result: CrossNetworkVerificationResult = {
      reportId,
      originalNetwork: originalNetworkId,
      verificationTimestamp: Date.now(),
      networks: verificationResults,
      consensusReached,
      consensusPercentage,
      discrepancies,
      recommendations,
    };

    console.log(`✅ Cross-network verification completed. Consensus: ${consensusReached ? 'YES' : 'NO'} (${consensusPercentage.toFixed(1)}%)`);
    
    return result;
  }

  /**
   * Verify a specific report on a specific network
   */
  private async verifyReportOnNetwork(
    reportId: string,
    networkId: number,
    originalReport: ReportData
  ): Promise<NetworkReportStatus> {
    const networkName = this.getNetworkName(networkId);
    console.log(`   Verifying on ${networkName}...`);

    const status: NetworkReportStatus = {
      networkId,
      networkName,
      contractAddress: this.contractAddresses[networkId],
      reportExists: false,
      verified: false,
    };

    try {
      const provider = this.providerManager.getProvider(networkId);
      if (!provider) {
        throw new Error(`Provider not available for network ${networkId}`);
      }

      const contractAddress = this.contractAddresses[networkId];
      if (!contractAddress) {
        throw new Error(`Contract address not configured for network ${networkId}`);
      }

      const contract = new ethers.Contract(contractAddress, this.contractABI, provider);

      // Check if report exists
      try {
        const reportData = await contract.getReport(reportId);
        
        if (reportData && reportData.reporter !== ethers.ZeroAddress) {
          status.reportExists = true;
          status.reportId = reportId;
          
          // Get additional details
          const reportCount = await contract.getReportCount();
          status.verified = true;
          
          console.log(`     ✅ Report found on ${networkName}`);
        } else {
          console.log(`     ❌ Report not found on ${networkName}`);
        }
      } catch (contractError) {
        // Report might not exist or contract might have different interface
        console.log(`     ❌ Report not accessible on ${networkName}`);
        status.error = contractError instanceof Error ? contractError.message : 'Contract call failed';
      }

    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`     ❌ Network verification failed: ${status.error}`);
    }

    return status;
  }

  /**
   * Get report data from a specific network
   */
  private async getReportFromNetwork(reportId: string, networkId: number): Promise<ReportData | null> {
    try {
      const provider = this.providerManager.getProvider(networkId);
      if (!provider) return null;

      const contractAddress = this.contractAddresses[networkId];
      if (!contractAddress) return null;

      const contract = new ethers.Contract(contractAddress, this.contractABI, provider);
      const reportData = await contract.getReport(reportId);

      if (reportData && reportData.reporter !== ethers.ZeroAddress) {
        return {
          id: reportId,
          reporterAddress: reportData.reporter,
          incidentType: reportData.incidentType,
          location: reportData.location,
          description: reportData.description,
          timestamp: Number(reportData.timestamp),
          ipfsHash: reportData.ipfsHash,
          evidenceHashes: reportData.evidenceHashes || [],
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting report from network ${networkId}:`, error);
      return null;
    }
  }

  /**
   * Compare two reports for discrepancies
   */
  private compareReports(report1: ReportData, report2: ReportData, networkId: number): string[] {
    const discrepancies: string[] = [];
    const networkName = this.getNetworkName(networkId);

    if (report1.reporterAddress !== report2.reporterAddress) {
      discrepancies.push(`Reporter address mismatch on ${networkName}: ${report1.reporterAddress} vs ${report2.reporterAddress}`);
    }

    if (report1.incidentType !== report2.incidentType) {
      discrepancies.push(`Incident type mismatch on ${networkName}: ${report1.incidentType} vs ${report2.incidentType}`);
    }

    if (report1.location !== report2.location) {
      discrepancies.push(`Location mismatch on ${networkName}: ${report1.location} vs ${report2.location}`);
    }

    if (report1.description !== report2.description) {
      discrepancies.push(`Description mismatch on ${networkName}`);
    }

    if (Math.abs(report1.timestamp - report2.timestamp) > 300) { // 5 minutes tolerance
      discrepancies.push(`Timestamp mismatch on ${networkName}: ${new Date(report1.timestamp * 1000)} vs ${new Date(report2.timestamp * 1000)}`);
    }

    if (report1.ipfsHash !== report2.ipfsHash) {
      discrepancies.push(`IPFS hash mismatch on ${networkName}: ${report1.ipfsHash} vs ${report2.ipfsHash}`);
    }

    return discrepancies;
  }

  /**
   * Generate recommendations based on verification results
   */
  private generateRecommendations(
    results: NetworkReportStatus[],
    discrepancies: string[],
    consensusReached: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (!consensusReached) {
      recommendations.push('⚠️ Consensus not reached - manual review required');
      recommendations.push('Consider investigating networks with verification failures');
    }

    if (discrepancies.length > 0) {
      recommendations.push('⚠️ Data discrepancies detected between networks');
      recommendations.push('Review report data integrity and synchronization');
    }

    const failedNetworks = results.filter(r => !r.verified);
    if (failedNetworks.length > 0) {
      recommendations.push(`⚠️ Verification failed on ${failedNetworks.length} network(s)`);
      recommendations.push('Check network connectivity and contract deployments');
    }

    const missingReports = results.filter(r => r.verified && !r.reportExists);
    if (missingReports.length > 0) {
      recommendations.push(`📝 Report missing on ${missingReports.length} network(s)`);
      recommendations.push('Consider cross-network synchronization');
    }

    if (consensusReached && discrepancies.length === 0) {
      recommendations.push('✅ Report verified successfully across networks');
      recommendations.push('Data integrity confirmed');
    }

    return recommendations;
  }

  /**
   * Get network name by ID
   */
  private getNetworkName(networkId: number): string {
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId);
    return network?.displayName || `Network ${networkId}`;
  }

  /**
   * Batch verify multiple reports
   */
  async batchVerifyReports(
    reportIds: string[],
    originalNetworkId: number,
    targetNetworks?: number[]
  ): Promise<CrossNetworkVerificationResult[]> {
    console.log(`🔍 Starting batch verification for ${reportIds.length} reports`);
    
    const results: CrossNetworkVerificationResult[] = [];
    
    for (const reportId of reportIds) {
      try {
        const result = await this.verifyReportAcrossNetworks(reportId, originalNetworkId, targetNetworks);
        results.push(result);
      } catch (error) {
        console.error(`❌ Batch verification failed for report ${reportId}:`, error);
        // Continue with other reports
      }
    }
    
    console.log(`✅ Batch verification completed. ${results.length}/${reportIds.length} reports processed`);
    
    return results;
  }

  /**
   * Get verification summary statistics
   */
  getVerificationSummary(results: CrossNetworkVerificationResult[]): {
    totalReports: number;
    consensusReached: number;
    discrepanciesFound: number;
    averageConsensus: number;
    networkReliability: { [networkId: number]: number };
  } {
    const totalReports = results.length;
    const consensusReached = results.filter(r => r.consensusReached).length;
    const discrepanciesFound = results.filter(r => r.discrepancies.length > 0).length;
    const averageConsensus = results.reduce((sum, r) => sum + r.consensusPercentage, 0) / totalReports;

    // Calculate network reliability
    const networkReliability: { [networkId: number]: number } = {};
    const networkStats: { [networkId: number]: { total: number; verified: number } } = {};

    results.forEach(result => {
      result.networks.forEach(network => {
        if (!networkStats[network.networkId]) {
          networkStats[network.networkId] = { total: 0, verified: 0 };
        }
        networkStats[network.networkId].total++;
        if (network.verified) {
          networkStats[network.networkId].verified++;
        }
      });
    });

    Object.keys(networkStats).forEach(networkId => {
      const id = Number(networkId);
      const stats = networkStats[id];
      networkReliability[id] = (stats.verified / stats.total) * 100;
    });

    return {
      totalReports,
      consensusReached,
      discrepanciesFound,
      averageConsensus,
      networkReliability,
    };
  }
}

export {
  CrossNetworkVerifier,
  type ReportData,
  type NetworkReportStatus,
  type CrossNetworkVerificationResult,
  type ContractAddresses,
};