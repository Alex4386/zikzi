.PHONY: build run dev clean test web web-dev docs

BINARY_NAME=zikzi
MAIN_PATH=./cmd/zikzi

# Build frontend then backend (CGO required for SQLite)
build: docs web
	CGO_ENABLED=1 go build -o $(BINARY_NAME) $(MAIN_PATH)

run: build
	./$(BINARY_NAME)

dev:
	go run $(MAIN_PATH)

clean:
	go clean
	rm -f $(BINARY_NAME)
	rm -rf internal/web/static/*
	rm -rf docs/

test:
	go test -v ./...

# Generate Swagger documentation
docs:
	./docgen.sh
	
# Build frontend
web:
	cd web && yarn && yarn build

# Run frontend dev server (proxies to backend)
web-dev:
	cd web && yarn dev

# Build for multiple platforms (requires cross-compilation toolchains for CGO)
build-all: docs web
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o dist/$(BINARY_NAME)-linux-amd64 $(MAIN_PATH)
	CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 go build -o dist/$(BINARY_NAME)-darwin-amd64 $(MAIN_PATH)
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -o dist/$(BINARY_NAME)-darwin-arm64 $(MAIN_PATH)
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build -o dist/$(BINARY_NAME)-windows-amd64.exe $(MAIN_PATH)

# Install dependencies
deps:
	go install github.com/swaggo/swag/cmd/swag@latest
	go mod download
	go mod tidy
	cd web && yarn
