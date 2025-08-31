/**
 * IPFS integration module using web3.storage
 * Handles uploading encrypted files to IPFS via web3.storage
 */

import * as Client from '@storacha/client'
import type { UnknownLink } from 'multiformats'

export interface IPFSUploadResult {
  cid: string;
  url?: string;
  size?: number;
  name?: string;
}

export interface FileUpload {
  file: File;
  name: string;
  type: string;
}

// Initialize Web3.Storage client
let web3StorageClient: Client.Client | null = null

/**
 * Initialize web3.storage client
 */
export async function initializeWeb3Storage(): Promise<Client.Client> {
  console.log('[Web3Storage Init] Starting client initialization...')
  
  if (web3StorageClient) {
    console.log('[Web3Storage Init] Using existing client instance')
    return web3StorageClient
  }

  try {
    console.log('[Web3Storage Init] Creating new client instance...')
    // Create client with proper agent management
    web3StorageClient = await Client.create()
    
    console.log('[Web3Storage Init] Client created, checking accounts...')
    // Check if we have any accounts configured
    const accounts = web3StorageClient.accounts()
    
    if (!Object.keys(accounts).length) {
      console.error('[Web3Storage Init] No accounts configured')
      throw new Error(
        'No web3.storage account configured. Please run the setup process:\n' +
        '1. Create a client and login with your email\n' +
        '2. Create a space for uploads\n' +
        '3. Associate the space with your account\n' +
        'See documentation for setup instructions.'
      )
    }

    console.log(`[Web3Storage Init] Found ${Object.keys(accounts).length} account(s)`)
    
    // Check if we have a current space
    const currentSpace = web3StorageClient.currentSpace()
    if (!currentSpace) {
      console.log('[Web3Storage Init] No current space set, looking for available spaces...')
      // Try to use the first available space
      const spaces = web3StorageClient.spaces()
      console.log(`[Web3Storage Init] Found ${spaces.length} space(s)`)
      
      if (spaces.length > 0) {
        console.log(`[Web3Storage Init] Setting current space to: ${spaces[0].name || 'unnamed'}`)
        await web3StorageClient.setCurrentSpace(spaces[0].did())
      } else {
        console.error('[Web3Storage Init] No spaces available')
        throw new Error(
          'No spaces available. Please create a space first:\n' +
          'const space = await client.createSpace("my-space")\n' +
          'await space.save()\n' +
          'await account.provision(space.did())'
        )
      }
    } else {
      console.log(`[Web3Storage Init] Current space: ${currentSpace.name || 'unnamed'}`)
    }

    console.log('[Web3Storage Init] ✅ Client initialized successfully')
    return web3StorageClient
  } catch (error) {
    console.error('[Web3Storage Init] Failed to initialize Web3.Storage client:', error)
    throw error
  }
}

