# Installing Printers on Clients

In most cases, you can install the printer through the UI provided by `zikzi`. However, some services (especially Korean government services like the Supreme Court's Internet Registry) require special handling.

This guide explains how to set up the `zikzi` printer for these cases.

## Korean Government Sites

Korean government sites often require proprietary plugins (like MarkAny) for printing documents.

These systems have annoying requirements:
- They only work with RAW printing
- They are picky about printer drivers (built-in Microsoft drivers often don't work)

`zikzi` provides a script that spoofs a Samsung printer driver. Since RAW printing just sends PostScript through port `:9100`, the actual driver doesn't matter.

### Installation Steps

1. Open `zikzi` web interface
2. Click the Settings menu in the left sidebar
3. Select the RAW tab and go to "Auto Setup"
4. Choose your preferred printer driver to spoof
5. Click "Download for Windows (.bat)"
6. Double-click to run. Click "Yes" when UAC ("User Account Control") prompt appears
7. If prompted to install Samsung printer driver, install it manually, then run step 6 again
8. The printer should now be automatically added
