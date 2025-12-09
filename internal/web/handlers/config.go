package handlers

import (
	"net/http"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/gin-gonic/gin"
)

type ConfigHandler struct {
	config *config.Config
}

func NewConfigHandler(cfg *config.Config) *ConfigHandler {
	return &ConfigHandler{
		config: cfg,
	}
}

// ConfigResponse represents public configuration
type ConfigResponse struct {
	PrinterExternalHostname string `json:"printer_external_hostname" example:"printer.example.com"`
	IPPPort                 int    `json:"ipp_port" example:"631"`
	RawPort                 int    `json:"raw_port" example:"9100"`
	AllowLocal              bool   `json:"allow_local" example:"true"`
	SSOEnabled              bool   `json:"sso_enabled" example:"false"`
	PrinterInsecure         bool   `json:"printer_insecure" example:"false"`
}

// GetPublicConfig returns public configuration
// @Summary Get public configuration
// @Description Get publicly accessible configuration (printer external hostname, etc.)
// @Tags config
// @Produce json
// @Success 200 {object} ConfigResponse
// @Router /config [get]
func (h *ConfigHandler) GetPublicConfig(c *gin.Context) {
	c.JSON(http.StatusOK, ConfigResponse{
		PrinterExternalHostname: h.config.Printer.ExternalHostname,
		IPPPort:                 h.config.IPP.Port,
		RawPort:                 h.config.Printer.Port,
		AllowLocal:              h.config.Auth.AllowLocal,
		SSOEnabled:              h.config.Auth.OIDC.Enabled,
		PrinterInsecure:         h.config.Printer.Insecure,
	})
}
