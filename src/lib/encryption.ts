/**
 * Encryption module using Web Crypto API for AES-256-GCM encryption
 * Provides client-side encryption/decryption for sensitive data
 */

export interface EncryptedData {
  encryptedData: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt for key derivation
}

export interface EncryptionKey {
  key: CryptoKey;
  exportedKey: string; // Base64 encoded key for storage
}

/**
 * Generate a random encryption key using Web Crypto API
 */
export async function generateEncryptionKey(): Promise<EncryptionKey> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const exportedKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));

  return {
    key,
    exportedKey: exportedKeyBase64
  };
}

/**
 * Import an encryption key from base64 string
 */
export async function importEncryptionKey(exportedKey: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(exportedKey), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive encryption key from password using PBKDF2
 */
export async function deriveKeyFromPassword(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Generate salt if not provided
  let keySalt: Uint8Array;
  if (salt) {
    keySalt = salt;
  } else {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    keySalt = new Uint8Array(randomBytes.buffer.slice(randomBytes.byteOffset, randomBytes.byteOffset + randomBytes.byteLength));
  }
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: keySalt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
  
  return { key, salt: keySalt };
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptData(data: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBuffer
  );
  
  // Convert to base64
  const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return {
    encryptedData,
    iv: ivBase64,
    salt: '' // Will be set by caller if using password-derived key
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decryptData(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
  // Convert from base64
  const encryptedBuffer = Uint8Array.from(atob(encryptedData.encryptedData), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
  
  // Decrypt data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encryptedBuffer
  );
  
  // Convert back to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt data with password
 */
export async function encryptWithPassword(data: string, password: string): Promise<EncryptedData> {
  const { key, salt } = await deriveKeyFromPassword(password);
  const encrypted = await encryptData(data, key);
  
  return {
    ...encrypted,
    salt: btoa(String.fromCharCode(...salt))
  };
}

/**
 * Decrypt data with password
 */
export async function decryptWithPassword(encryptedData: EncryptedData, password: string): Promise<string> {
  const salt = Uint8Array.from(atob(encryptedData.salt), c => c.charCodeAt(0));
  const { key } = await deriveKeyFromPassword(password, salt);
  
  return await decryptData(encryptedData, key);
}

/**
 * Generate SHA-256 hash of data
 */
export async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Convert to hex string
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate SHA-256 hash of file
 */
export async function generateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Convert to hex string
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}