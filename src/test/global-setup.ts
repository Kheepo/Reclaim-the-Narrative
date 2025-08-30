// Note: jest is available globally in the test environment
// We don't need to import it explicitly

/**
 * Global Jest setup configuration
 * Runs once before all test suites
 */
export default async function globalSetup() {
  // Set test environment
  (process.env as any).NODE_ENV = 'test';

  // Mock external services
  await mockExternalServices();

  // Initialize test data
  await initializeTestData();

  console.log('🧪 Global test setup completed');
}

/**
 * Mock external services for testing
 */
async function mockExternalServices() {
  // Mock IPFS service
  global.mockIPFS = {
    upload: async () => ({ hash: 'QmTestHash123' }),
    retrieve: async () => 'mock file content',
    pin: async () => true
  };

  // Mock blockchain service
  global.mockBlockchain = {
    submitTransaction: async () => ({ hash: '0xmocktxhash' }),
    getTransaction: async () => ({ status: 'confirmed' }),
    getBalance: async () => '1000000000000000000'
  };

  // Mock notification service
  global.mockNotifications = {
    send: async () => true,
    subscribe: async () => true
  };

  // Mock analytics service
  global.mockAnalytics = {
    track: () => {},
    identify: () => {},
    page: () => {}
  };

  // Mock error reporting service
  global.mockErrorReporting = {
    captureException: () => {},
    captureMessage: () => {},
    setUser: () => {}
  };
}



/**
 * Setup mock services for testing
 */
function setupMockServices() {
  // Mock IPFS service
  global.mockIPFS = {
    upload: jest.fn().mockResolvedValue({
      hash: 'QmTestHash123456789',
      size: 1024,
      url: 'https://test.ipfs.io/ipfs/QmTestHash123456789'
    }),
    
    retrieve: jest.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3, 4]),
      metadata: {
        name: 'test-file.txt',
        size: 4,
        type: 'text/plain'
      }
    }),
    
    pin: jest.fn().mockResolvedValue({ success: true }),
    unpin: jest.fn().mockResolvedValue({ success: true })
  };
  
  // Mock blockchain service
  global.mockBlockchain = {
    connect: jest.fn().mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      network: 'ethereum'
    }),
    
    disconnect: jest.fn().mockResolvedValue(true),
    
    submitReport: jest.fn().mockResolvedValue({
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      blockNumber: 12345678,
      gasUsed: '21000',
      status: 'success'
    }),
    
    getReport: jest.fn().mockResolvedValue({
      id: 'test-report-id',
      ipfsHash: 'QmTestHash123456789',
      timestamp: Date.now(),
      reporter: '0x1234567890123456789012345678901234567890',
      verified: false
    }),
    
    verifyReport: jest.fn().mockResolvedValue({
      transactionHash: '0xverify1234567890verify1234567890verify1234567890verify1234567890',
      status: 'success'
    })
  };
  
  // Mock notification service
  global.mockNotifications = {
    send: jest.fn().mockResolvedValue({ success: true, id: 'notification-123' }),
    subscribe: jest.fn().mockResolvedValue({ success: true }),
    unsubscribe: jest.fn().mockResolvedValue({ success: true })
  };
  
  // Mock analytics service
  global.mockAnalytics = {
    track: jest.fn(),
    identify: jest.fn(),
    page: jest.fn(),
    group: jest.fn(),
    alias: jest.fn()
  };
  
  // Mock error reporting service
  global.mockErrorReporting = {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    setContext: jest.fn()
  };
}

/**
 * Initialize test data
 */
async function initializeTestData() {
  // Create test users
  global.testUsers = {
    reporter: {
      id: 'test-reporter-1',
      address: '0x1234567890123456789012345678901234567890',
      email: 'reporter@test.com',
      role: 'reporter',
      verified: true
    },
    
    verifier: {
      id: 'test-verifier-1',
      address: '0x0987654321098765432109876543210987654321',
      email: 'verifier@test.com',
      role: 'verifier',
      verified: true
    },
    
    admin: {
      id: 'test-admin-1',
      address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      email: 'admin@test.com',
      role: 'admin',
      verified: true
    }
  };
  
  // Create test reports
  global.testReports = {
    pending: {
      id: 'test-report-pending',
      title: 'Test Pending Report',
      description: 'This is a test pending report',
      category: 'harassment',
      severity: 'high',
      location: 'Test Location',
      date: new Date('2024-01-15'),
      reporter: global.testUsers.reporter.id,
      status: 'pending',
      ipfsHash: 'QmTestPendingHash',
      transactionHash: null,
      verified: false
    },
    
    submitted: {
      id: 'test-report-submitted',
      title: 'Test Submitted Report',
      description: 'This is a test submitted report',
      category: 'assault',
      severity: 'critical',
      location: 'Test Location 2',
      date: new Date('2024-01-10'),
      reporter: global.testUsers.reporter.id,
      status: 'submitted',
      ipfsHash: 'QmTestSubmittedHash',
      transactionHash: '0xsubmitted123456789',
      verified: false
    },
    
    verified: {
      id: 'test-report-verified',
      title: 'Test Verified Report',
      description: 'This is a test verified report',
      category: 'discrimination',
      severity: 'medium',
      location: 'Test Location 3',
      date: new Date('2024-01-05'),
      reporter: global.testUsers.reporter.id,
      status: 'verified',
      ipfsHash: 'QmTestVerifiedHash',
      transactionHash: '0xverified123456789',
      verified: true,
      verifier: global.testUsers.verifier.id,
      verificationDate: new Date('2024-01-06')
    }
  };
  
  // Create test files
  global.testFiles = {
    image: {
      name: 'test-image.jpg',
      size: 1024 * 50, // 50KB
      type: 'image/jpeg',
      content: new Uint8Array(1024 * 50).fill(255),
      hash: 'sha256-test-image-hash'
    },
    
    document: {
      name: 'test-document.pdf',
      size: 1024 * 100, // 100KB
      type: 'application/pdf',
      content: new Uint8Array(1024 * 100).fill(128),
      hash: 'sha256-test-document-hash'
    },
    
    text: {
      name: 'test-text.txt',
      size: 1024, // 1KB
      type: 'text/plain',
      content: new TextEncoder().encode('This is a test text file content'),
      hash: 'sha256-test-text-hash'
    }
  };
  
  // Create test encryption keys
  global.testKeys = {
    encryption: {
      key: new Uint8Array(32).fill(42), // 32-byte key
      iv: new Uint8Array(12).fill(24)   // 12-byte IV for AES-GCM
    },
    
    signing: {
      privateKey: '0x' + '1'.repeat(64), // 32-byte private key
      publicKey: '0x' + '2'.repeat(128)  // 64-byte public key
    }
  };
}

// Type declarations for global test objects
declare global {
  var mockIPFS: any;
  var mockBlockchain: any;
  var mockNotifications: any;
  var mockAnalytics: any;
  var mockErrorReporting: any;
  var testUsers: any;
  var testReports: any;
  var testFiles: any;
  var testKeys: any;
}