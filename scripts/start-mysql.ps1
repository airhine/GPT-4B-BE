# MySQL 서버 시작 스크립트 (Windows PowerShell)

# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "🔍 MySQL 설치 확인 중..." -ForegroundColor Cyan

# MySQL 설치 경로 찾기
$mysqlPaths = @(
    "C:\xampp\mysql\bin\mysqld.exe",
    "C:\wamp64\bin\mysql\mysql8.0\bin\mysqld.exe",
    "C:\wamp64\bin\mysql\mysql8.1\bin\mysqld.exe",
    "C:\wamp64\bin\mysql\mysql8.2\bin\mysqld.exe",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe",
    "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysqld.exe",
    "C:\Program Files\MySQL\MySQL Server 8.2\bin\mysqld.exe",
    "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysqld.exe"
)

$mysqlPath = $null
foreach ($path in $mysqlPaths) {
    if (Test-Path $path) {
        $mysqlPath = $path
        Write-Host "✅ MySQL 발견: $path" -ForegroundColor Green
        break
    }
}

# MySQL 서비스 찾기
$mysqlServices = Get-Service | Where-Object { $_.Name -like "*MySQL*" } -ErrorAction SilentlyContinue

if ($mysqlServices.Count -eq 0 -and $null -eq $mysqlPath) {
    Write-Host "`n❌ MySQL을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "`n💡 MySQL 설치 방법:" -ForegroundColor Yellow
    Write-Host "   1. XAMPP 설치: https://www.apachefriends.org/download.html" -ForegroundColor White
    Write-Host "   2. WAMP 설치: https://www.wampserver.com/en/" -ForegroundColor White
    Write-Host "   3. MySQL 직접 설치: https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
    Write-Host "`n💡 또는 Docker를 사용할 수 있습니다:" -ForegroundColor Yellow
    Write-Host "   docker run --name mysql-local -e MYSQL_ROOT_PASSWORD=peter0524! -e MYSQL_DATABASE=backendTest -p 3306:3306 -d mysql:8.0" -ForegroundColor White
    Write-Host "`n💡 MySQL이 이미 설치되어 있다면:" -ForegroundColor Yellow
    Write-Host "   - XAMPP/WAMP Control Panel에서 MySQL을 시작하세요" -ForegroundColor White
    Write-Host "   - 또는 MySQL이 실행 중인지 확인하세요 (포트 3306)" -ForegroundColor White
    exit 1
}

# MySQL 서비스로 시작 시도
if ($mysqlServices.Count -gt 0) {
    $mysqlService = $mysqlServices[0]
    Write-Host "✅ MySQL 서비스 발견: $($mysqlService.Name)" -ForegroundColor Green

    # 서비스 상태 확인
    if ($mysqlService.Status -eq 'Running') {
        Write-Host "✅ MySQL 서버가 이미 실행 중입니다!" -ForegroundColor Green
        Write-Host "   서비스 이름: $($mysqlService.Name)" -ForegroundColor Gray
        Write-Host "   상태: $($mysqlService.Status)" -ForegroundColor Gray
    } else {
        Write-Host "🚀 MySQL 서버 시작 중..." -ForegroundColor Cyan
        try {
            Start-Service -Name $mysqlService.Name -ErrorAction Stop
            Start-Sleep -Seconds 3
            
            # 상태 재확인
            $mysqlService.Refresh()
            if ($mysqlService.Status -eq 'Running') {
                Write-Host "✅ MySQL 서버가 성공적으로 시작되었습니다!" -ForegroundColor Green
            } else {
                Write-Host "⚠️  MySQL 서버 시작 중 문제가 발생했습니다." -ForegroundColor Yellow
                Write-Host "   상태: $($mysqlService.Status)" -ForegroundColor Gray
            }
        } catch {
            Write-Host "❌ MySQL 서버 시작 실패: $_" -ForegroundColor Red
            Write-Host "💡 관리자 권한으로 실행해보세요." -ForegroundColor Yellow
            Write-Host "💡 또는 XAMPP/WAMP Control Panel에서 MySQL을 시작하세요." -ForegroundColor Yellow
        }
    }
} else {
    # 서비스가 없지만 mysqld.exe가 있는 경우
    if ($null -ne $mysqlPath) {
        Write-Host "⚠️  MySQL 서비스를 찾을 수 없지만 mysqld.exe가 발견되었습니다." -ForegroundColor Yellow
        Write-Host "💡 XAMPP/WAMP를 사용하는 경우 Control Panel에서 MySQL을 시작하세요." -ForegroundColor Yellow
        Write-Host "💡 또는 다음 명령어로 수동으로 시작할 수 있습니다:" -ForegroundColor Yellow
        Write-Host "   Start-Process -FilePath `"$mysqlPath`"" -ForegroundColor White
    }
}

# 포트 확인
Write-Host "`n🔍 MySQL 포트 확인 중 (3306)..." -ForegroundColor Cyan
$portCheck = netstat -an | Select-String ":3306"

if ($portCheck) {
    Write-Host "✅ MySQL이 포트 3306에서 실행 중입니다." -ForegroundColor Green
    Write-Host "`n✅ 준비 완료! 이제 데이터베이스를 초기화할 수 있습니다." -ForegroundColor Green
    Write-Host "   다음 명령어를 실행하세요: npm run db:init" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  포트 3306에서 MySQL을 찾을 수 없습니다." -ForegroundColor Yellow
    Write-Host "`n💡 MySQL이 실행 중인지 확인하세요:" -ForegroundColor Yellow
    if ($mysqlServices.Count -gt 0) {
        Write-Host "   - 서비스 상태: $($mysqlServices[0].Status)" -ForegroundColor Gray
    }
    if ($null -ne $mysqlPath) {
        Write-Host "   - MySQL 경로: $mysqlPath" -ForegroundColor Gray
        Write-Host "   - XAMPP/WAMP Control Panel에서 MySQL을 시작하세요" -ForegroundColor White
    }
    Write-Host "`n💡 MySQL이 실행되면 다음 명령어로 데이터베이스를 초기화하세요:" -ForegroundColor Yellow
    Write-Host "   npm run db:init" -ForegroundColor Cyan
}

