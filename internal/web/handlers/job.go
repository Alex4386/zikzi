package handlers

import (
	"net/http"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/utils"
	"github.com/alex4386/zikzi/internal/web/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type JobHandler struct {
	db      *gorm.DB
	storage config.StorageConfig
}

func NewJobHandler(db *gorm.DB, storage config.StorageConfig) *JobHandler {
	return &JobHandler{db: db, storage: storage}
}

// ListJobsQuery represents query parameters for listing jobs
type ListJobsQuery struct {
	Page   int    `form:"page,default=1" example:"1"`
	Limit  int    `form:"limit,default=20" example:"20"`
	Status string `form:"status" example:"completed"`
	UserID string `form:"user_id" example:"abc123"` // Admin only: filter by user
	Full   bool   `form:"full" example:"false"`     // Admin only: show all jobs
}

// ListJobsResponse represents the paginated jobs response
type ListJobsResponse struct {
	Jobs  []models.PrintJob `json:"jobs"`
	Total int64             `json:"total" example:"100"`
	Page  int               `json:"page" example:"1"`
	Limit int               `json:"limit" example:"20"`
}

// MessageResponse represents a simple message response
type MessageResponse struct {
	Message string `json:"message" example:"job deleted"`
}

// ListJobs returns paginated print jobs for the authenticated user
// @Summary List print jobs
// @Description Get paginated list of print jobs for the authenticated user. Admins can use full=true to see all jobs.
// @Tags jobs
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param status query string false "Filter by status (received, processing, completed, failed)"
// @Param user_id query string false "Filter by user ID (admin only, requires full=true)"
// @Param full query bool false "Show all jobs (admin only)"
// @Success 200 {object} ListJobsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /jobs [get]
func (h *JobHandler) ListJobs(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)

	var query ListJobsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// full=true requires admin
	if query.Full && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	if query.Limit > 100 {
		query.Limit = 100
	}

	offset := (query.Page - 1) * query.Limit

	var jobs []models.PrintJob
	var q *gorm.DB

	if query.Full && isAdmin {
		// Admin mode: show all jobs
		q = h.db.Model(&models.PrintJob{})
		if query.UserID != "" {
			q = q.Where("user_id = ?", query.UserID)
		}
	} else {
		// Regular mode: show only user's jobs
		q = h.db.Where("user_id = ?", userID)
	}

	if query.Status != "" {
		q = q.Where("status = ?", query.Status)
	}

	var total int64
	q.Model(&models.PrintJob{}).Count(&total)

	// Preload user for admin full mode
	if query.Full && isAdmin {
		q = q.Preload("User")
	}

	if err := q.Order("created_at DESC").Offset(offset).Limit(query.Limit).Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch jobs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":  jobs,
		"total": total,
		"page":  query.Page,
		"limit": query.Limit,
	})
}

// GetJob returns a specific print job
// @Summary Get print job
// @Description Get details of a specific print job (admins can access any job)
// @Tags jobs
// @Produce json
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Success 200 {object} models.PrintJob
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /jobs/{id} [get]
func (h *JobHandler) GetJob(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	jobID := c.Param("id")

	var job models.PrintJob
	query := h.db.Preload("User")
	if isAdmin {
		// Admin can access any job
		query = query.Where("id = ?", jobID)
	} else {
		// Regular users can only access their own jobs
		query = query.Where("id = ? AND user_id = ?", jobID, userID)
	}

	if err := query.First(&job).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// DownloadJob downloads the original PostScript file
// @Summary Download original file
// @Description Download the original PostScript file for a print job (admins can access any job)
// @Tags jobs
// @Produce application/octet-stream
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Success 200 {file} binary
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /jobs/{id}/download [get]
func (h *JobHandler) DownloadJob(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	jobID := c.Param("id")

	var job models.PrintJob
	query := h.db
	if isAdmin {
		query = query.Where("id = ?", jobID)
	} else {
		query = query.Where("id = ? AND user_id = ?", jobID, userID)
	}

	if err := query.First(&job).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	if job.OriginalFile == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	c.File(job.OriginalFile)
}

// DownloadPDF downloads the converted PDF file
// @Summary Download PDF
// @Description Download the converted PDF file for a print job (admins can access any job)
// @Tags jobs
// @Produce application/pdf
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Success 200 {file} binary
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /jobs/{id}/pdf [get]
func (h *JobHandler) DownloadPDF(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	jobID := c.Param("id")

	var job models.PrintJob
	query := h.db
	if isAdmin {
		query = query.Where("id = ?", jobID)
	} else {
		query = query.Where("id = ? AND user_id = ?", jobID, userID)
	}

	if err := query.First(&job).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	if job.PDFFile == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "PDF not available"})
		return
	}

	c.File(job.PDFFile)
}

