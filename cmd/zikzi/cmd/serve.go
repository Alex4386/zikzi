package cmd

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/database"
	"github.com/alex4386/zikzi/internal/logger"
	"github.com/alex4386/zikzi/internal/printer"
	"github.com/alex4386/zikzi/internal/web"
	"github.com/spf13/cobra"
)

var (
	logLevel string
	verbose  bool
)

var serveCmd = &cobra.Command{
	Use:     "serve",
	Aliases: []string{"start"},
	Short:   "Start the Zikzi server",
	Long:    `Start the Zikzi printing server with both the web API and PostScript printer.`,
	Run:     runServe,
}

func init() {
	rootCmd.AddCommand(serveCmd)
	serveCmd.Flags().StringVarP(&logLevel, "log-level", "l", "", "Log level (debug, info, warn, error)")
	serveCmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose/debug logging")
}

func runServe(cmd *cobra.Command, args []string) {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load config: %v", err)
	}

	// Determine log level: CLI flags override config
	level := cfg.LogLevel
	if verbose {
		level = "debug"
	}
	if logLevel != "" {
		level = logLevel
	}
	logger.SetLevel(level)

	// Initialize database
	db, err := database.Connect(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		logger.Fatal("Failed to migrate database: %v", err)
	}

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start PostScript printer server on port 9100
	printerServer := printer.NewServer(cfg.Printer, cfg.Storage, db)
	go func() {
		if err := printerServer.Start(ctx); err != nil {
			logger.Error("Printer server error: %v", err)
		}
	}()

	// Start IPP server if enabled
	if cfg.IPP.Enabled {
		ippServer := printer.NewIPPServer(cfg.IPP, cfg.Printer, cfg.Storage, db)
		go func() {
			if err := ippServer.Start(ctx); err != nil {
				logger.Error("IPP server error: %v", err)
			}
		}()
	}

	// Start HTTP server (REST API + WebUI)
	webServer := web.NewServer(cfg, db)
	go func() {
		if err := webServer.Start(ctx); err != nil {
			logger.Error("Web server error: %v", err)
		}
	}()

	if cfg.IPP.Enabled {
		logger.Info("Zikzi started - Web: http://localhost:%d, Printer: tcp://localhost:%d, IPP: ipp://localhost:%d/ipp/print",
			cfg.Web.Port, cfg.Printer.Port, cfg.IPP.Port)
	} else {
		logger.Info("Zikzi started - Web: http://localhost:%d, Printer: tcp://localhost:%d",
			cfg.Web.Port, cfg.Printer.Port)
	}

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	logger.Info("Shutting down...")
	cancel()
}
