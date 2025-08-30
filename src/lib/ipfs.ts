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
  if (web3StorageClient) {
    return web3StorageClient
  }

  try {
    // Create client with proper agent management
    web3StorageClient = await Client.create()
    
    // Check if we have any accounts configured
    const accounts = web3StorageClient.accounts()
    
    if (!Object.keys(accounts).length) {
      throw new Error(
        'No web3.storage account configured. Please run the setup process:\n' +
        '1. Create a client and login with your email\n' +
        '2. Create a space for uploads\n' +
        '3. Associate the space with your account\n' +
        'See documentation for setup instructions.'
      )
    }

    // Check if we have a current space
    const currentSpace = web3StorageClient.currentSpace()
    if (!currentSpace) {
      // Try to use the first available space
      const spaces = web3StorageClient.spaces()
      if (spaces.length > 0) {
        await web3StorageClient.setCurrentSpace(spaces[0].did())
      } else {
        throw new Error(
          'No spaces available. Please create a space first:\n' +
          'const space = await client.createSpace("my-space")\n' +
          'await space.save()\n' +
          'await account.provision(space.did())'
        )
      }
    }

    return web3StorageClient
  } catch (error) {
    console.error('Failed to initialize Web3.Storage client:', error)
    throw error
  }
}

// Setup function for initial configuration (should be called once)
export const setupWeb3Storage = async (email: string, spaceName: string = 'GBV-Reporting-Platform'): Promise<void> => {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address')
    }
    
    const client = await Client.create()
    
    // Login with email (this will send a verification email)
    console.log(`Sending verification email to ${email}...`)
    
    try {
      const account = await client.login(email as `${string}@${string}`)
      console.log('Verification email sent successfully!')
      console.log('Please check your email (including spam folder) and click the verification link.')
      
      // Additional helpful information
      console.log('Note: The verification email may take a few minutes to arrive.')
      console.log('If you don\'t receive the email, please:')
      console.log('1. Check your spam/junk folder')
      console.log('2. Ensure the email address is correct')
      console.log('3. Try again with a different email if needed')
      
    } catch (loginError) {
      console.error('Login error details:', loginError)
      
      if (loginError instanceof Error) {
        if (loginError.message.includes('rate limit')) {
          throw new Error('Too many requests. Please wait a few minutes before trying again.')
        } else if (loginError.message.includes('invalid email')) {
          throw new Error('Invalid email address format. Please check and try again.')
        } else if (loginError.message.includes('network')) {
          throw new Error('Network error. Please check your internet connection and try again.')
        }
      }
      
      throw new Error(`Failed to send verification email: ${loginError instanceof Error ? loginError.message : 'Unknown error'}. Please try again or contact support if the issue persists.`)
    }
    
    // Note: We don't create spaces here immediately because the email verification
    // needs to be completed first. The space creation will happen after email verification
    // is confirmed through the checkWeb3StorageStatus function.
    
    return
  } catch (error) {
    console.error('Failed to setup Web3.Storage:', error)
    throw error
  }
}

// Create space after email verification is completed
export const createWeb3StorageSpace = async (spaceName: string = 'GBV-Reporting-Platform'): Promise<void> => {
  try {
    const client = await Client.create()
    const accounts = client.accounts()
    
    // Check if user is logged in
    if (Object.keys(accounts).length === 0) {
      throw new Error('No authenticated account found. Please complete email verification first.')
    }
    
    // Get the first account (should be the one we just verified)
    const accountEmail = Object.keys(accounts)[0] as keyof typeof accounts
    const account = accounts[accountEmail]
    
    // Create a space for uploads
    const space = await client.createSpace(spaceName)
    
    // Save the space to the store and set as current
    await space.save()
    
    // Associate this space with the account
    await account.provision(space.did())
    
    console.log(`Space "${spaceName}" created and provisioned successfully!`)
    console.log(`Space DID: ${space.did()}`)
    
    return
  } catch (error) {
    console.error('Failed to create Web3.Storage space:', error)
    throw error
  }
}

/**
 * Upload a single file to IPFS with retry mechanism
 */
