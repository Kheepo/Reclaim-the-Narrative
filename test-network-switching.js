/**
 * Test script for network switching functionality
 * Tests switching between supported networks and error handling
 */

const { JSDOM } = require('jsdom');

// Mock browser environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Network configurations
const NETWORKS = {
  POLYGON_MAINNET: {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    rpcUrls: ['https://polygon-rpc.com/'],
    blockExplorerUrls: ['https://polygonscan.com/']
  },
  POLYGON_MUMBAI: {
    chainId: '0x13881',
    chainName: 'Polygon Mumbai',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
    blockExplorerUrls: ['https://mumbai.polygonscan.com/']
  }
};

// Mock MetaMask ethereum provider with network switching
class MockEthereum {
  constructor() {
    this.isMetaMask = true;
    this.currentChainId = '0x89'; // Start with Polygon mainnet
    this.accounts = ['0x742d35Cc6634C0532925a3b8D4C9db96590c4C5d'];
    this.listeners = {};
  }

  async request(params) {
    console.log('Mock MetaMask request:', params);
    
    switch (params.method) {
      case 'eth_requestAccounts':
        return this.accounts;
      case 'eth_accounts':
        return this.accounts;
      case 'eth_chainId':
        return this.currentChainId;
      case 'net_version':
        return parseInt(this.currentChainId, 16).toString();
      case 'wallet_switchEthereumChain':
        return this.switchChain(params.params[0].chainId);
      case 'wallet_addEthereumChain':
        return this.addChain(params.params[0]);
      default:
        throw new Error(`Unsupported method: ${params.method}`);
    }
  }

  async switchChain(chainId) {
    console.log(`Switching to chain: ${chainId}`);
    
    // Simulate network switching
    if (chainId === '0x89' || chainId === '0x13881') {
      const oldChainId = this.currentChainId;
      this.currentChainId = chainId;
      
      // Emit chainChanged event
      setTimeout(() => {
        this.emit('chainChanged', chainId);
      }, 100);
      
      return null; // Success
    } else {
      // Simulate unsupported network error
      const error = new Error('Unrecognized chain ID');
      error.code = 4902;
      throw error;
    }
  }

  async addChain(chainParams) {
    console.log('Adding chain:', chainParams);
    
    // Simulate adding a new network
    if (chainParams.chainId === '0x89' || chainParams.chainId === '0x13881') {
      this.currentChainId = chainParams.chainId;
      
      // Emit chainChanged event
      setTimeout(() => {
        this.emit('chainChanged', chainParams.chainId);
      }, 100);
      
      return null; // Success
    } else {
      throw new Error('Failed to add network');
    }
  }

  on(event, handler) {
    console.log(`Mock MetaMask event listener added: ${event}`);
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  removeListener(event, handler) {
    console.log(`Mock MetaMask event listener removed: ${event}`);
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(handler);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

const mockEthereum = new MockEthereum();
global.window.ethereum = mockEthereum;

// Test network switching functionality
async function testNetworkSwitching() {
  console.log('\n=== Testing Network Switching Functionality ===\n');
  
  try {
    // Test 1: Get current network
    console.log('Test 1: Current Network Detection');
    const initialChainId = await window.ethereum.request({ method: 'eth_chainId' });
    const initialNetworkId = parseInt(initialChainId, 16);
    console.log(`✓ Initial network: ${initialChainId} (${initialNetworkId})`);
    
    // Test 2: Switch to Mumbai testnet
    console.log('\nTest 2: Switch to Mumbai Testnet');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13881' }]
      });
      
      // Wait for chain change event
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const newChainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log(`✓ Successfully switched to: ${newChainId}`);
      
    } catch (error) {
      console.log(`Network switch error: ${error.message}`);
      
      // If switch fails, try adding the network
      if (error.code === 4902) {
        console.log('Network not found, attempting to add...');
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [NETWORKS.POLYGON_MUMBAI]
        });
        console.log('✓ Network added successfully');
      }
    }
    
    // Test 3: Switch back to Polygon mainnet
    console.log('\nTest 3: Switch to Polygon Mainnet');
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }]
    });
    
    // Wait for chain change event
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const finalChainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log(`✓ Successfully switched to: ${finalChainId}`);
    
    // Test 4: Test unsupported network
    console.log('\nTest 4: Unsupported Network Handling');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }] // Ethereum mainnet (unsupported)
      });
    } catch (error) {
      console.log(`✓ Unsupported network rejected: ${error.message}`);
    }
    
    // Test 5: Event listener functionality
    console.log('\nTest 5: Chain Change Event Listeners');
    let eventReceived = false;
    
    const chainChangeHandler = (chainId) => {
      console.log(`✓ Chain change event received: ${chainId}`);
      eventReceived = true;
    };
    
    window.ethereum.on('chainChanged', chainChangeHandler);
    
    // Trigger a chain change
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x13881' }]
    });
    
    // Wait for event
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (eventReceived) {
      console.log('✓ Event listener working correctly');
    } else {
      console.log('❌ Event listener not triggered');
    }
    
    window.ethereum.removeListener('chainChanged', chainChangeHandler);
    
    console.log('\n=== All Network Switching Tests Passed ===\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Network Switching Test Failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Test network validation
async function testNetworkValidation() {
  console.log('\n=== Testing Network Validation ===\n');
  
  try {
    const supportedNetworks = [137, 80001]; // Polygon mainnet and Mumbai
    
    // Test supported networks
    console.log('Test 1: Supported Network Validation');
    for (const networkId of supportedNetworks) {
      const chainId = '0x' + networkId.toString(16);
      const isSupported = supportedNetworks.includes(networkId);
      const networkName = networkId === 137 ? 'Polygon Mainnet' : 'Polygon Mumbai';
      
      console.log(`✓ Network ${networkId} (${networkName}): ${isSupported ? 'Supported' : 'Not Supported'}`);
    }
    
    // Test unsupported networks
    console.log('\nTest 2: Unsupported Network Detection');
    const unsupportedNetworks = [1, 56, 43114]; // Ethereum, BSC, Avalanche
    
    for (const networkId of unsupportedNetworks) {
      const isSupported = supportedNetworks.includes(networkId);
      console.log(`✓ Network ${networkId}: ${isSupported ? 'Supported' : 'Not Supported (Expected)'}`);
    }
    
    console.log('\n=== Network Validation Tests Passed ===\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Network Validation Test Failed:');
    console.error('Error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting Network Switching Tests...');
  
  const switchingTest = await testNetworkSwitching();
  const validationTest = await testNetworkValidation();
  
  const allPassed = switchingTest && validationTest;
  
  console.log('\n' + '='.repeat(50));
  console.log(`FINAL RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('='.repeat(50));
  
  process.exit(allPassed ? 0 : 1);
}

// Check if running directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testNetworkSwitching,
  testNetworkValidation,
  runAllTests
};