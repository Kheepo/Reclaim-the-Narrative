// Test script to identify form validation issues
const { validateFormData } = require('./src/lib/validation');

// Test different form data scenarios
function testFormValidation() {
  console.log('=== Testing Form Validation ===\n');
  
  // Test 1: Empty form data
  console.log('Test 1: Empty form data');
  const emptyForm = {
    title: '',
    description: '',
    category: '',
    encryptionPassword: ''
  };
  
  const emptyResult = validateFormData(emptyForm, {
    requireTitle: true,
    requireDescription: true,
    requireCategory: true,
    minPasswordLength: 8,
    maxTitleLength: 200,
    maxDescriptionLength: 5000
  });
  
  console.log('Empty form validation result:', emptyResult);
  console.log('\n');
  
  // Test 2: Minimal valid form data
  console.log('Test 2: Minimal valid form data');
  const validForm = {
    title: 'Test Report Title',
    description: 'This is a test description that is longer than 10 characters to meet validation requirements.',
    category: 'Physical Violence',
    encryptionPassword: 'SecurePass123!'
  };
  
  const validResult = validateFormData(validForm, {
    requireTitle: true,
    requireDescription: true,
    requireCategory: true,
    minPasswordLength: 8,
    maxTitleLength: 200,
    maxDescriptionLength: 5000
  });
  
  console.log('Valid form validation result:', validResult);
  console.log('\n');
  
  // Test 3: Form with weak password
  console.log('Test 3: Form with weak password');
  const weakPasswordForm = {
    title: 'Test Report Title',
    description: 'This is a test description that is longer than 10 characters.',
    category: 'Physical Violence',
    encryptionPassword: 'weak'
  };
  
  const weakPasswordResult = validateFormData(weakPasswordForm, {
    requireTitle: true,
    requireDescription: true,
    requireCategory: true,
    minPasswordLength: 8,
    maxTitleLength: 200,
    maxDescriptionLength: 5000
  });
  
  console.log('Weak password validation result:', weakPasswordResult);
  console.log('\n');
  
  // Test 4: Form with missing category
  console.log('Test 4: Form with missing category');
  const noCategoryForm = {
    title: 'Test Report Title',
    description: 'This is a test description that is longer than 10 characters.',
    category: '',
    encryptionPassword: 'SecurePass123!'
  };
  
  const noCategoryResult = validateFormData(noCategoryForm, {
    requireTitle: true,
    requireDescription: true,
    requireCategory: true,
    minPasswordLength: 8,
    maxTitleLength: 200,
    maxDescriptionLength: 5000
  });
  
  console.log('No category validation result:', noCategoryResult);
}

// Run the tests
testFormValidation();