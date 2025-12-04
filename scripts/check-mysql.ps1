# MySQL 설치 및 상태 확인 스크립트

# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MySQL 설치 및 상태 확인" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. MySQL 서비스 확인
Write-Host "[1] MySQL 서비스 확인 중..." -ForegroundColor Yellow
$mysqlServices = Get-Service | Where-Object { $_.Name -like "*MySQL*" } -ErrorAction SilentlyContinue

if ($mysqlServices.Count -gt 0) {
    Write-Host "✅ MySQL 서비스 발견:" -ForegroundColor Green
    foreach ($service in $mysqlServices) {
        $statusColor = if ($service.Status -eq 'Running') { 'Green' } else { 'Red' }
        Write-Host "   - $($service.Name): $($service.Status)" -ForegroundColor $statusColor
    }
} else {
    Write-Host "❌ MySQL 서비스를 찾을 수 없습니다." -ForegroundColor Red
}

# 2. MySQL 설치 경로 확인
Write-Host "`n[2] MySQL 설치 경로 확인 중..." -ForegroundColor Yellow
$mysqlPaths = @(
    @{ Name = "XAMPP"; Path = "C:\xampp\mysql\bin\mysqld.exe" },
    @{ Name = "WAMP 8.0"; Path = "C:\wamp64\bin\mysql\mysql8.0\bin\mysqld.exe" },
    @{ Name = "WAMP 8.1"; Path = "C:\wamp64\bin\mysql\mysql8.1\bin\mysqld.exe" },
    @{ Name = "WAMP 8.2"; Path = "C:\wamp64\bin\mysql\mysql8.2\bin\mysqld.exe" },
    @{ Name = "MySQL 8.0"; Path = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" },
    @{ Name = "MySQL 8.1"; Path = "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysqld.exe" },
    @{ Name = "MySQL 8.2"; Path = "C:\Program Files\MySQL\MySQL Server 8.2\bin\mysqld.exe" },
    @{ Name = "MySQL 8.0 (x86)"; Path = "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysqld.exe" }
)

$foundPaths = @()
foreach ($item in $mysqlPaths) {
    if (Test-Path $item.Path) {
        $foundPaths += $item
        Write-Host "✅ $($item.Name) 발견: $($item.Path)" -ForegroundColor Green
    }
}

if ($foundPaths.Count -eq 0) {
    Write-Host "❌ MySQL 설치 경로를 찾을 수 없습니다." -ForegroundColor Red
}

# 3. 포트 3306 확인
Write-Host "`n[3] 포트 3306 확인 중..." -ForegroundColor Yellow
$portCheck = netstat -an | Select-String ":3306"
if ($portCheck) {
    Write-Host "✅ 포트 3306이 사용 중입니다 (MySQL이 실행 중일 수 있음)" -ForegroundColor Green
    $portCheck | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "❌ 포트 3306이 사용되지 않습니다 (MySQL이 실행되지 않음)" -ForegroundColor Red
}

# 4. mysql 명령어 확인
Write-Host "`n[4] mysql 명령어 확인 중..." -ForegroundColor Yellow
$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
if ($mysqlCmd) {
    Write-Host "✅ mysql 명령어 사용 가능: $($mysqlCmd.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ mysql 명령어를 찾을 수 없습니다 (PATH에 없음)" -ForegroundColor Red
}

# 요약
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "요약" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($mysqlServices.Count -gt 0 -or $foundPaths.Count -gt 0) {
    Write-Host "✅ MySQL이 설치되어 있습니다." -ForegroundColor Green
    
    $isRunning = ($mysqlServices | Where-Object { $_.Status -eq 'Running' }).Count -gt 0 -or $portCheck
    if ($isRunning) {
        Write-Host "✅ MySQL이 실행 중입니다." -ForegroundColor Green
        Write-Host "`n다음 명령어로 데이터베이스를 초기화하세요:" -ForegroundColor Cyan
        Write-Host "   npm run db:init" -ForegroundColor White
    } else {
        Write-Host "❌ MySQL이 실행되지 않았습니다." -ForegroundColor Red
        Write-Host "`n다음 명령어로 MySQL을 시작하세요:" -ForegroundColor Yellow
        Write-Host "   npm run mysql:start" -ForegroundColor White
        if ($foundPaths.Count -gt 0) {
            Write-Host "`n또는 XAMPP/WAMP Control Panel에서 MySQL을 시작하세요." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ MySQL이 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "`nMySQL 설치 방법:" -ForegroundColor Yellow
    Write-Host "   1. XAMPP: https://www.apachefriends.org/download.html" -ForegroundColor White
    Write-Host "   2. WAMP: https://www.wampserver.com/en/" -ForegroundColor White
    Write-Host "   3. MySQL 직접 설치: https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
    Write-Host "   4. Docker: docker run --name mysql-local -e MYSQL_ROOT_PASSWORD=peter0524! -e MYSQL_DATABASE=backendTest -p 3306:3306 -d mysql:8.0" -ForegroundColor White
}


