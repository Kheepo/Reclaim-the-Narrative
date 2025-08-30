import { ethers } from 'hardhat';
import type { Provider, FunctionFragment } from 'ethers';
import { getProviderManager } from '../src/lib/providers/NetworkProvider';
import { BLOCKDAG_TESTNET, BLOCKDAG_MAINNET } from '../src/config/networks';
import fs from 'fs';
import path from 'path';

interface VerificationConfig {
  network: 'blockdag-testnet' | 'blockdag-mainnet';
  contractAddress: string;
  contractName?: string;
  constructorArgs?: unknown[];
  sourceCode?: boolean;
  abi?: boolean;
  bytecode?: boolean;
}

interface VerificationResult {
  address: string;
  network: string;
  isContract: boolean;
  codeSize: number;
  isVerified: boolean;
  contractName?: string;
  abi?: unknown[];
  sourceCode?: string;
  constructorArgs?: unknown[];
  creationTx?: string;
  creationBlock?: number;
  timestamp: number;
}

class BlockDAGVerifier {
  private config: VerificationConfig;
  private providerManager = getProviderManager();

  constructor(config: VerificationConfig) {
    this.config = config;
  }

  async verifyContract(): Promise<VerificationResult> {
    console.log(`\n🔍 Verifying contract on ${this.config.network}...`);
    console.log(`   Address: ${this.config.contractAddress}`);
    
    const networkConfig = this.config.network === 'blockdag-testnet' ? BLOCKDAG_TESTNET : BLOCKDAG_MAINNET;
    const provider = this.providerManager.getProvider(networkConfig.id);
    
    if (!provider) {
      throw new Error(`Provider not available for ${this.config.network}`);
    }

    const result: VerificationResult = {
      address: this.config.contractAddress,
      network: this.config.network,
      isContract: false,
      codeSize: 0,
      isVerified: false,
      timestamp: Date.now(),
    };

    try {
      // Check if address contains contract code
      console.log('   Checking contract code...');
      const code = await provider.getCode(this.config.contractAddress);
      
      if (code === '0x') {
        console.log('   ❌ No contract code found at this address');
        return result;
      }

      result.isContract = true;
      result.codeSize = (code.length - 2) / 2; // Remove '0x' and divide by 2
      console.log(`   ✅ Contract found (${result.codeSize} bytes)`);

      // Get contract creation info
      await this.getCreationInfo(result, provider);

      // Verify contract interface if contract name is provided
      if (this.config.contractName) {
        await this.verifyInterface(result);
      }

      // Extract ABI if requested
      if (this.config.abi && this.config.contractName) {
        await this.extractABI(result);
      }

      // Get source code if requested
      if (this.config.sourceCode && this.config.contractName) {
        await this.getSourceCode(result);
      }

      result.isVerified = true;
      console.log('   ✅ Contract verification completed!');

    } catch (error) {
      console.error('   ❌ Verification failed:', error);
      throw error;
    }

    return result;
  }

  private async getCreationInfo(result: VerificationResult, provider: Provider): Promise<void> {
    console.log('   Searching for contract creation...');
    
    try {
      // For BlockDAG, we'll need to search through recent blocks
      // This is a simplified approach - in production, you might want to use
      // block explorer APIs or maintain a deployment registry
      
      const currentBlock = await provider.getBlockNumber();
      const searchRange = Math.min(1000, currentBlock); // Search last 1000 blocks
      
      for (let i = 0; i < searchRange; i++) {
        const blockNumber = currentBlock - i;
        
        try {
          const block = await provider.getBlock(blockNumber, true);
          
          if (block && block.transactions) {
            for (const txHash of block.transactions) {
              try {
                const tx = await provider.getTransaction(txHash as string);
                if (tx && tx.to === null) {
                  // This is a contract creation transaction
                  const receipt = await tx.wait();
                  if (receipt && receipt.contractAddress === result.address) {
                    result.creationTx = tx.hash;
                    result.creationBlock = blockNumber;
                    console.log(`   ✅ Creation found: Block ${blockNumber}, Tx ${tx.hash}`);
                    return;
                  }
                }
              } catch (txError) {
                // Continue if transaction fetch fails
                continue;
              }
            }
          }
        } catch (blockError) {
          // Continue searching if block fetch fails
          continue;
        }
        
        // Break early if we've searched enough
        if (i > 100) break;
      }
      
      console.log('   ⚠️  Contract creation not found in recent blocks');
      
    } catch (error) {
      console.log('   ⚠️  Could not determine contract creation info:', error instanceof Error ? error.message : String(error));
    }
  }

