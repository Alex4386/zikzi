package main

import (
	"github.com/alex4386/zikzi/cmd/zikzi/cmd"
)

// @title Zikzi API
// @version 1.0
// @description Multi-user printing server API for managing print jobs, IP registrations, and user authentication.

// @contact.name Zikzi
// @license.name MIT

// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT Bearer token authentication

func main() {
	cmd.Execute()
}
