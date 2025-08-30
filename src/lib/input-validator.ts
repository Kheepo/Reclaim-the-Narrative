import { toast } from 'sonner';
import { globalErrorHandler, ErrorCategory, ErrorContext, ErrorSeverity } from './error-handler';

// Validation rule interfaces
export interface ValidationRule {
  name: string;
  validator: (value: any) => boolean | Promise<boolean>;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface FieldValidationConfig {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'url' | 'phone' | 'date' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customRules?: ValidationRule[];
  sanitize?: boolean;
  allowHtml?: boolean;
  trim?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedValue?: any;
  originalValue: any;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  sanitizedData: Record<string, any>;
  originalData: Record<string, any>;
}

// Sanitization utilities
class InputSanitizer {
  private static readonly HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  private static readonly DANGEROUS_PATTERNS = [
    // Script injection
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<applet[^>]*>.*?<\/applet>/gi,
    /<meta[^>]*>/gi,
    /<link[^>]*>/gi,
    
    // Event handlers
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /on\w+\s*=\s*[^\s>]+/gi,
    
    // JavaScript URLs
    /javascript:\s*[^\s]*/gi,
    /vbscript:\s*[^\s]*/gi,
    /data:\s*text\/html/gi,
    
    // CSS expressions
    /expression\s*\(/gi,
    /-moz-binding/gi,
    
    // SQL injection patterns
    /('|(\-\-)|(;)|(\||\|)|(\*|\*))/gi,
    /(exec(\s|\+)+(s|x)p\w+)/gi
  ];

  static sanitizeString(input: string, allowHtml: boolean = false): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    let sanitized = input;

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // HTML encoding if HTML is not allowed
    if (!allowHtml) {
      sanitized = this.escapeHtml(sanitized);
    } else {
      // If HTML is allowed, only escape dangerous characters
      sanitized = this.sanitizeHtml(sanitized);
    }

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  private static escapeHtml(input: string): string {
    return input.replace(/[&<>"'\/]/g, (char) => this.HTML_ENTITIES[char] || char);
  }

  private static sanitizeHtml(input: string): string {
    // Allow basic HTML tags but remove dangerous attributes
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'i', 'b', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const dangerousAttributes = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
    
    let sanitized = input;
    
    // Remove dangerous attributes
    for (const attr of dangerousAttributes) {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(regex, '');
    }
    
    return sanitized;
  }

  static sanitizeEmail(email: string): string {
    return email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '');
  }

  static sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9+()-\s]/g, '').trim();
  }

  static sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
      
