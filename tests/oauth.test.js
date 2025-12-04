/**
 * OAuth 인증 API 테스트 스크립트
 * 
 * 사용법:
 *   node tests/oauth.test.js google
 *   node tests/oauth.test.js apple
 * 
 * 주의: 실제 OAuth 토큰이 필요합니다.
 * 이 스크립트는 실제 토큰을 사용하여 테스트합니다.
 */

import axios from 'axios';
import readline from 'readline';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 사용자 입력을 받는 함수
function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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

// Google OAuth 테스트
async function testGoogleOAuth() {
  logTest('Google OAuth Login');
  
  logWarning('실제 Google ID Token이 필요합니다.');
  logInfo('프론트엔드에서 Google 로그인 후 idToken을 받아서 입력하세요.\n');

  const idToken = await getUserInput('Google ID Token을 입력하세요: ');

  if (!idToken || idToken.trim() === '') {
    logError('ID Token이 제공되지 않았습니다.');
    return false;
  }

  const result = await makeRequest('POST', '/api/auth/google', {
    idToken: idToken.trim(),
  });

  if (result.success && result.data.success && result.data.token) {
    logSuccess('Google OAuth login successful');
    logInfo(`Token: ${result.data.token.substring(0, 20)}...`);
    logInfo(`User: ${result.data.user.name} (${result.data.user.email})`);
    logInfo(`OAuth Provider: ${result.data.user.oauthProvider}`);
    
    // 받은 토큰으로 /api/auth/me 테스트
    logTest('Testing authenticated endpoint with Google OAuth token');
    const meResult = await makeRequest('GET', '/api/auth/me', null, result.data.token);
    
    if (meResult.success && meResult.data.success) {
      logSuccess('Authenticated endpoint access successful');
      return true;
    } else {
      logError('Authenticated endpoint access failed');
      return false;
    }
  } else {
    logError('Google OAuth login failed');
    console.log('Response:', result.data);
    return false;
  }
}

// Apple OAuth 테스트
async function testAppleOAuth() {
  logTest('Apple OAuth Login');
  
  logWarning('실제 Apple identityToken이 필요합니다.');
  logInfo('프론트엔드에서 Apple Sign In 후 identityToken을 받아서 입력하세요.\n');

  const identityToken = await getUserInput('Apple identityToken을 입력하세요: ');
  const email = await getUserInput('이메일 (선택사항, 첫 로그인 시 필요): ');
  const givenName = await getUserInput('이름 (선택사항): ');
  const familyName = await getUserInput('성 (선택사항): ');

  if (!identityToken || identityToken.trim() === '') {
    logError('identityToken이 제공되지 않았습니다.');
    return false;
  }

  const requestData = {
    identityToken: identityToken.trim(),
  };

  if (email && email.trim() !== '') {
    requestData.email = email.trim();
  }

  if (givenName || familyName) {
    requestData.fullName = {
      givenName: givenName?.trim() || '',
      familyName: familyName?.trim() || '',
    };
  }

  const result = await makeRequest('POST', '/api/auth/apple', requestData);

  if (result.success && result.data.success && result.data.token) {
    logSuccess('Apple OAuth login successful');
    logInfo(`Token: ${result.data.token.substring(0, 20)}...`);
    logInfo(`User: ${result.data.user.name} (${result.data.user.email})`);
    logInfo(`OAuth Provider: ${result.data.user.oauthProvider}`);
    
    // 받은 토큰으로 /api/auth/me 테스트
    logTest('Testing authenticated endpoint with Apple OAuth token');
    const meResult = await makeRequest('GET', '/api/auth/me', null, result.data.token);
    
    if (meResult.success && meResult.data.success) {
      logSuccess('Authenticated endpoint access successful');
      return true;
    } else {
      logError('Authenticated endpoint access failed');
      return false;
    }
  } else {
    logError('Apple OAuth login failed');
    console.log('Response:', result.data);
    return false;
  }
}

// OAuth 설정 확인
async function checkOAuthConfig() {
  logTest('OAuth Configuration Check');
  
  const googleConfigured = !!process.env.GOOGLE_CLIENT_ID;
  const appleConfigured = !!process.env.APPLE_CLIENT_ID;

  if (googleConfigured) {
    logSuccess('Google OAuth is configured');
  } else {
    logWarning('Google OAuth is not configured (GOOGLE_CLIENT_ID missing)');
  }

  if (appleConfigured) {
    logSuccess('Apple OAuth is configured');
  } else {
    logWarning('Apple OAuth is not configured (APPLE_CLIENT_ID missing)');
  }

  return { googleConfigured, appleConfigured };
}

// 메인 실행 함수
async function runTests() {
  const oauthType = process.argv[2];

  log('\n🚀 Starting OAuth Tests\n', 'blue');
  logInfo(`Base URL: ${BASE_URL}\n`);

  // 환경 변수 로드
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch (error) {
    logWarning('dotenv를 로드할 수 없습니다. 환경 변수를 수동으로 설정하세요.');
  }

  // OAuth 설정 확인
  const config = await checkOAuthConfig();

  if (oauthType === 'google') {
    if (!config.googleConfigured) {
      logError('Google OAuth가 설정되지 않았습니다.');
      process.exit(1);
    }
    await testGoogleOAuth();
  } else if (oauthType === 'apple') {
    if (!config.appleConfigured) {
      logError('Apple OAuth가 설정되지 않았습니다.');
      process.exit(1);
    }
    await testAppleOAuth();
  } else {
    logError('사용법: node tests/oauth.test.js [google|apple]');
    logInfo('예시:');
    logInfo('  node tests/oauth.test.js google');
    logInfo('  node tests/oauth.test.js apple');
    process.exit(1);
  }
}

// 스크립트 실행
runTests().catch(error => {
  logError(`Test execution failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
