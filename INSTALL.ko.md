# 설치 가이드

Docker로 Zikzi 설치하는 방법입니다.

## 필요한 것

- [Docker](https://docs.docker.com/get-docker/) (v20.10 이상)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0 이상)

## 빠른 시작

### 1. 폴더 만들기

```bash
mkdir zikzi && cd zikzi
```

### 2. 필요한 파일 다운로드

```bash
# docker-compose.yaml 다운로드
curl -O https://raw.githubusercontent.com/alex4386/zikzi/main/docker-compose.yaml

# 설정 파일 다운로드
curl -O https://raw.githubusercontent.com/alex4386/zikzi/main/config.example.yaml
cp config.example.yaml config.yaml
```

### 3. 설정하기

`config.yaml` 열어서 설정 수정하면 됩니다:

```bash
nano config.yaml
```

> [!IMPORTANT]
> 운영 환경에서는 `jwt_secret`을 꼭 바꿔주세요.
> 시크릿 생성:
> ```bash
> openssl rand -base64 32
> ```
> 그 다음 `config.yaml`에 넣어주면 됩니다:
> ```yaml
> auth:
>   jwt_secret: "생성한-시크릿-여기에"
> ```

### 4. 데이터 폴더 만들기

```bash
mkdir -p data
```

### 5. 실행

```bash
docker compose up -d
```

### 6. 접속

브라우저에서 http://localhost:8080 으로 접속하면 됩니다.

## 포트

설정에 따라 다르지만, 기본적으로 다음 포트가 열립니다:

| 포트 | 용도 |
|------|------|
| 8080 | HTTP API + 웹 UI |
| 9100 | PostScript 프린터 |
| 631  | IPP (Internet Printing Protocol) |

## 설정

자세한 설정은 [CONFIG.md](CONFIG.md) 참고
