// Test IPFS upload functionality with Web3.Storage
const { checkWeb3StorageStatus, uploadToIPFS } = require('./src/lib/ipfs.ts');

// Test IPFS upload with minimal data
async function testIPFSUpload() {
  console.log('=== Testing IPFS Upload Functionality ===\n');
  
  try {
    // First check if Web3.Storage is configured
    console.log('🔍 Checking Web3.Storage configuration...');
    const status = await checkWeb3StorageStatus();
    
    console.log('📊 Web3.Storage Status:');
    console.log(`- Configured: ${status.configured ? '✅ Yes' : '❌ No'}`);
    console.log(`- Has Spaces: ${status.hasSpaces ? '✅ Yes' : '❌ No'}`);
    
    if (status.error) {
      console.log(`- Error: ${status.error}`);
    }
    
    if (!status.configured || !status.hasSpaces) {
      console.log('\n⚠️  Web3.Storage is not properly configured.');
      console.log('Please complete the setup process first:');
      console.log('1. Go to the Submit page');
      console.log('2. Navigate to Step 3: Security Settings');
      console.log('3. Complete the Web3.Storage setup');
      console.log('4. Verify your email');
      console.log('5. Run this test again');
      return;
    }
    
    console.log('\n✅ Web3.Storage is configured! Testing upload...');
    
    // Create test data
    const testData = {
      title: 'Test Report for IPFS',
      description: 'This is a test report to verify IPFS upload functionality.',
      category: 'harassment',
      timestamp: new Date().toISOString(),
      reportId: 'test-' + Date.now()
    };
    
    console.log('📤 Uploading test data to IPFS...');
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
    // Convert to blob for upload
    const dataBlob = new Blob([JSON.stringify(testData, null, 2)], {
      type: 'application/json'
    });
    
    // Test upload
    const uploadResult = await uploadToIPFS(dataBlob, [], (progress) => {
      console.log(`Upload progress: ${Math.round(progress.progress * 100)}% - ${progress.stage}`);
    });
    
    console.log('\n🎉 Upload successful!');
    console.log('Upload result:', uploadResult);
    console.log(`IPFS Hash: ${uploadResult.hash}`);
    console.log(`Gateway URL: https://${uploadResult.hash}.ipfs.w3s.link`);
    
  } catch (error) {
    console.error('\n❌ IPFS upload test failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
}

// Test Web3.Storage configuration only
async function testWeb3StorageConfig() {
  console.log('=== Testing Web3.Storage Configuration ===\n');
  
  try {
    const status = await checkWeb3StorageStatus();
    
    console.log('📊 Configuration Status:');
    console.log(`- Configured: ${status.configured ? '✅ Yes' : '❌ No'}`);
    console.log(`- Has Spaces: ${status.hasSpaces ? '✅ Yes' : '❌ No'}`);
    
    if (status.error) {
      console.log(`- Error: ${status.error}`);
    }
    
    if (status.configured && status.hasSpaces) {
      console.log('\n✅ Web3.Storage is ready for uploads!');
    } else {
      console.log('\n⚠️  Web3.Storage needs configuration.');
    }
    
  } catch (error) {
    console.error('\n❌ Configuration check failed:', error);
  }
}

// Run tests
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--config-only')) {
    testWeb3StorageConfig();
  } else {
    testIPFSUpload();
  }
}

module.exports = {
  testIPFSUpload,
  testWeb3StorageConfig
};