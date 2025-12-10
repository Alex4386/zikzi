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
	UserID      string `json:"user_id" example:"abc123"` // Admin only: register on behalf of user
}

// UpdateIPRequest represents IP update data
type UpdateIPRequest struct {
	Description string `json:"description" example:"Office Desktop"`
}

// DetectIPResponse represents the detected IP response
type DetectIPResponse struct {
	IPAddress string `json:"ip_address" example:"192.168.1.100"`
}

// ListIPsQuery represents query parameters for listing IPs
type ListIPsQuery struct {
	Full bool `form:"full" example:"false"` // Admin only: show all IPs
}

// ListIPs returns all registered IP addresses for the authenticated user
// @Summary List registered IPs
// @Description Get all IP addresses registered by the authenticated user. Admins can use full=true to see all IPs.
// @Tags ips
// @Produce json
// @Security BearerAuth
// @Param full query bool false "Show all IPs (admin only)"
// @Success 200 {array} models.IPRegistration
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /ips [get]
func (h *IPHandler) ListIPs(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)

	var queryParams ListIPsQuery
	if err := c.ShouldBindQuery(&queryParams); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// full=true requires admin
	if queryParams.Full && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	var ips []models.IPRegistration
	query := h.db
	if !queryParams.Full || !isAdmin {
		// Regular mode: show only user's IPs
		query = query.Where("user_id = ?", userID)
	}
	if err := query.Preload("User").Find(&ips).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch IPs"})
		return
	}

	c.JSON(http.StatusOK, ips)
}

// RegisterIP registers a new IP address for the authenticated user
// @Summary Register IP address
// @Description Register a new IP address to associate with the user's account (admin can register on behalf of user)
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
	isAdmin := middleware.IsAdmin(c)

	var req RegisterIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Admin can register on behalf of another user
	targetUserID := userID
	if req.UserID != "" && isAdmin {
		targetUserID = req.UserID
	}

	// Check if IP is already registered (including soft-deleted records)
	var existing models.IPRegistration
	if err := h.db.Unscoped().Where("ip_address = ?", req.IPAddress).First(&existing).Error; err == nil {
		if existing.DeletedAt.Valid {
			// Reactivate the soft-deleted record
			existing.DeletedAt = gorm.DeletedAt{}
			existing.UserID = targetUserID
			existing.Description = req.Description
			existing.IsActive = true
			if err := h.db.Unscoped().Save(&existing).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register IP"})
				return
			}
			h.db.Preload("User").First(&existing, "id = ?", existing.ID)
			c.JSON(http.StatusCreated, existing)
			return
		}
		c.JSON(http.StatusConflict, gin.H{"error": "IP address already registered"})
		return
	}

	ip := models.IPRegistration{
		UserID:      targetUserID,
		IPAddress:   req.IPAddress,
		Description: req.Description,
		IsActive:    true,
	}

	if err := h.db.Create(&ip).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register IP"})
		return
	}

	// Preload user for response
	h.db.Preload("User").First(&ip, "id = ?", ip.ID)

	c.JSON(http.StatusCreated, ip)
}

// UpdateIP updates an IP registration's description
// @Summary Update IP registration
// @Description Update an IP address registration's description (admin can update any)
// @Tags ips
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "IP Registration ID"
// @Param request body UpdateIPRequest true "IP update data"
// @Success 200 {object} models.IPRegistration
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /ips/{id} [put]
func (h *IPHandler) UpdateIP(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	ipID := c.Param("id")

	var req UpdateIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ip models.IPRegistration
	query := h.db.Where("id = ?", ipID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.First(&ip).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "IP registration not found"})
		return
	}

	ip.Description = req.Description
	if err := h.db.Save(&ip).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update IP"})
		return
	}

	// Preload user for response
	h.db.Preload("User").First(&ip, "id = ?", ip.ID)

	c.JSON(http.StatusOK, ip)
}

// DeleteIP removes an IP registration
// @Summary Delete IP registration
// @Description Remove an IP address registration (admin can delete any)
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
	isAdmin := middleware.IsAdmin(c)
	ipID := c.Param("id")

	query := h.db.Where("id = ?", ipID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	result := query.Delete(&models.IPRegistration{})
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