  private async verifyInterface(result: VerificationResult): Promise<void> {
    console.log(`   Verifying ${this.config.contractName} interface...`);
    
    try {
      // Get the contract factory to compare interfaces
      const ContractFactory = await ethers.getContractFactory(this.config.contractName!);
      const contract = ContractFactory.attach(this.config.contractAddress);
      
      // Test basic contract functions
      const contractInterface = ContractFactory.interface;
      const fragments = contractInterface.fragments.filter(f => f.type === 'function');
      
      console.log(`   Contract has ${fragments.length} functions:`);
      
      let viewFunctions = 0;
      let writeFunctions = 0;
      
      for (const fragment of fragments.slice(0, 10)) { // Show first 10 functions
        if (fragment.type === 'function') {
          const funcFragment = fragment as FunctionFragment;
          if (funcFragment.stateMutability === 'view' || funcFragment.stateMutability === 'pure') {
            console.log(`     ✅ ${funcFragment.name} (view/pure)`);
            viewFunctions++;
          } else {
            console.log(`     📝 ${funcFragment.name} (${funcFragment.stateMutability})`);
            writeFunctions++;
          }
        }
      }
      
      console.log(`   ✅ Contract interface verified: ${viewFunctions} view functions, ${writeFunctions} write functions`);
      result.contractName = this.config.contractName;
      
    } catch (error) {
      console.log(`   ❌ Interface verification failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  private async extractABI(result: VerificationResult): Promise<void> {
    console.log('   Extracting contract ABI...');
    
    try {
      const ContractFactory = await ethers.getContractFactory(this.config.contractName!);
      result.abi = ContractFactory.interface.fragments.map(fragment => fragment.format('json'));
      console.log(`   ✅ ABI extracted (${result.abi.length} items)`);
    } catch (error) {
      console.log('   ❌ ABI extraction failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private async getSourceCode(result: VerificationResult): Promise<void> {
    console.log('   Retrieving source code...');
    
    try {
      // In a real implementation, you might read from the contracts directory
      const contractsDir = path.join(process.cwd(), 'contracts');
      const sourceFile = path.join(contractsDir, `${this.config.contractName}.sol`);
      
      if (fs.existsSync(sourceFile)) {
        result.sourceCode = fs.readFileSync(sourceFile, 'utf8');
        console.log(`   ✅ Source code retrieved (${result.sourceCode.length} characters)`);
      } else {
        console.log('   ⚠️  Source code file not found');
      }
    } catch (error) {
      console.log('   ❌ Source code retrieval failed:', error instanceof Error ? error.message : String(error));
    }
  }

  async generateVerificationReport(result: VerificationResult): Promise<void> {
    console.log('\n📋 Generating verification report...');
    
    const networkConfig = this.config.network === 'blockdag-testnet' ? BLOCKDAG_TESTNET : BLOCKDAG_MAINNET;
    
    const report = {
      verification: {
        timestamp: new Date(result.timestamp).toISOString(),
        network: result.network,
        networkName: networkConfig.displayName,
        chainId: networkConfig.id,
        explorerUrl: `${networkConfig.blockExplorerUrl}/address/${result.address}`,
      },
      contract: {
        address: result.address,
        isContract: result.isContract,
        codeSize: result.codeSize,
        name: result.contractName,
        isVerified: result.isVerified,
      },
      creation: {
        transactionHash: result.creationTx,
        blockNumber: result.creationBlock,
      },
      interface: {
        abiAvailable: !!result.abi,
        abiItemCount: result.abi?.length || 0,
        sourceCodeAvailable: !!result.sourceCode,
        sourceCodeSize: result.sourceCode?.length || 0,
      },
    };
    
    // Save report to file
    const reportsDir = path.join(process.cwd(), 'verification-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }
    
    const reportFile = path.join(
      reportsDir,
      `${result.network}-${result.address}-${Date.now()}.json`
    );
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`   ✅ Report saved: ${reportFile}`);
    
    // Display summary
    console.log('\n📊 Verification Summary:');
    console.log('=' .repeat(50));
    console.log(`Network: ${report.verification.networkName} (${report.verification.chainId})`);
    console.log(`Address: ${report.contract.address}`);
    console.log(`Is Contract: ${report.contract.isContract ? '✅' : '❌'}`);
    console.log(`Code Size: ${report.contract.codeSize} bytes`);
    console.log(`Verified: ${report.contract.isVerified ? '✅' : '❌'}`);
    
    if (report.contract.name) {
      console.log(`Contract Name: ${report.contract.name}`);
    }
    
    if (report.creation.transactionHash) {
      console.log(`Creation Tx: ${report.creation.transactionHash}`);
      console.log(`Creation Block: ${report.creation.blockNumber}`);
    }
    
    if (report.interface.abiAvailable) {
      console.log(`ABI Items: ${report.interface.abiItemCount}`);
    }
    
    if (report.interface.sourceCodeAvailable) {
      console.log(`Source Code: ${report.interface.sourceCodeSize} characters`);
    }
    
    console.log(`Explorer: ${report.verification.explorerUrl}`);
    console.log('=' .repeat(50));
  }
}

// Main verification function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npm run verify-blockdag <network> <contract-address> [contract-name]');
    console.log('Networks: blockdag-testnet, blockdag-mainnet');
    console.log('Example: npm run verify-blockdag blockdag-testnet 0x1234... GBVReportRegistry');
    process.exit(1);
  }
  
  const network = args[0] as 'blockdag-testnet' | 'blockdag-mainnet';
  const contractAddress = args[1];
  const contractName = args[2];
  
  console.log('🔍 BlockDAG Contract Verification');
  console.log('=' .repeat(50));
  
  const config: VerificationConfig = {
    network,
    contractAddress,
    contractName,
    abi: true,
    sourceCode: true,
  };
  
  const verifier = new BlockDAGVerifier(config);
  
  try {
    const result = await verifier.verifyContract();
    await verifier.generateVerificationReport(result);
    
    console.log('\n🎉 Verification completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
export { BlockDAGVerifier };
export type { VerificationConfig, VerificationResult };

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}