package cmd

import (
	"fmt"
	"log"
	"strings"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Show configuration",
	Long:  `Display the current Zikzi configuration.`,
	Run:   runConfig,
}

var configShowSecrets bool

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.Flags().BoolVar(&configShowSecrets, "show-secrets", false, "Show secret values (use with caution)")
}

func runConfig(cmd *cobra.Command, args []string) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	fmt.Println("Zikzi Configuration")
	fmt.Println(strings.Repeat("=", 50))

	fmt.Println("\n[Web Server]")
	fmt.Printf("  Host:           %s\n", cfg.Web.Host)
	fmt.Printf("  Port:           %d\n", cfg.Web.Port)

	fmt.Println("\n[Printer Server]")
	fmt.Printf("  Host:                  %s\n", cfg.Printer.Host)
	fmt.Printf("  Port:                  %d\n", cfg.Printer.Port)
	fmt.Printf("  Allow Unregistered IPs: %t\n", cfg.Printer.AllowUnregisteredIPs)

	fmt.Println("\n[Database]")
	fmt.Printf("  Driver:         %s\n", cfg.Database.Driver)
	if configShowSecrets {
		fmt.Printf("  DSN:            %s\n", cfg.Database.DSN)
	} else {
		fmt.Printf("  DSN:            %s\n", maskDSN(cfg.Database.DSN))
	}

	fmt.Println("\n[Authentication]")
	fmt.Printf("  Allow Local:    %t\n", cfg.Auth.AllowLocal)
	if configShowSecrets {
		fmt.Printf("  JWT Secret:     %s\n", cfg.Auth.JWTSecret)
	} else {
		fmt.Printf("  JWT Secret:     %s\n", maskSecret(cfg.Auth.JWTSecret))
	}

	fmt.Println("\n[OIDC]")
	fmt.Printf("  Enabled:        %t\n", cfg.Auth.OIDC.Enabled)
	if cfg.Auth.OIDC.Enabled {
		fmt.Printf("  Provider URL:   %s\n", cfg.Auth.OIDC.ProviderURL)
		fmt.Printf("  Client ID:      %s\n", cfg.Auth.OIDC.ClientID)
		if configShowSecrets {
			fmt.Printf("  Client Secret:  %s\n", cfg.Auth.OIDC.ClientSecret)
		} else {
			fmt.Printf("  Client Secret:  %s\n", maskSecret(cfg.Auth.OIDC.ClientSecret))
		}
		fmt.Printf("  Redirect URL:   %s\n", cfg.Auth.OIDC.RedirectURL)
	}

	fmt.Println("\n[Storage]")
	fmt.Printf("  Path:           %s\n", cfg.Storage.Path)
	fmt.Printf("  Ghostscript:    %s\n", cfg.Storage.GhostscriptBin)
}

func maskSecret(s string) string {
	if s == "" {
		return "(not set)"
	}
	if len(s) <= 4 {
		return "****"
	}
	return s[:2] + strings.Repeat("*", len(s)-4) + s[len(s)-2:]
}

func maskDSN(dsn string) string {
	// For SQLite, just show the filename
	if !strings.Contains(dsn, "://") && !strings.Contains(dsn, "@") {
		return dsn
	}
	// For connection strings with passwords, mask them
	if idx := strings.Index(dsn, "://"); idx != -1 {
		prefix := dsn[:idx+3]
		rest := dsn[idx+3:]
		if atIdx := strings.Index(rest, "@"); atIdx != -1 {
			userPass := rest[:atIdx]
			host := rest[atIdx:]
			if colonIdx := strings.Index(userPass, ":"); colonIdx != -1 {
				user := userPass[:colonIdx]
				return prefix + user + ":****" + host
			}
		}
	}
	return dsn
}
