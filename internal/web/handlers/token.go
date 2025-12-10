package handlers

import (
	"net/http"
	"time"

	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/web/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TokenHandler struct {
	db *gorm.DB
}

func NewTokenHandler(db *gorm.DB) *TokenHandler {
	return &TokenHandler{db: db}
}

// CreateTokenRequest represents token creation data
type CreateTokenRequest struct {
	Name       string `json:"name" binding:"required" example:"My Laptop"`
	ExpireDays int    `json:"expire_days" example:"90"` // 0 = never expires
	UserID     string `json:"user_id" example:"abc123"` // Admin only: create on behalf of user
}

// IPPTokenResponse represents an IPP token in API responses (without the actual token value)
type IPPTokenResponse struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Name       string     `json:"name"`
	LastUsedAt *time.Time `json:"last_used_at"`
	LastUsedIP string     `json:"last_used_ip"`
	ExpiresAt  *time.Time `json:"expires_at"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
}

// CreateIPPTokenResponse includes the token value (only shown once at creation)
type CreateIPPTokenResponse struct {
	IPPTokenResponse
	Token string `json:"token"` // Only returned on creation
}

// ListTokensQuery represents query parameters for listing tokens
type ListTokensQuery struct {
	Page   int    `form:"page,default=1" example:"1"`
	Limit  int    `form:"limit,default=20" example:"20"`
	Full   bool   `form:"full" example:"false"`      // Admin only: show all tokens
	UserID string `form:"user_id" example:"abc123"` // Admin only: filter by user
}

// ListTokensResponse represents the paginated tokens response
type ListTokensResponse struct {
	Tokens []IPPTokenResponse `json:"tokens"`
	Total  int64              `json:"total" example:"100"`
	Page   int                `json:"page" example:"1"`
	Limit  int                `json:"limit" example:"20"`
}

// ListTokens returns all IPP tokens for the authenticated user
// @Summary List IPP tokens
// @Description Get paginated list of IPP tokens for the authenticated user. Admins can use full=true to see all tokens.
// @Tags tokens
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param full query bool false "Show all tokens (admin only)"
// @Success 200 {object} ListTokensResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /tokens [get]
func (h *TokenHandler) ListTokens(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)

	var queryParams ListTokensQuery
	if err := c.ShouldBindQuery(&queryParams); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// full=true or user_id filter requires admin
	if (queryParams.Full || queryParams.UserID != "") && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	if queryParams.Limit > 100 {
		queryParams.Limit = 100
	}
	if queryParams.Limit == 0 {
		queryParams.Limit = 20
	}
	if queryParams.Page == 0 {
		queryParams.Page = 1
	}

	offset := (queryParams.Page - 1) * queryParams.Limit

	var tokens []models.IPPToken
	var total int64

	query := h.db.Model(&models.IPPToken{})
	if queryParams.UserID != "" && isAdmin {
		// Admin filtering by specific user
		query = query.Where("user_id = ?", queryParams.UserID)
	} else if !queryParams.Full || !isAdmin {
		// Regular mode: show only user's tokens
		query = query.Where("user_id = ?", userID)
	}

	query.Count(&total)

	if err := query.Preload("User").Order("created_at DESC").Offset(offset).Limit(queryParams.Limit).Find(&tokens).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tokens"})
		return
	}

	// Convert to response format (without token values)
	response := make([]IPPTokenResponse, len(tokens))
	for i, t := range tokens {
		response[i] = IPPTokenResponse{
			ID:         t.ID,
			UserID:     t.UserID,
			Name:       t.Name,
			LastUsedAt: t.LastUsedAt,
			LastUsedIP: t.LastUsedIP,
			ExpiresAt:  t.ExpiresAt,
			IsActive:   t.IsActive,
			CreatedAt:  t.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"tokens": response,
		"total":  total,
		"page":   queryParams.Page,
		"limit":  queryParams.Limit,
	})
}

// CreateToken creates a new IPP token for the authenticated user
// @Summary Create IPP token
// @Description Create a new IPP authentication token (admin can create on behalf of user)
// @Tags tokens
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateTokenRequest true "Token creation data"
// @Success 201 {object} CreateIPPTokenResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /tokens [post]
func (h *TokenHandler) CreateToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)

	var req CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Admin can create on behalf of another user
	targetUserID := userID
	if req.UserID != "" && isAdmin {
		// Verify the target user exists
		var targetUser models.User
		if err := h.db.Where("id = ?", req.UserID).First(&targetUser).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "target user not found"})
			return
		}
		targetUserID = req.UserID
	}

	// Generate token
	tokenValue, err := models.GenerateIPPToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	token := models.IPPToken{
		UserID:   targetUserID,
		Name:     req.Name,
		Token:    tokenValue,
		IsActive: true,
	}

	// Set expiration if specified
	if req.ExpireDays > 0 {
		expires := time.Now().AddDate(0, 0, req.ExpireDays)
		token.ExpiresAt = &expires
	}

	if err := h.db.Create(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
		return
	}

	// Return with token value (only shown once)
	c.JSON(http.StatusCreated, CreateIPPTokenResponse{
		IPPTokenResponse: IPPTokenResponse{
			ID:         token.ID,
			UserID:     token.UserID,
			Name:       token.Name,
			LastUsedAt: token.LastUsedAt,
			LastUsedIP: token.LastUsedIP,
			ExpiresAt:  token.ExpiresAt,
			IsActive:   token.IsActive,
			CreatedAt:  token.CreatedAt,
		},
		Token: tokenValue,
	})
}

// GetToken returns a specific IPP token
// @Summary Get IPP token
// @Description Get details of a specific IPP token (admin can access any)
// @Tags tokens
// @Produce json
// @Security BearerAuth
// @Param id path string true "Token ID"
// @Success 200 {object} IPPTokenResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tokens/{id} [get]
func (h *TokenHandler) GetToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	tokenID := c.Param("id")

	var token models.IPPToken
	query := h.db.Where("id = ?", tokenID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.First(&token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "token not found"})
		return
	}

	c.JSON(http.StatusOK, IPPTokenResponse{
		ID:         token.ID,
		UserID:     token.UserID,
		Name:       token.Name,
		LastUsedAt: token.LastUsedAt,
		LastUsedIP: token.LastUsedIP,
		ExpiresAt:  token.ExpiresAt,
		IsActive:   token.IsActive,
		CreatedAt:  token.CreatedAt,
	})
}

// RevokeToken deactivates an IPP token
// @Summary Revoke IPP token
// @Description Revoke (deactivate) an IPP token (admin can revoke any)
// @Tags tokens
// @Produce json
// @Security BearerAuth
// @Param id path string true "Token ID"
// @Success 200 {object} MessageResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tokens/{id}/revoke [post]
func (h *TokenHandler) RevokeToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	tokenID := c.Param("id")

	var token models.IPPToken
	query := h.db.Where("id = ?", tokenID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.First(&token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "token not found"})
		return
	}

	if !token.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is already revoked"})
		return
	}

	token.IsActive = false
	if err := h.db.Save(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "token revoked"})
}

// DeleteToken permanently deletes an IPP token
// @Summary Delete IPP token
// @Description Permanently delete an IPP token (admin can delete any)
// @Tags tokens
// @Produce json
// @Security BearerAuth
// @Param id path string true "Token ID"
// @Success 200 {object} MessageResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tokens/{id} [delete]
func (h *TokenHandler) DeleteToken(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	tokenID := c.Param("id")

	query := h.db.Where("id = ?", tokenID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}
	result := query.Delete(&models.IPPToken{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "token not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "token deleted"})
}
