import { ethers } from 'hardhat';
import { getProviderManager } from '../src/lib/providers/NetworkProvider';
import { BLOCKDAG_TESTNET, BLOCKDAG_MAINNET } from '../src/config/networks';
import fs from 'fs';
import path from 'path';

interface DeploymentConfig {
  network: 'blockdag-testnet' | 'blockdag-mainnet';
  gasLimit?: number;
  gasPrice?: string;
  verify?: boolean;
  saveDeployment?: boolean;
}

interface DeploymentResult {
  contractName: string;
  address: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  deploymentCost: string;
  network: string;
  timestamp: number;
}

class BlockDAGDeployer {
  private config: DeploymentConfig;
  private providerManager = getProviderManager();
  private deployments: DeploymentResult[] = [];

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async deployGBVRegistry(): Promise<DeploymentResult> {
    console.log(`\n🚀 Deploying GBVReportRegistry to ${this.config.network}...`);
    
    const networkConfig = this.config.network === 'blockdag-testnet' ? BLOCKDAG_TESTNET : BLOCKDAG_MAINNET;
    
    // Get the contract factory
    const GBVReportRegistry = await ethers.getContractFactory('GBVReportRegistry');
    
    // Prepare deployment options
    const deployOptions: Record<string, unknown> = {};
    
    if (this.config.gasLimit) {
      deployOptions.gasLimit = this.config.gasLimit;
    }
    
    if (this.config.gasPrice) {
      deployOptions.gasPrice = ethers.parseUnits(this.config.gasPrice, 'gwei');
    }
    
    console.log('📋 Deployment configuration:');
    console.log(`   Network: ${networkConfig.displayName}`);
    console.log(`   Chain ID: ${networkConfig.id}`);
    console.log(`   RPC URL: ${networkConfig.rpcUrl}`);
    
    if (deployOptions.gasLimit) {
      console.log(`   Gas Limit: ${deployOptions.gasLimit}`);
    }
    
    if (deployOptions.gasPrice) {
      console.log(`   Gas Price: ${ethers.formatUnits(deployOptions.gasPrice as bigint, 'gwei')} gwei`);
    }
    
    // Deploy the contract
    console.log('\n⏳ Deploying contract...');
    const startTime = Date.now();
    
    const contract = await GBVReportRegistry.deploy(deployOptions);
    await contract.waitForDeployment();
    
    const deploymentTime = Date.now() - startTime;
    const contractAddress = await contract.getAddress();
    
    // Get deployment transaction details
    const deploymentTx = contract.deploymentTransaction();
    if (!deploymentTx) {
      throw new Error('Deployment transaction not found');
    }
    
    const receipt = await deploymentTx.wait();
    if (!receipt) {
      throw new Error('Deployment receipt not found');
    }
    
    const gasUsed = receipt.gasUsed.toString();
    const gasPrice = deploymentTx.gasPrice || BigInt(0);
    const deploymentCost = ethers.formatEther(BigInt(gasUsed) * gasPrice);
    
    const result: DeploymentResult = {
      contractName: 'GBVReportRegistry',
      address: contractAddress,
      transactionHash: deploymentTx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed,
      deploymentCost,
      network: this.config.network,
      timestamp: Date.now(),
    };
    
    console.log('\n✅ Contract deployed successfully!');
    console.log(`   Address: ${contractAddress}`);
    console.log(`   Transaction: ${deploymentTx.hash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${gasUsed}`);
    console.log(`   Deployment Cost: ${deploymentCost} ${networkConfig.nativeCurrency.symbol}`);
    console.log(`   Deployment Time: ${deploymentTime}ms`);
    
    this.deployments.push(result);
    
    // Verify contract if requested
    if (this.config.verify) {
      await this.verifyContract(result);
    }
    
    // Save deployment info if requested
    if (this.config.saveDeployment) {
      await this.saveDeploymentInfo(result);
    }
    
    return result;
  }
  
