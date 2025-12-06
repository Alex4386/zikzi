package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "zikzi",
	Short: "Multi-user printing server",
	Long: `Zikzi is a multi-user printing server that supports:
  - PostScript printing on port 9100
  - RESTful API for print job management
  - User authentication (local + OIDC)
  - Modern WebUI`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", "config file (default: config.yaml)")
}

func GetConfigFile() string {
	return cfgFile
}
