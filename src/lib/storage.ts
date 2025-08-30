/**
 * Local storage module for managing offline drafts and encrypted data
 * Provides secure client-side storage with encryption
 */

import { EncryptedData, encryptWithPassword, decryptWithPassword } from './encryption';

export interface DraftReport {
  id: string;
  title: string;
  description: string;
  category: string;
  files: DraftFile[];
  createdAt: string;
  updatedAt: string;
  encrypted: boolean;
}

export interface DraftFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded file data
  encrypted: boolean;
}

export interface StorageConfig {
  encryptDrafts: boolean;
  maxDraftSize: number; // in bytes
  maxDrafts: number;
}

const STORAGE_KEYS = {
  DRAFTS: 'gbv_drafts',
  CONFIG: 'gbv_storage_config',
  ENCRYPTION_KEY: 'gbv_encryption_key',
  USER_PREFERENCES: 'gbv_user_preferences'
};

const DEFAULT_CONFIG: StorageConfig = {
  encryptDrafts: true,
  maxDraftSize: 50 * 1024 * 1024, // 50MB
  maxDrafts: 10
};

/**
 * Initialize storage with default configuration
 */
export function initializeStorage(): void {
  if (typeof window === 'undefined') return;
  
  const existingConfig = getStorageConfig();
  if (!existingConfig) {
    setStorageConfig(DEFAULT_CONFIG);
  }
}

/**
 * Get storage configuration
 */
export function getStorageConfig(): StorageConfig | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const config = localStorage.getItem(STORAGE_KEYS.CONFIG);
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Failed to get storage config:', error);
    return null;
  }
}

/**
 * Set storage configuration
 */
export function setStorageConfig(config: StorageConfig): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to set storage config:', error);
  }
}

/**
 * Generate unique ID for drafts
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save draft report
 */
export async function saveDraft(
  draft: Omit<DraftReport, 'id' | 'createdAt' | 'updatedAt' | 'encrypted'>,
  password?: string
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Storage not available');
  }
  
  const config = getStorageConfig() || DEFAULT_CONFIG;
  const drafts = await getAllDrafts(password);
  
  // Check draft limits
  if (drafts.length >= config.maxDrafts) {
    throw new Error(`Maximum number of drafts (${config.maxDrafts}) reached`);
  }
  
  const now = new Date().toISOString();
  const draftId = generateId();
  
  const newDraft: DraftReport = {
    ...draft,
    id: draftId,
    createdAt: now,
    updatedAt: now,
    encrypted: config.encryptDrafts && !!password
  };
  
  // Check size limit
  const draftSize = JSON.stringify(newDraft).length;
  if (draftSize > config.maxDraftSize) {
    throw new Error(`Draft size (${draftSize} bytes) exceeds maximum (${config.maxDraftSize} bytes)`);
  }
  
  try {
    let dataToStore: string;
    
    if (config.encryptDrafts && password) {
      const encrypted = await encryptWithPassword(JSON.stringify(newDraft), password);
      dataToStore = JSON.stringify(encrypted);
    } else {
      dataToStore = JSON.stringify(newDraft);
    }
    
    const allDrafts = [...drafts, newDraft];
    const storageData = {
      encrypted: config.encryptDrafts && !!password,
      drafts: config.encryptDrafts && password ? [dataToStore] : allDrafts
    };
    
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(storageData));
    return draftId;
  } catch (error) {
    console.error('Failed to save draft:', error);
    throw new Error(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update existing draft
 */
export async function updateDraft(
  draftId: string,
  updates: Partial<Omit<DraftReport, 'id' | 'createdAt' | 'encrypted'>>,
  password?: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Storage not available');
  }
  
  const drafts = await getAllDrafts(password);
  const draftIndex = drafts.findIndex(d => d.id === draftId);
  
  if (draftIndex === -1) {
    throw new Error('Draft not found');
  }
  
  const updatedDraft: DraftReport = {
    ...drafts[draftIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  drafts[draftIndex] = updatedDraft;
  
  try {
    const config = getStorageConfig() || DEFAULT_CONFIG;
    let dataToStore: any;
    
    if (config.encryptDrafts && password) {
      const encryptedDrafts = await Promise.all(
        drafts.map(draft => encryptWithPassword(JSON.stringify(draft), password))
      );
      dataToStore = {
        encrypted: true,
        drafts: encryptedDrafts.map(encrypted => JSON.stringify(encrypted))
      };
    } else {
      dataToStore = {
        encrypted: false,
        drafts: drafts
      };
    }
    
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Failed to update draft:', error);
    throw new Error(`Failed to update draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all draft reports
 */
export async function getAllDrafts(password?: string): Promise<DraftReport[]> {
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    if (!stored) {
      return [];
    }
    
    const storageData = JSON.parse(stored);
    
    if (storageData.encrypted && password) {
      const decryptedDrafts: DraftReport[] = [];
      
      for (const encryptedDraftStr of storageData.drafts) {
        try {
          const encryptedData: EncryptedData = JSON.parse(encryptedDraftStr);
          const decryptedStr = await decryptWithPassword(encryptedData, password);
          const draft: DraftReport = JSON.parse(decryptedStr);
          decryptedDrafts.push(draft);
        } catch (error) {
          console.warn('Failed to decrypt draft:', error);
        }
      }
      
      return decryptedDrafts;
    } else if (!storageData.encrypted) {
      return storageData.drafts || [];
    } else {
      // Encrypted but no password provided
      return [];
    }
  } catch (error) {
    console.error('Failed to get drafts:', error);
    return [];
  }
}

/**
 * Get specific draft by ID
 */
export async function getDraft(draftId: string, password?: string): Promise<DraftReport | null> {
  const drafts = await getAllDrafts(password);
  return drafts.find(d => d.id === draftId) || null;
}

/**
 * Delete draft by ID
 */
export async function deleteDraft(draftId: string, password?: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Storage not available');
  }
  
  const drafts = await getAllDrafts(password);
  const filteredDrafts = drafts.filter(d => d.id !== draftId);
  
  try {
    const config = getStorageConfig() || DEFAULT_CONFIG;
    let dataToStore: any;
    
    if (config.encryptDrafts && password) {
      const encryptedDrafts = await Promise.all(
        filteredDrafts.map(draft => encryptWithPassword(JSON.stringify(draft), password))
      );
      dataToStore = {
        encrypted: true,
        drafts: encryptedDrafts.map(encrypted => JSON.stringify(encrypted))
      };
    } else {
      dataToStore = {
        encrypted: false,
        drafts: filteredDrafts
      };
    }
    
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Failed to delete draft:', error);
    throw new Error(`Failed to delete draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear all drafts
 */
export function clearAllDrafts(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFTS);
  } catch (error) {
    console.error('Failed to clear drafts:', error);
  }
}

/**
 * Convert file to base64 for storage
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 back to file
 */
export function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], filename, { type: mimeType });
}

/**
 * Get storage usage statistics
 */
export function getStorageStats(): { used: number; available: number; percentage: number } {
  if (typeof window === 'undefined') {
    return { used: 0, available: 0, percentage: 0 };
  }
  
  try {
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Estimate available space (browsers typically allow 5-10MB)
    const estimated = 5 * 1024 * 1024; // 5MB estimate
    const available = Math.max(0, estimated - used);
    const percentage = (used / estimated) * 100;
    
    return { used, available, percentage };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return { used: 0, available: 0, percentage: 0 };
  }
}

/**
 * Check if storage is available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}