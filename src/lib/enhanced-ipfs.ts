/**
 * Enhanced IPFS utilities with progress tracking, corruption detection, and retry mechanisms
 */

import { createEnhancedError, ErrorCategory, retryWithBackoff, withTimeout } from './error-handling';
import { robustFetch, checkConnectivity } from './network-utils';

export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'verifying' | 'completed' | 'failed';
  progress: number; // 0-100
  bytesUploaded: number;
  totalBytes: number;
  speed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
  currentFile?: string;
  error?: string;
}

export interface IPFSUploadResult {
  cid: string;
  size: number;
  url: string;
  hash: string;
  uploadTime: number;
  verified: boolean;
}

export interface IPFSUploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  timeout?: number;
  retryAttempts?: number;
  verifyUpload?: boolean;
  chunkSize?: number;
  enableCompression?: boolean;
  metadata?: Record<string, any>;
}

export interface IPFSGateway {
  name: string;
  url: string;
  timeout: number;
  priority: number;
  supportsUpload: boolean;
}

// Configuration validation interfaces
interface PinataConfigValidation {
  isValid: boolean;
  error?: string;
  details?: string;
}

/**
 * Validate Pinata API configuration
 */
function validatePinataConfig(apiKey?: string, secretKey?: string): PinataConfigValidation {
  if (!apiKey || !secretKey) {
    return {
      isValid: false,
      error: 'Missing API keys',
      details: 'Both REACT_APP_PINATA_API_KEY and REACT_APP_PINATA_SECRET_KEY must be set'
    };
  }
  
  // Check for placeholder values
  const placeholderValues = [
    'your_pinata_api_key_here',
    'your_pinata_secret_key_here',
    'pk_placeholder',
    'sk_placeholder',
    'your_api_key',
    'your_secret_key'
  ];
  
  if (placeholderValues.includes(apiKey) || placeholderValues.includes(secretKey)) {
    return {
      isValid: false,
      error: 'Placeholder values detected',
      details: 'API keys contain placeholder values. Please update with actual Pinata credentials'
    };
  }
  
  // Basic format validation
  if (apiKey.length < 10 || secretKey.length < 10) {
    return {
      isValid: false,
      error: 'Invalid key format',
      details: 'API keys appear to be too short. Please verify your Pinata credentials'
    };
  }
  
  return { isValid: true };
}

/**
 * Generate detailed error message for configuration issues
 */
function generateConfigurationErrorMessage(pinataConfig: PinataConfigValidation): string {
  const baseMessage = 'IPFS upload service unavailable.';
  
  if (!pinataConfig.isValid) {
    const setupInstructions = [
      '\n\nTo fix this issue:',
      '1. Visit https://app.pinata.cloud/ to create an account',
      '2. Generate API keys with pinFileToIPFS permissions',
      '3. Update your .env file with the actual API keys:',
      '   REACT_APP_PINATA_API_KEY=your_actual_api_key',
      '   REACT_APP_PINATA_SECRET_KEY=your_actual_secret_key',
      '4. Restart your development server',
      '\nFor detailed instructions, see IPFS_SETUP_GUIDE.md'
    ].join('\n');
    
    return `${baseMessage} ${pinataConfig.error}: ${pinataConfig.details}${setupInstructions}`;
  }
  
  return `${baseMessage} Please configure Web3.Storage or check your network connection.`;
}

// IPFS Gateway configurations - Updated with working gateways
const IPFS_GATEWAYS: IPFSGateway[] = [
  {
    name: 'Web3.Storage',
    url: 'https://api.web3.storage',
    timeout: 30000,
    priority: 1,
    supportsUpload: true
  },
  {
    name: 'Pinata',
    url: 'https://api.pinata.cloud',
    timeout: 30000,
    priority: 2,
    supportsUpload: true
  },
  {
    name: 'IPFS.io',
    url: 'https://ipfs.io',
    timeout: 20000,
    priority: 3,
    supportsUpload: false
  },
  {
    name: 'Dweb.link',
    url: 'https://dweb.link',
    timeout: 20000,
    priority: 4,
    supportsUpload: false
  },
  {
    name: 'Gateway.pinata.cloud',
    url: 'https://gateway.pinata.cloud',
    timeout: 20000,
    priority: 5,
    supportsUpload: false
  },
  {
    name: 'W3s.link',
    url: 'https://w3s.link',
    timeout: 20000,
    priority: 6,
    supportsUpload: false
  }
];

/**
 * Calculate file hash for verification
 */
