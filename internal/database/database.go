package database

import (
	"fmt"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Connect(cfg config.DatabaseConfig) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.Driver {
	case "sqlite":
		dialector = sqlite.Open(cfg.DSN)
	case "postgres":
		dialector = postgres.Open(cfg.DSN)
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", cfg.Driver)
	}

	db, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&models.User{},
		&models.PrintJob{},
		&models.IPRegistration{},
		&models.IPPToken{},
	); err != nil {
		return err
	}

	// Migration: Set AllowIPPPassword to true for existing users where it's not set
	// This handles the case where the column was added to existing users
	db.Model(&models.User{}).Where("allow_ipp_password = ?", false).Update("allow_ipp_password", true)

	return nil
}
