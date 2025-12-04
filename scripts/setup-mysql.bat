@echo off
chcp 65001 >nul
echo ========================================
echo MySQL 로컬 서버 설정
echo ========================================
echo.

echo [1/3] MySQL 서버 시작 중...
call npm run mysql:start
if %errorlevel% neq 0 (
    echo.
    echo ❌ MySQL 서버 시작 실패
    pause
    exit /b 1
)

echo.
echo [2/3] 데이터베이스 초기화 중...
call npm run db:init
if %errorlevel% neq 0 (
    echo.
    echo ❌ 데이터베이스 초기화 실패
    pause
    exit /b 1
)

echo.
echo [3/3] 연결 테스트 중...
call npm run db:test
if %errorlevel% neq 0 (
    echo.
    echo ❌ 연결 테스트 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ MySQL 설정 완료!
echo ========================================
echo.
echo 이제 다음 명령어로 서버를 시작할 수 있습니다:
echo   npm run dev
echo.
pause


