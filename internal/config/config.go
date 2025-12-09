package config

import (
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	LogLevel string         `mapstructure:"log_level"` // debug, info, warn, error
	Web      WebConfig      `mapstructure:"web"`
	Printer  PrinterConfig  `mapstructure:"printer"`
	IPP      IPPConfig      `mapstructure:"ipp"`
	Database DatabaseConfig `mapstructure:"database"`
	Auth     AuthConfig     `mapstructure:"auth"`
	Storage  StorageConfig  `mapstructure:"storage"`
}

type WebConfig struct {
	Port           int      `mapstructure:"port"`
	Host           string   `mapstructure:"host"`
	TrustProxy     bool     `mapstructure:"trust_proxy"`      // Trust X-Forwarded-For headers
	TrustedProxies []string `mapstructure:"trusted_proxies"`  // List of trusted proxy IPs/CIDRs
}

type PrinterConfig struct {
	Port                 int      `mapstructure:"port"`
	Host                 string   `mapstructure:"host"`
	AllowUnregisteredIPs bool     `mapstructure:"allow_unregistered_ips"`
	ExternalHostname     string   `mapstructure:"external_hostname"`  // External hostname for printer access (e.g., "printer.example.com")
	ProxyProtocol        bool     `mapstructure:"proxy_protocol"`     // Enable PROXY protocol v1/v2 support
	TrustedProxies       []string `mapstructure:"trusted_proxies"`    // List of trusted proxy IPs/CIDRs for PROXY protocol
	Insecure             bool     `mapstructure:"insecure"`           // Mark connection as insecure (show warning in UI)
}

type IPPConfig struct {
	Enabled        bool     `mapstructure:"enabled"`
	Port           int      `mapstructure:"port"`
	Host           string   `mapstructure:"host"`
	TrustProxy     bool     `mapstructure:"trust_proxy"`      // Trust X-Forwarded-For headers
	TrustedProxies []string `mapstructure:"trusted_proxies"`  // List of trusted proxy IPs/CIDRs
}

type DatabaseConfig struct {
	Driver string `mapstructure:"driver"` // sqlite, postgres, mysql
	DSN    string `mapstructure:"dsn"`
}

type AuthConfig struct {
	JWTSecret    string     `mapstructure:"jwt_secret"`
	OIDC         OIDCConfig `mapstructure:"oidc"`
	AllowLocal   bool       `mapstructure:"allow_local"`
}

type OIDCConfig struct {
	Enabled         bool              `mapstructure:"enabled"`
	ProviderURL     string            `mapstructure:"provider_url"`
	ClientID        string            `mapstructure:"client_id"`
	ClientSecret    string            `mapstructure:"client_secret"`
	RedirectURL     string            `mapstructure:"redirect_url"`
	AutoCreateUsers bool              `mapstructure:"auto_create_users"` // Create new users on first OIDC login
	AuthParams      []string          `mapstructure:"auth_params"`       // Extra query params for auth URL (e.g., "hd=example.com")
	ACL             ACLConfig         `mapstructure:"acl"`
}

type ACLConfig struct {
	Users   []string `mapstructure:"users"`   // Specific email addresses allowed
	Groups  []string `mapstructure:"groups"`  // OIDC groups allowed
	Domains []string `mapstructure:"domains"` // Email domains allowed
}

type StorageConfig struct {
	Path           string `mapstructure:"path"`
	GhostscriptBin string `mapstructure:"ghostscript_bin"`
}

func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/zikzi")

	// Environment variable support
	viper.SetEnvPrefix("ZIKZI")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// Defaults
	viper.SetDefault("web.port", 8080)
	viper.SetDefault("web.host", "0.0.0.0")
	viper.SetDefault("printer.port", 9100)
	viper.SetDefault("printer.host", "0.0.0.0")
	viper.SetDefault("printer.allow_unregistered_ips", false)
	viper.SetDefault("ipp.enabled", true)
	viper.SetDefault("ipp.port", 631)
	viper.SetDefault("ipp.host", "0.0.0.0")
	viper.SetDefault("ipp.trust_proxy", false)
	viper.SetDefault("database.driver", "sqlite")
	viper.SetDefault("database.dsn", "zikzi.db")
	viper.SetDefault("auth.allow_local", true)
	viper.SetDefault("auth.oidc.auto_create_users", true)
	viper.SetDefault("log_level", "info")
	viper.SetDefault("storage.path", "./data")
	viper.SetDefault("storage.ghostscript_bin", "gs")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