// GetThumbnail returns the thumbnail image for a print job
// @Summary Get thumbnail
// @Description Get the thumbnail image for a print job (admins can access any job)
// @Tags jobs
// @Produce image/png
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Success 200 {file} binary
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /jobs/{id}/thumbnail [get]
func (h *JobHandler) GetThumbnail(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	jobID := c.Param("id")

	var job models.PrintJob
	query := h.db
	if isAdmin {
		query = query.Where("id = ?", jobID)
	} else {
		query = query.Where("id = ? AND user_id = ?", jobID, userID)
	}

	if err := query.First(&job).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	if job.ThumbnailFile == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "thumbnail not available"})
		return
	}

	c.File(job.ThumbnailFile)
}

// DeleteJob deletes a print job and its associated files
// @Summary Delete print job
// @Description Delete a print job and its associated files (admins can delete any job)
// @Tags jobs
// @Produce json
// @Security BearerAuth
// @Param id path string true "Job ID"
// @Success 200 {object} MessageResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /jobs/{id} [delete]
func (h *JobHandler) DeleteJob(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isAdmin := middleware.IsAdmin(c)
	jobID := c.Param("id")

	var job models.PrintJob
	query := h.db
	if isAdmin {
		query = query.Where("id = ?", jobID)
	} else {
		query = query.Where("id = ? AND user_id = ?", jobID, userID)
	}

	if err := query.First(&job).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	// Delete associated files
	utils.DeleteJobFiles(job.OriginalFile, job.PDFFile, job.ThumbnailFile)

	// Delete database record
	if err := h.db.Delete(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete job"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "job deleted"})
}

// ListOrphanedJobs returns all orphaned print jobs (jobs without a user) - admin only
// @Summary List orphaned print jobs
// @Description Get a list of all print jobs without an assigned user (admin only)
// @Tags jobs
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} ListJobsResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /jobs/orphaned [get]
func (h *JobHandler) ListOrphanedJobs(c *gin.Context) {
	if !middleware.IsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	var query ListJobsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if query.Limit > 100 {
		query.Limit = 100
	}
	if query.Limit == 0 {
		query.Limit = 20
	}
	if query.Page == 0 {
		query.Page = 1
	}

	offset := (query.Page - 1) * query.Limit

	var jobs []models.PrintJob
	var total int64

	// Jobs with empty user_id are orphaned
	q := h.db.Model(&models.PrintJob{}).Where("user_id IS NULL OR user_id = ''")
	q.Count(&total)

	if err := q.Order("created_at DESC").Offset(offset).Limit(query.Limit).Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch orphaned jobs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":  jobs,
		"total": total,
		"page":  query.Page,
		"limit": query.Limit,
	})
}

// AssignJob assigns an orphaned job to a user - admin only
// @Summary Assign job to user
// @Description Assign a print job to a specific user (admin only)
// @Tags jobs
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
// @Router /jobs/{id}/assign [post]
func (h *JobHandler) AssignJob(c *gin.Context) {
	if !middleware.IsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

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
