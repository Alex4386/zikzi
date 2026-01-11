<h1 align="center">Zikzi</h1>
<p align="center">A software-emulated network printer with web interface for managing print jobs.</p>

[한국어 README](README.ko.md)는 [여기](README.ko.md) 있어요!

## What's this?
Zikzi (named after [直指心體要節 (직지심체요절)](https://www.heritage.go.kr/heri/html/HtmlPage.do?pg=/unesco/MemHeritage/MemHeritage_03.jsp&pageNo=5_4_2_0)) is a software-emulated network printer that allows you to print documents over a network and export them as PDF files via a user-friendly web interface. 

It is designed for:  
- Printing government documents that requires to be printed on specific printers.
- Environments where physical printers are not available or practical.

## Features
- Emulates a network printer utilizing `:9100` raw printing protocol. 
- Authorized IPP Printing with HTTP/Basic Auth
- Web interface for managing print jobs and downloading PDF files.
- Supports multi-user via OIDC authentication.
- Converts print jobs to PDF format using GhostScript.

## Installation
See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## License
[MIT License](LICENSE)

## Acknowledgements
- [GhostScript](https://www.ghostscript.com/) - for PDF rendering and processing.
