/**
 * Security utilities for rate limiting, CSRF protection, and other security measures
 */

import { createEnhancedError, ErrorCategory } from './error-handling';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

export interface CSRFConfig {
  tokenLength: number;
  cookieName: string;
  headerName: string;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Frame-Options'?: string;
  'X-Content-Type-Options'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
}

export interface InputSanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  stripScripts?: boolean;
  trim?: boolean;
}

// Rate limiting storage
interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const csrfTokens = new Map<string, { token: string; expires: number }>();

/**
 * Rate Limiter Class
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (id) => id,
      ...config
    };

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const key = this.config.keyGenerator!(identifier);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry) {
      // First request
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      });
      return true;
    }

    // Check if window has expired
    if (now >= entry.resetTime) {
      // Reset window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      });
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Record a request (for tracking purposes)
   */
  recordRequest(identifier: string, success: boolean): void {
    if (
      (success && this.config.skipSuccessfulRequests) ||
      (!success && this.config.skipFailedRequests)
    ) {
      return;
    }

    // The counting is already done in isAllowed
    // This method is for additional tracking if needed
  }

  /**
   * Get remaining requests for identifier
   */
  getRemainingRequests(identifier: string): number {
    const key = this.config.keyGenerator!(identifier);
    const entry = rateLimitStore.get(key);
    
    if (!entry) {
      return this.config.maxRequests;
    }

    const now = Date.now();
    if (now >= entry.resetTime) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Get time until reset
   */
  getTimeUntilReset(identifier: string): number {
    const key = this.config.keyGenerator!(identifier);
    const entry = rateLimitStore.get(key);
    
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    return Math.max(0, entry.resetTime - now);
  }

  /**
   * Clear rate limit for identifier
   */
  clear(identifier: string): void {
    const key = this.config.keyGenerator!(identifier);
    rateLimitStore.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Destroy rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    rateLimitStore.clear();
  }
}

/**
 * CSRF Protection
 */
export class CSRFProtection {
  private config: CSRFConfig;

  constructor(config: Partial<CSRFConfig> = {}) {
    this.config = {
      tokenLength: 32,
      cookieName: 'csrf-token',
      headerName: 'X-CSRF-Token',
      secure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false,
      sameSite: 'strict',
      ...config
    };
  }

