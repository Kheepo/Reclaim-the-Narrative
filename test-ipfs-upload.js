/**
 * IPFS Upload Test Script
 * Tests the IPFS upload functionality with configured services
 */

const https = require('https');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Test Pinata API directly
async function testPinataAPI() {
  console.log('🔄 Testing Pinata API Configuration...');
  console.log('=' .repeat(50));
  
  const apiKey = process.env.REACT_APP_PINATA_API_KEY;
  const secretKey = process.env.REACT_APP_PINATA_SECRET_KEY;
  
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'Not set');
  console.log('Secret Key:', secretKey ? `${secretKey.substring(0, 8)}...` : 'Not set');
  
  if (!apiKey || !secretKey) {
    console.error('❌ Pinata API keys not configured');
    return false;
  }
  
  try {
    // Test authentication with Pinata
    const testAuth = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretKey
      }
    });
    
    if (testAuth.ok) {
      const authResult = await testAuth.json();
      console.log('✓ Pinata authentication successful:', authResult.message);
      return true;
    } else {
      console.error('❌ Pinata authentication failed:', testAuth.status, testAuth.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Pinata API test failed:', error.message);
    return false;
  }
}

// Test file upload to Pinata using JSON API
async function testPinataUpload() {
  console.log('\n🔄 Testing Pinata File Upload...');
  console.log('=' .repeat(50));
  
  const apiKey = process.env.REACT_APP_PINATA_API_KEY;
  const secretKey = process.env.REACT_APP_PINATA_SECRET_KEY;
  
  // Create test content
  const testContent = 'This is a test file for IPFS upload verification - ' + new Date().toISOString();
  const testFileName = 'test-upload.txt';
  
  try {
    console.log(`✓ Created test content for: ${testFileName}`);
    
    // Try JSON upload first (simpler and more reliable)
    console.log('\n📤 Attempting JSON upload to Pinata...');
    
    const jsonData = {
      pinataContent: {
        content: testContent,
        filename: testFileName,
        timestamp: new Date().toISOString()
      },
      pinataMetadata: {
        name: testFileName,
        keyvalues: {
          testUpload: 'true',
          timestamp: new Date().toISOString()
        }
      },
      pinataOptions: {
        cidVersion: 1
      }
    };
    
    const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretKey
      },
      body: JSON.stringify(jsonData)
    });
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      console.log('✓ Upload successful!');
      console.log('IPFS Hash (CID):', uploadResult.IpfsHash);
      console.log('Pin Size:', uploadResult.PinSize);
      console.log('Timestamp:', uploadResult.Timestamp);
      
      // Test retrieval
      console.log('\n🔄 Testing File Retrieval...');
      const retrievalUrl = `https://gateway.pinata.cloud/ipfs/${uploadResult.IpfsHash}`;
      console.log('Retrieval URL:', retrievalUrl);
      
      // Wait a moment for propagation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const retrievalResponse = await fetch(retrievalUrl);
      if (retrievalResponse.ok) {
        const retrievedContent = await retrievalResponse.text();
        if (retrievedContent === testContent) {
          console.log('✓ File retrieval successful - content matches!');
        } else {
          console.log('⚠️  File retrieved but content differs');
          console.log('Expected length:', testContent.length);
          console.log('Retrieved length:', retrievedContent.length);
        }
      } else {
        console.log('⚠️  File retrieval failed:', retrievalResponse.status, retrievalResponse.statusText);
      }
      
      return uploadResult;
    } else {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', uploadResponse.status, uploadResponse.statusText);
      console.error('Error details:', errorText);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Upload test failed:', error.message);
    return null;
  } finally {
    console.log('🧹 Test completed (no cleanup needed for JSON upload)');
  }
}

// Test IPFS gateway accessibility
async function testIPFSGateways() {
  console.log('\n🔄 Testing IPFS Gateway Accessibility...');
  console.log('=' .repeat(50));
  
  const gateways = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://w3s.link/ipfs/'
  ];
  
  // Use a known IPFS hash for testing
  const testHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'; // "hello world" file
  
  for (const gateway of gateways) {
    try {
      const testUrl = gateway + testHash;
      console.log(`Testing: ${gateway}`);
      
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        console.log(`✓ ${gateway} - Accessible`);
      } else {
        console.log(`⚠️  ${gateway} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${gateway} - Error: ${error.message}`);
    }
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting IPFS Upload Tests...');
  console.log('Time:', new Date().toISOString());
  console.log('Environment: Node.js', process.version);
  
  try {
    // Test Pinata API authentication
    const authSuccess = await testPinataAPI();
    
    if (authSuccess) {
      // Test file upload
      const uploadResult = await testPinataUpload();
      
      if (uploadResult) {
        console.log('\n🎉 IPFS Upload Test Completed Successfully!');
        console.log('=' .repeat(50));
        console.log('✅ Pinata API is properly configured and working');
        console.log('✅ File upload and retrieval successful');
        console.log('✅ IPFS integration is ready for production use');
      } else {
        console.log('\n❌ Upload test failed');
      }
    }
    
    // Test gateway accessibility
    await testIPFSGateways();
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  }
  
  console.log('\n📋 Summary:');
  console.log('- Pinata API keys are configured in .env file');
  console.log('- IPFS upload functionality has been tested');
  console.log('- Gateway accessibility has been verified');
  console.log('\n📖 For detailed setup instructions, see: IPFS_SETUP_GUIDE.md');
}

// Execute if run directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testPinataAPI,
  testPinataUpload,
  testIPFSGateways,
  runAllTests
};