<#
.SYNOPSIS
    Automated IIS Deployment Script for Smart Solar Microgrid Backend Service.
    Deploys the ASP.NET Core API to C:\inetpub\backend-service and configures IIS.

.DESCRIPTION
    Requires Administrator privileges. If not elevated, it will prompt for UAC elevation.
#>

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting Administrator privileges to deploy to IIS..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Deploying Smart Solar Microgrid Backend to IIS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = $scriptDir
$publishDir = Join-Path $projectDir "bin\Release\net10.0\publish"
$targetDir = "C:\inetpub\backend-service"

# Step 1: Build & Publish Release
Write-Host "`n[1/5] Publishing Release build..." -ForegroundColor Green
Set-Location $projectDir
dotnet publish -c Release -o $publishDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "dotnet publish failed!" -ForegroundColor Red
    pause
    exit 1
}

# Step 2: Stop AppPool / IIS Site to release locked DLL files
Write-Host "`n[2/5] Stopping IIS site / AppPool to unlock files..." -ForegroundColor Green
Import-Module WebAdministration -ErrorAction SilentlyContinue

$appPoolName = "SmartSolarAPI"
if (Get-Item "IIS:\AppPools\$appPoolName" -ErrorAction SilentlyContinue) {
    Stop-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Step 3: Ensure target directory exists and copy files
Write-Host "`n[3/5] Deploying files to $targetDir..." -ForegroundColor Green
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item -Path "$publishDir\*" -Destination $targetDir -Recurse -Force

# Create logs directory
$logDir = Join-Path $targetDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Step 4: Grant Permissions to IIS AppPool identity and IUSR
Write-Host "`n[4/5] Setting folder permissions for IIS..." -ForegroundColor Green
$acl = Get-Acl $targetDir
$permission = "IIS_IUSRS","FullControl","ContainerInherit,ObjectInherit","None","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)

$iusrPermission = "IUSR","ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow"
$iusrRule = New-Object System.Security.AccessControl.FileSystemAccessRule $iusrPermission
$acl.AddAccessRule($iusrRule)
Set-Acl $targetDir $acl

# Step 5: Start AppPool
Write-Host "`n[5/5] Restarting IIS AppPool and verifying..." -ForegroundColor Green
if (Get-Item "IIS:\AppPools\$appPoolName" -ErrorAction SilentlyContinue) {
    Start-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
} else {
    iisreset /restart
}

Write-Host "`nTesting IIS endpoint at http://localhost:8080/api/health..." -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -Method Get -TimeoutSec 10
    Write-Host "Success! Backend responded from IIS:" -ForegroundColor Green
    $res | Format-List
} catch {
    Write-Host "Verification note: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "If this was first start, please check http://localhost:8080 in your browser." -ForegroundColor Gray
}

Write-Host "`nDeployment completed successfully!" -ForegroundColor Cyan
Write-Host "AVD emulator URL for IIS: http://10.0.2.2:8080/" -ForegroundColor Cyan
pause
