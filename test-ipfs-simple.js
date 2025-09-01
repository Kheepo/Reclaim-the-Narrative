// Simple IPFS configuration test without TypeScript imports
const fs = require('fs');
const path = require('path');

// Check environment variables
function checkEnvironmentVariables() {
  console.log('=== Checking Environment Variables ===\n');
  
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  const config = {};
  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      config[key.trim()] = value.trim();
    }
  });
  
  console.log('📊 IPFS Configuration Status:');
  
  // Check Pinata configuration
  const pinataKey = config['REACT_APP_PINATA_API_KEY'];
  const pinataSecret = config['REACT_APP_PINATA_SECRET_KEY'];
  
  console.log(`- Pinata API Key: ${pinataKey && pinataKey !== 'your_pinata_api_key_here' ? '✅ Configured' : '❌ Not configured (placeholder value)'}`);
  console.log(`- Pinata Secret Key: ${pinataSecret && pinataSecret !== 'your_pinata_secret_key_here' ? '✅ Configured' : '❌ Not configured (placeholder value)'}`);
  
  // Check public Pinata configuration
  const publicPinataKey = config['NEXT_PUBLIC_PINATA_API_KEY'];
  const publicPinataSecret = config['NEXT_PUBLIC_PINATA_SECRET_KEY'];
  
  console.log(`- Public Pinata API Key: ${publicPinataKey && publicPinataKey !== '' ? '✅ Configured' : '❌ Empty'}`);
  console.log(`- Public Pinata Secret Key: ${publicPinataSecret && publicPinataSecret !== '' ? '✅ Configured' : '❌ Empty'}`);
  
  console.log('\n📋 Current Values:');
  console.log(`- REACT_APP_PINATA_API_KEY: ${pinataKey || 'Not set'}`);
  console.log(`- REACT_APP_PINATA_SECRET_KEY: ${pinataSecret || 'Not set'}`);
  console.log(`- NEXT_PUBLIC_PINATA_API_KEY: ${publicPinataKey || 'Not set'}`);
  console.log(`- NEXT_PUBLIC_PINATA_SECRET_KEY: ${publicPinataSecret || 'Not set'}`);
  
  const isPinataConfigured = pinataKey && pinataKey !== 'your_pinata_api_key_here' && 
                            pinataSecret && pinataSecret !== 'your_pinata_secret_key_here';
  
  return isPinataConfigured;
}

// Test Pinata API connectivity
async function testPinataAPI() {
  console.log('\n=== Testing Pinata API Connectivity ===\n');
  
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  const config = {};
  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      config[key.trim()] = value.trim();
    }
  });
  
  const pinataKey = config['REACT_APP_PINATA_API_KEY'];
  const pinataSecret = config['REACT_APP_PINATA_SECRET_KEY'];
  
  if (!pinataKey || pinataKey === 'your_pinata_api_key_here' || 
      !pinataSecret || pinataSecret === 'your_pinata_secret_key_here') {
    console.log('❌ Pinata API keys not configured properly');
    return false;
  }
  
  try {
    // Test Pinata API with a simple authentication check
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        'pinata_api_key': pinataKey,
        'pinata_secret_api_key': pinataSecret
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Pinata API authentication successful');
      console.log('Response:', result);
      return true;
    } else {
      console.log('❌ Pinata API authentication failed');
      console.log('Status:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Pinata API test failed with error:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🔍 IPFS Configuration Diagnostic Tool\n');
  
  const envConfigured = checkEnvironmentVariables();
  
  if (envConfigured) {
    await testPinataAPI();
  } else {
    console.log('\n⚠️  Configuration Issues Detected:');
    console.log('1. Pinata API keys are not properly configured');
    console.log('2. Please update your .env file with valid Pinata credentials');
    console.log('3. Get your API keys from: https://app.pinata.cloud/keys');
    console.log('\n📝 Required Environment Variables:');
    console.log('REACT_APP_PINATA_API_KEY=your_actual_api_key');
    console.log('REACT_APP_PINATA_SECRET_KEY=your_actual_secret_key');
  }
  
  console.log('\n=== Web3.Storage Information ===');
  console.log('ℹ️  Web3.Storage (Storacha Network) uses email-based authentication');
  console.log('ℹ️  No environment variables needed for Web3.Storage');
  console.log('ℹ️  Authentication happens in the browser during first upload');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, checkEnvironmentVariables, testPinataAPI };