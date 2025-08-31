// Debug script to test form submission step by step
const { validateFormData } = require('./src/lib/validation');

// Test minimal valid form data
function testMinimalFormData() {
  console.log('=== Testing Minimal Form Data ===\n');
  
  const minimalForm = {
    title: 'Test Report Title',
    description: 'This is a test description that is long enough to pass validation requirements.',
    category: 'harassment',
    encryptionPassword: 'TestPassword123!'
  };
  
  console.log('Testing form data:', minimalForm);
  
  const result = validateFormData(minimalForm, {
    requireTitle: true,
    requireDescription: true,
    requireCategory: true,
    minPasswordLength: 8,
    maxTitleLength: 200,
    maxDescriptionLength: 5000
  });
  
  console.log('Validation result:', result);
  
  if (result.isValid) {
    console.log('✅ Form validation PASSED');
  } else {
    console.log('❌ Form validation FAILED');
    console.log('Errors:', result.errors);
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.log('⚠️ Warnings:', result.warnings);
  }
  
  return result;
}

// Test empty form data
function testEmptyFormData() {
  console.log('\n=== Testing Empty Form Data ===\n');
  
  const emptyForm = {
    title: '',
    description: '',
    category: '',
    encryptionPassword: ''
  };
  
  console.log('Testing empty form data:', emptyForm);
  
  const result = validateFormData(emptyForm, {
    requireTitle: true,
    requireDescription: true,
    requireCategory: true,
    minPasswordLength: 8
  });
  
  console.log('Validation result:', result);
  
  if (!result.isValid) {
    console.log('✅ Empty form validation correctly FAILED');
    console.log('Expected errors:', result.errors);
  } else {
    console.log('❌ Empty form validation unexpectedly PASSED');
  }
  
  return result;
}

// Run tests
if (require.main === module) {
  try {
    testMinimalFormData();
    testEmptyFormData();
    
    console.log('\n=== Test Summary ===');
    console.log('Form validation tests completed.');
    console.log('If minimal form data passes validation, the issue is likely in:');
    console.log('1. Network connectivity checks');
    console.log('2. Wallet connection validation');
    console.log('3. Web3.Storage configuration');
    console.log('4. IPFS upload process');
    console.log('5. Blockchain submission');
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

module.exports = {
  testMinimalFormData,
  testEmptyFormData
};