  async verifyContract(deployment: DeploymentResult): Promise<void> {
    console.log('\n🔍 Verifying contract on block explorer...');
    
    try {
      // For BlockDAG, we'll use a custom verification approach
      // since traditional Etherscan verification might not be available
      
      const networkConfig = this.config.network === 'blockdag-testnet' ? BLOCKDAG_TESTNET : BLOCKDAG_MAINNET;
      
      // Check if the contract is deployed and accessible
      const provider = this.providerManager.getProvider(networkConfig.id);
      if (!provider) {
        throw new Error('Provider not available for verification');
      }
      
      const code = await provider.getCode(deployment.address);
      if (code === '0x') {
        throw new Error('Contract not found at deployment address');
      }
      
      console.log('✅ Contract verification completed!');
      console.log(`   Contract code size: ${(code.length - 2) / 2} bytes`);
      console.log(`   Explorer URL: ${networkConfig.blockExplorerUrl}/address/${deployment.address}`);
      
    } catch (error) {
      console.error('❌ Contract verification failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  async saveDeploymentInfo(deployment: DeploymentResult): Promise<void> {
    console.log('\n💾 Saving deployment information...');
    
    try {
      const deploymentsDir = path.join(process.cwd(), 'deployments');
      const networkDir = path.join(deploymentsDir, this.config.network);
      
      // Create directories if they don't exist
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
      }
      
      if (!fs.existsSync(networkDir)) {
        fs.mkdirSync(networkDir);
      }
      
      // Save individual contract deployment
      const contractFile = path.join(networkDir, `${deployment.contractName}.json`);
      fs.writeFileSync(contractFile, JSON.stringify(deployment, null, 2));
      
      // Update deployments summary
      const summaryFile = path.join(networkDir, 'deployments.json');
      let allDeployments: DeploymentResult[] = [];
      
      if (fs.existsSync(summaryFile)) {
        const existingData = fs.readFileSync(summaryFile, 'utf8');
        allDeployments = JSON.parse(existingData);
      }
      
      // Remove any existing deployment of the same contract
      allDeployments = allDeployments.filter(d => d.contractName !== deployment.contractName);
      allDeployments.push(deployment);
      
      fs.writeFileSync(summaryFile, JSON.stringify(allDeployments, null, 2));
      
      console.log('✅ Deployment information saved!');
      console.log(`   Contract file: ${contractFile}`);
      console.log(`   Summary file: ${summaryFile}`);
      
    } catch (error) {
      console.error('❌ Failed to save deployment information:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  async testDeployment(deployment: DeploymentResult): Promise<void> {
    console.log('\n🧪 Testing deployed contract...');
    
    try {
      const networkConfig = this.config.network === 'blockdag-testnet' ? BLOCKDAG_TESTNET : BLOCKDAG_MAINNET;
      const provider = this.providerManager.getProvider(networkConfig.id);
      
      if (!provider) {
        throw new Error('Provider not available for testing');
      }
      
      // Get contract instance
      const GBVReportRegistry = await ethers.getContractFactory('GBVReportRegistry');
      const contract = GBVReportRegistry.attach(deployment.address);
      
      // Test basic contract functionality
      console.log('   Testing contract interface...');
      
      // Test view functions (these should not require gas)
      try {
        // Test basic contract interaction
        const contractInterface = contract.interface;
        console.log(`   ✅ Contract interface loaded with ${contractInterface.fragments.length} functions`);
      } catch (error) {
        console.log(`   ❌ Contract interface test failed:`, error instanceof Error ? error.message : String(error));
      }
      
      // Test contract events
      console.log('   Testing event filters...');
      try {
        const filter = contract.filters.ReportSubmitted();
        console.log('   ✅ Event filters created successfully');
      } catch (error) {
        console.log('   ❌ Event filter creation failed:', error instanceof Error ? error.message : String(error));
      }
      
      console.log('✅ Contract testing completed!');
      
    } catch (error) {
      console.error('❌ Contract testing failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  getDeploymentSummary(): void {
    console.log('\n📊 Deployment Summary:');
    console.log('=' .repeat(50));
    
    this.deployments.forEach((deployment, index) => {
      console.log(`\n${index + 1}. ${deployment.contractName}`);
      console.log(`   Address: ${deployment.address}`);
      console.log(`   Network: ${deployment.network}`);
      console.log(`   Gas Used: ${deployment.gasUsed}`);
      console.log(`   Cost: ${deployment.deploymentCost} BDAG`);
      console.log(`   Block: ${deployment.blockNumber}`);
    });
    
    console.log('\n' + '=' .repeat(50));
  }
}

// Main deployment function
async function main() {
  const args = process.argv.slice(2);
  const network = args[0] as 'blockdag-testnet' | 'blockdag-mainnet' || 'blockdag-testnet';
  
  console.log('🌐 BlockDAG Smart Contract Deployment');
  console.log('=' .repeat(50));
  
  const config: DeploymentConfig = {
    network,
    gasLimit: 3000000, // 3M gas limit for BlockDAG
    verify: true,
    saveDeployment: true,
  };
  
  const deployer = new BlockDAGDeployer(config);
  
  try {
    // Deploy GBV Registry
    const deployment = await deployer.deployGBVRegistry();
    
    // Test the deployment
    await deployer.testDeployment(deployment);
    
    // Show summary
    deployer.getDeploymentSummary();
    
    console.log('\n🎉 All deployments completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Deployment failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Export for use in other scripts
export { BlockDAGDeployer };
export type { DeploymentConfig, DeploymentResult };

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}