// Setup function for initial configuration (should be called once)
export const setupWeb3Storage = async (email: string, spaceName: string = 'GBV-Reporting-Platform', maxRetries: number = 3): Promise<{ success: boolean; message: string; needsVerification?: boolean }> => {
  console.log(`[Web3.Storage Setup] Starting setup for email: ${email}`)
  console.debug('[IPFS] Starting setupWeb3Storage function')
  
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error(`[Web3.Storage Setup] Invalid email format: ${email}`)
      return { success: false, message: 'Please enter a valid email address' }
    }
    
    console.log(`[Web3.Storage Setup] Email validation passed for: ${email}`)
    
    // Check if already configured
    try {
      console.debug('[IPFS] Checking existing Web3.Storage status')
      const status = await checkWeb3StorageStatus()
      if (status.configured && status.hasSpaces) {
        console.log('[Web3.Storage Setup] Already configured with spaces, skipping setup')
        return { success: true, message: 'Web3.Storage is already configured' }
      }
      if (status.configured && !status.hasSpaces) {
        console.log('[Web3.Storage Setup] Account exists but no spaces, will create space')
        await createWeb3StorageSpace(spaceName)
        return { success: true, message: 'Space created successfully' }
      }
    } catch (statusError) {
      console.log('[Web3.Storage Setup] Status check failed, proceeding with setup:', statusError)
    }
    
    console.debug('[IPFS] Creating Web3.Storage client')
    let client
    try {
      client = await Client.create()
      console.log('[Web3.Storage Setup] Web3.Storage client created successfully')
    } catch (clientError) {
      console.error('[Web3.Storage Setup] Failed to create client:', clientError)
      return { 
        success: false, 
        message: `Failed to initialize Web3.Storage client: ${clientError instanceof Error ? clientError.message : 'Unknown error'}` 
      }
    }
    
    // Retry logic for email verification
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[IPFS] Attempting to send verification email (attempt ${attempt}/${maxRetries})`)
        
        const account = await client.login(email as `${string}@${string}`)
        
        console.log('[IPFS] Verification email sent successfully')
        console.log('[Web3.Storage Setup] 📧 Please check your email (including spam folder) and click the verification link.')
        
        // Additional helpful information
        console.log('[Web3.Storage Setup] ℹ️  Important notes:')
        console.log('[Web3.Storage Setup] • The verification email may take 2-5 minutes to arrive')
        console.log('[Web3.Storage Setup] • Check your spam/junk folder if you don\'t see it')
        console.log('[Web3.Storage Setup] • The verification link will open in your browser')
        console.log('[Web3.Storage Setup] • After clicking the link, return here and refresh the status')
        
        // Success - break out of retry loop
        return { 
          success: true, 
          message: 'Verification email sent! Please check your inbox and click the verification link.',
          needsVerification: true 
        }
        
      } catch (loginError) {
        lastError = loginError instanceof Error ? loginError : new Error('Unknown login error')
        console.error(`[IPFS] Email sending attempt ${attempt} failed:`, lastError.message)
        
        if (loginError instanceof Error) {
          if (loginError.message.includes('rate limit') || loginError.message.includes('too many requests')) {
            const waitTime = Math.min(30000 * attempt, 120000) // 30s, 60s, 120s
            console.log(`[IPFS] Rate limited, waiting ${waitTime/1000}s before retry...`)
            
            if (attempt === maxRetries) {
              return { success: false, message: 'Rate limited. Please wait 5-10 minutes before trying again.' }
            }
            
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          } else if (loginError.message.includes('invalid email') || loginError.message.includes('malformed')) {
            return { success: false, message: 'Invalid email address format. Please check and try again.' }
          } else if (loginError.message.includes('network') || loginError.message.includes('fetch')) {
            if (attempt === maxRetries) {
              return { success: false, message: 'Network error. Please check your internet connection and try again.' }
            }
            console.log(`[IPFS] Network error, retrying in ${attempt * 2}s...`)
            console.debug(`[IPFS] Waiting before retry ${attempt}`)
            await new Promise(resolve => setTimeout(resolve, attempt * 2000))
            continue
          } else if (loginError.message.includes('already exists') || loginError.message.includes('already registered')) {
            console.log('[Web3.Storage Setup] Account already exists, checking verification status...')
            // Account exists, check if it's verified
            try {
              const status = await checkWeb3StorageStatus()
              if (status.configured) {
                console.log('[Web3.Storage Setup] Account is already verified!')
                if (!status.hasSpaces) {
                  console.log('[Web3.Storage Setup] Creating space for existing account...')
                  await createWeb3StorageSpace(spaceName)
                }
                return { success: true, message: 'Account is already verified and configured' }
              }
            } catch (statusError) {
              console.log('[Web3.Storage Setup] Could not check status of existing account')
            }
            return { 
              success: true, 
              message: 'Account already exists. Please check your email for verification if needed.',
              needsVerification: true 
            }
          }
        }
        
        // For other errors, don't retry
        if (attempt === maxRetries) {
          break
        }
        
        console.log(`[Web3.Storage Setup] Retrying in ${attempt * 2}s...`)
        console.debug(`[IPFS] Waiting before retry ${attempt}`)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
      }
    }
    
    // If we get here, all retries failed
    return { 
      success: false, 
      message: `Failed to send verification email after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}. Please try again later or contact support if the issue persists.` 
    }
    
  } catch (error) {
    console.error('[Web3.Storage Setup] Setup failed:', error)
    return { 
      success: false, 
      message: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later.` 
    }
  }
}

