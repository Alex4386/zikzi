package models

import (
	"crypto/rand"
	"crypto/subtle"
	"time"

	"github.com/alex4386/zikzi/internal/utils"
	"gorm.io/gorm"
)

// Base58 alphabet (no 0, O, I, l to avoid confusion)
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// IPPToken represents an authentication token for IPP printing
type IPPToken struct {
	ID        string         `gorm:"type:varchar(12);primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID     string     `gorm:"type:varchar(12);index;not null" json:"user_id"`
	User       User       `gorm:"foreignKey:UserID" json:"-"`
	Name       string     `gorm:"not null" json:"name"` // Human-readable token name
	Token      string     `gorm:"not null" json:"-"`    // Plaintext token value (for Digest auth compatibility)
	LastUsedAt *time.Time `json:"last_used_at"`         // Track last usage
	LastUsedIP string     `json:"last_used_ip"`         // Track last IP
	ExpiresAt  *time.Time `json:"expires_at"`           // Optional expiration
	IsActive   bool       `gorm:"default:true;not null" json:"is_active"`
}

func (t *IPPToken) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = utils.GenerateShortID()
	}
	return nil
}

// IsExpired checks if the token has expired
func (t *IPPToken) IsExpired() bool {
	if t.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*t.ExpiresAt)
}

// IsValid checks if the token is active and not expired
func (t *IPPToken) IsValid() bool {
	return t.IsActive && !t.IsExpired()
}

// GenerateIPPToken generates a new random token string using base58 encoding
func GenerateIPPToken() (string, error) {
	// Generate 32 random characters from base58 alphabet
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}

	// Convert random bytes to base58 characters
	result := make([]byte, 32)
	for i, b := range tokenBytes {
		result[i] = base58Alphabet[int(b)%len(base58Alphabet)]
	}
	return string(result), nil
}

// VerifyIPPToken checks if the provided token matches using constant-time comparison
func VerifyIPPToken(storedToken, providedToken string) bool {
	return subtle.ConstantTimeCompare([]byte(storedToken), []byte(providedToken)) == 1
}