export async function uploadFileToIPFS(file: File, maxRetries: number = 3): Promise<{ cid: string; url: string }> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await initializeWeb3Storage()
      const cid = await client.uploadFile(file)
      return {
        cid: cid.toString(),
        url: `https://${cid}.ipfs.w3s.link`
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (error instanceof Error && error.message.includes('space/blob/add')) {
        throw new Error('IPFS upload failed: Missing blob/add permission. Please check your web3.storage space delegation.')
      }
      
      if (error instanceof Error && error.message.includes('account is not configured')) {
        throw new Error('IPFS upload failed: Web3.storage account not configured. Please set up your account first.')
      }
      
      console.warn(`Upload attempt ${attempt} failed:`, lastError.message)
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error(`Failed to upload file to IPFS after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Upload file to IPFS via web3.storage
 */
export async function uploadToIPFS(file: File, filename?: string): Promise<IPFSUploadResult> {
  try {
    const client = await initializeWeb3Storage();
    
    // Create a new File object with the desired filename
    const uploadFile = new File([file], filename || file.name, {
      type: file.type
    });
    
    // Upload the file
    const cid = await client.uploadFile(uploadFile);
    
    return {
      cid: cid.toString(),
      url: `https://${cid}.ipfs.w3s.link`
    };
  } catch (error) {
    console.error('IPFS upload failed:', error);
    throw new Error(`Failed to upload to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload multiple files to IPFS with retry mechanism
 */
export async function uploadFilesToIPFS(files: File[], maxRetries: number = 3): Promise<{ cid: string; url: string }[]> {
  const results: { cid: string; url: string }[] = []
  
  for (const file of files) {
    try {
      const result = await uploadFileToIPFS(file, maxRetries)
      results.push(result)
    } catch (error) {
      // If one file fails, we still want to know which files succeeded
      console.error(`Failed to upload file ${file.name}:`, error)
      throw new Error(`Failed to upload file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
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
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await initializeWeb3Storage()
      
      // Convert JSON to string and then to Uint8Array
      const jsonString = JSON.stringify(data, null, 2)
      const jsonBytes = new TextEncoder().encode(jsonString)
      
      // Create a File object
      const file = new File([jsonBytes], filename, { type: 'application/json' })
      
      // Upload the file
      const cid = await client.uploadFile(file)
      
      return {
        cid: cid.toString(),
        size: jsonBytes.length,
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
      
      console.warn(`JSON upload attempt ${attempt} failed:`, lastError.message)
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
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
 * Retrieve JSON data from IPFS
 */
export async function getJSONFromIPFS(cid: string): Promise<any> {
  try {
    // Use the web3.storage gateway for retrieval
    const response = await fetch(`https://w3s.link/ipfs/${cid}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to retrieve JSON from IPFS:', error)
    
    if (error instanceof Error) {
      throw new Error(`IPFS retrieval failed: ${error.message}`)
    }
    
    throw new Error('IPFS retrieval failed: Unknown error')
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
export async function checkWeb3StorageStatus(): Promise<{ configured: boolean; hasSpaces: boolean; currentSpace?: string; spaces?: any[]; error?: string }> {
  try {
    console.log('Checking Web3.Storage status...')
    const client = await Client.create()
    
    // Check if we have an account (user is logged in)
    const accounts = client.accounts()
    const accountKeys = Object.keys(accounts) as Array<keyof typeof accounts>
    const account = accountKeys.length > 0 ? accounts[accountKeys[0]] : null
    
    console.log('Account status:', account ? 'Found' : 'Not found')
    
    if (!account) {
      console.log('No account found - user needs to complete email verification')
      return { configured: false, hasSpaces: false, error: 'Email verification not completed' }
    }
    
    // Get spaces
    const spaces = []
    try {
      for await (const space of client.spaces()) {
        spaces.push(space)
        console.log('Found space:', space.name || 'Unnamed space')
      }
    } catch (spacesError) {
      console.error('Error fetching spaces:', spacesError)
      return { 
        configured: true, 
        hasSpaces: false, 
        spaces: [],
        error: 'Could not fetch spaces - you may need to create one'
      }
    }
    
    const currentSpace = client.currentSpace()
    
    console.log(`Web3.Storage status: configured=true, spaces=${spaces.length}`)
    
    return {
      configured: true,
      hasSpaces: spaces.length > 0,
      currentSpace: currentSpace?.did(),
      spaces
    }
  } catch (error) {
    console.error('Failed to check web3.storage status:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.message.includes('network')) {
        errorMessage = 'Network error - please check your connection'
      } else if (error.message.includes('unauthorized')) {
        errorMessage = 'Email verification required'
      } else {
        errorMessage = error.message
      }
    }
    
    return {
      configured: false,
      hasSpaces: false,
      error: errorMessage
    }
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