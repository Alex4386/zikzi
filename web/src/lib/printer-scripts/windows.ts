export interface PrinterDriver {
  id: string
  name: string
  driverName: string
  searchPattern: string // Pattern to search in DriverStore (empty for built-in drivers)
}

export const PRINTER_DRIVERS: PrinterDriver[] = [
  {
    id: 'samsung-clx-6200-ps',
    name: 'Samsung CLX-6200 Series PS',
    driverName: 'Samsung CLX-6200 Series PS',
    searchPattern: 'Samsung.*CLX.*6200.*PS',
  },
  {
    id: 'samsung-universal',
    name: 'Samsung Universal Print Driver 3',
    driverName: 'Samsung Universal Print Driver 3',
    searchPattern: 'Samsung Universal Print Driver',
  },
  {
    id: 'microsoft-ps-class',
    name: 'Microsoft PS Class Driver',
    driverName: 'Microsoft PS Class Driver',
    searchPattern: '',
  },
  {
    id: 'microsoft-pcl6-class',
    name: 'Microsoft PCL6 Class Driver',
    driverName: 'Microsoft PCL6 Class Driver',
    searchPattern: '',
  },
  {
    id: 'generic-text',
    name: 'Generic / Text Only',
    driverName: 'Generic / Text Only',
    searchPattern: '',
  },
]

export function generateWindowsScript(hostname: string, port: number, driver: PrinterDriver): string {
  const printerName = 'Zikzi Printer'
  const portName = `IP_${hostname}_${port}`

  return `@echo off
setlocal EnableDelayedExpansion

:: Zikzi RAW Printer Setup Script for Windows
:: Run this script as Administrator

echo ============================================
echo  Zikzi RAW Printer Setup
echo ============================================
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

set "PRINTER_NAME=${printerName}"
set "PORT_NAME=${portName}"
set "HOSTNAME=${hostname}"
set "PORT=${port}"
set "DRIVER_NAME=${driver.driverName}"
set "SEARCH_PATTERN=${driver.searchPattern}"

echo Printer Name: %PRINTER_NAME%
echo RAW Port: %HOSTNAME%:%PORT%
echo Driver: %DRIVER_NAME%
echo.

:: Check if driver is already installed
echo Checking if driver is installed...
powershell -Command "if (Get-PrinterDriver -Name '%DRIVER_NAME%' -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"

if %errorLevel% equ 0 (
    echo Driver found!
    goto :InstallPrinter
)

:: Driver not installed
if "%SEARCH_PATTERN%"=="" (
    echo.
    echo ERROR: Driver "%DRIVER_NAME%" not found.
    echo This is a built-in driver and should be available on Windows.
    echo.
    pause
    exit /b 1
)

:: Search DriverStore for the driver
echo Driver not installed. Searching DriverStore...
set "INF_PATH="
for /f "tokens=*" %%i in ('powershell -Command "$d = Get-WindowsDriver -Online -All | Where-Object { $_.ProviderName -match '%SEARCH_PATTERN%' -or $_.OriginalFileName -match '%SEARCH_PATTERN%' } | Select-Object -First 1; if ($d) { $d.OriginalFileName }"') do (
    set "INF_PATH=%%i"
)

if "%INF_PATH%"=="" (
    echo.
    echo ============================================
    echo  ERROR: Driver not found
    echo ============================================
    echo.
    echo The driver "%DRIVER_NAME%" was not found in the DriverStore.
    echo.
    echo Please install the driver first:
    echo   1. Download the driver from the manufacturer
    echo   2. Run the driver installer
    echo   3. Then re-run this script
    echo.
    pause
    exit /b 1
)

echo Found: %INF_PATH%
echo Installing driver...
pnputil /add-driver "%INF_PATH%" /install >nul 2>&1
rundll32 printui.dll,PrintUIEntry /ia /m "%DRIVER_NAME%" /f "%INF_PATH%"

:: Verify installation
timeout /t 2 /nobreak >nul
powershell -Command "if (Get-PrinterDriver -Name '%DRIVER_NAME%' -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"

if %errorLevel% neq 0 (
    echo ERROR: Failed to install driver.
    pause
    exit /b 1
)

echo Driver installed!

:InstallPrinter
echo.
echo Setting up printer...

:: Remove existing printer
rundll32 printui.dll,PrintUIEntry /dl /n "%PRINTER_NAME%" >nul 2>&1

:: Remove existing port
powershell -Command "Remove-PrinterPort -Name '%PORT_NAME%' -ErrorAction SilentlyContinue" 2>nul

:: Create port
echo Creating port %PORT_NAME%...
powershell -Command "Add-PrinterPort -Name '%PORT_NAME%' -PrinterHostAddress '%HOSTNAME%' -PortNumber %PORT%"
if %errorLevel% neq 0 (
    echo ERROR: Failed to create port.
    pause
    exit /b 1
)

:: Add printer
echo Adding printer...
powershell -Command "Add-Printer -Name '%PRINTER_NAME%' -DriverName '%DRIVER_NAME%' -PortName '%PORT_NAME%'"

if %errorLevel% equ 0 (
    echo.
    echo ============================================
    echo  SUCCESS!
    echo ============================================
    echo.
    echo Printer "%PRINTER_NAME%" installed.
    echo Driver: %DRIVER_NAME%
) else (
    echo.
    echo ERROR: Failed to add printer.
)

echo.
pause
`
}
