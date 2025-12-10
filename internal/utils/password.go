package utils

import (
	"crypto/md5"
	"encoding/hex"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

// HashPassword generates a bcrypt hash of the password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// VerifyPassword checks if the provided password matches the hash
func VerifyPassword(hash, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ComputeDigestHA1 computes MD5(username:realm:password) for HTTP Digest authentication
func ComputeDigestHA1(username, realm, password string) string {
	h := md5.Sum([]byte(username + ":" + realm + ":" + password))
	return hex.EncodeToString(h[:])
}
