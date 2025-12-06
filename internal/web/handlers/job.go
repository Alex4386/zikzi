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
// @Description Get paginated list of print jobs for the authenticated user
// @Tags jobs
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param status query string false "Filter by status (received, processing, completed, failed)"
// @Success 200 {object} ListJobsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Router /jobs [get]
func (h *JobHandler) ListJobs(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var query ListJobsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if query.Limit > 100 {
		query.Limit = 100
	}

	offset := (query.Page - 1) * query.Limit

	var jobs []models.PrintJob
	q := h.db.Where("user_id = ?", userID)

	if query.Status != "" {
		q = q.Where("status = ?", query.Status)
	}

	var total int64
	q.Model(&models.PrintJob{}).Count(&total)

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
// @Description Get details of a specific print job
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
	jobID := c.Param("id")

	var job models.PrintJob
	if err := h.db.Where("id = ? AND user_id = ?", jobID, userID).First(&job).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// DownloadJob downloads the original PostScript file
// @Summary Download original file
// @Description Download the original PostScript file for a print job
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
	jobID := c.Param("id")

	var job models.PrintJob
	if err := h.db.Where("id = ? AND user_id = ?", jobID, userID).First(&job).Error; err != nil {
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
// @Description Download the converted PDF file for a print job
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
	jobID := c.Param("id")

	var job models.PrintJob
	if err := h.db.Where("id = ? AND user_id = ?", jobID, userID).First(&job).Error; err != nil {
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
// @Description Get the thumbnail image for a print job
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
	jobID := c.Param("id")

	var job models.PrintJob
	if err := h.db.Where("id = ? AND user_id = ?", jobID, userID).First(&job).Error; err != nil {
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
// @Description Delete a print job and its associated files
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
	jobID := c.Param("id")

	var job models.PrintJob
	if err := h.db.Where("id = ? AND user_id = ?", jobID, userID).First(&job).Error; err != nil {
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
