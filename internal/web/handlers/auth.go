package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/alex4386/zikzi/internal/auth"
	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/utils"
	"github.com/alex4386/zikzi/internal/web/middleware"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type AuthHandler struct {
	config       config.AuthConfig
	db           *gorm.DB
	oidcProvider *auth.OIDCProvider
}

func NewAuthHandler(cfg config.AuthConfig, db *gorm.DB) *AuthHandler {
	oidcProvider, _ := auth.NewOIDCProvider(cfg.OIDC)
	return &AuthHandler{
		config:       cfg,
		db:           db,
		oidcProvider: oidcProvider,
	}
}

// LoginRequest represents login credentials
type LoginRequest struct {
	Username string `json:"username" binding:"required" example:"johndoe"`
	Password string `json:"password" binding:"required" example:"secretpassword"`
}

// RegisterRequest represents registration data
type RegisterRequest struct {
	Username    string `json:"username" binding:"required" example:"johndoe"`
	Email       string `json:"email" binding:"required,email" example:"john@example.com"`
	Password    string `json:"password" binding:"required,min=8" example:"secretpassword"`
	DisplayName string `json:"display_name" example:"John Doe"`
}

// TokenResponse represents the authentication token response
type TokenResponse struct {
	AccessToken  string `json:"access_token" example:"eyJhbGciOiJIUzI1NiIs..."`
	RefreshToken string `json:"refresh_token" example:"eyJhbGciOiJIUzI1NiIs..."`
	ExpiresIn    int64  `json:"expires_in" example:"86400"`
}

// RefreshRequest represents a token refresh request
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required" example:"eyJhbGciOiJIUzI1NiIs..."`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error" example:"invalid credentials"`
}

// Login authenticates a user with username and password
// @Summary Login with username and password
// @Description Authenticate user with local credentials
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login credentials"
// @Success 200 {object} TokenResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	if !h.config.AllowLocal {
		c.JSON(http.StatusForbidden, gin.H{"error": "local login disabled"})
		return
	}

	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if !utils.VerifyPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.generateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, token)
}

// Register creates a new user account
// @Summary Register a new user
// @Description Create a new user account with local credentials
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Registration data"
// @Success 201 {object} TokenResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	if !h.config.AllowLocal {
		c.JSON(http.StatusForbidden, gin.H{"error": "local registration disabled"})
		return
	}

	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	passwordHash, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
		return
	}

	user := models.User{
		Username:     req.Username,
		Email:        req.Email,
		DisplayName:  req.DisplayName,
		PasswordHash: passwordHash,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}

	token, err := h.generateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, token)
}

// OIDCLogin initiates OIDC authentication
// @Summary Initiate OIDC login
// @Description Redirect to OIDC provider for authentication
// @Tags auth
// @Param redirect query string false "URL to redirect after login"
// @Success 307 {string} string "Redirect to OIDC provider"
// @Failure 404 {object} ErrorResponse
// @Router /auth/oidc/login [get]
func (h *AuthHandler) OIDCLogin(c *gin.Context) {
	if !h.config.OIDC.Enabled || h.oidcProvider == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "OIDC not configured"})
		return
	}

	redirectAfter := c.Query("redirect")
	if redirectAfter == "" {
		redirectAfter = "/ui"
	}

	authURL, _, err := h.oidcProvider.GenerateAuthURL(redirectAfter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate auth URL"})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// OIDCCallback handles OIDC provider callback
// @Summary OIDC callback handler
// @Description Handle callback from OIDC provider after authentication
// @Tags auth
// @Param code query string true "Authorization code"
// @Param state query string true "State parameter"
// @Success 307 {string} string "Redirect to UI with token"
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /auth/oidc/callback [get]
func (h *AuthHandler) OIDCCallback(c *gin.Context) {
	if !h.config.OIDC.Enabled || h.oidcProvider == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "OIDC not configured"})
		return
	}

	state := c.Query("state")
	code := c.Query("code")

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing authorization code"})
		return
	}

	redirectURL, valid := h.oidcProvider.ValidateState(state)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired state"})
		return
	}

	claims, err := h.oidcProvider.ExchangeCode(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "failed to verify identity"})
		return
	}

	// Check ACL before allowing access
	if !h.checkACL(claims) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: user not in allowed ACL"})
		return
	}

	// Find or create user
	var user models.User
	result := h.db.Where("oidc_subject = ? AND oidc_provider = ?", claims.Subject, h.config.OIDC.ProviderURL).First(&user)

	if result.Error == gorm.ErrRecordNotFound {
		// Check if auto-creation is enabled
		if !h.config.OIDC.AutoCreateUsers {
			c.JSON(http.StatusForbidden, gin.H{"error": "account registration via OIDC is disabled"})
			return
		}

		// Create new user
		username := claims.PreferredUsername
		if username == "" {
			username = claims.Email
		}

		user = models.User{
			Username:     username,
			Email:        claims.Email,
			DisplayName:  claims.Name,
			OIDCSubject:  claims.Subject,
			OIDCProvider: h.config.OIDC.ProviderURL,
		}

		if err := h.db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
	} else if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	} else {
		// Update existing user info
		user.Email = claims.Email
		user.DisplayName = claims.Name
		h.db.Save(&user)
	}

	token, err := h.generateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Redirect with token (in production, use secure cookie or fragment)
	c.Redirect(http.StatusTemporaryRedirect, redirectURL+"?token="+token.AccessToken)
}

// RefreshToken refreshes an access token
// @Summary Refresh access token
// @Description Get new access token using refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RefreshRequest true "Refresh token"
// @Success 200 {object} TokenResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.config.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	newToken, err := h.generateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, newToken)
}

// checkACL validates if the user is allowed based on ACL configuration
func (h *AuthHandler) checkACL(claims *auth.OIDCClaims) bool {
	acl := h.config.OIDC.ACL

	// If all ACL lists are empty, ACL is disabled - allow all authenticated users
	if len(acl.Users) == 0 && len(acl.Groups) == 0 && len(acl.Domains) == 0 {
		return true
	}

	// Check if user email is in allowed users list
	for _, allowedUser := range acl.Users {
		if strings.EqualFold(claims.Email, allowedUser) {
			return true
		}
	}

	// Check if user's email domain is in allowed domains list
	if emailParts := strings.Split(claims.Email, "@"); len(emailParts) == 2 {
		domain := strings.ToLower(emailParts[1])
		for _, allowedDomain := range acl.Domains {
			if strings.EqualFold(domain, allowedDomain) {
				return true
			}
		}
	}

	// Check if user belongs to any allowed groups
	for _, userGroup := range claims.Groups {
		for _, allowedGroup := range acl.Groups {
			if userGroup == allowedGroup {
				return true
			}
		}
	}

	// No ACL match found
	return false
}

func (h *AuthHandler) generateToken(user *models.User) (*TokenResponse, error) {
	expiresAt := time.Now().Add(24 * time.Hour)

	claims := middleware.Claims{
		UserID:  user.ID,
		IsAdmin: user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.Username,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.config.JWTSecret))
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken: tokenString,
		ExpiresIn:   int64(24 * time.Hour / time.Second),
	}, nil
}