      return urlObj.toString();
    } catch {
      return '';
    }
  }

  static sanitizeNumber(input: any): number | null {
    const num = Number(input);
    return isNaN(num) ? null : num;
  }

  static sanitizeArray(input: any): any[] {
    if (Array.isArray(input)) {
      return input.map(item => {
        if (typeof item === 'string') {
          return this.sanitizeString(item);
        }
        return item;
      });
    }
    return [];
  }

  static sanitizeObject(input: any, config: Record<string, FieldValidationConfig>): any {
    if (typeof input !== 'object' || input === null) {
      return {};
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(input)) {
      const fieldConfig = config[key];
      if (fieldConfig && fieldConfig.sanitize !== false) {
        sanitized[key] = this.sanitizeValue(value, fieldConfig);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  static sanitizeValue(value: any, config: FieldValidationConfig): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Trim strings if configured
    if (config.trim && typeof value === 'string') {
      value = value.trim();
    }

    switch (config.type) {
      case 'string':
        return this.sanitizeString(value, config.allowHtml);
      case 'email':
        return this.sanitizeEmail(value);
      case 'url':
        return this.sanitizeUrl(value);
      case 'phone':
        return this.sanitizePhone(value);
      case 'number':
        return this.sanitizeNumber(value);
      case 'array':
        return this.sanitizeArray(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      default:
        if (typeof value === 'string') {
          return this.sanitizeString(value, config.allowHtml);
        }
        return value;
    }
  }
}

// Built-in validation rules
class ValidationRules {
  static required: ValidationRule = {
    name: 'required',
    validator: (value: any) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },
    message: 'This field is required'
  };

  static email: ValidationRule = {
    name: 'email',
    validator: (value: string) => {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(value);
    },
    message: 'Please enter a valid email address'
  };

  static url: ValidationRule = {
    name: 'url',
    validator: (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Please enter a valid URL'
  };

  static phone: ValidationRule = {
    name: 'phone',
    validator: (value: string) => {
      const phoneRegex = /^[+]?[1-9]?[0-9]{7,15}$/;
      return phoneRegex.test(value.replace(/[\s()-]/g, ''));
    },
    message: 'Please enter a valid phone number'
  };

  static strongPassword: ValidationRule = {
    name: 'strongPassword',
    validator: (value: string) => {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return strongPasswordRegex.test(value);
    },
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  };

  static noSqlInjection: ValidationRule = {
    name: 'noSqlInjection',
    validator: (value: string) => {
      const sqlPatterns = [
        /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
        /(exec(\s|\+)+(s|x)p\w+)/i,
        /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i
      ];
      return !sqlPatterns.some(pattern => pattern.test(value));
    },
    message: 'Input contains potentially dangerous characters',
    severity: 'error'
  };

  static noXss: ValidationRule = {
    name: 'noXss',
    validator: (value: string) => {
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>/gi
      ];
      return !xssPatterns.some(pattern => pattern.test(value));
    },
    message: 'Input contains potentially malicious content',
    severity: 'error'
  };

  static ethereumAddress: ValidationRule = {
    name: 'ethereumAddress',
    validator: (value: string) => {
      const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
      return ethAddressRegex.test(value);
    },
    message: 'Please enter a valid Ethereum address'
  };

  static ipfsHash: ValidationRule = {
    name: 'ipfsHash',
    validator: (value: string) => {
      const ipfsHashRegex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
      return ipfsHashRegex.test(value);
    },
    message: 'Please enter a valid IPFS hash'
  };

  static createMinLength(min: number): ValidationRule {
    return {
      name: 'minLength',
      validator: (value: string) => value.length >= min,
      message: `Must be at least ${min} characters long`
    };
  }

  static createMaxLength(max: number): ValidationRule {
    return {
      name: 'maxLength',
      validator: (value: string) => value.length <= max,
      message: `Must be no more than ${max} characters long`
    };
  }

  static createMinValue(min: number): ValidationRule {
    return {
      name: 'minValue',
      validator: (value: number) => value >= min,
      message: `Must be at least ${min}`
    };
  }

  static createMaxValue(max: number): ValidationRule {
    return {
      name: 'maxValue',
      validator: (value: number) => value <= max,
      message: `Must be no more than ${max}`
    };
  }

  static createPattern(pattern: RegExp, message: string): ValidationRule {
    return {
      name: 'pattern',
      validator: (value: string) => pattern.test(value),
      message
    };
  }
}

// Main input validator class
export class InputValidator {
  private static instance: InputValidator;
  private validationCache: Map<string, ValidationResult> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator();
    }
    return InputValidator.instance;
  }

  async validateField(
    value: any,
    config: FieldValidationConfig,
    fieldName?: string
  ): Promise<ValidationResult> {
    const cacheKey = this.generateCacheKey(value, config, fieldName);
    const cached = this.validationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.originalValue < this.cacheTimeout) {
      return cached;
    }

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      originalValue: value
    };

    try {
      // Sanitize value if configured
      if (config.sanitize !== false) {
        result.sanitizedValue = InputSanitizer.sanitizeValue(value, config);
      } else {
        result.sanitizedValue = value;
      }

      // Skip validation for null/undefined values unless required
      if ((value === null || value === undefined || value === '') && !config.required) {
        this.validationCache.set(cacheKey, result);
        return result;
      }

      // Required validation
      if (config.required) {
        const requiredResult = await this.runValidationRule(ValidationRules.required, value);
        if (!requiredResult.isValid) {
          result.errors.push(...requiredResult.errors);
          result.isValid = false;
        }
      }

      // Type validation
      if (config.type && result.isValid) {
        const typeResult = await this.validateType(value, config.type);
        if (!typeResult.isValid) {
          result.errors.push(...typeResult.errors);
          result.isValid = false;
        }
      }

      // Length validation for strings
      if (typeof value === 'string' && result.isValid) {
        if (config.minLength !== undefined) {
          const minLengthResult = await this.runValidationRule(
            ValidationRules.createMinLength(config.minLength),
            value
          );
          if (!minLengthResult.isValid) {
            result.errors.push(...minLengthResult.errors);
            result.isValid = false;
          }
        }

        if (config.maxLength !== undefined) {
          const maxLengthResult = await this.runValidationRule(
            ValidationRules.createMaxLength(config.maxLength),
            value
          );
          if (!maxLengthResult.isValid) {
            result.errors.push(...maxLengthResult.errors);
            result.isValid = false;
          }
        }
      }

      // Numeric range validation
      if (typeof value === 'number' && result.isValid) {
        if (config.min !== undefined) {
          const minResult = await this.runValidationRule(
            ValidationRules.createMinValue(config.min),
            value
          );
          if (!minResult.isValid) {
            result.errors.push(...minResult.errors);
            result.isValid = false;
          }
        }

        if (config.max !== undefined) {
          const maxResult = await this.runValidationRule(
            ValidationRules.createMaxValue(config.max),
            value
          );
          if (!maxResult.isValid) {
            result.errors.push(...maxResult.errors);
            result.isValid = false;
          }
        }
      }

      // Pattern validation
      if (config.pattern && typeof value === 'string' && result.isValid) {
        const patternResult = await this.runValidationRule(
          ValidationRules.createPattern(config.pattern, 'Invalid format'),
          value
        );
        if (!patternResult.isValid) {
          result.errors.push(...patternResult.errors);
          result.isValid = false;
        }
      }

      // Security validations (always run for strings)
      if (typeof value === 'string') {
        const securityResults = await Promise.all([
          this.runValidationRule(ValidationRules.noSqlInjection, value),
          this.runValidationRule(ValidationRules.noXss, value)
        ]);

        securityResults.forEach(secResult => {
          if (!secResult.isValid) {
            result.errors.push(...secResult.errors);
            result.isValid = false;
          }
        });
      }

      // Custom rules
      if (config.customRules && result.isValid) {
        for (const rule of config.customRules) {
          const customResult = await this.runValidationRule(rule, value);
          if (!customResult.isValid) {
            if (rule.severity === 'warning') {
              result.warnings.push(...customResult.errors);
            } else {
              result.errors.push(...customResult.errors);
              result.isValid = false;
            }
          }
        }
      }

      this.validationCache.set(cacheKey, result);
      return result;

    } catch (error) {
      const context: ErrorContext = {
        component: 'InputValidator',
        action: 'validateField',
        timestamp: Date.now(),
        metadata: {
          fieldName,
          valueType: typeof value,
          config
        }
      };

      globalErrorHandler.handleError(
        error as Error,
        ErrorCategory.VALIDATION,
        context,
        ErrorSeverity.MEDIUM
      );

      result.isValid = false;
      result.errors.push('Validation error occurred');
      return result;
    }
  }

  async validateForm(
    data: Record<string, any>,
    schema: Record<string, FieldValidationConfig>
  ): Promise<FormValidationResult> {
    const result: FormValidationResult = {
      isValid: true,
      errors: {},
      warnings: {},
      sanitizedData: {},
      originalData: { ...data }
    };

    const validationPromises = Object.entries(schema).map(async ([fieldName, config]) => {
      const fieldValue = data[fieldName];
      const fieldResult = await this.validateField(fieldValue, config, fieldName);
      
      if (!fieldResult.isValid) {
        result.isValid = false;
        result.errors[fieldName] = fieldResult.errors;
      }
      
      if (fieldResult.warnings.length > 0) {
        result.warnings[fieldName] = fieldResult.warnings;
      }
      
      result.sanitizedData[fieldName] = fieldResult.sanitizedValue;
    });

    await Promise.all(validationPromises);
    return result;
  }

  private async validateType(value: any, type: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      originalValue: value
    };

    switch (type) {
      case 'email':
        return await this.runValidationRule(ValidationRules.email, value);
      case 'url':
        return await this.runValidationRule(ValidationRules.url, value);
      case 'phone':
        return await this.runValidationRule(ValidationRules.phone, value);
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          result.isValid = false;
          result.errors.push('Must be a valid number');
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          result.isValid = false;
          result.errors.push('Must be a boolean value');
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          result.isValid = false;
          result.errors.push('Must be an array');
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          result.isValid = false;
          result.errors.push('Must be an object');
        }
        break;
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          result.isValid = false;
          result.errors.push('Must be a valid date');
        }
        break;
    }

    return result;
  }

  private async runValidationRule(rule: ValidationRule, value: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      originalValue: value
    };

    try {
      const isValid = await rule.validator(value);
      if (!isValid) {
        result.isValid = false;
        result.errors.push(rule.message);
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation rule '${rule.name}' failed: ${(error as Error).message}`);
    }

    return result;
  }

  private generateCacheKey(value: any, config: FieldValidationConfig, fieldName?: string): string {
    return `${fieldName || 'field'}_${JSON.stringify(value)}_${JSON.stringify(config)}`;
  }

  clearCache(): void {
    this.validationCache.clear();
  }

  getCacheStats() {
    return {
      size: this.validationCache.size,
      timeout: this.cacheTimeout
    };
  }
}

// Global validator instance
export const globalValidator = InputValidator.getInstance();

// Utility functions
export const validateInput = async (
  value: any,
  config: FieldValidationConfig,
  fieldName?: string
): Promise<ValidationResult> => {
  return await globalValidator.validateField(value, config, fieldName);
};

export const validateFormData = async (
  data: Record<string, any>,
  schema: Record<string, FieldValidationConfig>
): Promise<FormValidationResult> => {
  return await globalValidator.validateForm(data, schema);
};

export const sanitizeInput = (value: any, config: FieldValidationConfig): any => {
  return InputSanitizer.sanitizeValue(value, config);
};

export const sanitizeFormData = (
  data: Record<string, any>,
  schema: Record<string, FieldValidationConfig>
): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const config = schema[key];
    if (config) {
      sanitized[key] = InputSanitizer.sanitizeValue(value, config);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Export validation rules for custom use
export { ValidationRules, InputSanitizer };

// Common validation schemas
export const CommonSchemas = {
  reportForm: {
    title: {
      required: true,
      type: 'string' as const,
      minLength: 5,
      maxLength: 200,
      sanitize: true,
      trim: true
    },
    description: {
      required: true,
      type: 'string' as const,
      minLength: 20,
      maxLength: 5000,
      sanitize: true,
      trim: true
    },
    location: {
      required: false,
      type: 'string' as const,
      maxLength: 500,
      sanitize: true,
      trim: true
    },
    incidentDate: {
      required: true,
      type: 'date' as const
    },
    contactEmail: {
      required: false,
      type: 'email' as const,
      sanitize: true,
      trim: true
    },
    isAnonymous: {
      required: true,
      type: 'boolean' as const
    }
  },
  
  userProfile: {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
      sanitize: true,
      trim: true
    },
    email: {
      required: true,
      type: 'email' as const,
      sanitize: true,
      trim: true
    },
    phone: {
      required: false,
      type: 'phone' as const,
      sanitize: true,
      trim: true
    },
    walletAddress: {
      required: false,
      type: 'string' as const,
      customRules: [ValidationRules.ethereumAddress],
      sanitize: true,
      trim: true
    }
  }
};