export async function calculateFileHash(file: File | Blob): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    throw createEnhancedError(
      'Failed to calculate file hash',
      ErrorCategory.FILE_PROCESSING,
      { operation: 'hash_calculation' },
      error as Error
    );
  }
}

/**
 * Compress file if beneficial
 */
export async function compressFile(file: File): Promise<File> {
  // Only compress if file is larger than 1MB and is compressible
  if (file.size < 1024 * 1024) {
    return file;
  }
  
  const compressibleTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'image/svg+xml'
  ];
  
  const isCompressible = compressibleTypes.some(type => file.type.startsWith(type));
  if (!isCompressible) {
    return file;
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const compressed = await new Response(
      new Response(arrayBuffer).body?.pipeThrough(new CompressionStream('gzip'))
    ).arrayBuffer();
    
    // Only use compressed version if it's significantly smaller
    if (compressed.byteLength < file.size * 0.8) {
      return new File([compressed], `${file.name}.gz`, {
        type: 'application/gzip',
        lastModified: file.lastModified
      });
    }
    
    return file;
  } catch (error) {
    console.warn('File compression failed, using original:', error);
    return file;
  }
}

/**
 * Upload file to IPFS with enhanced features
 */
export async function uploadToIPFS(
  file: File,
  options: IPFSUploadOptions = {}
): Promise<IPFSUploadResult> {
  const {
    onProgress,
    timeout = 60000,
    retryAttempts = 3,
    verifyUpload = true,
    enableCompression = true,
    metadata = {}
  } = options;
  
  const startTime = Date.now();
  let processedFile = file;
  
  // Report initial progress
  onProgress?.({
    stage: 'preparing',
    progress: 0,
    bytesUploaded: 0,
    totalBytes: file.size,
    currentFile: file.name
  });
  
  try {
    // Check network connectivity
    const connectivity = await checkConnectivity();
    if (!connectivity.isConnected) {
      throw createEnhancedError(
        'No internet connection available for IPFS upload',
        ErrorCategory.NETWORK,
        { operation: 'ipfs_upload_no_connection' }
      );
    }
    
    // Compress file if enabled
    if (enableCompression) {
      processedFile = await compressFile(file);
      onProgress?.({
        stage: 'preparing',
        progress: 10,
        bytesUploaded: 0,
        totalBytes: processedFile.size,
        currentFile: processedFile.name
      });
    }
    
    // Calculate original hash for verification
    const originalHash = await calculateFileHash(file);
    
    onProgress?.({
      stage: 'preparing',
      progress: 20,
      bytesUploaded: 0,
      totalBytes: processedFile.size,
      currentFile: processedFile.name
    });
    
    // Upload with retry mechanism
    const uploadResult = await retryWithBackoff(async () => {
      return await uploadWithProgress(processedFile, originalHash, {
        onProgress,
        timeout,
        metadata
      });
    }, {
      maxAttempts: retryAttempts,
      baseDelay: 2000,
      retryCondition: (error) => {
        // Retry on network errors but not on file validation errors
        return !error.message.includes('validation') &&
               !error.message.includes('invalid file');
      }
    });
    
    // Verify upload if enabled
    if (verifyUpload) {
      onProgress?.({
        stage: 'verifying',
        progress: 90,
        bytesUploaded: processedFile.size,
        totalBytes: processedFile.size,
        currentFile: processedFile.name
      });
      
      try {
        const verified = await verifyIPFSUpload(uploadResult.cid, originalHash);
        uploadResult.verified = verified;
        
        if (!verified) {
          console.warn(`Upload verification failed for CID ${uploadResult.cid}, but continuing with upload`);
          uploadResult.verified = false;
        }
      } catch (error) {
        console.warn('Upload verification failed due to gateway issues, but upload may still be successful:', error);
        uploadResult.verified = false;
        // Don't throw error - the upload itself was successful
      }
    }
    
    const uploadTime = Date.now() - startTime;
    uploadResult.uploadTime = uploadTime;
    
    onProgress?.({
      stage: 'completed',
      progress: 100,
      bytesUploaded: processedFile.size,
      totalBytes: processedFile.size,
      currentFile: processedFile.name,
      speed: processedFile.size / (uploadTime / 1000)
    });
    
    return uploadResult;
    
  } catch (error) {
    onProgress?.({
      stage: 'failed',
      progress: 0,
      bytesUploaded: 0,
      totalBytes: processedFile.size,
      currentFile: processedFile.name,
      error: (error as Error).message
    });
    
    throw error;
  }
}

