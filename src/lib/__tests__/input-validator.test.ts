import {
  InputValidator,
  ValidationRules,
  InputSanitizer,
  validateInput,
  validateFormData,
  sanitizeInput,
  sanitizeFormData,
  CommonSchemas
} from '../input-validator';
import { globalErrorHandler } from '../error-handler';

// Mock the error handler
jest.mock('../error-handler', () => ({
  globalErrorHandler: {
    handleError: jest.fn(),
    reportError: jest.fn()
  }
}));

describe('Input Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    InputValidator.getInstance().clearCache();
  });

  describe('InputSanitizer', () => {
    describe('sanitizeString', () => {
      it('should escape HTML characters', () => {
        const input = '<script>alert("xss")</script>';
        const result = InputSanitizer.sanitizeString(input);
        expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });

      it('should remove dangerous patterns', () => {
        const input = 'javascript:alert(1)';
        const result = InputSanitizer.sanitizeString(input);
        expect(result).toBe('');
      });

      it('should handle normal strings', () => {
        const input = 'Hello World!';
        const result = InputSanitizer.sanitizeString(input);
        expect(result).toBe('Hello World!');
      });
    });

    describe('sanitizeEmail', () => {
      it('should normalize valid email', () => {
        const input = '  Test@Example.COM  ';
        const result = InputSanitizer.sanitizeEmail(input);
        expect(result).toBe('test@example.com');
      });

      it('should return empty string for invalid email', () => {
        const input = 'not-an-email';
        const result = InputSanitizer.sanitizeEmail(input);
        expect(result).toBe('');
      });
    });

    describe('sanitizeUrl', () => {
      it('should allow valid HTTPS URLs', () => {
        const input = 'https://example.com';
        const result = InputSanitizer.sanitizeUrl(input);
        expect(result).toBe('https://example.com');
      });

      it('should reject javascript URLs', () => {
        const input = 'javascript:alert(1)';
        const result = InputSanitizer.sanitizeUrl(input);
        expect(result).toBe('');
      });
    });

    describe('sanitizePhoneNumber', () => {
      it('should format phone number', () => {
        const input = '+1 (555) 123-4567';
        const result = InputSanitizer.sanitizePhoneNumber(input);
        expect(result).toBe('+15551234567');
      });
    });
  });

  describe('ValidationRules', () => {
    describe('required', () => {
      it('should pass for non-empty values', () => {
        expect(ValidationRules.required('test')).toBe(true);
        expect(ValidationRules.required(0)).toBe(true);
        expect(ValidationRules.required(false)).toBe(true);
      });

      it('should fail for empty values', () => {
        expect(ValidationRules.required('')).toBe('This field is required');
        expect(ValidationRules.required(null)).toBe('This field is required');
        expect(ValidationRules.required(undefined)).toBe('This field is required');
      });
    });

    describe('email', () => {
      it('should validate correct emails', () => {
        expect(ValidationRules.email('test@example.com')).toBe(true);
        expect(ValidationRules.email('user+tag@domain.co.uk')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(ValidationRules.email('invalid-email')).toBe('Please enter a valid email address');
        expect(ValidationRules.email('test@')).toBe('Please enter a valid email address');
      });
    });

    describe('strongPassword', () => {
      it('should validate strong passwords', () => {
        expect(ValidationRules.strongPassword('StrongPass123!')).toBe(true);
      });

      it('should reject weak passwords', () => {
        const result = ValidationRules.strongPassword('weak');
        expect(typeof result).toBe('string');
        expect(result).toContain('Password must be at least 8 characters');
      });
    });

    describe('ethereumAddress', () => {
      it('should validate correct Ethereum addresses', () => {
        expect(ValidationRules.ethereumAddress('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6')).toBe(true);
      });

      it('should reject invalid addresses', () => {
        expect(ValidationRules.ethereumAddress('invalid')).toBe('Please enter a valid Ethereum address');
      });
    });

    describe('factory methods', () => {
      it('should create minLength validator', () => {
        const validator = ValidationRules.minLength(5);
        expect(validator('test')).toBe('Must be at least 5 characters long');
        expect(validator('testing')).toBe(true);
      });

      it('should create maxLength validator', () => {
        const validator = ValidationRules.maxLength(5);
        expect(validator('testing')).toBe('Must be no more than 5 characters long');
        expect(validator('test')).toBe(true);
      });
    });
  });

  describe('InputValidator', () => {
    const validator = InputValidator.getInstance();

    describe('validateField', () => {
      it('should validate single field with built-in rules', () => {
        const config = {
          rules: ['required', 'email'],
          sanitize: true
        };
        
        const result = validator.validateField('test@example.com', config);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue).toBe('test@example.com');
      });

      it('should fail validation with errors', () => {
        const config = {
          rules: ['required', 'email'],
          sanitize: true
        };
        
        const result = validator.validateField('', config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('This field is required');
      });

      it('should use custom validation rules', () => {
        const config = {
          rules: [(value: any) => value === 'custom' || 'Must be "custom"'],
          sanitize: false
        };
        
        const result = validator.validateField('wrong', config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Must be "custom"');
      });
    });

    describe('validateForm', () => {
      it('should validate entire form', () => {
        const schema = {
          email: {
            rules: ['required', 'email'],
            sanitize: true
          },
          password: {
            rules: ['required', ValidationRules.minLength(8)],
            sanitize: false
          }
        };

        const data = {
          email: 'test@example.com',
          password: 'password123'
        };

        const result = validator.validateForm(data, schema);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData.email).toBe('test@example.com');
      });

      it('should handle form validation errors', () => {
        const schema = {
          email: {
            rules: ['required', 'email'],
            sanitize: true
          }
        };

        const data = {
          email: 'invalid-email'
        };

        const result = validator.validateForm(data, schema);
        expect(result.isValid).toBe(false);
        expect(result.fieldErrors.email).toContain('Please enter a valid email address');
      });
    });
  });

  describe('Utility Functions', () => {
    it('should validate single input', () => {
      const result = validateInput('test@example.com', ['required', 'email']);
      expect(result.isValid).toBe(true);
    });

    it('should validate form data', () => {
      const result = validateFormData(
        { email: 'test@example.com' },
        { email: { rules: ['required', 'email'], sanitize: true } }
      );
      expect(result.isValid).toBe(true);
    });

    it('should sanitize input', () => {
      const result = sanitizeInput('<script>alert(1)</script>');
      expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should sanitize form data', () => {
      const result = sanitizeFormData({
        name: '<script>test</script>',
        email: '  TEST@EXAMPLE.COM  '
      });
      expect(result.name).toBe('&lt;script&gt;test&lt;/script&gt;');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('Common Schemas', () => {
    it('should validate report form schema', () => {
      const validData = {
        title: 'Test Report',
        description: 'This is a test report description.',
        location: 'Test Location',
        incidentDate: '2024-01-15',
        reporterName: 'John Doe',
        reporterContact: 'john@example.com'
      };

      const result = validateFormData(validData, CommonSchemas.reportForm);
      expect(result.isValid).toBe(true);
    });

    it('should validate user profile schema', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
      };

      const result = validateFormData(validData, CommonSchemas.userProfile);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      const validator = InputValidator.getInstance();
      
      // Mock a validation rule that throws an error
      const errorRule = () => {
        throw new Error('Validation rule error');
      };

      const config = {
        rules: [errorRule],
        sanitize: false
      };

      const result = validator.validateField('test', config);
      expect(result.isValid).toBe(false);
      expect(globalErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Caching', () => {
    it('should cache validation results', () => {
      const validator = InputValidator.getInstance();
      const config = {
        rules: ['required', 'email'],
        sanitize: true
      };

      // First validation
      const result1 = validator.validateField('test@example.com', config);
      
      // Second validation (should use cache)
      const result2 = validator.validateField('test@example.com', config);
      
      expect(result1).toEqual(result2);
    });

    it('should clear cache', () => {
      const validator = InputValidator.getInstance();
      validator.clearCache();
      
      // Should not throw any errors
      expect(() => validator.clearCache()).not.toThrow();
    });
  });
});