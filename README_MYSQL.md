# MySQL 로컬 서버 설정 가이드

이 가이드는 로컬에서 MySQL 서버를 시작하고 테스트하는 방법을 설명합니다.

## 빠른 시작

### 1. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하세요:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

또는 수동으로 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=peter0524!
DB_NAME=backendTest
DB_PORT=3306
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key-change-in-production
```

### 2. MySQL 서버 시작

```bash
npm run mysql:start
```

이 명령어는:
- MySQL 서비스를 자동으로 찾아서 시작합니다
- 서비스가 이미 실행 중이면 상태를 확인합니다
- 포트 3306이 사용 중인지 확인합니다

**수동으로 시작하는 방법:**
- XAMPP/WAMP를 사용하는 경우: Control Panel에서 MySQL 시작
- Windows 서비스로 설치된 경우: 서비스 관리자에서 MySQL 서비스 시작
- 수동 설치된 경우: `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe` 실행

### 3. 데이터베이스 초기화

```bash
npm run db:init
```

이 명령어는:
- `backendTest` 데이터베이스를 생성합니다
- 필요한 모든 테이블을 생성합니다 (users, business_cards, gifts, events, chats)

### 4. 연결 테스트

```bash
npm run db:test
```

이 명령어는:
- MySQL 서버 연결을 테스트합니다
- 데이터베이스 정보를 표시합니다
- 테이블 목록과 레코드 수를 확인합니다

### 5. 서버 실행

```bash
npm run dev
```

서버가 시작되면 자동으로 데이터베이스 연결을 확인하고 테이블을 생성합니다.

## 사용 가능한 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run mysql:check` | MySQL 설치 및 상태 확인 |
| `npm run mysql:start` | MySQL 서버 시작 (Windows) |
| `npm run db:init` | 데이터베이스 및 테이블 초기화 |
| `npm run db:test` | MySQL 연결 테스트 |
| `npm run dev` | 개발 서버 시작 (nodemon) |
| `npm start` | 프로덕션 서버 시작 |

## 문제 해결

### 한글이 깨져서 표시되는 경우

터미널에서 한글이 깨져 보이는 경우 다음 중 하나를 시도하세요:

**방법 1: PowerShell에서 직접 실행**
```powershell
# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001

# 그 다음 스크립트 실행
npm run mysql:start
```

**방법 2: 인코딩 설정 스크립트 실행**
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/fix-encoding.ps1
```

**방법 3: 터미널 설정 변경**
- VS Code 터미널: 설정에서 "Terminal > Integrated > Encoding"을 UTF-8로 변경
- Windows 터미널: 설정에서 기본 인코딩을 UTF-8로 변경

### MySQL 서버를 찾을 수 없음

먼저 MySQL 설치 상태를 확인하세요:
```bash
npm run mysql:check
```

이 명령어는 다음을 확인합니다:
- MySQL 서비스 상태
- MySQL 설치 경로 (XAMPP, WAMP, 일반 설치)
- 포트 3306 사용 여부
- mysql 명령어 사용 가능 여부

**해결 방법:**

1. **MySQL이 설치되어 있지 않은 경우:**
   - XAMPP 설치: https://www.apachefriends.org/download.html
   - WAMP 설치: https://www.wampserver.com/en/
   - MySQL 직접 설치: https://dev.mysql.com/downloads/mysql/
   - Docker 사용: `docker run --name mysql-local -e MYSQL_ROOT_PASSWORD=peter0524! -e MYSQL_DATABASE=backendTest -p 3306:3306 -d mysql:8.0`

2. **XAMPP/WAMP를 사용하는 경우:**
   - Control Panel에서 MySQL을 시작하세요
   - 시작 후 `npm run mysql:check`로 확인

3. **MySQL이 설치되어 있지만 서비스가 없는 경우:**
   - XAMPP/WAMP Control Panel에서 MySQL을 시작하세요
   - 또는 `npm run mysql:start`를 관리자 권한으로 실행

### 연결 거부 오류 (ECONNREFUSED)

- MySQL 서버가 실행 중인지 확인: `npm run mysql:start`
- 포트 3306이 사용 중인지 확인:
  ```powershell
  netstat -an | findstr 3306
  ```

### 접근 거부 오류 (ER_ACCESS_DENIED_ERROR)

- `.env` 파일의 `DB_USER`와 `DB_PASSWORD`가 올바른지 확인
- MySQL root 비밀번호를 확인하고 `.env` 파일에 올바르게 설정

### 데이터베이스가 존재하지 않음 (ER_BAD_DB_ERROR)

- 데이터베이스를 초기화: `npm run db:init`

## 데이터베이스 구조

초기화 후 다음 테이블이 생성됩니다:

- `users` - 사용자 정보
- `business_cards` - 명함 정보
- `gifts` - 선물 기록
- `events` - 캘린더 이벤트
- `chats` - LLM 채팅 기록

## 추가 정보

더 자세한 정보는 `MYSQL_SETUP.md` 파일을 참조하세요.

