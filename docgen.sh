#!/usr/bin/env sh

# check if swag command is existent
if ! command -v swag &> /dev/null; then
  echo "swag command could not be found, installing it via go install..."
  go install github.com/swaggo/swag/cmd/swag@latest
fi

# generate swagger docs
swag init -g ./cmd/zikzi/main.go -o docs --parseDependency --parseInternal
