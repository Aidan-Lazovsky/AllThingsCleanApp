#!/usr/bin/env node
// test-api.js - Test script for AllThingsClean Backend API

const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('🧪 Testing AllThingsClean API');
console.log('📡 Base URL:', BASE_URL);
console.log('================================\n');

const tests = [];
let passed = 0;
let failed = 0;

// Helper function to make requests
async function testEndpoint(name, endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    console.log(`Testing: ${name}`);
    console.log(`GET ${url}`);
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ PASS - Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...\n');
      passed++;
      return { success: true, data };
    } else {
      console.log(`❌ FAIL - Status: ${response.status}`);
      console.log(`Error:`, data);
      console.log('');
      failed++;
      return { success: false, data };
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    console.log('');
    failed++;
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('🔍 Starting API Tests...\n');

  // Test 1: Health Check
  await testEndpoint(
    '1. Root Endpoint',
    '/'
  );

  // Test 2: Health Endpoint
  await testEndpoint(
    '2. Health Check',
    '/api/health'
  );

  // Test 3: Shopify Connection Test
  await testEndpoint(
    '3. Shopify Connection Test',
    '/api/shopify/test'
  );

  // Test 4: Get Products
  await testEndpoint(
    '4. Get All Products',
    '/api/products'
  );

  // Test 5: Get Categories
  await testEndpoint(
    '5. Get Categories',
    '/api/categories'
  );

  // Test 6: Get Brands
  await testEndpoint(
    '6. Get Brands',
    '/api/brands'
  );

  // Test 7: Get Featured Products
  await testEndpoint(
    '7. Get Featured Products',
    '/api/products/featured/list'
  );

  // Test 8: Search Products
  await testEndpoint(
    '8. Search Products (query: vacuum)',
    '/api/products?search=vacuum'
  );

  // Test 9: Filter by Category
  await testEndpoint(
    '9. Filter Products by Category',
    '/api/products?category=Vacuums'
  );

  // Test 10: Get Customers
  await testEndpoint(
    '10. Get Customers',
    '/api/customers'
  );

  // Test 11: Get Orders
  await testEndpoint(
    '11. Get Orders',
    '/api/orders'
  );

  // Test 12: Get Statistics
  await testEndpoint(
    '12. Get Dashboard Statistics',
    '/api/stats'
  );

  // Test 13: Get Shopify Shop Info
  await testEndpoint(
    '13. Get Shopify Shop Info',
    '/api/shopify/shop'
  );

  // Test 14: Get Webhooks
  await testEndpoint(
    '14. Get Registered Webhooks',
    '/api/shopify/webhooks'
  );

  // Summary
  console.log('================================');
  console.log('📊 TEST SUMMARY');
  console.log('================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('================================\n');

  if (failed === 0) {
    console.log('🎉 All tests passed! Your API is working correctly!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});
