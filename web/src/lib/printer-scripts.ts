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

export function generateMacScript(hostname: string, port: number): string {
  const printerName = 'Zikzi_Printer'
  const socketUrl = `socket://${hostname}:${port}`

  return `#!/bin/bash

# Zikzi RAW Printer Setup Script for macOS
# Run: chmod +x setup-printer.sh && ./setup-printer.sh

PRINTER_NAME="${printerName}"
SOCKET_URL="${socketUrl}"

echo "============================================"
echo " Zikzi RAW Printer Setup"
echo "============================================"
echo ""
echo "Printer Name: $PRINTER_NAME"
echo "RAW Socket: $SOCKET_URL"
echo ""

# Remove existing printer if it exists
echo "Removing existing printer if present..."
lpadmin -x "$PRINTER_NAME" 2>/dev/null

# Add RAW socket printer with Generic PostScript driver
echo "Adding RAW socket printer..."
lpadmin -p "$PRINTER_NAME" -E -v "$SOCKET_URL" -m "drv:///sample.drv/generic.ppd"

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo " SUCCESS: Printer installed successfully!"
    echo "============================================"
    echo ""
    echo "You can now print to '$PRINTER_NAME'"
    echo ""
    echo "NOTE: This is a RAW printer for PostScript passthrough."
    echo "Use a PostScript-capable application to print."
else
    echo ""
    echo "============================================"
    echo " ERROR: Failed to install printer"
    echo "============================================"
    echo ""
    echo "Please try manual installation:"
    echo "1. Open System Preferences > Printers & Scanners"
    echo "2. Click + to add a printer"
    echo "3. Right-click toolbar and select 'Customize Toolbar'"
    echo "4. Add 'Advanced' button, then click it"
    echo "5. Type: HP Jetdirect - Socket"
    echo "6. URL: $SOCKET_URL"
    echo "7. Use: Generic PostScript Printer"
fi
`
}

export function generateLinuxScript(hostname: string, port: number): string {
  const printerName = 'Zikzi_Printer'
  const socketUrl = `socket://${hostname}:${port}`

  return `#!/bin/bash

# Zikzi RAW Printer Setup Script for Linux
# Run: chmod +x setup-printer.sh && sudo ./setup-printer.sh

PRINTER_NAME="${printerName}"
SOCKET_URL="${socketUrl}"

echo "============================================"
echo " Zikzi RAW Printer Setup"
echo "============================================"
echo ""
echo "Printer Name: $PRINTER_NAME"
echo "RAW Socket: $SOCKET_URL"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

# Remove existing printer if it exists
echo "Removing existing printer if present..."
lpadmin -x "$PRINTER_NAME" 2>/dev/null

# Add RAW socket printer using CUPS with raw queue
echo "Adding RAW socket printer..."
lpadmin -p "$PRINTER_NAME" -E -v "$SOCKET_URL" -m raw

if [ $? -eq 0 ]; then
    # Set as default printer (optional)
    # lpoptions -d "$PRINTER_NAME"

    echo ""
    echo "============================================"
    echo " SUCCESS: Printer installed successfully!"
    echo "============================================"
    echo ""
    echo "You can now print to '$PRINTER_NAME'"
    echo "To set as default: lpoptions -d $PRINTER_NAME"
    echo ""
    echo "NOTE: This is a RAW printer for PostScript passthrough."
    echo "Use a PostScript-capable application to print."
else
    echo ""
    echo "============================================"
    echo " ERROR: Failed to install printer"
    echo "============================================"
    echo ""
    echo "Please ensure CUPS is installed:"
    echo "  Debian/Ubuntu: sudo apt install cups"
    echo "  Fedora/RHEL: sudo dnf install cups"
    echo "  Arch: sudo pacman -S cups"
    echo ""
    echo "Manual installation:"
    echo "  lpadmin -p $PRINTER_NAME -E -v $SOCKET_URL -m raw"
fi
`
}

export function downloadScript(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
