// Simple test to check Web3.Storage status
const { checkWeb3StorageStatus } = require('./src/lib/ipfs.ts');

async function testWeb3StorageStatus() {
  console.log('🔍 Checking Web3.Storage status...');
  
  try {
    const status = await checkWeb3StorageStatus();
    console.log('\n📊 Web3.Storage Status:');
    console.log('- Configured:', status.configured ? '✅ Yes' : '❌ No');
    console.log('- Has Spaces:', status.hasSpaces ? '✅ Yes' : '❌ No');
    
    if (status.currentSpace) {
      console.log('- Current Space:', status.currentSpace);
    }
    
    if (status.error) {
      console.log('- Error:', status.error);
    }
    
    if (status.spaces && status.spaces.length > 0) {
      console.log('- Available Spaces:', status.spaces.length);
    }
    
    console.log('\n🎯 Next Steps:');
    if (!status.configured) {
      console.log('1. Go to the Submit page');
      console.log('2. Navigate to Step 3: Security Settings');
      console.log('3. Complete the Web3.Storage setup by entering your email');
      console.log('4. Check your email for verification link');
      console.log('5. Click the verification link');
      console.log('6. Return to the form and refresh status');
    } else if (!status.hasSpaces) {
      console.log('1. Your email is verified!');
      console.log('2. Go to Step 3: Security Settings');
      console.log('3. Create a storage space');
    } else {
      console.log('✅ Web3.Storage is fully configured! You can now submit reports.');
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have internet connection');
    console.log('2. Try refreshing the page');
    console.log('3. Check browser console for additional errors');
  }
}

testWeb3StorageStatus();