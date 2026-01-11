# Installation Guide

This guide covers how to install and run Zikzi using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10 or later)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0 or later)

## Quick Start

### 1. Create a directory for Zikzi

```bash
mkdir zikzi && cd zikzi
```

### 2. Download the required files

```bash
# Download docker-compose.yaml
curl -O https://raw.githubusercontent.com/alex4386/zikzi/main/docker-compose.yaml

# Download example config
curl -O https://raw.githubusercontent.com/alex4386/zikzi/main/config.example.yaml
cp config.example.yaml config.yaml
```

### 3. Configure Zikzi

Edit `config.yaml` to customize your setup:

```bash
# Edit with your preferred editor
nano config.yaml
```

> [!IMPORTANT]  
> You should **GENERATE** and **SET** the `jwt_secret` in `config.yaml` for production use.  
> Generate secrets by running command:  
> ```bash
> openssl rand -base64 32
> ```
> Then update the `config.yaml` like following:  
> ```yaml
> auth:
>   jwt_secret: "generated-jwt-secret-here"
> ```

### 4. Create data directory

```bash
mkdir -p data
```

### 5. Start Zikzi

```bash
docker compose up -d
```

### 6. Access the Web UI

Open your browser and navigate to: http://localhost:8080

## Ports
Depending on your configuration, zikzi, by default opens the following port:  

| Port | Service |
|------|---------|
| 8080 | HTTP API + Web UI |
| 9100 | PostScript Printer |
| 631  | IPP (Internet Printing Protocol) |

## Configuration
See [CONFIG.md](.github/docs/CONFIG.md)  

## Installing Printers on Clients
See [PRINT.md](.github/docs/PRINT.md)
