type PrinterInstallHook = (src: {
  printerName: string;
  portName: string;
  hostname: string;
  port: number;
}) => string;

export interface PrinterDriver {
  id: string;
  name: string;
  driverName: string; // The exact string shown in the "Add Printer" wizard
  postInstall?: PrinterInstallHook;
  installerUrl?: string;
}

const samsungSwitcherBuilder = (model: string): PrinterInstallHook => {
  return ({ printerName }) => `
$windir = "\${env:WINDIR}"
Write-Host "Switching driver to ${model}..." -ForegroundColor Gray

"$windir\\System32\\spool\\drivers\\x64\\3\\up00aa.exe" -switch "${printerName}" "${model}"
Write-Host " [OK] Universal Driver Switched to ${model}." -ForegroundColor Green

`
};

export const PRINTER_DRIVERS: PrinterDriver[] = [
  {
    id: 'samsung-clx-6240-series-ps-upd3',
    name: 'Samsung CLX-6240 Series PS (Universal)',
    driverName: 'Samsung Universal Print Driver 3 PS',
    postInstall: samsungSwitcherBuilder('CLX-6240'),
    installerUrl: 'https://www.samsungsvc.co.kr/solution/38849',
  },
  {
    id: 'samsung-clx-6200-series-ps-upd3',
    name: 'Samsung CLX-6200 Series PS (Universal)',
    driverName: 'Samsung Universal Print Driver 3 PS',
    postInstall: samsungSwitcherBuilder('CLX-6200'),
    installerUrl: 'https://www.samsungsvc.co.kr/solution/38849',
  },
  // ... other drivers
];

export function generateWindowsScript(hostname: string, port: number, driver: PrinterDriver): string {
  const printerName = "Zikzi Printer"; // Or dynamic if you prefer
  const portName = `IP_${hostname}_${port}`;
  
  // We escape single quotes for PowerShell safety
  const safeDriverName = driver.driverName.replace(/'/g, "''");
  const safePrinterName = printerName.replace(/'/g, "''");

  return `
<# : batch portion
@echo off
setlocal
cd /d "%~dp0"

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Run the PowerShell logic below
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression (Get-Content '%~f0' -Raw | Select-String -Pattern '^<# : batch portion' -Context 0,10000 | ForEach-Object { $_.Context.PostContext })"
exit /b
#>

# --- POWERSHELL LOGIC STARTS HERE ---

$ErrorActionPreference = "Stop"

# --- Configuration ---
$PrinterName = '${safePrinterName}'
$DriverName  = '${safeDriverName}'
$PortName    = '${portName}'
$PrinterIP   = '${hostname}'
$PortNumber  = ${port}

# --- Helper Function: GUI Prompt ---
function Show-UserPrompt {
    param([string]$Message)
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($Message, "Printer Setup Required", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "      Zikzi Printer Setup Assistant         " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Check Driver Status ---
Write-Host "Checking for driver: '$DriverName'..." -ForegroundColor Yellow

$DriverInstalled = $false

# 1. Check if actively installed (in Spooler)
if (Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue) {
    Write-Host " [OK] Driver is already active." -ForegroundColor Green
    $DriverInstalled = $true
} 
else {
    # 2. Check Driver Store (Available but not active)
    Write-Host " Driver not active. Checking Windows Driver Store..." -ForegroundColor Gray
    try {
        # Add-PrinterDriver automatically looks in the Driver Store for the name
        Add-PrinterDriver -Name $DriverName -ErrorAction Stop
        Write-Host " [OK] Driver retrieved from system storage." -ForegroundColor Green
        $DriverInstalled = $true
    }
    catch {
        # 3. DRIVER MISSING
        Write-Warning "Driver not found on this computer."
    }
}

# --- Step 2: Handle Missing Driver ---
if (-not $DriverInstalled) {
    Write-Host ""
    Write-Host "CRITICAL: The required driver is missing." -ForegroundColor Red
    
    $Msg = "The printer driver '$DriverName' is not installed on this computer.\`n\`n" +
           "Please download and install the driver manually.\`n\`n" +
           "Once installed, run this script again."

    ${driver.installerUrl ? `
    $Msg += "\`n\`nThe Installer can be found following directions at:\`n${driver.installerUrl}\`n\`nLink to download the driver will open when you click OK."
    Start-Process '${driver.installerUrl}'
    ` : ''}
    
    Show-UserPrompt $Msg
    
    # Pause so they see the error in console too
    Read-Host "Press Enter to exit..."
    exit 1
}

# --- Step 3: Configure Port ---
Write-Host "Checking Network Port..." -ForegroundColor Yellow
if (-not (Get-PrinterPort -Name $PortName -ErrorAction SilentlyContinue)) {
    try {
        Add-PrinterPort -Name $PortName -PrinterHostAddress $PrinterIP -PortNumber $PortNumber
        Write-Host " [OK] Created port $PortName" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create printer port. $_"
        Read-Host "Press Enter to exit..."
        exit 1
    }
} else {
    Write-Host " [OK] Port already exists." -ForegroundColor Gray
}

# --- Step 4: Install Printer ---
Write-Host "Installing Printer Object..." -ForegroundColor Yellow

if (Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue) {
    Write-Host " [INFO] Printer '$PrinterName' already exists. Updating settings..." -ForegroundColor Gray
    # Optional: Update driver if it changed
    Set-Printer -Name $PrinterName -DriverName $DriverName -PortName $PortName
} else {
    try {
        Add-Printer -Name $PrinterName -DriverName $DriverName -PortName $PortName
        Write-Host " [SUCCESS] Printer installed successfully!" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create printer object. $_"
        Show-UserPrompt "Failed to create printer. Error: $_"
        exit 1
    }
}

${driver.postInstall ? `
# --- Step 5: Post-Install Hook ---
Write-Host "Running post-install configuration..." -ForegroundColor Yellow
${driver.postInstall({ printerName: safePrinterName, portName, hostname, port })}
` : ''}

Write-Host ""
Write-Host "Setup Complete." -ForegroundColor Cyan
Start-Sleep -Seconds 3
`;
}
