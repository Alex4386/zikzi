# Build stage for frontend
FROM node:24-alpine AS frontend-builder

WORKDIR /app/web

# Build frontend
COPY web/ ./
RUN corepack enable
RUN yarn install --frozen-lockfile

RUN yarn build

# Build stage for backend
FROM golang:1.25-alpine AS backend-builder

# Install build dependencies (gcc/musl-dev required for CGO/SQLite)
RUN apk add --no-cache git gcc musl-dev

# Install swag for generating swagger docs
RUN go install github.com/swaggo/swag/cmd/swag@latest

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy built frontend
COPY --from=frontend-builder /app/internal/web/static ./internal/web/static

# Generate swagger docs
RUN ./docgen.sh

# Build binary
RUN CGO_ENABLED=1 CGO_CFLAGS="-D_LARGEFILE64_SOURCE" go build -o zikzi ./cmd/zikzi

# Final stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    ghostscript \
    tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=backend-builder /app/zikzi .

# Copy example config
COPY config.example.yaml ./config.example.yaml

# Create directories for data
RUN mkdir -p /app/data

# Expose ports
# 8080: HTTP API + Web UI
# 9100: PostScript printer
EXPOSE 8080 9100

# Volume for persistent data
VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

# Run the application
CMD ["./zikzi", "serve"]
