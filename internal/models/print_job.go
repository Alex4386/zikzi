package models

import (
	"time"

	"github.com/alex4386/zikzi/internal/utils"
	"gorm.io/gorm"
)

type PrintJob struct {
	ID        string         `gorm:"type:varchar(12);primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID string `gorm:"type:varchar(12);index" json:"user_id"`
	User   *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`

	// Client information from PostScript metadata
	SourceIP     string `gorm:"index" json:"source_ip"`
	Hostname     string `json:"hostname"`
	DocumentName string `json:"document_name"`
	AppName      string `json:"app_name"`
	OSVersion    string `json:"os_version"`

	// File info
	OriginalFile  string `json:"original_file"`  // Path to stored PostScript
	PDFFile       string `json:"pdf_file"`       // Path to generated PDF
	ThumbnailFile string `json:"thumbnail_file"` // Path to thumbnail image

	// Job metadata
	PageCount int    `json:"page_count"`
	FileSize  int64  `json:"file_size"`
	Status    string `gorm:"index;default:received" json:"status"` // received, processing, completed, failed

	ProcessedAt *time.Time `json:"processed_at,omitempty"`
	Error       string     `json:"error,omitempty"`
}

func (j *PrintJob) BeforeCreate(tx *gorm.DB) error {
	if j.ID == "" {
		j.ID = utils.GenerateShortID()
	}
	return nil
}

const (
	JobStatusReceived   = "received"
	JobStatusProcessing = "processing"
	JobStatusCompleted  = "completed"
	JobStatusFailed     = "failed"
)
