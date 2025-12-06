package models

import (
	"time"

	"github.com/alex4386/zikzi/internal/utils"
	"gorm.io/gorm"
)

type IPRegistration struct {
	ID        string         `gorm:"type:varchar(12);primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID string `gorm:"type:varchar(12);index" json:"user_id"`
	User   *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`

	IPAddress   string     `gorm:"uniqueIndex;not null" json:"ip_address"`
	Description string     `json:"description"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	IsActive    bool       `gorm:"default:true" json:"is_active"`
}

func (r *IPRegistration) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = utils.GenerateShortID()
	}
	return nil
}
