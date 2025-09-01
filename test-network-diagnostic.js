/**
 * Test script for the improved checkNetworkStatus function
 */
import { checkNetworkStatus } from './src/lib/blockchain.js';

async function testNetworkDiagnostic() {
  console.log('🧪 Testing improved checkNetworkStatus function...');
  console.log('=' .repeat(50));
  
  try {
    const result = await checkNetworkStatus();
    
    console.log('✅ Network diagnostic completed successfully!');
    console.log('📊 Results:');
    console.log(`   - Connected: ${result.isConnected}`);
    console.log(`   - Chain ID: ${result.chainId}`);
    console.log(`   - Network: ${result.networkName}`);
    console.log(`   - Block Number: ${result.blockNumber}`);
    console.log(`   - Gas Price: ${result.gasPrice}`);
    console.log(`   - Wallet Connected: ${result.walletConnected}`);
    
    if (result.walletAddress) {
      console.log(`   - Wallet Address: ${result.walletAddress}`);
    }
    
    if (result.walletBalance) {
      console.log(`   - Wallet Balance: ${result.walletBalance}`);
    }
    
    if (result.error) {
      console.log(`   - Error: ${result.error}`);
    }
    
    // Validate the response structure
    const requiredFields = ['isConnected', 'chainId', 'networkName', 'blockNumber', 'gasPrice', 'walletConnected'];
    const missingFields = requiredFields.filter(field => result[field] === undefined);
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields are present in the response');
    } else {
      console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
    }
    
    // Test that chainId is never undefined (the original issue)
    if (result.chainId !== undefined && result.chainId !== null) {
      console.log('✅ chainId is properly defined (original bug fixed)');
    } else {
      console.log('❌ chainId is still undefined/null');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('=' .repeat(50));
  console.log('🏁 Test completed');
}

// Run the test
testNetworkDiagnostic().catch(console.error);