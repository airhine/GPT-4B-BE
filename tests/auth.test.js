/**
 * 기본 인증 API 테스트 스크립트
 * 
 * 사용법:
 *   node tests/auth.test.js
 * 
 * 또는 특정 테스트만 실행:
 *   node tests/auth.test.js register
 *   node tests/auth.test.js login
 *   node tests/auth.test.js me
 */

import axios from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'password123';
const TEST_NAME = 'Test User';

let authToken = null;

// 색상 출력을 위한 유틸리티
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logTest(name) {
  log(`\n🧪 Testing: ${name}`, 'yellow');
}

// 테스트 헬퍼 함수
async function makeRequest(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      data: error.response?.data || { message: error.message },
      status: error.response?.status || 500,
    };
  }
}

// 테스트 함수들
async function testHealthCheck() {
  logTest('Health Check');
  const result = await makeRequest('GET', '/health');
  
  if (result.success && result.data.status === 'ok') {
    logSuccess('Health check passed');
    return true;
  } else {
    logError('Health check failed');
    console.log('Response:', result.data);
    return false;
  }
}

async function testRegister() {
  logTest('User Registration');
  const result = await makeRequest('POST', '/api/auth/register', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME,
  });

  if (result.success && result.data.success && result.data.token) {
    authToken = result.data.token;
    logSuccess('Registration successful');
    logInfo(`Token: ${authToken.substring(0, 20)}...`);
    logInfo(`User ID: ${result.data.user.id}`);
    return true;
  } else {
    logError('Registration failed');
    console.log('Response:', result.data);
    return false;
  }
}

async function testLogin() {
  logTest('User Login');
  const result = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (result.success && result.data.success && result.data.token) {
    authToken = result.data.token;
    logSuccess('Login successful');
    logInfo(`Token: ${authToken.substring(0, 20)}...`);
    return true;
  } else {
    logError('Login failed');
    console.log('Response:', result.data);
    return false;
  }
}

async function testGetMe() {
  logTest('Get Current User');
  
  if (!authToken) {
    logError('No auth token available. Please run register or login test first.');
    return false;
  }

  const result = await makeRequest('GET', '/api/auth/me', null, authToken);

  if (result.success && result.data.success && result.data.user) {
    logSuccess('Get current user successful');
    logInfo(`User: ${result.data.user.name} (${result.data.user.email})`);
    return true;
  } else {
    logError('Get current user failed');
    console.log('Response:', result.data);
    return false;
  }
}

async function testInvalidLogin() {
  logTest('Invalid Login (should fail)');
  const result = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: 'wrongpassword',
  });

  if (!result.success && result.status === 401) {
    logSuccess('Invalid login correctly rejected');
    return true;
  } else {
    logError('Invalid login test failed - should have been rejected');
    console.log('Response:', result.data);
    return false;
  }
}

async function testInvalidToken() {
  logTest('Invalid Token (should fail)');
  const result = await makeRequest('GET', '/api/auth/me', null, 'invalid_token');

  if (!result.success && result.status === 401) {
    logSuccess('Invalid token correctly rejected');
    return true;
  } else {
    logError('Invalid token test failed - should have been rejected');
    console.log('Response:', result.data);
    return false;
  }
}

// 메인 실행 함수
async function runTests() {
  const testName = process.argv[2];
  const tests = {
    health: testHealthCheck,
    register: testRegister,
    login: testLogin,
    me: testGetMe,
    invalidLogin: testInvalidLogin,
    invalidToken: testInvalidToken,
  };

  log('\n🚀 Starting API Tests\n', 'blue');
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo(`Test Email: ${TEST_EMAIL}\n`);

  if (testName && tests[testName]) {
    // 특정 테스트만 실행
    await tests[testName]();
  } else {
    // 모든 테스트 실행
    const results = {
      health: await testHealthCheck(),
      register: await testRegister(),
      login: await testLogin(),
      me: await testGetMe(),
      invalidLogin: await testInvalidLogin(),
      invalidToken: await testInvalidToken(),
    };

    // 결과 요약
    log('\n📊 Test Results Summary', 'yellow');
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([name, result]) => {
      if (result) {
        logSuccess(`${name}: PASSED`);
      } else {
        logError(`${name}: FAILED`);
      }
    });

    log(`\n✅ Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
    
    if (passed < total) {
      process.exit(1);
    }
  }
}

// 스크립트 실행
runTests().catch(error => {
  logError(`Test execution failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
