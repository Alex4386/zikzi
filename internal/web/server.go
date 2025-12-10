package web

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/logger"
	"github.com/alex4386/zikzi/internal/web/handlers"
	"github.com/alex4386/zikzi/internal/web/middleware"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gorm.io/gorm"

	_ "github.com/alex4386/zikzi/docs"
)

//go:embed static/*
var staticFS embed.FS

type Server struct {
	config *config.Config
	db     *gorm.DB
	router *gin.Engine
}

func NewServer(cfg *config.Config, db *gorm.DB) *Server {
	router := gin.Default()

	// Disable automatic redirects to prevent redirect loops
	router.RedirectTrailingSlash = false
	router.RedirectFixedPath = false

	// Configure trusted proxies
	if cfg.Web.TrustProxy {
		if len(cfg.Web.TrustedProxies) > 0 {
			router.SetTrustedProxies(cfg.Web.TrustedProxies)
		} else {
			// Trust all proxies if TrustProxy is enabled but no specific proxies configured
			router.SetTrustedProxies(nil)
		}
	} else {
		// Don't trust any proxies
		router.SetTrustedProxies([]string{})
	}

	s := &Server{
		config: cfg,
		db:     db,
		router: router,
	}

	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	// Middleware
	authMiddleware := middleware.NewAuthMiddleware(s.config.Auth)

	// API routes
	api := s.router.Group("/api/v1")
	{
		// Health check endpoint
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Config endpoint
		configHandler := handlers.NewConfigHandler(s.config)
		api.GET("/config", configHandler.GetPublicConfig)

		// Public routes
		auth := api.Group("/auth")
		{
			authHandler := handlers.NewAuthHandler(s.config.Auth, s.db)
			auth.POST("/login", authHandler.Login)
			auth.POST("/register", authHandler.Register)
			auth.GET("/oidc/login", authHandler.OIDCLogin)
			auth.GET("/oidc/callback", authHandler.OIDCCallback)
			auth.POST("/refresh", authHandler.RefreshToken)
		}

		// Protected routes
		protected := api.Group("/")
		protected.Use(authMiddleware.RequireAuth())
		{
			// User routes
			users := protected.Group("/users")
			{
				userHandler := handlers.NewUserHandler(s.db)
				users.GET("/me", userHandler.GetCurrentUser)
				users.PUT("/me", userHandler.UpdateCurrentUser)
				users.PUT("/me/password", userHandler.ChangePassword)
				users.PUT("/me/ipp-settings", userHandler.UpdateIPPSettings)
			}

			// Print jobs routes
			jobs := protected.Group("/jobs")
			{
				jobHandler := handlers.NewJobHandler(s.db, s.config.Storage)
				jobs.GET("", jobHandler.ListJobs)
				jobs.GET("/:id", jobHandler.GetJob)
				jobs.GET("/:id/download", jobHandler.DownloadJob)
				jobs.GET("/:id/pdf", jobHandler.DownloadPDF)
				jobs.GET("/:id/thumbnail", jobHandler.GetThumbnail)
				jobs.DELETE("/:id", jobHandler.DeleteJob)
			}

			// IP registration routes
			ips := protected.Group("/ips")
			{
				ipHandler := handlers.NewIPHandler(s.db)
				ips.GET("", ipHandler.ListIPs)
				ips.POST("", ipHandler.RegisterIP)
				ips.PUT("/:id", ipHandler.UpdateIP)
				ips.DELETE("/:id", ipHandler.DeleteIP)
				ips.GET("/detect", ipHandler.DetectIP)
			}

			// IPP token routes
			tokens := protected.Group("/tokens")
			{
				tokenHandler := handlers.NewTokenHandler(s.db)
				tokens.GET("", tokenHandler.ListTokens)
				tokens.POST("", tokenHandler.CreateToken)
				tokens.GET("/:id", tokenHandler.GetToken)
				tokens.POST("/:id/revoke", tokenHandler.RevokeToken)
				tokens.DELETE("/:id", tokenHandler.DeleteToken)
			}
		}

		// Admin routes
		admin := api.Group("/admin")
		admin.Use(authMiddleware.RequireAuth(), authMiddleware.RequireAdmin())
		{
			adminHandler := handlers.NewAdminHandler(s.db)
			admin.GET("/users", adminHandler.ListUsers)
			admin.POST("/users", adminHandler.CreateUser)
			admin.GET("/users/:id", adminHandler.GetUser)
			admin.PUT("/users/:id", adminHandler.UpdateUser)
			admin.PUT("/users/:id/password", adminHandler.ChangeUserPassword)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.GET("/jobs", adminHandler.ListAllJobs)
			admin.GET("/jobs/orphaned", adminHandler.ListOrphanedJobs)
			admin.GET("/jobs/:id", adminHandler.GetJobAdmin)
			admin.POST("/jobs/:id/assign", adminHandler.AssignJob)
			admin.GET("/stats", adminHandler.GetStats)
		}
	}

	// Swagger documentation
	s.router.GET("/docs", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/docs/index.html")
	})
	s.router.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Serve embedded static files (WebUI)
	staticContent, err := fs.Sub(staticFS, "static")
	if err == nil {
		// Read index.html once at startup
		indexHTML, _ := fs.ReadFile(staticContent, "index.html")

		serveIndex := func(c *gin.Context) {
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
		}

		serveUI := func(c *gin.Context) {
			// Get the path after /ui
			fullPath := c.Request.URL.Path
			path := strings.TrimPrefix(fullPath, "/ui")
			path = strings.TrimPrefix(path, "/")

			// Empty path means /ui or /ui/ was requested
			if path == "" {
				serveIndex(c)
				return
			}
			// Try to serve the static file
			data, err := fs.ReadFile(staticContent, path)
			if err == nil {
				// Determine content type
				contentType := "application/octet-stream"
				if strings.HasSuffix(path, ".html") {
					contentType = "text/html; charset=utf-8"
				} else if strings.HasSuffix(path, ".css") {
					contentType = "text/css; charset=utf-8"
				} else if strings.HasSuffix(path, ".js") {
					contentType = "application/javascript; charset=utf-8"
				} else if strings.HasSuffix(path, ".json") {
					contentType = "application/json; charset=utf-8"
				} else if strings.HasSuffix(path, ".png") {
					contentType = "image/png"
				} else if strings.HasSuffix(path, ".jpg") || strings.HasSuffix(path, ".jpeg") {
					contentType = "image/jpeg"
				} else if strings.HasSuffix(path, ".svg") {
					contentType = "image/svg+xml"
				} else if strings.HasSuffix(path, ".ico") {
					contentType = "image/x-icon"
				} else if strings.HasSuffix(path, ".woff") {
					contentType = "font/woff"
				} else if strings.HasSuffix(path, ".woff2") {
					contentType = "font/woff2"
				}
				c.Data(http.StatusOK, contentType, data)
				return
			}
			// Not a static file, serve index.html for SPA routing
			serveIndex(c)
		}

		// Handle all /ui paths with a single wildcard route
		s.router.GET("/ui/*path", serveUI)

		// Redirect /ui to /ui/ for consistent SPA routing (preserve query params)
		s.router.GET("/ui", func(c *gin.Context) {
			redirectURL := "/ui/"
			if c.Request.URL.RawQuery != "" {
				redirectURL += "?" + c.Request.URL.RawQuery
			}
			c.Redirect(http.StatusFound, redirectURL)
		})
	}

	// Redirect root to UI
	s.router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/ui/")
	})
}

func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf("%s:%d", s.config.Web.Host, s.config.Web.Port)
	logger.Info("Web server listening on %s", addr)

	server := &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	go func() {
		<-ctx.Done()
		server.Shutdown(context.Background())
	}()

	return server.ListenAndServe()
}
