/**
 * IPFS integration module using web3.storage
 * Handles uploading encrypted files to IPFS via web3.storage
 */

import { create } from '@web3-storage/w3up-client';

export interface IPFSUploadResult {
  cid: string;
  url: string;
}

export interface FileUpload {
  file: File;
  name: string;
  type: string;
}

/**
 * Initialize web3.storage client
 */
export async function initializeWeb3Storage(): Promise<any> {
  const client = await create();
  
  try {
    // Check if we have a stored delegation
    const storedDelegation = localStorage.getItem('w3up-delegation');
    if (storedDelegation) {
      try {
        const delegation = JSON.parse(storedDelegation);
        await client.addSpace(delegation);
      } catch (error) {
        console.warn('Failed to restore delegation:', error);
      }
    }
    
    // Check if client has any spaces
    const spaces = client.spaces();
    if (spaces.length === 0) {
      // Create a new space if none exists
      const space = await client.createSpace('gbv-reporting-space');
      await client.setCurrentSpace(space.did());
      
      // Store the space delegation for future use
      const delegation = await client.createDelegation(space, [
        'space/blob/add',
        'space/index/add',
        'filecoin/offer',
        'upload/add'
      ]);
      
      localStorage.setItem('w3up-delegation', JSON.stringify(delegation));
    } else {
      // Use the first available space
      const firstSpace = spaces[0];
      await client.setCurrentSpace(firstSpace.did());
    }
    
    return client;
  } catch (error) {
    console.error('Failed to initialize web3.storage client:', error);
    throw new Error(`Web3.Storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
 * Upload encrypted data as a file to IPFS
 */
export async function uploadEncryptedDataToIPFS(
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
 * Upload JSON data to IPFS
 */
export async function uploadJSONToIPFS(
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