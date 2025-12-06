package web

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"

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
				ips.DELETE("/:id", ipHandler.DeleteIP)
				ips.GET("/detect", ipHandler.DetectIP)
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
		c.Redirect(http.StatusMovedPermanently, "/docs/index.html")
	})
	s.router.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Serve embedded static files (WebUI)
	staticContent, err := fs.Sub(staticFS, "static")
	if err == nil {
		s.router.StaticFS("/ui", http.FS(staticContent))

		// SPA fallback - serve index.html for unmatched routes under /ui
		s.router.NoRoute(func(c *gin.Context) {
			// Only handle /ui paths
			if len(c.Request.URL.Path) >= 3 && c.Request.URL.Path[:3] == "/ui" {
				c.FileFromFS("index.html", http.FS(staticContent))
				return
			}
			c.JSON(404, gin.H{"error": "not found"})
		})
	}

	// Redirect root to UI
	s.router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/ui/")
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