// Create space after email verification is completed
export const createWeb3StorageSpace = async (spaceName: string = 'GBV-Reporting-Platform', maxRetries: number = 3): Promise<void> => {
  console.log(`[Web3.Storage Space] Starting space creation: ${spaceName}`)
  
  try {
    const client = await Client.create()
    console.log('[Web3.Storage Space] Client created successfully')
    
    // Retry logic for space creation
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Web3.Storage Space] Attempt ${attempt}/${maxRetries}: Checking account verification...`)
        
        const accounts = client.accounts()
        
        // Check if user is logged in
        if (Object.keys(accounts).length === 0) {
          console.error('[Web3.Storage Space] No authenticated account found')
          throw new Error('No authenticated account found. Please complete email verification first.')
        }
        
        console.log('[Web3.Storage Space] ✅ Account verified, proceeding with space creation...')
        
        // Get the first account (should be the one we just verified)
        const accountEmail = Object.keys(accounts)[0] as keyof typeof accounts
        const account = accounts[accountEmail]
        
        // Check if space already exists
        try {
          const spaces = client.spaces()
          const existingSpace = spaces.find(space => space.name === spaceName)
          if (existingSpace) {
            console.log(`[Web3.Storage Space] Space "${spaceName}" already exists, setting as current...`)
            await client.setCurrentSpace(existingSpace.did())
            console.log('[Web3.Storage Space] ✅ Existing space set as current')
            return
          }
        } catch (spacesError) {
          console.log('[Web3.Storage Space] Could not check existing spaces, proceeding with creation...')
        }
        
        // Create a space for uploads
        console.log(`[Web3.Storage Space] Creating new space: ${spaceName}...`)
        const space = await client.createSpace(spaceName)
        
        // Save the space to the store and set as current
        await space.save()
        
        // Associate this space with the account
        await account.provision(space.did())
        
        console.log(`[Web3.Storage Space] ✅ Space "${spaceName}" created and provisioned successfully!`)
        console.log(`[Web3.Storage Space] Space DID: ${space.did()}`)
        
        // Verify the space is properly set
        try {
          const currentSpace = client.currentSpace()
          if (currentSpace) {
            console.log(`[Web3.Storage Space] ✅ Current space confirmed: ${currentSpace.name || 'unnamed'}`)
          }
        } catch (verifyError) {
          console.log('[Web3.Storage Space] Could not verify current space, but creation succeeded')
        }
        
        return // Success - exit retry loop
        
      } catch (spaceError) {
        lastError = spaceError instanceof Error ? spaceError : new Error('Unknown space creation error')
        console.error(`[Web3.Storage Space] Attempt ${attempt} failed:`, lastError.message)
        
        if (spaceError instanceof Error) {
          // Handle specific error types
          if (spaceError.message.includes('No authenticated account') || spaceError.message.includes('not verified')) {
            throw new Error('Please complete email verification before creating a space. Check your email and click the verification link.')
          } else if (spaceError.message.includes('rate limit') || spaceError.message.includes('too many requests')) {
            const waitTime = Math.min(15000 * attempt, 60000) // 15s, 30s, 60s
            console.log(`[Web3.Storage Space] Rate limited. Waiting ${waitTime/1000}s before retry...`)
            
            if (attempt === maxRetries) {
              throw new Error('Rate limited. Please wait a few minutes before trying again.')
            }
            
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          } else if (spaceError.message.includes('network') || spaceError.message.includes('fetch')) {
            if (attempt === maxRetries) {
              throw new Error('Network error. Please check your internet connection and try again.')
            }
            console.log(`[Web3.Storage Space] Network error, retrying in ${attempt * 2}s...`)
            await new Promise(resolve => setTimeout(resolve, attempt * 2000))
            continue
          } else if (spaceError.message.includes('already exists') || spaceError.message.includes('duplicate')) {
            console.log('[Web3.Storage Space] Space already exists, attempting to set as current...')
            try {
              const spaces = client.spaces()
              const existingSpace = spaces.find(space => space.name === spaceName)
              if (existingSpace) {
                await client.setCurrentSpace(existingSpace.did())
                console.log('[Web3.Storage Space] ✅ Existing space set as current')
                return
              }
            } catch (setError) {
              console.log('[Web3.Storage Space] Could not set existing space as current')
            }
            throw new Error(`Space "${spaceName}" already exists but could not be set as current. Please try with a different name.`)
          }
        }
        
        // For other errors, don't retry immediately
        if (attempt === maxRetries) {
          break
        }
        
        console.log(`[Web3.Storage Space] Retrying in ${attempt * 2}s...`)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
      }
    }
    
    // If we get here, all retries failed
    throw new Error(`Failed to create space after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}. Please try again later.`)
    
  } catch (error) {
    console.error('[Web3.Storage Space] Space creation failed:', error)
    throw error
  }
}

/**
 * Upload a single file to IPFS with retry mechanism
 */
export async function uploadFileToIPFS(file: File, maxRetries: number = 3): Promise<{ cid: string; url: string }> {
  console.log(`[IPFS Upload] Starting upload for file: ${file.name} (${file.size} bytes, ${file.type})`)
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[IPFS Upload] Attempt ${attempt}/${maxRetries}: Initializing Web3.Storage client...`)
      const client = await initializeWeb3Storage()
      console.log('[IPFS Upload] Client initialized successfully, uploading file...')
      
      const cid = await client.uploadFile(file)
      const result = {
        cid: cid.toString(),
        url: `https://${cid}.ipfs.w3s.link`
      }
      
      console.log(`[IPFS Upload] ✅ Upload successful! CID: ${result.cid}`)
      console.log(`[IPFS Upload] File URL: ${result.url}`)
      
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`[IPFS Upload] Attempt ${attempt} failed:`, lastError.message)
      
      if (error instanceof Error && error.message.includes('space/blob/add')) {
        console.error('[IPFS Upload] Permission error: Missing blob/add permission')
        throw new Error('IPFS upload failed: Missing blob/add permission. Please check your web3.storage space delegation.')
      }
      
      if (error instanceof Error && error.message.includes('account is not configured')) {
        console.error('[IPFS Upload] Configuration error: Account not configured')
        throw new Error('IPFS upload failed: Web3.storage account not configured. Please set up your account first.')
      }
      
      if (error instanceof Error && error.message.includes('network')) {
        console.warn(`[IPFS Upload] Network error on attempt ${attempt}, will retry if attempts remain`)
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        console.error(`[IPFS Upload] All ${maxRetries} attempts failed`)
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      console.log(`[IPFS Upload] Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error(`Failed to upload file to IPFS after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Upload file to IPFS via web3.storage
 */
export async function uploadToIPFS(file: File, filename?: string): Promise<IPFSUploadResult> {
  console.log(`[IPFS Upload Simple] Starting upload for file: ${filename || file.name} (${file.size} bytes, ${file.type})`);
  
  try {
    console.log('[IPFS Upload Simple] Initializing Web3.Storage client...');
    const client = await initializeWeb3Storage();
    console.log('[IPFS Upload Simple] Client initialized successfully, uploading file...');
    
    // Create a new File object with the desired filename
    const uploadFile = new File([file], filename || file.name, {
      type: file.type
    });
    
    // Upload the file
    const cid = await client.uploadFile(uploadFile);
    
    const result = {
      cid: cid.toString(),
      url: `https://${cid}.ipfs.w3s.link`
    };
    
    console.log(`[IPFS Upload Simple] ✅ Upload successful! CID: ${result.cid}`);
    console.log(`[IPFS Upload Simple] File URL: ${result.url}`);
    
    return result;
  } catch (error) {
    console.error('[IPFS Upload Simple] Upload failed:', error);
    
    if (error instanceof Error && error.message.includes('space/blob/add')) {
      console.error('[IPFS Upload Simple] Permission error: Missing blob/add permission');
      throw new Error('IPFS upload failed: Missing blob/add permission. Please check your web3.storage space delegation.');
    }
    
    if (error instanceof Error && error.message.includes('account is not configured')) {
      console.error('[IPFS Upload Simple] Configuration error: Account not configured');
      throw new Error('IPFS upload failed: Web3.storage account not configured. Please set up your account first.');
    }
    
    throw new Error(`Failed to upload to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload multiple files to IPFS with retry mechanism
 */
export async function uploadFilesToIPFS(files: File[], maxRetries: number = 3): Promise<{ cid: string; url: string }[]> {
  console.log(`[IPFS Multi-Upload] Starting upload for ${files.length} files`)
  console.log(`[IPFS Multi-Upload] Files:`, files.map(f => `${f.name} (${f.size} bytes)`).join(', '))
  
  const results: { cid: string; url: string }[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    console.log(`[IPFS Multi-Upload] Processing file ${i + 1}/${files.length}: ${file.name}`)
    
    try {
      const result = await uploadFileToIPFS(file, maxRetries)
      results.push(result)
      console.log(`[IPFS Multi-Upload] ✅ File ${i + 1}/${files.length} uploaded successfully`)
    } catch (error) {
      // If one file fails, we still want to know which files succeeded
      console.error(`[IPFS Multi-Upload] ❌ Failed to upload file ${file.name}:`, error)
      throw new Error(`Failed to upload file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  console.log(`[IPFS Multi-Upload] ✅ All ${files.length} files uploaded successfully`)
  return results
}

/**
 * Upload multiple files to IPFS
 */
export async function uploadMultipleToIPFS(files: FileUpload[]): Promise<IPFSUploadResult[]> {
  const uploadPromises = files.map(({ file, name }) => 
    uploadToIPFS(file, name)
  );
  
  try {
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple IPFS upload failed:', error);
    throw new Error(`Failed to upload multiple files to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload encrypted data to IPFS with retry mechanism
 */
export async function uploadEncryptedDataToIPFS(encryptedData: Uint8Array, filename: string, maxRetries: number = 3): Promise<IPFSUploadResult> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await initializeWeb3Storage()
      
      // Create a File object from the encrypted data
      const file = new File([new Uint8Array(encryptedData)], filename, { type: 'application/octet-stream' })
      
      // Upload the file
      const cid = await client.uploadFile(file)
      
      return {
        cid: cid.toString(),
        size: encryptedData.length,
        name: filename
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (error instanceof Error && error.message.includes('space/blob/add')) {
        throw new Error('IPFS upload failed: No permission to add blobs to space. Please ensure proper space delegation.')
      }
      
      if (error instanceof Error && error.message.includes('account is not configured')) {
        throw new Error('IPFS upload failed: Web3.storage account not configured. Please set up your account first.')
      }
      
      console.warn(`Encrypted data upload attempt ${attempt} failed:`, lastError.message)
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error(`Failed to upload encrypted data to IPFS after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Upload encrypted data as a file to IPFS
 */
export async function uploadEncryptedDataStringToIPFS(
  encryptedData: string,
  filename: string,
  mimeType: string = 'application/octet-stream'
): Promise<IPFSUploadResult> {
  // Convert encrypted data to blob
  const blob = new Blob([encryptedData], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  
  return await uploadToIPFS(file);
}

/**
 * Upload JSON data to IPFS with retry mechanism
 */
export async function uploadJSONToIPFS(data: any, filename: string = 'data.json', maxRetries: number = 3): Promise<IPFSUploadResult> {
  console.log('[IPFS JSON Upload] Starting JSON upload...')
  console.log('[IPFS JSON Upload] Data size:', JSON.stringify(data).length, 'characters')
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[IPFS JSON Upload] Attempt ${attempt}/${maxRetries}: Initializing Web3.Storage client...`)
      const client = await initializeWeb3Storage()
      console.log('[IPFS JSON Upload] Client initialized successfully, preparing JSON file...')
      
      // Convert JSON to string and then to Uint8Array
      const jsonString = JSON.stringify(data, null, 2)
      const jsonBytes = new TextEncoder().encode(jsonString)
      
      // Create a File object
      const file = new File([jsonBytes], filename, { type: 'application/json' })
      console.log(`[IPFS JSON Upload] JSON file created: ${file.size} bytes`)
      
      console.log('[IPFS JSON Upload] Uploading JSON file...')
      // Upload the file
      const cid = await client.uploadFile(file)
      
      const result = {
        cid: cid.toString(),
        size: jsonBytes.length,
        name: filename
      }
      
      console.log(`[IPFS JSON Upload] ✅ JSON upload successful! CID: ${result.cid}`)
      console.log(`[IPFS JSON Upload] JSON URL: https://${result.cid}.ipfs.w3s.link`)
      
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`[IPFS JSON Upload] Attempt ${attempt} failed:`, lastError.message)
      
      if (error instanceof Error && error.message.includes('space/blob/add')) {
        console.error('[IPFS JSON Upload] Permission error: Missing blob/add permission')
        throw new Error('IPFS upload failed: No permission to add blobs to space. Please ensure proper space delegation.')
      }
      
      if (error instanceof Error && error.message.includes('account is not configured')) {
        console.error('[IPFS JSON Upload] Configuration error: Account not configured')
        throw new Error('IPFS upload failed: Web3.storage account not configured. Please set up your account first.')
      }
      
      console.warn(`[IPFS JSON Upload] JSON upload attempt ${attempt} failed:`, lastError.message)
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      console.log(`[IPFS JSON Upload] Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error(`Failed to upload JSON to IPFS after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Upload JSON data to IPFS (legacy method)
 */
export async function uploadJSONToIPFSLegacy(
  data: any,
  filename: string = 'data.json'
): Promise<IPFSUploadResult> {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  
  return await uploadToIPFS(file);
}

/**
 * Retrieve file from IPFS
 */
export async function retrieveFromIPFS(cid: string): Promise<Response> {
  const url = `https://${cid}.ipfs.w3s.link`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('IPFS retrieval failed:', error);
    throw new Error(`Failed to retrieve from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve data from IPFS using CID
 */
export async function retrieveDataFromIPFS(cid: string): Promise<Uint8Array> {
  console.log(`[IPFS Retrieve] Starting retrieval for CID: ${cid}`)
  
  try {
    console.log('[IPFS Retrieve] Initializing Web3.Storage client...')
    const client = await initializeWeb3Storage()
    console.log('[IPFS Retrieve] Client initialized, getting upload info...')
    
    const res = await client.capability.upload.get({ root: cid })
    
    if (!res.ok) {
      console.error('[IPFS Retrieve] Failed to get upload info:', res.error?.message)
      throw new Error(`Failed to retrieve from IPFS: ${res.error?.message || 'Unknown error'}`)
    }
    
    console.log('[IPFS Retrieve] Upload info retrieved successfully')
    
    // Get the first file from the upload
    const files = res.ok.shards || []
    if (files.length === 0) {
      console.error('[IPFS Retrieve] No files found in upload')
      throw new Error('No files found in IPFS upload')
    }
    
    console.log(`[IPFS Retrieve] Found ${files.length} file(s), fetching content...`)
    
    // Fetch the file content
    const url = `https://${cid}.ipfs.w3s.link`
    console.log(`[IPFS Retrieve] Fetching from URL: ${url}`)
    
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`[IPFS Retrieve] Fetch failed: ${response.status} ${response.statusText}`)
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }
    
    console.log(`[IPFS Retrieve] Content fetched successfully (${response.headers.get('content-length')} bytes)`)
    
    const arrayBuffer = await response.arrayBuffer()
    const result = new Uint8Array(arrayBuffer)
    
    console.log(`[IPFS Retrieve] ✅ Retrieval successful! Retrieved ${result.length} bytes`)
    return result
  } catch (error) {
    console.error('[IPFS Retrieve] Retrieval failed:', error)
    throw error
  }
}

/**
 * Retrieve JSON data from IPFS
 */
export async function getJSONFromIPFS(cid: string): Promise<any> {
  console.log(`[IPFS JSON Retrieve] Starting JSON retrieval for CID: ${cid}`)
  const url = `https://${cid}.ipfs.w3s.link`
  console.log(`[IPFS JSON Retrieve] Fetching JSON from URL: ${url}`)
  
  try {
    const response = await fetch(url)
    console.log(`[IPFS JSON Retrieve] Response status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      console.error(`[IPFS JSON Retrieve] Fetch failed: ${response.status} ${response.statusText}`)
      throw new Error(`Failed to fetch from IPFS: ${response.status} ${response.statusText}`)
    }
    
    console.log('[IPFS JSON Retrieve] Response received, parsing text...')
    const text = await response.text()
    console.log(`[IPFS JSON Retrieve] Text retrieved (${text.length} characters), parsing JSON...`)
    
    const jsonData = JSON.parse(text)
    console.log('[IPFS JSON Retrieve] ✅ JSON parsed successfully')
    console.log('[IPFS JSON Retrieve] JSON keys:', Object.keys(jsonData).join(', '))
    
    return jsonData
  } catch (error) {
    console.error('[IPFS JSON Retrieve] Failed to retrieve JSON from IPFS:', error)
    if (error instanceof SyntaxError) {
      console.error('[IPFS JSON Retrieve] JSON parsing error - invalid JSON format')
    }
    throw error
  }
}

/**
 * Retrieve file data from IPFS
 */
export async function getFileFromIPFS(cid: string): Promise<Uint8Array> {
  try {
    const response = await fetch(`https://w3s.link/ipfs/${cid}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  } catch (error) {
    console.error('Failed to retrieve file from IPFS:', error)
    
    if (error instanceof Error) {
      throw new Error(`IPFS retrieval failed: ${error.message}`)
    }
    
    throw new Error('IPFS retrieval failed: Unknown error')
  }
}

/**
 * Check if the web3.storage client is properly configured
 */
export async function checkWeb3StorageStatus(maxRetries: number = 2): Promise<{ configured: boolean; hasSpaces: boolean; currentSpace?: string; spaces?: any[]; error?: string }> {
  console.log('[Web3.Storage Status] Starting status check...')
  console.debug('[IPFS] Starting checkWeb3StorageStatus')
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Web3.Storage Status] Attempt ${attempt}/${maxRetries}: Creating client...`)
      console.debug('[IPFS] Creating Web3.Storage client for status check')
      const client = await Client.create()
      console.log('[Web3.Storage Status] Client created successfully')
      
      // Check if we have an account (user is logged in)
      console.log('[Web3.Storage Status] Checking accounts...')
      console.debug('[IPFS] Checking localStorage for web3storage-setup')
      const accounts = client.accounts()
      const accountKeys = Object.keys(accounts) as Array<keyof typeof accounts>
      const account = accountKeys.length > 0 ? accounts[accountKeys[0]] : null
      
      console.log(`[Web3.Storage Status] Account status: ${account ? 'Found' : 'Not found'}`)
      
      if (!account) {
        console.log('[Web3.Storage Status] No account found - user needs to complete email verification')
        return { configured: false, hasSpaces: false, error: 'Email verification not completed' }
      }
      
      console.log('[Web3.Storage Status] ✅ Account verified, fetching spaces...')
      
      // Get spaces
      const spaces = []
      try {
        for await (const space of client.spaces()) {
          spaces.push(space)
          console.log(`[Web3.Storage Status] Found space: ${space.name || 'Unnamed space'} (${space.did()})`)
        }
        console.log(`[Web3.Storage Status] Total spaces found: ${spaces.length}`)
      } catch (spacesError) {
        console.error('[Web3.Storage Status] Error fetching spaces:', spacesError)
        
        if (spacesError instanceof Error) {
          if (spacesError.message.includes('network') || spacesError.message.includes('fetch')) {
            if (attempt === maxRetries) {
              return { 
                configured: true, 
                hasSpaces: false, 
                spaces: [],
                error: 'Network error while fetching spaces - please check your connection'
              }
            }
            console.log(`[Web3.Storage Status] Network error fetching spaces, retrying in ${attempt}s...`)
            await new Promise(resolve => setTimeout(resolve, attempt * 1000))
            continue
          } else if (spacesError.message.includes('rate limit') || spacesError.message.includes('too many requests')) {
            if (attempt === maxRetries) {
              return { 
                configured: true, 
                hasSpaces: false, 
                spaces: [],
                error: 'Rate limited while fetching spaces - please wait and try again'
              }
            }
            console.log(`[Web3.Storage Status] Rate limited, waiting ${attempt * 2}s...`)
            await new Promise(resolve => setTimeout(resolve, attempt * 2000))
            continue
          }
        }
        
        return { 
          configured: true, 
          hasSpaces: false, 
          spaces: [],
          error: 'Could not fetch spaces - you may need to create one'
        }
      }
      
      // Get current space
      let currentSpace
      try {
        console.log('[Web3.Storage Status] Checking current space...')
        const current = client.currentSpace()
        if (current) {
          currentSpace = current.did()
          console.log(`[Web3.Storage Status] ✅ Current space: ${current.name || 'Unnamed'} (${currentSpace})`)
        } else {
          console.log('[Web3.Storage Status] No current space set')
        }
      } catch (currentSpaceError) {
        console.log('[Web3.Storage Status] Could not get current space:', currentSpaceError)
      }
      
      const result = {
        configured: true,
        hasSpaces: spaces.length > 0,
        currentSpace,
        spaces
      }
      
      console.log('[Web3.Storage Status] ✅ Status check completed successfully:', {
        configured: result.configured,
        hasSpaces: result.hasSpaces,
        spacesCount: spaces.length,
        hasCurrentSpace: !!result.currentSpace
      })
      
      console.debug('[IPFS] Status check result:', result)
      return result
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`[Web3.Storage Status] Status check error (attempt ${attempt}):`, lastError.message)
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          if (attempt === maxRetries) {
            return {
              configured: false,
              hasSpaces: false,
              error: 'Network error - please check your connection'
            }
          }
          console.log(`[Web3.Storage Status] Network error, retrying in ${attempt}s...`)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
          continue
        } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          if (attempt === maxRetries) {
            return {
              configured: false,
              hasSpaces: false,
              error: 'Rate limited - please wait a moment and try again'
            }
          }
          console.log(`[Web3.Storage Status] Rate limited, waiting ${attempt * 2}s...`)
          await new Promise(resolve => setTimeout(resolve, attempt * 2000))
          continue
        } else if (error.message.includes('unauthorized') || error.message.includes('not verified')) {
          return {
            configured: false,
            hasSpaces: false,
            error: 'Email verification required'
          }
        }
      }
      
      // For other errors, don't retry
      break
    }
  }
  
  // If we get here, all retries failed
  console.error('[Web3.Storage Status] Status check failed after all retries')
  return {
    configured: false,
    hasSpaces: false,
    error: `Status check failed: ${lastError?.message || 'Unknown error'}`
  }
}

/**
 * Retrieve JSON data from IPFS
 */
export async function retrieveJSONFromIPFS(cid: string): Promise<any> {
  const response = await retrieveFromIPFS(cid);
  return await response.json();
}

/**
 * Retrieve text data from IPFS
 */
export async function retrieveTextFromIPFS(cid: string): Promise<string> {
  const response = await retrieveFromIPFS(cid);
  return await response.text();
}

/**
 * Check if a CID is valid
 */
export function isValidCID(cid: string): boolean {
  // Basic CID validation - checks if it looks like a valid CID
  const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]{48})$/;
  return cidRegex.test(cid);
}

/**
 * Get IPFS gateway URL for a CID
 */
export function getIPFSGatewayURL(cid: string, gateway: string = 'https://ipfs.io'): string {
  return `${gateway}/ipfs/${cid}`;
}

/**
 * Setup web3.storage with email authentication
 */
export async function setupWeb3StorageAuth(email: string): Promise<void> {
  try {
    const client = await initializeWeb3Storage();
    
    // This would typically involve email verification flow
    // For now, we'll store the email for later use
    localStorage.setItem('w3up-email', email);
    
    console.log('Web3.Storage authentication setup initiated for:', email);
  } catch (error) {
    console.error('Web3.Storage auth setup failed:', error);
    throw new Error(`Failed to setup Web3.Storage authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if web3.storage is properly configured
 */
export function isWeb3StorageConfigured(): boolean {
  const token = process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN;
  return !!token && token !== 'your_web3_storage_token_here';
}