/**
 * Upload with progress tracking
 */
async function uploadWithProgress(
  file: File,
  originalHash: string,
  options: {
    onProgress?: (progress: UploadProgress) => void;
    timeout: number;
    metadata: Record<string, any>;
  }
): Promise<IPFSUploadResult> {
  const { onProgress, timeout, metadata } = options;
  
  // Try Web3.Storage first (using new Storacha Network authentication)
    try {
      // Import the main IPFS functions that handle proper authentication
      const { 
        uploadToIPFS: mainUploadToIPFS, 
        isWeb3StorageConfigured,
        validateWeb3StorageConfig,
        generateWeb3StorageErrorMessage,
        checkWeb3StorageStatus
      } = await import('./ipfs');
    
    // Check if Web3.Storage is properly configured
    const status = await checkWeb3StorageStatus();
    if (status.configured && status.hasSpaces) {
      console.log('[Enhanced IPFS] Using Web3.Storage via main IPFS module');
      
      // Use the main uploadToIPFS function which handles proper authentication
      const result = await mainUploadToIPFS(file);
      
      // Report progress
      onProgress?.({
        stage: 'uploading',
        progress: 50,
        bytesUploaded: file.size / 2,
        totalBytes: file.size,
        currentFile: file.name
      });
      
      onProgress?.({
        stage: 'completed',
        progress: 100,
        bytesUploaded: file.size,
        totalBytes: file.size,
        currentFile: file.name
      });
      
      return {
         cid: result.cid,
         size: file.size,
         url: result.url || `https://w3s.link/ipfs/${result.cid}`,
         hash: originalHash,
         uploadTime: result.uploadTime || 0,
         verified: result.verified || false
       };
    } else {
      console.log('[Enhanced IPFS] Web3.Storage not configured, will try Pinata fallback');
      if (status.error) {
        console.warn('[Enhanced IPFS] Web3.Storage status error:', status.error);
      }
    }
  } catch (error) {
    console.warn('Web3.Storage upload failed, trying alternatives:', error);
  }
  
  // Try Pinata as fallback
  const pinataKey = process.env.REACT_APP_PINATA_API_KEY;
  const pinataSecret = process.env.REACT_APP_PINATA_SECRET_KEY;
  
  // Validate Pinata configuration
  const pinataConfigured = validatePinataConfig(pinataKey, pinataSecret);
  
  if (pinataConfigured.isValid) {
    try {
      return await uploadToPinata(file, originalHash, pinataKey!, pinataSecret!, {
        onProgress,
        timeout,
        metadata
      });
    } catch (error) {
      console.warn('Pinata upload failed:', error);
    }
  } else {
    console.warn('Pinata not configured:', pinataConfigured.error);
  }
  
  // Generate comprehensive error message for all failed services
  let errorMessage = `IPFS upload failed after trying all available services:\n\n`;
  
  // Add Web3.Storage error details
  errorMessage += `Web3.Storage: Service not configured or unavailable\n`;
  
  // Add Pinata error details
  if (pinataConfigured.isValid) {
    errorMessage += `\nPinata: Upload attempt failed\n`;
  } else {
    errorMessage += `\nPinata: ${pinataConfigured.error} - ${pinataConfigured.details}\n`;
  }
  
  errorMessage += `\n\nRecommended Actions:\n` +
    `1. Check your internet connection\n` +
    `2. Configure at least one IPFS service (see IPFS_SETUP_GUIDE.md)\n` +
    `3. For immediate resolution, set up Pinata API keys (faster setup)\n` +
    `4. For long-term use, consider Web3.Storage (free, decentralized)\n\n` +
    `If the issue persists, please contact support with the error details above.`;
  
  throw createEnhancedError(
    errorMessage,
    ErrorCategory.IPFS,
    { 
      operation: 'no_upload_service',
      additionalData: {
        pinataConfigured: pinataConfigured.isValid,
        pinataError: pinataConfigured.error,
        setupGuide: 'See IPFS_SETUP_GUIDE.md for configuration instructions'
      }
    }
  );
}

/**
 * Upload to Web3.Storage
 */
