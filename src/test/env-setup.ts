// Environment setup for tests
(process.env as any).NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_ENV = 'test';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'test-wallet-connect-id';
process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = 'test-alchemy-key';

process.env.NEXT_PUBLIC_IPFS_GATEWAY = 'https://test.ipfs.io';
process.env.NEXT_PUBLIC_PINATA_API_KEY = 'test-pinata-key';
process.env.PINATA_SECRET_API_KEY = 'test-pinata-secret';

process.env.NEXT_PUBLIC_ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.NEXT_PUBLIC_APP_SECRET = 'test-app-secret-for-testing-only';

// Blockchain test configuration
process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL = 'https://test.ethereum.rpc';
process.env.NEXT_PUBLIC_POLYGON_RPC_URL = 'https://test.polygon.rpc';
process.env.NEXT_PUBLIC_BSC_RPC_URL = 'https://test.bsc.rpc';

process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_ETHEREUM = '0x1234567890123456789012345678901234567890';
process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON = '0x1234567890123456789012345678901234567891';
process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BSC = '0x1234567890123456789012345678901234567892';

// Test database configuration
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// API configuration
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// File upload configuration
process.env.MAX_FILE_SIZE = '10485760'; // 10MB
process.env.ALLOWED_FILE_TYPES = 'image/jpeg,image/png,image/gif,application/pdf,text/plain';

// Rate limiting
process.env.RATE_LIMIT_WINDOW = '900000'; // 15 minutes
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

// Security configuration
process.env.BCRYPT_ROUNDS = '10';
process.env.JWT_EXPIRY = '24h';
process.env.REFRESH_TOKEN_EXPIRY = '7d';

// Monitoring and logging
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_METRICS = 'false';
process.env.SENTRY_DSN = '';

// Feature flags for testing
process.env.FEATURE_MULTI_CHAIN = 'true';
process.env.FEATURE_FILE_ENCRYPTION = 'true';
process.env.FEATURE_ADVANCED_VALIDATION = 'true';
process.env.FEATURE_ERROR_MONITORING = 'false';

export {};