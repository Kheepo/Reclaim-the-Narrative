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
  var testEncryptionKeys: any;
  var testKeys: any;
}

/**
 * Global Jest teardown configuration
 * Runs once after all test suites complete
 */
export default async function globalTeardown() {
  console.log('🧹 Starting global test cleanup...');

  // Clean up test data
  await cleanupTestData();

  // Clean up mock services
  await cleanupMockServices();

  // Clean up temporary files
  await cleanupTempFiles();

  // Reset environment variables
  resetEnvironmentVariables();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  console.log('✅ Global test cleanup completed');
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  // Clear test users
  if (global.testUsers) {
    global.testUsers = [];
  }

  // Clear test reports
  if (global.testReports) {
    global.testReports = [];
  }

  // Clear test files
  if (global.testFiles) {
    global.testFiles = [];
  }

  // Clear test encryption keys
  if (global.testEncryptionKeys) {
    global.testEncryptionKeys = null;
  }

  // Clear localStorage and sessionStorage
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
}

/**
 * Clean up mock services
 */
async function cleanupMockServices() {
  // Clean up IPFS mocks
  if (global.mockIPFS) {
    global.mockIPFS = null;
  }

  // Clean up blockchain mocks
  if (global.mockBlockchain) {
    global.mockBlockchain = null;
  }

  // Clean up notification mocks
  if (global.mockNotifications) {
    global.mockNotifications = null;
  }

  // Clean up analytics mocks
  if (global.mockAnalytics) {
    global.mockAnalytics = null;
  }

  // Clean up error reporting mocks
  if (global.mockErrorReporting) {
    global.mockErrorReporting = null;
  }
}

/**
 * Clean up temporary files
 */
async function cleanupTempFiles() {
  // In a real implementation, this would clean up any temporary files
  // created during testing. For now, we'll just log the action.
  console.log('🗑️ Cleaning up temporary files...');
}

/**
 * Reset environment variables
 */
function resetEnvironmentVariables() {
  // Reset test-specific environment variables
  const testEnvVars = [
    'NODE_ENV',
    'NEXT_PUBLIC_APP_ENV',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
    'NEXT_PUBLIC_ALCHEMY_API_KEY',
    'IPFS_GATEWAY_URL',
    'PINATA_API_KEY',
    'PINATA_SECRET_KEY',
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'APP_SECRET'
  ];

  testEnvVars.forEach(varName => {
    if (process.env[varName] && process.env[varName].includes('test')) {
      delete process.env[varName];
    }
  });
}