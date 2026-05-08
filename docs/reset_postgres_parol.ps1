# PostgreSQL postgres foydalanuvchi parolini qayta tiklash
# Administrator sifatida ishga tushiring!

$ErrorActionPreference = "Stop"

# === SOZLAMALAR ===
$YangiParol  = "Postgres@2026"
$PgVersion   = "18"
$PgDataDir   = "C:\Program Files\PostgreSQL\$PgVersion\data"
$PgBinDir    = "C:\Program Files\PostgreSQL\$PgVersion\bin"
$ServiceName = "postgresql-x64-$PgVersion"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL parol tiklash" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Admin tekshiruvi
$current = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "XATO: Administrator huquqi kerak!" -ForegroundColor Red
    Write-Host "PowerShell ni Run as Administrator orqali oching." -ForegroundColor Yellow
    exit 1
}

# Papka tekshiruvi
if (-not (Test-Path $PgDataDir)) {
    Write-Host "XATO: $PgDataDir topilmadi" -ForegroundColor Red
    Write-Host "PostgreSQL boshqa versiyada o'rnatilgan bo'lishi mumkin." -ForegroundColor Yellow
    Write-Host "Mavjud papkalar:"
    Get-ChildItem "C:\Program Files\PostgreSQL\" | Select-Object Name
    exit 1
}

# Xizmat tekshiruvi
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "XATO: $ServiceName xizmati topilmadi" -ForegroundColor Red
    Write-Host "Mavjud xizmatlar:"
    Get-Service | Where-Object { $_.Name -like "*postgres*" } | Format-Table Name, Status
    exit 1
}

$hbaPath    = Join-Path $PgDataDir "pg_hba.conf"
$backupPath = Join-Path $PgDataDir "pg_hba.conf.backup"

# 1. Backup
Write-Host ""
Write-Host "[1/6] Backup yaratilmoqda..." -ForegroundColor Yellow
Copy-Item -Path $hbaPath -Destination $backupPath -Force
Write-Host "  Tayyor" -ForegroundColor Green

# 2. Xizmatni to'xtatish
Write-Host ""
Write-Host "[2/6] Xizmat toxtatilmoqda..." -ForegroundColor Yellow
Stop-Service -Name $ServiceName -Force
Start-Sleep -Seconds 2
Write-Host "  Tayyor" -ForegroundColor Green

# 3. pg_hba.conf ni trust rejimiga
Write-Host ""
Write-Host "[3/6] pg_hba.conf trust rejimiga otkazilmoqda..." -ForegroundColor Yellow
$content = Get-Content -Path $hbaPath -Raw
$modified = $content -replace "(?m)^(host\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+)\S+", "`$1trust"
$modified = $modified -replace "(?m)^(local\s+all\s+all\s+)\S+", "`$1trust"
Set-Content -Path $hbaPath -Value $modified -Encoding ASCII
Write-Host "  Tayyor" -ForegroundColor Green

# 4. Xizmatni ishga tushirish
Write-Host ""
Write-Host "[4/6] Xizmat qayta ishga tushirilmoqda..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3
Write-Host "  Tayyor" -ForegroundColor Green

# 5. Parolni ozgartirish
Write-Host ""
Write-Host "[5/6] Parol ozgartirilmoqda..." -ForegroundColor Yellow
$psql = Join-Path $PgBinDir "psql.exe"
$alterCmd = "ALTER USER postgres WITH PASSWORD '$YangiParol';"
& $psql -U postgres -h localhost -d postgres -c $alterCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "XATO: parolni ozgartirib bolmadi" -ForegroundColor Red
    Copy-Item -Path $backupPath -Destination $hbaPath -Force
    Restart-Service -Name $ServiceName -Force
    exit 1
}
Write-Host "  Tayyor" -ForegroundColor Green

# 6. pg_hba.conf ni qaytarish
Write-Host ""
Write-Host "[6/6] pg_hba.conf qaytarilmoqda..." -ForegroundColor Yellow
Copy-Item -Path $backupPath -Destination $hbaPath -Force
Restart-Service -Name $ServiceName -Force
Start-Sleep -Seconds 3
Write-Host "  Tayyor" -ForegroundColor Green

# Yakuniy xabar
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  MUVAFFAQIYAT!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Foydalanuvchi: postgres" -ForegroundColor White
Write-Host "  Yangi parol:   $YangiParol" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Bu parolni eslab qoling!" -ForegroundColor Yellow
Write-Host "Endi Claude ga: parol tayyor deb yozing." -ForegroundColor Cyan