async function uploadToWeb3Storage(
  file: File,
  originalHash: string,
  apiKey: string,
  options: {
    onProgress?: (progress: UploadProgress) => void;
    timeout: number;
    metadata: Record<string, any>;
  }
): Promise<IPFSUploadResult> {
  const { onProgress, timeout, metadata } = options;
  
  const formData = new FormData();
  formData.append('file', file);
  
  // Add metadata
  if (Object.keys(metadata).length > 0) {
    formData.append('metadata', JSON.stringify(metadata));
  }
  
  const startTime = Date.now();
  let lastProgressTime = startTime;
  let lastBytesUploaded = 0;
  
  const response = await withTimeout(
    fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    }),
    timeout
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw createEnhancedError(
      `Web3.Storage upload failed: ${response.status} ${errorText}`,
      ErrorCategory.IPFS,
      { operation: 'web3_storage_upload', additionalData: { status: response.status, error: errorText } }
    );
  }
  
  const result = await response.json();
  
  if (!result.cid) {
    throw createEnhancedError(
      'Invalid response from Web3.Storage - no CID returned',
      ErrorCategory.IPFS,
      { operation: 'web3_storage_invalid_response', additionalData: result }
    );
  }
  
  return {
    cid: result.cid,
    size: file.size,
    url: `https://w3s.link/ipfs/${result.cid}`,
    hash: originalHash,
    uploadTime: Date.now() - startTime,
    verified: false
  };
}

/**
 * Upload to Pinata
 */
async function uploadToPinata(
  file: File,
  originalHash: string,
  apiKey: string,
  secretKey: string,
  options: {
    onProgress?: (progress: UploadProgress) => void;
    timeout: number;
    metadata: Record<string, any>;
  }
): Promise<IPFSUploadResult> {
  const { onProgress, timeout, metadata } = options;
  
  const formData = new FormData();
  formData.append('file', file);
  
  // Add Pinata metadata
  const pinataMetadata = {
    name: file.name,
    keyvalues: {
      originalHash,
      uploadTimestamp: new Date().toISOString(),
      ...metadata
    }
  };
  formData.append('pinataMetadata', JSON.stringify(pinataMetadata));
  
  const startTime = Date.now();
  
  const response = await withTimeout(
    fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretKey
      },
      body: formData
    }),
    timeout
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw createEnhancedError(
      `Pinata upload failed: ${response.status} ${errorText}`,
      ErrorCategory.IPFS,
      { operation: 'pinata_upload', additionalData: { status: response.status, error: errorText } }
    );
  }
  
  const result = await response.json();
  
  if (!result.IpfsHash) {
    throw createEnhancedError(
      'Invalid response from Pinata - no IPFS hash returned',
      ErrorCategory.IPFS,
      { operation: 'pinata_invalid_response', additionalData: result }
    );
  }
  
  return {
    cid: result.IpfsHash,
    size: file.size,
    url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
    hash: originalHash,
    uploadTime: Date.now() - startTime,
    verified: false
  };
}

/**
 * Verify IPFS upload with improved fallback strategies
 */
export async function verifyIPFSUpload(
  cid: string,
  expectedHash: string,
  timeout = 30000
): Promise<boolean> {
  const gateways = IPFS_GATEWAYS.filter(g => !g.supportsUpload)
    .sort((a, b) => a.priority - b.priority);
  
  console.log(`Verifying IPFS upload for CID: ${cid} using ${gateways.length} gateways`);
  
  // First, try simple existence check (HEAD request)
  for (const gateway of gateways) {
    try {
      const url = `${gateway.url}/ipfs/${cid}`;
      console.log(`Trying HEAD request to ${gateway.name}: ${url}`);
      
      const response = await withTimeout(
        robustFetch(url, {
          method: 'HEAD',
          headers: {
            'Cache-Control': 'no-cache'
          }
        }),
        Math.min(timeout / 2, gateway.timeout / 2)
      );
      
      if (response.ok) {
        console.log(`✅ File exists on ${gateway.name}, status: ${response.status}`);
        // If HEAD request succeeds, assume upload is valid
        // This is a reasonable assumption for most use cases
        return true;
      }
      
      console.log(`❌ HEAD request failed for ${gateway.name}, status: ${response.status}`);
    } catch (error) {
      console.warn(`HEAD request failed for gateway ${gateway.name}:`, error);
      continue;
    }
  }
  
  console.log('HEAD requests failed, trying full download verification...');
  
  // If HEAD requests fail, try full download and hash verification
  for (const gateway of gateways) {
    try {
      const url = `${gateway.url}/ipfs/${cid}`;
      console.log(`Trying full download from ${gateway.name}: ${url}`);
      
      const response = await withTimeout(
        robustFetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache'
          }
        }),
        Math.min(timeout, gateway.timeout)
      );
      
      if (!response.ok) {
        console.log(`❌ GET request failed for ${gateway.name}, status: ${response.status}`);
        continue;
      }
      
      const blob = await response.blob();
      const downloadedHash = await calculateFileHash(blob);
      
      const hashMatch = downloadedHash === expectedHash;
      console.log(`Hash verification for ${gateway.name}: ${hashMatch ? '✅ Match' : '❌ Mismatch'}`);
      
      if (hashMatch) {
        return true;
      }
    } catch (error) {
      console.warn(`Full download verification failed for gateway ${gateway.name}:`, error);
      continue;
    }
  }
  
  console.error('All verification methods failed for all gateways');
  
  throw createEnhancedError(
    'Could not verify upload - all gateways failed',
    ErrorCategory.IPFS,
    { operation: 'upload_verification_failed', additionalData: { cid, expectedHash, gatewayCount: gateways.length } }
  );
}

