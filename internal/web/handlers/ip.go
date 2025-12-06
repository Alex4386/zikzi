package handlers

import (
	"net/http"
	"strings"

	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/web/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type IPHandler struct {
	db *gorm.DB
}

func NewIPHandler(db *gorm.DB) *IPHandler {
	return &IPHandler{db: db}
}

// RegisterIPRequest represents IP registration data
type RegisterIPRequest struct {
	IPAddress   string `json:"ip_address" binding:"required" example:"192.168.1.100"`
	Description string `json:"description" example:"Office Desktop"`
}

// DetectIPResponse represents the detected IP response
type DetectIPResponse struct {
	IPAddress string `json:"ip_address" example:"192.168.1.100"`
}

// ListIPs returns all registered IP addresses for the authenticated user
// @Summary List registered IPs
// @Description Get all IP addresses registered by the authenticated user
// @Tags ips
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.IPRegistration
// @Failure 401 {object} ErrorResponse
// @Router /ips [get]
func (h *IPHandler) ListIPs(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var ips []models.IPRegistration
	if err := h.db.Where("user_id = ?", userID).Find(&ips).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch IPs"})
		return
	}

	c.JSON(http.StatusOK, ips)
}

// RegisterIP registers a new IP address for the authenticated user
// @Summary Register IP address
// @Description Register a new IP address to associate with the user's account
// @Tags ips
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RegisterIPRequest true "IP registration data"
// @Success 201 {object} models.IPRegistration
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /ips [post]
func (h *IPHandler) RegisterIP(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req RegisterIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if IP is already registered
	var existing models.IPRegistration
	if err := h.db.Where("ip_address = ?", req.IPAddress).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "IP address already registered"})
		return
	}

	ip := models.IPRegistration{
		UserID:      userID,
		IPAddress:   req.IPAddress,
		Description: req.Description,
		IsActive:    true,
	}

	if err := h.db.Create(&ip).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register IP"})
		return
	}

	c.JSON(http.StatusCreated, ip)
}

// DeleteIP removes an IP registration
// @Summary Delete IP registration
// @Description Remove an IP address registration
// @Tags ips
// @Produce json
// @Security BearerAuth
// @Param id path string true "IP Registration ID"
// @Success 200 {object} MessageResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /ips/{id} [delete]
func (h *IPHandler) DeleteIP(c *gin.Context) {
	userID := middleware.GetUserID(c)
	ipID := c.Param("id")

	result := h.db.Where("id = ? AND user_id = ?", ipID, userID).Delete(&models.IPRegistration{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "IP registration not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "IP registration deleted"})
}

// DetectIP returns the client's IP address
// @Summary Detect client IP
// @Description Get the client's IP address as seen by the server
// @Tags ips
// @Produce json
// @Security BearerAuth
// @Success 200 {object} DetectIPResponse
// @Failure 401 {object} ErrorResponse
// @Router /ips/detect [get]
func (h *IPHandler) DetectIP(c *gin.Context) {
	// Get client IP from request
	clientIP := c.ClientIP()

	// Handle X-Forwarded-For header if present
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		clientIP = strings.TrimSpace(ips[0])
	}

	c.JSON(http.StatusOK, gin.H{"ip_address": clientIP})
}
