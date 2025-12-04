# PowerShell UTF-8 인코딩 설정 스크립트
# 이 스크립트를 실행하면 현재 PowerShell 세션의 인코딩이 UTF-8로 설정됩니다.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "✅ UTF-8 인코딩이 설정되었습니다." -ForegroundColor Green
Write-Host "이제 한글이 정상적으로 표시됩니다." -ForegroundColor Cyan


