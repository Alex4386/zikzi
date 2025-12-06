package utils

import (
	"os"
	"path/filepath"
)

// DeleteJobFiles removes all files associated with a print job
func DeleteJobFiles(originalFile, pdfFile, thumbnailFile string) []error {
	var errors []error

	files := []string{originalFile, pdfFile, thumbnailFile}

	for _, file := range files {
		if file == "" {
			continue
		}

		if err := os.Remove(file); err != nil && !os.IsNotExist(err) {
			errors = append(errors, err)
		}
	}

	return errors
}

// EnsureDir creates a directory if it doesn't exist
func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// GetJobDir returns the directory path for storing job files
func GetJobDir(basePath string, jobID uint) string {
	return filepath.Join(basePath, "jobs")
}

// SanitizeFilename removes potentially dangerous characters from filenames
func SanitizeFilename(name string) string {
	// Replace path separators and null bytes
	replacer := func(r rune) rune {
		switch r {
		case '/', '\\', '\x00', ':', '*', '?', '"', '<', '>', '|':
			return '_'
		}
		return r
	}

	sanitized := []rune(name)
	for i, r := range sanitized {
		sanitized[i] = replacer(r)
	}

	return string(sanitized)
}
