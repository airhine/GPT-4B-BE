# API 테스트 가이드

이 문서는 GPT-4b Backend API를 테스트하는 방법을 설명합니다.

## 목차

1. [서버 실행](#서버-실행)
2. [기본 인증 테스트](#기본-인증-테스트)
3. [Google OAuth 테스트](#google-oauth-테스트)
4. [Apple OAuth 테스트](#apple-oauth-테스트)
5. [Postman 사용법](#postman-사용법)
6. [curl 사용법](#curl-사용법)
7. [테스트 스크립트 사용법](#테스트-스크립트-사용법)

## 서버 실행

먼저 서버를 실행합니다:

```bash
npm run dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 기본 인증 테스트

### 1. 회원가입

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. 로그인

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

응답에서 `token`을 받아서 저장합니다.

### 3. 현재 사용자 정보 조회

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Google OAuth 테스트

### 실제 Google OAuth 플로우

1. **프론트엔드에서 Google 로그인**
   - Google OAuth 라이브러리를 사용하여 로그인
   - `idToken`을 받습니다

2. **백엔드로 idToken 전송**

```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_GOOGLE_ID_TOKEN"
  }'
```

### 테스트용 Mock Token 생성 (개발용)

실제 Google ID Token을 생성하려면 프론트엔드에서 Google 로그인을 해야 합니다.

**웹 브라우저 콘솔에서 테스트:**

```javascript
// Google OAuth 라이브러리 로드 후
gapi.load('auth2', function() {
  gapi.auth2.init({
    client_id: 'YOUR_GOOGLE_CLIENT_ID'
  }).then(function() {
    const authInstance = gapi.auth2.getAuthInstance();
    authInstance.signIn().then(function(googleUser) {
      const idToken = googleUser.getAuthResponse().id_token;
      console.log('ID Token:', idToken);
      
      // 이 토큰을 백엔드로 전송
      fetch('http://localhost:3000/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken })
      })
      .then(res => res.json())
      .then(data => console.log('Response:', data));
    });
  });
});
```

## Apple OAuth 테스트

### 실제 Apple OAuth 플로우

1. **프론트엔드에서 Apple 로그인**
   - Apple Sign In을 사용하여 로그인
   - `identityToken`을 받습니다

2. **백엔드로 identityToken 전송**

```bash
curl -X POST http://localhost:3000/api/auth/apple \
  -H "Content-Type: application/json" \
  -d '{
    "identityToken": "YOUR_APPLE_IDENTITY_TOKEN",
    "email": "user@example.com",
    "fullName": {
      "givenName": "John",
      "familyName": "Doe"
    }
  }'
```

**참고:** Apple은 첫 로그인 시에만 `email`과 `fullName`을 제공합니다.

## Postman 사용법

### 1. Postman Collection 생성

1. Postman을 열고 새 Collection 생성
2. 환경 변수 설정:
   - `base_url`: `http://localhost:3000`
   - `token`: (로그인 후 자동으로 설정)

### 2. 요청 예시

#### 회원가입
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/register`
- **Body** (raw JSON):
```json
{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}
```

#### 로그인
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/login`
- **Body** (raw JSON):
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

#### Google OAuth
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/google`
- **Body** (raw JSON):
```json
{
  "idToken": "YOUR_GOOGLE_ID_TOKEN"
}
```

#### Apple OAuth
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/apple`
- **Body** (raw JSON):
```json
{
  "identityToken": "YOUR_APPLE_IDENTITY_TOKEN",
  "email": "user@example.com",
  "fullName": {
    "givenName": "John",
    "familyName": "Doe"
  }
}
```

#### 인증이 필요한 요청
- **Method**: GET
- **URL**: `{{base_url}}/api/auth/me`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`

## curl 사용법

### 환경 변수 설정 (PowerShell)

```powershell
$BASE_URL = "http://localhost:3000"
$TOKEN = "YOUR_JWT_TOKEN"
```

### 요청 예시

#### 회원가입
```powershell
curl -X POST "$BASE_URL/api/auth/register" `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

#### 로그인 및 토큰 저장
```powershell
$response = curl -X POST "$BASE_URL/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123"}'
  
$TOKEN = ($response | ConvertFrom-Json).token
```

#### 인증이 필요한 요청
```powershell
curl -X GET "$BASE_URL/api/auth/me" `
  -H "Authorization: Bearer $TOKEN"
```

## 테스트 스크립트 사용법

프로젝트에 포함된 테스트 스크립트를 사용할 수 있습니다:

```bash
# 기본 인증 테스트
node tests/auth.test.js

# Google OAuth 테스트 (실제 토큰 필요)
node tests/google-oauth.test.js

# Apple OAuth 테스트 (실제 토큰 필요)
node tests/apple-oauth.test.js
```

## Health Check

서버가 정상적으로 실행 중인지 확인:

```bash
curl http://localhost:3000/health
```

응답:
```json
{
  "status": "ok",
  "message": "GPT-4b Backend API is running"
}
```

## 에러 응답 예시

### 유효하지 않은 토큰
```json
{
  "success": false,
  "message": "Invalid token"
}
```

### 인증 실패
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### 검증 오류
```json
{
  "success": false,
  "errors": [
    {
      "msg": "Email is required",
      "param": "email",
      "location": "body"
    }
  ]
}
```

## 주의사항

1. **OAuth 토큰**: Google과 Apple OAuth는 실제 토큰이 필요합니다. Mock 토큰으로는 테스트할 수 없습니다.

2. **환경 변수**: `.env` 파일에 올바른 OAuth 클라이언트 ID가 설정되어 있어야 합니다.

3. **CORS**: 프론트엔드에서 테스트할 때는 CORS 설정을 확인하세요.

4. **데이터베이스**: MySQL이 실행 중이고 데이터베이스가 생성되어 있어야 합니다.

## 문제 해결

### 서버 연결 오류
- 서버가 실행 중인지 확인: `npm run dev`
- 포트가 올바른지 확인: 기본값은 3000

### 인증 오류
- JWT_SECRET이 설정되어 있는지 확인
- 토큰이 만료되지 않았는지 확인 (기본 7일)

### OAuth 오류
- GOOGLE_CLIENT_ID 또는 APPLE_CLIENT_ID가 설정되어 있는지 확인
- OAuth 클라이언트 ID가 올바른지 확인
- 토큰이 유효한지 확인 (만료되지 않았는지)