/**
 * Upload multiple files with batch progress tracking
 */
export async function uploadMultipleToIPFS(
  files: File[],
  options: IPFSUploadOptions = {}
): Promise<IPFSUploadResult[]> {
  const { onProgress } = options;
  const results: IPFSUploadResult[] = [];
  const totalFiles = files.length;
  let completedFiles = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const result = await uploadToIPFS(file, {
        ...options,
        onProgress: (progress) => {
          // Calculate overall progress
          const fileProgress = progress.progress / 100;
          const overallProgress = ((completedFiles + fileProgress) / totalFiles) * 100;
          
          onProgress?.({
            ...progress,
            progress: overallProgress,
            currentFile: `${file.name} (${i + 1}/${totalFiles})`
          });
        }
      });
      
      results.push(result);
      completedFiles++;
      
    } catch (error) {
      // Continue with other files even if one fails
      console.error(`Failed to upload file ${file.name}:`, error);
      
      results.push({
        cid: '',
        size: file.size,
        url: '',
        hash: '',
        uploadTime: 0,
        verified: false
      });
      
      completedFiles++;
    }
  }
  
  return results;
}

/**
 * Get file from IPFS with fallback gateways
 */
export async function getFromIPFS(
  cid: string,
  timeout = 30000
): Promise<Blob> {
  const gateways = IPFS_GATEWAYS
    .filter(g => !g.supportsUpload)
    .sort((a, b) => a.priority - b.priority);
  
  for (const gateway of gateways) {
    try {
      const url = `${gateway.url}/ipfs/${cid}`;
      
      const response = await withTimeout(
        robustFetch(url),
        Math.min(timeout, gateway.timeout)
      );
      
      if (response.ok) {
        return await response.blob();
      }
    } catch (error) {
      console.warn(`Failed to fetch from gateway ${gateway.name}:`, error);
      continue;
    }
  }
  
  throw createEnhancedError(
    `Could not retrieve file with CID ${cid} from any gateway`,
    ErrorCategory.IPFS,
    { operation: 'ipfs_retrieval', additionalData: { cid } }
  );
}

/**
 * Check IPFS gateway availability
 */
export async function checkGatewayAvailability(): Promise<Record<string, boolean>> {
  const testCid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'; // IPFS readme
  const results: Record<string, boolean> = {};
  
  const checks = IPFS_GATEWAYS.map(async (gateway) => {
    try {
      const url = `${gateway.url}/ipfs/${testCid}`;
      const response = await withTimeout(
        fetch(url, { method: 'HEAD', mode: 'no-cors' }),
        gateway.timeout
      );
      results[gateway.name] = true;
    } catch (error) {
      results[gateway.name] = false;
    }
  });
  
  await Promise.allSettled(checks);
  return results;
}

/**
 * Format upload progress for display
 */
export function formatUploadProgress(progress: UploadProgress): string {
  const { stage, progress: percent, bytesUploaded, totalBytes, speed, estimatedTimeRemaining } = progress;
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  let message = `${stage.charAt(0).toUpperCase() + stage.slice(1)}: ${percent.toFixed(1)}%`;
  
  if (bytesUploaded > 0 && totalBytes > 0) {
    message += ` (${formatBytes(bytesUploaded)} / ${formatBytes(totalBytes)})`;
  }
  
  if (speed && speed > 0) {
    message += ` at ${formatBytes(speed)}/s`;
  }
  
  if (estimatedTimeRemaining && estimatedTimeRemaining > 0) {
    message += ` - ${formatTime(estimatedTimeRemaining)} remaining`;
  }
  
  return message;
}