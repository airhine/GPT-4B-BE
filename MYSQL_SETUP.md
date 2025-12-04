# MySQL 설정 가이드

## MySQL 서버 시작하기

### Windows

1. **서비스로 실행 중인 경우:**
   ```powershell
   # 서비스 상태 확인
   Get-Service -Name MySQL* | Select-Object Name, Status
   
   # 서비스 시작 (서비스 이름이 다른 경우 조정)
   Start-Service -Name MySQL80
   # 또는
   Start-Service -Name MySQL
   ```

2. **수동으로 실행하는 경우:**
   ```powershell
   # MySQL 설치 경로로 이동 (일반적으로)
   cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
   
   # MySQL 서버 시작
   .\mysqld.exe
   ```

3. **XAMPP/WAMP 사용하는 경우:**
   - XAMPP/WAMP Control Panel을 열고 MySQL을 시작하세요.

### macOS

```bash
# Homebrew로 설치한 경우
brew services start mysql

# 또는 수동으로
mysql.server start
```

### Linux

```bash
# systemd 사용
sudo systemctl start mysql
# 또는
sudo systemctl start mysqld

# 서비스 상태 확인
sudo systemctl status mysql
```

## 데이터베이스 생성

MySQL 서버가 실행되면 데이터베이스를 생성해야 합니다:

```sql
-- MySQL에 로그인
mysql -u root -p

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS backendTest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 사용자 권한 확인 (필요한 경우)
GRANT ALL PRIVILEGES ON backendTest.* TO 'root'@'localhost';
FLUSH PRIVILEGES;

-- 종료
EXIT;
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# MySQL 데이터베이스 설정
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your-password-here
DB_NAME=backendTest
DB_PORT=3306
```

## 연결 테스트

서버를 실행하면 자동으로 데이터베이스 연결을 테스트하고 테이블을 생성합니다:

```bash
npm run dev
```

성공 메시지:
```
✅ MySQL connected successfully
✅ Database tables created/verified successfully
🚀 Server is running on port 3000
```

## 문제 해결

### 1. "ECONNREFUSED" 오류
- MySQL 서버가 실행 중인지 확인
- 포트 3306이 사용 중인지 확인: `netstat -an | findstr 3306` (Windows)

### 2. "Access denied" 오류
- 사용자 이름과 비밀번호가 올바른지 확인
- `.env` 파일의 `DB_USER`와 `DB_PASSWORD` 확인

### 3. "Unknown database" 오류
- 데이터베이스가 생성되었는지 확인
- 위의 "데이터베이스 생성" 섹션 참고

### 4. 포트 확인
```powershell
# Windows
netstat -an | findstr 3306

# macOS/Linux
lsof -i :3306
```

## MySQL 설치 확인

MySQL이 설치되어 있는지 확인:

```bash
# 버전 확인
mysql --version

# 또는
mysql -V
```

MySQL이 설치되어 있지 않다면:
- [MySQL 공식 사이트](https://dev.mysql.com/downloads/mysql/)에서 다운로드
- 또는 XAMPP/WAMP 같은 패키지 설치
