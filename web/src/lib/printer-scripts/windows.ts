export function generateWindowsScript(hostname: string, port: number): string {
  const printerName = 'Zikzi Printer'
  const portName = `IP_${hostname}_${port}`

  return `@echo off
setlocal

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

echo Printer Name: %PRINTER_NAME%
echo RAW Port: %HOSTNAME%:%PORT%
echo.

:: Remove existing printer if it exists
echo Removing existing printer if present...
rundll32 printui.dll,PrintUIEntry /dl /n "%PRINTER_NAME%" >nul 2>&1

:: Delete existing port if it exists
cscript //nologo %windir%\\System32\\Printing_Admin_Scripts\\en-US\\prnport.vbs -d -r "%PORT_NAME%" >nul 2>&1

:: Create Standard TCP/IP Port with RAW protocol
echo Creating RAW TCP/IP port...
cscript //nologo %windir%\\System32\\Printing_Admin_Scripts\\en-US\\prnport.vbs -a -r "%PORT_NAME%" -h "%HOSTNAME%" -o raw -n %PORT%

if %errorLevel% neq 0 (
    echo Trying alternative port creation method...
    powershell -Command "Add-PrinterPort -Name '%PORT_NAME%' -PrinterHostAddress '%HOSTNAME%' -PortNumber %PORT%" 2>nul
)

:: Add printer with Generic / Text Only driver (for RAW passthrough)
echo Adding RAW printer...
rundll32 printui.dll,PrintUIEntry /if /b "%PRINTER_NAME%" /f "%%windir%%\\inf\\ntprint.inf" /r "%PORT_NAME%" /m "Generic / Text Only"

if %errorLevel% equ 0 (
    echo.
    echo ============================================
    echo  SUCCESS: Printer installed successfully!
    echo ============================================
    echo.
    echo You can now print to "%PRINTER_NAME%"
    echo.
    echo NOTE: This is a RAW printer for PostScript passthrough.
    echo Use a PostScript-capable application to print.
) else (
    echo.
    echo ============================================
    echo  ERROR: Failed to install printer
    echo ============================================
    echo.
    echo Please try manual installation:
    echo 1. Open Settings ^> Devices ^> Printers ^& Scanners
    echo 2. Add a printer ^> The printer I want isn't listed
    echo 3. Add a local printer with manual settings
    echo 4. Create new port ^> Standard TCP/IP Port
    echo 5. Hostname: %HOSTNAME%, Port: %PORT%, Protocol: RAW
    echo 6. Driver: Generic / Text Only
)

echo.
pause
`
}
