# Configure your `zikzi` instance
## Using Environment Variables

You can override configuration values using environment variables in `docker-compose.yaml`:

```yaml
environment:
  - GIN_MODE=release
  - LOG_LEVEL=info
  - WEB_PORT=8080
  - PRINTER_PORT=9100
  - IPP_PORT=631
  - DATABASE_DRIVER=sqlite
  - DATABASE_DSN=data/zikzi.db
```

Get Overridable Environment Variables list from [config.go](/internal/config/config.go).

## Using PostgreSQL Instead of SQLite

For production deployments, PostgreSQL is recommended. Modify your `docker-compose.yaml`:

1. Uncomment the `postgres` service section
2. Uncomment the `depends_on` section under `zikzi`
3. Uncomment the `volumes` section at the bottom
4. Update `config.yaml`:

```yaml
database:
  driver: "postgres"
  dsn: "host=postgres user=zikzi password=zikzi-password dbname=zikzi sslmode=disable"
```

Then restart:

```bash
docker compose down
docker compose up -d
```

## Reverse Proxy Configuration

If running behind a reverse proxy (nginx, Traefik, etc.), enable proxy trust in `config.yaml`:

```yaml
web:
  trust_proxy: true
  trusted_proxies: ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
```

## OIDC Authentication

To enable OIDC authentication (e.g., Google, Okta), configure the `auth.oidc` section in `config.yaml`:

```yaml
auth:
  jwt_secret: "your-secure-random-string"
  oidc:
    enabled: true
    provider_url: "https://accounts.google.com"
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    redirect_url: "https://your-domain.com/api/v1/auth/oidc/callback"
```
