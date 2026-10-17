<#
.SYNOPSIS
    Automated IIS Deployment Script for Smart Solar Microgrid Backend Service.
    Deploys the ASP.NET Core API to C:\inetpub\backend-service, configures IIS AppPool & Site,
    opens Windows Firewall port 8080, and verifies connectivity.

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
Write-Host " Deploying Smart Solar Microgrid Backend to IIS (Port 8080)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = $scriptDir
$publishDir = Join-Path $projectDir "bin\Release\net10.0\publish"
$targetDir = "C:\inetpub\backend-service"
$appPoolName = "SmartSolarAPI"
$siteName = "SmartSolarAPI"
$port = 8080

Import-Module WebAdministration -ErrorAction SilentlyContinue

# Step 1: Ensure IIS AppPool and Site exist
Write-Host "`n[1/6] Configuring IIS Application Pool and Website..." -ForegroundColor Green

# Configure AppPool
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    Write-Host "Creating IIS Application Pool '$appPoolName'..." -ForegroundColor Yellow
    New-WebAppPool -Name $appPoolName | Out-Null
}
# ASP.NET Core requires "No Managed Code"
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name "managedRuntimeVersion" -Value ""

# Ensure target directory exists
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# Stop AppPool before publishing to unlock any locked DLLs
if (Get-Item "IIS:\AppPools\$appPoolName" -ErrorAction SilentlyContinue) {
    Write-Host "Stopping AppPool '$appPoolName' to release file locks..." -ForegroundColor Gray
    Stop-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Step 2: Build & Publish Release
Write-Host "`n[2/6] Publishing Release build from source..." -ForegroundColor Green
Set-Location $projectDir
dotnet publish -c Release -o $publishDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "dotnet publish failed!" -ForegroundColor Red
    pause
    exit 1
}

# Step 3: Copy Published Files & Configuration
Write-Host "`n[3/6] Deploying files to $targetDir..." -ForegroundColor Green
Copy-Item -Path "$publishDir\*" -Destination $targetDir -Recurse -Force

# Copy appsettings.Development.json so MongoDB connection string and bootstrap admin are available
$devSettings = Join-Path $projectDir "appsettings.Development.json"
if (Test-Path $devSettings) {
    Copy-Item -Path $devSettings -Destination $targetDir -Force
    Write-Host "Copied appsettings.Development.json to destination." -ForegroundColor Gray
}

# Ensure web.config sets ASPNETCORE_ENVIRONMENT=Development
$webConfigPath = Join-Path $targetDir "web.config"
$webConfigContent = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\backend-service.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Development" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>
"@
Set-Content -Path $webConfigPath -Value $webConfigContent -Force

# Create logs directory
$logDir = Join-Path $targetDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Step 4: Configure IIS Website on Port 8080
$siteExists = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if (-not $siteExists) {
    Write-Host "Creating IIS Website '$siteName' on port $port..." -ForegroundColor Yellow
    New-WebSite -Name $siteName -Port $port -PhysicalPath $targetDir -ApplicationPool $appPoolName | Out-Null
} else {
    Write-Host "Updating IIS Website '$siteName' settings..." -ForegroundColor Gray
    Set-ItemProperty "IIS:\Sites\$siteName" -Name "physicalPath" -Value $targetDir
    Set-ItemProperty "IIS:\Sites\$siteName" -Name "applicationPool" -Value $appPoolName
}

# Step 5: Grant Folder Permissions and Configure Windows Firewall
Write-Host "`n[4/6] Setting NTFS permissions and Windows Firewall..." -ForegroundColor Green
$acl = Get-Acl $targetDir
$permission = "IIS_IUSRS","FullControl","ContainerInherit,ObjectInherit","None","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)

$iusrPermission = "IUSR","ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow"
$iusrRule = New-Object System.Security.AccessControl.FileSystemAccessRule $iusrPermission
$acl.AddAccessRule($iusrRule)
Set-Acl $targetDir $acl

# Windows Firewall: Inbound rule for Port 8080
$fwRule = Get-NetFirewallRule -DisplayName "IIS SmartSolar Backend (8080)" -ErrorAction SilentlyContinue
if (-not $fwRule) {
    Write-Host "Opening Port $port in Windows Defender Firewall..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "IIS SmartSolar Backend (8080)" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow | Out-Null
}

# Step 6: Start AppPool & Website, Test Connection
Write-Host "`n[5/6] Starting IIS AppPool and Website..." -ForegroundColor Green
Start-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue
Start-WebSite -Name $siteName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "`n[6/6] Verifying backend health at http://localhost:$port/api/health..." -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Uri "http://localhost:$port/api/health" -Method Get -TimeoutSec 15
    Write-Host "Success! Backend responded from IIS:" -ForegroundColor Green
    $res | Format-List
} catch {
    Write-Host "Verification note: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Check stdout logs in $logDir if there are any startup errors." -ForegroundColor Gray
}

# Detect local IP addresses for physical device configuration
$localIps = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and $_.IPAddress -notmatch "^169\.254\." }).IPAddress

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " DEPLOYMENT SUMMARY & CONNECTION URLS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  * IIS Swagger UI:   http://localhost:$port/swagger" -ForegroundColor White
Write-Host "  * Web Client env:   VITE_API_BASE_URL=http://localhost:$port" -ForegroundColor White
Write-Host "  * AVD Emulator:     http://10.0.2.2:$port/" -ForegroundColor White
foreach ($ip in $localIps) {
    Write-Host "  * Physical Phone:   http://${ip}:$port/" -ForegroundColor Yellow
}
Write-Host "  * USB adb reverse:  adb reverse tcp:$port tcp:$port (then use http://localhost:$port/)" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
pause