  /**
   * Generate CSRF token
   */
  generateToken(sessionId: string): string {
    const token = this.generateRandomToken();
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    csrfTokens.set(sessionId, { token, expires });
    
    // Store in cookie if in browser environment
    if (typeof document !== 'undefined') {
      this.setCookie(token);
    }
    
    return token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(sessionId: string, providedToken: string): boolean {
    const stored = csrfTokens.get(sessionId);
    
    if (!stored) {
      return false;
    }
    
    // Check expiration
    if (Date.now() > stored.expires) {
      csrfTokens.delete(sessionId);
      return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(stored.token, providedToken);
  }

  /**
   * Get token from cookie
   */
  getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') {
      return null;
    }
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === this.config.cookieName) {
        return decodeURIComponent(value);
      }
    }
    
    return null;
  }

  /**
   * Clear token
   */
  clearToken(sessionId: string): void {
    csrfTokens.delete(sessionId);
    
    if (typeof document !== 'undefined') {
      document.cookie = `${this.config.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }

  private generateRandomToken(): string {
    const array = new Uint8Array(this.config.tokenLength);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private setCookie(token: string): void {
    const secure = this.config.secure ? '; Secure' : '';
    const sameSite = `; SameSite=${this.config.sameSite}`;
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
    
    document.cookie = `${this.config.cookieName}=${encodeURIComponent(token)}; expires=${expires}; path=/${secure}${sameSite}`;
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}

/**
 * Input Sanitization
 */
export class InputSanitizer {
  private static readonly SCRIPT_PATTERNS = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
    /<object[^>]*>[\s\S]*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi
  ];

  private static readonly SQL_PATTERNS = [
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
   * Sanitize text input
   */
  static sanitizeText(
    input: string,
    options: InputSanitizationOptions = {}
  ): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Apply length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Strip scripts if not allowing HTML or if explicitly requested
    if (!options.allowHtml || options.stripScripts) {
      sanitized = this.removeScripts(sanitized);
    }

    // If not allowing HTML, escape all HTML
    if (!options.allowHtml) {
      sanitized = this.escapeHtml(sanitized);
    } else if (options.allowedTags || options.allowedAttributes) {
      sanitized = this.sanitizeHtml(sanitized, options);
    }

    // Only trim if explicitly requested in options, otherwise preserve spaces
    return options.trim !== false ? sanitized.trim() : sanitized;
  }

  /**
   * Check for malicious patterns
   */
  static detectMaliciousContent(input: string): string[] {
    const threats: string[] = [];

    // Check for script injection
    for (const pattern of this.SCRIPT_PATTERNS) {
      if (pattern.test(input)) {
        threats.push('Script injection detected');
        break;
      }
    }

    // Check for SQL injection
    for (const pattern of this.SQL_PATTERNS) {
      if (pattern.test(input)) {
        threats.push('SQL injection pattern detected');
        break;
      }
    }

    // Check for excessive special characters
    const specialCharCount = (input.match(/[<>"'&\\]/g) || []).length;
    const specialCharRatio = specialCharCount / input.length;
    if (specialCharRatio > 0.1 && specialCharCount > 10) {
      threats.push('Excessive special characters detected');
    }

    // Check for encoded attacks
    const decodedInput = this.decodeEntities(input);
    if (decodedInput !== input) {
      const decodedThreats = this.detectMaliciousContent(decodedInput);
      if (decodedThreats.length > 0) {
        threats.push('Encoded malicious content detected');
      }
    }

    return threats;
  }

  /**
   * Validate file upload security
   */
  static validateFileUpload(file: File): string[] {
    const issues: string[] = [];

    // Check file extension
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
      '.jar', '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl'
    ];

    const fileName = file.name.toLowerCase();
    for (const ext of dangerousExtensions) {
      if (fileName.endsWith(ext)) {
        issues.push(`Dangerous file extension: ${ext}`);
        break;
      }
    }

    // Check for double extensions
    const extensionMatches = fileName.match(/\.[a-z0-9]+/g);
    if (extensionMatches && extensionMatches.length > 1) {
      issues.push('Multiple file extensions detected');
    }

    // Check MIME type vs extension mismatch
    const expectedMimeTypes: Record<string, string[]> = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.pdf': ['application/pdf'],
      '.txt': ['text/plain'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };

    for (const [ext, mimeTypes] of Object.entries(expectedMimeTypes)) {
      if (fileName.endsWith(ext) && !mimeTypes.includes(file.type)) {
        issues.push(`MIME type mismatch: expected ${mimeTypes.join(' or ')}, got ${file.type}`);
        break;
      }
    }

    return issues;
  }

  private static removeScripts(input: string): string {
    let sanitized = input;
    for (const pattern of this.SCRIPT_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }
    return sanitized;
  }

  private static escapeHtml(input: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return input.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match]);
  }

  private static sanitizeHtml(
    input: string,
    options: InputSanitizationOptions
  ): string {
    // Basic HTML sanitization - in a real app, use a library like DOMPurify
    let sanitized = input;

    if (options.allowedTags) {
      // Remove all tags except allowed ones
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      sanitized = sanitized.replace(tagPattern, (match, tagName) => {
        if (options.allowedTags!.includes(tagName.toLowerCase())) {
          return match;
        }
        return '';
      });
    }

    return sanitized;
  }

  private static decodeEntities(input: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = input;
    return textarea.value;
  }
}

/**
 * Security Headers Manager
 */
export class SecurityHeadersManager {
  private static readonly DEFAULT_HEADERS: SecurityHeaders = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };

  /**
   * Get security headers for requests
   */
  static getSecurityHeaders(customHeaders: Partial<SecurityHeaders> = {}): SecurityHeaders {
    return {
      ...this.DEFAULT_HEADERS,
      ...customHeaders
    };
  }

  /**
   * Apply security headers to fetch requests
   */
  static applyToFetch(headers: HeadersInit = {}): HeadersInit {
    const securityHeaders = this.getSecurityHeaders();
    return {
      ...headers,
      ...securityHeaders
    };
  }
}

/**
 * Browser Security Checker
 */
export class BrowserSecurityChecker {
  /**
   * Check if browser supports required security features
   */
  static checkSecurityFeatures(): { supported: boolean; missing: string[] } {
    const missing: string[] = [];

    // Check for Crypto API
    if (!window.crypto || !window.crypto.subtle) {
      missing.push('Web Crypto API');
    }

    // Check for secure context (HTTPS)
    if (!window.isSecureContext) {
      missing.push('Secure Context (HTTPS)');
    }

    // Check for Content Security Policy support
    if (!('securitypolicy' in document)) {
      // This is a basic check - CSP support is complex
    }

    // Check for SameSite cookie support
    const testCookie = 'test=1; SameSite=Strict';
    document.cookie = testCookie;
    if (!document.cookie.includes('test=1')) {
      missing.push('SameSite Cookie Support');
    } else {
      // Clean up test cookie
      document.cookie = 'test=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }

    return {
      supported: missing.length === 0,
      missing
    };
  }

  /**
   * Check for common security vulnerabilities
   */
  static checkVulnerabilities(): string[] {
    const vulnerabilities: string[] = [];

    // Check if running in iframe (potential clickjacking)
    if (window !== window.top) {
      vulnerabilities.push('Running in iframe - potential clickjacking risk');
    }

    // Check for mixed content
    if (window.location.protocol === 'https:' && document.querySelector('script[src^="http:"]')) {
      vulnerabilities.push('Mixed content detected - HTTP resources on HTTPS page');
    }

    // Check for inline scripts (basic check)
    if (document.querySelector('script:not([src])')) {
      vulnerabilities.push('Inline scripts detected - potential XSS risk');
    }

    return vulnerabilities;
  }
}

/**
 * Create rate limiter instances for different operations
 */
export const createSubmissionRateLimiter = () => new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 3, // 3 submissions per 5 minutes
  keyGenerator: (identifier) => `submission:${identifier}`
});

export const createValidationRateLimiter = () => new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 30, // 30 validations per minute
  keyGenerator: (identifier) => `validation:${identifier}`
});

export const createFileUploadRateLimiter = () => new RateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 10, // 10 file uploads per 10 minutes
  keyGenerator: (identifier) => `upload:${identifier}`
});

/**
 * Global security initialization
 */
export function initializeSecurity(): {
  csrf: CSRFProtection;
  submissionLimiter: RateLimiter;
  validationLimiter: RateLimiter;
  uploadLimiter: RateLimiter;
} {
  // Check browser security features
  const securityCheck = BrowserSecurityChecker.checkSecurityFeatures();
  if (!securityCheck.supported) {
    console.warn('Missing security features:', securityCheck.missing);
  }

  // Check for vulnerabilities
  const vulnerabilities = BrowserSecurityChecker.checkVulnerabilities();
  if (vulnerabilities.length > 0) {
    console.warn('Security vulnerabilities detected:', vulnerabilities);
  }

  return {
    csrf: new CSRFProtection(),
    submissionLimiter: createSubmissionRateLimiter(),
    validationLimiter: createValidationRateLimiter(),
    uploadLimiter: createFileUploadRateLimiter()
  };
}