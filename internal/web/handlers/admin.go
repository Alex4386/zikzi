package handlers

import (
	"net/http"
	"strconv"

	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// StatsResponse represents system statistics
type StatsResponse struct {
	TotalUsers    int64 `json:"total_users" example:"150"`
	TotalJobs     int64 `json:"total_jobs" example:"5000"`
	JobsToday     int64 `json:"jobs_today" example:"42"`
	TotalDataSize int64 `json:"total_data_size" example:"10737418240"`
}

// AdminJobsResponse represents admin jobs list response
type AdminJobsResponse struct {
	Jobs  []models.PrintJob `json:"jobs"`
	Total int64             `json:"total" example:"5000"`
}

// ListUsers returns all users (admin only)
// @Summary List all users
// @Description Get a list of all users in the system (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.User
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/users [get]
func (h *AdminHandler) ListUsers(c *gin.Context) {
	var users []models.User
	if err := h.db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// ListAllJobs returns all print jobs (admin only)
// @Summary List all print jobs
// @Description Get a list of all print jobs in the system (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param status query string false "Filter by status"
// @Param user_id query string false "Filter by user ID"
// @Success 200 {object} AdminJobsResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/jobs [get]
func (h *AdminHandler) ListAllJobs(c *gin.Context) {
	page := 1
	limit := 20

	if p := c.Query("page"); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			page = val
		}
	}
	if l := c.Query("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil && val > 0 && val <= 100 {
			limit = val
		}
	}

	offset := (page - 1) * limit

	var jobs []models.PrintJob
	var total int64

	query := h.db.Model(&models.PrintJob{})

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by user_id
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	query.Count(&total)

	if err := query.Preload("User").Order("created_at DESC").Offset(offset).Limit(limit).Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch jobs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":  jobs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetStats returns system statistics (admin only)
// @Summary Get system statistics
// @Description Get system-wide statistics (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} StatsResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/stats [get]
func (h *AdminHandler) GetStats(c *gin.Context) {
	var stats StatsResponse

	h.db.Model(&models.User{}).Count(&stats.TotalUsers)
	h.db.Model(&models.PrintJob{}).Count(&stats.TotalJobs)
	h.db.Model(&models.PrintJob{}).Where("DATE(created_at) = DATE('now')").Count(&stats.JobsToday)

	// Calculate total data size
	h.db.Model(&models.PrintJob{}).Select("COALESCE(SUM(file_size), 0)").Scan(&stats.TotalDataSize)

	c.JSON(http.StatusOK, stats)
}

// OrphanedJobsResponse represents orphaned jobs list response
type OrphanedJobsResponse struct {
	Jobs  []models.PrintJob `json:"jobs"`
	Total int64             `json:"total" example:"10"`
}

// AssignJobRequest represents the request to assign a job to a user
type AssignJobRequest struct {
	UserID string `json:"user_id" binding:"required" example:"ABC123def456"`
}

// ListOrphanedJobs returns all orphaned print jobs (jobs without a user)
// @Summary List orphaned print jobs
// @Description Get a list of all print jobs without an assigned user (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} OrphanedJobsResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/jobs/orphaned [get]
func (h *AdminHandler) ListOrphanedJobs(c *gin.Context) {
	var jobs []models.PrintJob
	var total int64

	// Jobs with empty user_id are orphaned
	h.db.Model(&models.PrintJob{}).Where("user_id IS NULL OR user_id = ''").Count(&total)

	if err := h.db.Where("user_id IS NULL OR user_id = ''").Order("created_at DESC").Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch orphaned jobs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":  jobs,
		"total": total,
	})
}

// GetJobAdmin returns a specific print job (admin can see any job)
// @Summary Get any print job (admin)
// @Description Get details of any print job regardless of owner (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Success 200 {object} models.PrintJob
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /admin/jobs/{id} [get]
func (h *AdminHandler) GetJobAdmin(c *gin.Context) {
	jobID := c.Param("id")

	var job models.PrintJob
	if err := h.db.Preload("User").First(&job, "id = ?", jobID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// AssignJob assigns an orphaned job to a user
// @Summary Assign job to user
// @Description Assign an orphaned print job to a specific user (admin only)
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Param request body AssignJobRequest true "User to assign"
// @Success 200 {object} models.PrintJob
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /admin/jobs/{id}/assign [post]
func (h *AdminHandler) AssignJob(c *gin.Context) {
	jobID := c.Param("id")

	var req AssignJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify user exists
	var user models.User
	if err := h.db.First(&user, "id = ?", req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Find and update the job
	var job models.PrintJob
	if err := h.db.First(&job, "id = ?", jobID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	job.UserID = req.UserID
	if err := h.db.Save(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign job"})
		return
	}

	// Reload with user data
	h.db.Preload("User").First(&job, "id = ?", jobID)

	c.JSON(http.StatusOK, job)
}

// CreateUserRequest represents the request to create a new user
type CreateUserRequest struct {
	Username    string `json:"username" binding:"required" example:"johndoe"`
	Email       string `json:"email" binding:"required,email" example:"john@example.com"`
	Password    string `json:"password" binding:"required,min=8" example:"secretpassword"`
	DisplayName string `json:"display_name" example:"John Doe"`
	IsAdmin     bool   `json:"is_admin" example:"false"`
}

// UpdateUserRequest represents the request to update a user
type AdminUpdateUserRequest struct {
	Username    string `json:"username" example:"johndoe"`
	Email       string `json:"email" binding:"omitempty,email" example:"john@example.com"`
	DisplayName string `json:"display_name" example:"John Doe"`
	IsAdmin     *bool  `json:"is_admin" example:"false"`
}

// ChangePasswordRequest represents the request to change a user's password
type AdminChangePasswordRequest struct {
	Password string `json:"password" binding:"required,min=8" example:"newsecretpassword"`
}

// CreateUser creates a new user (admin only)
// @Summary Create a new user
// @Description Create a new user account (admin only)
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateUserRequest true "User data"
// @Success 201 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /admin/users [post]
func (h *AdminHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
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
		IsAdmin:      req.IsAdmin,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// GetUser returns a specific user (admin only)
// @Summary Get a user
// @Description Get details of a specific user (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} models.User
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /admin/users/{id} [get]
func (h *AdminHandler) GetUser(c *gin.Context) {
	userID := c.Param("id")

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateUser updates a user (admin only)
// @Summary Update a user
// @Description Update a user's information (admin only)
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Param request body AdminUpdateUserRequest true "User data"
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /admin/users/{id} [put]
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	userID := c.Param("id")

	var req AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if req.Username != "" {
		user.Username = req.Username
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.DisplayName != "" {
		user.DisplayName = req.DisplayName
	}
	if req.IsAdmin != nil {
		user.IsAdmin = *req.IsAdmin
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// ChangeUserPassword changes a user's password (admin only)
// @Summary Change user password
// @Description Change a user's password (admin only)
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Param request body AdminChangePasswordRequest true "New password"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /admin/users/{id}/password [put]
func (h *AdminHandler) ChangeUserPassword(c *gin.Context) {
	userID := c.Param("id")

	var req AdminChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	passwordHash, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
		return
	}

	user.PasswordHash = passwordHash
	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password updated"})
}

// DeleteUser deletes a user (admin only)
// @Summary Delete a user
// @Description Delete a user account (admin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} map[string]string
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /admin/users/{id} [delete]
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := h.db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}
