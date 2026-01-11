# `zikzi` 설정하기

## 환경 변수로 설정하기

`docker-compose.yaml`에서 환경 변수로 설정값을 덮어씌울 수 있어요:

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

쓸 수 있는 환경 변수 목록은 [config.go](/internal/config/config.go)에서 확인하세요.

## PostgreSQL 쓰기 (SQLite 대신)

운영 환경에서는 PostgreSQL 추천해요. `docker-compose.yaml` 수정 방법:

1. `postgres` 서비스 섹션 주석 해제
2. `zikzi` 아래 `depends_on` 섹션 주석 해제
3. 맨 아래 `volumes` 섹션 주석 해제
4. `config.yaml` 수정:

```yaml
database:
  driver: "postgres"
  dsn: "host=postgres user=zikzi password=zikzi-password dbname=zikzi sslmode=disable"
```

그 다음 재시작:

```bash
docker compose down
docker compose up -d
```

## 리버스 프록시 설정

nginx, Traefik 같은 리버스 프록시 뒤에서 돌릴 때는 `config.yaml`에서 프록시 신뢰 설정을 켜주세요:

```yaml
web:
  trust_proxy: true
  trusted_proxies: ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
```

## OIDC 인증

Google, Okta 같은 OIDC 인증 쓰려면 `config.yaml`에서 `auth.oidc` 섹션 설정하면 돼요:

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
