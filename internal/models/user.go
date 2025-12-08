package models

import (
	"time"

	"github.com/alex4386/zikzi/internal/utils"
	"gorm.io/gorm"
)

type User struct {
	ID        string         `gorm:"type:varchar(12);primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Username    string `gorm:"uniqueIndex;not null" json:"username"`
	Email       string `gorm:"uniqueIndex" json:"email"`
	DisplayName string `json:"display_name"`

	// Local auth (optional)
	PasswordHash string `json:"-"`

	// OIDC fields
	OIDCSubject  string `gorm:"column:oidc_subject;index" json:"-"`
	OIDCProvider string `gorm:"column:oidc_provider" json:"-"`

	// Relations
	PrintJobs       []PrintJob       `gorm:"foreignKey:UserID" json:"-"`
	IPRegistrations []IPRegistration `gorm:"foreignKey:UserID" json:"-"`

	IsAdmin bool `gorm:"default:false" json:"is_admin"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = utils.GenerateShortID()
	}
	return nil
}
