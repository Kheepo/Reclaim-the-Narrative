/**
 * Enhanced validation utilities for form inputs, files, and security
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  maxFiles?: number;
  requireFiles?: boolean;
}

export interface FormValidationOptions {
  minPasswordLength?: number;
  maxTitleLength?: number;
  maxDescriptionLength?: number;
  requireAllFields?: boolean;
}

// File type configurations
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
};

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_FILE_TYPES.images,
  ...ALLOWED_FILE_TYPES.documents,
  ...ALLOWED_FILE_TYPES.audio,
  ...ALLOWED_FILE_TYPES.video,
  ...ALLOWED_FILE_TYPES.archives
];

// Security patterns
const MALICIOUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /data:text\/html/gi,
  /vbscript:/gi
];

const SQL_INJECTION_PATTERNS = [
  /('|(\-\-)|(;)|(\||\|)|(\*|\*))/gi,
  /(exec(\s|\+)+(s|x)p\w+)/gi,
  /union[\s\w]*select/gi,
  /select[\s\w]*from/gi,
  /insert[\s\w]*into/gi,
  /delete[\s\w]*from/gi,
  /update[\s\w]*set/gi,
  /drop[\s\w]*table/gi
];

/**
 * Validate text input for malicious content
 */
export function validateTextSecurity(text: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for script injection
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      errors.push('Text contains potentially malicious content');
      break;
    }
  }

  // Check for SQL injection
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push('Text contains patterns that might be flagged as suspicious');
      break;
    }
  }

  // Check for excessive special characters
  const specialCharCount = (text.match(/[^\w\s.,!?;:()\-"']/g) || []).length;
  if (specialCharCount > text.length * 0.3) {
    warnings.push('Text contains many special characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate file upload
 */
export function validateFile(file: File, options: FileValidationOptions = {}): ValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ALL_ALLOWED_TYPES,
    maxFiles = 10
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}`);
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type "${file.type}" is not allowed for "${file.name}"`);
  }

  // Check file name for suspicious patterns
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.vbs', '.js'];
  const fileName = file.name.toLowerCase();
  
  for (const ext of suspiciousExtensions) {
    if (fileName.endsWith(ext)) {
      errors.push(`File "${file.name}" has a potentially dangerous extension`);
      break;
    }
  }

  // Check for double extensions
  const extensionMatches = fileName.match(/\.[a-z0-9]+/g);
  if (extensionMatches && extensionMatches.length > 1) {
    warnings.push(`File "${file.name}" has multiple extensions`);
  }

  // Check for very long filenames
  if (file.name.length > 255) {
    errors.push(`File name "${file.name}" is too long`);
  }

  // Check for empty files
  if (file.size === 0) {
    errors.push(`File "${file.name}" is empty`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(files: File[], options: FileValidationOptions = {}): ValidationResult {
  const { maxFiles = 10 } = options;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check total number of files
  if (files.length > maxFiles) {
    errors.push(`Too many files selected. Maximum is ${maxFiles}`);
  }

  // Check total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const maxTotalSize = 50 * 1024 * 1024; // 50MB total
  if (totalSize > maxTotalSize) {
    errors.push(`Total file size is too large. Maximum is ${formatFileSize(maxTotalSize)}`);
  }

  // Check for duplicate names
  const fileNames = files.map(f => f.name.toLowerCase());
  const duplicates = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate file names detected: ${duplicates.join(', ')}`);
  }

  // Validate each file
  for (const file of files) {
    const fileResult = validateFile(file, options);
    errors.push(...fileResult.errors);
    warnings.push(...fileResult.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate form data
 */
export function validateFormData(formData: any, options: FormValidationOptions = {}): ValidationResult {
  const {
    minPasswordLength = 8,
    maxTitleLength = 200,
    maxDescriptionLength = 5000,
    requireAllFields = true
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate title
  if (!formData.title?.trim()) {
    if (requireAllFields) {
      errors.push('Report title is required');
    }
  } else {
    if (formData.title.length > maxTitleLength) {
      errors.push(`Title is too long. Maximum is ${maxTitleLength} characters`);
    }
    const titleSecurity = validateTextSecurity(formData.title);
    errors.push(...titleSecurity.errors);
    warnings.push(...titleSecurity.warnings);
  }

  // Validate description
  if (!formData.description?.trim()) {
    if (requireAllFields) {
      errors.push('Report description is required');
    }
  } else {
    if (formData.description.length > maxDescriptionLength) {
      errors.push(`Description is too long. Maximum is ${maxDescriptionLength} characters`);
    }
    if (formData.description.length < 10) {
      warnings.push('Description is very short. Consider providing more details');
    }
    const descSecurity = validateTextSecurity(formData.description);
    errors.push(...descSecurity.errors);
    warnings.push(...descSecurity.warnings);
  }

  // Validate category
  if (!formData.category && requireAllFields) {
    errors.push('Please select a category');
  }

  // Validate encryption password
  if (formData.encryptionPassword) {
    if (formData.encryptionPassword.length < minPasswordLength) {
      errors.push(`Encryption password must be at least ${minPasswordLength} characters long`);
    }
    
    // Check password strength
    const hasUpperCase = /[A-Z]/.test(formData.encryptionPassword);
    const hasLowerCase = /[a-z]/.test(formData.encryptionPassword);
    const hasNumbers = /\d/.test(formData.encryptionPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.encryptionPassword);
    
    const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    
    if (strengthScore < 2) {
      warnings.push('Password is weak. Consider using uppercase, lowercase, numbers, and special characters');
    } else if (strengthScore < 3) {
      warnings.push('Password strength is moderate. Consider adding more character types');
    }
  } else if (requireAllFields) {
    errors.push('Encryption password is required to secure your report');
  }

  // Validate optional fields
  if (formData.location) {
    const locationSecurity = validateTextSecurity(formData.location);
    errors.push(...locationSecurity.errors);
    warnings.push(...locationSecurity.warnings);
  }

  if (formData.additionalInfo) {
    const additionalSecurity = validateTextSecurity(formData.additionalInfo);
    errors.push(...additionalSecurity.errors);
    warnings.push(...additionalSecurity.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate network connectivity
 */
export async function validateNetworkConnectivity(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if online
    if (!navigator.onLine) {
      errors.push('No internet connection detected');
      return { isValid: false, errors, warnings };
    }

    // Test connectivity to key services
    const testUrls = [
      'https://api.web3.storage',
      'https://cloudflare-eth.com'
    ];

    const connectivityTests = testUrls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors'
        });
        
        clearTimeout(timeoutId);
        return { url, success: true };
      } catch (error) {
        return { url, success: false, error };
      }
    });

    const results = await Promise.all(connectivityTests);
    const failedTests = results.filter(r => !r.success);
    
    if (failedTests.length === results.length) {
      warnings.push('Unable to verify connectivity to external services');
    } else if (failedTests.length > 0) {
      warnings.push(`Some services may be unavailable: ${failedTests.map(f => f.url).join(', ')}`);
    }

  } catch (error) {
    warnings.push('Unable to perform network connectivity check');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Sanitize text input
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>"'&]/g, (match) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match] || match;
    })
    .trim();
}

/**
 * Check if browser supports required features
 */
export function validateBrowserCompatibility(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required APIs
  if (!window.crypto || !window.crypto.subtle) {
    errors.push('Browser does not support Web Crypto API');
  }

  if (!window.File || !window.FileReader) {
    errors.push('Browser does not support File API');
  }

  if (!window.fetch) {
    errors.push('Browser does not support Fetch API');
  }

  // Check for recommended features
  if (!window.localStorage) {
    warnings.push('Local storage is not available');
  }

  if (!window.sessionStorage) {
    warnings.push('Session storage is not available');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}