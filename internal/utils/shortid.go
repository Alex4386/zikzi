package utils

import (
	"crypto/rand"
	"encoding/binary"
	"sync"
	"time"
)

const (
	// Base62 alphabet for URL-safe short IDs
	alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	// Epoch: 2024-01-01 00:00:00 UTC
	epoch = 1704067200000
)

var (
	counter   uint16
	counterMu sync.Mutex
	lastMs    int64
)

// GenerateShortID generates a 12-character short ID
// Format: 7 chars timestamp (base62) + 5 chars random
// This gives ~3.5 trillion unique IDs per millisecond
func GenerateShortID() string {
	counterMu.Lock()
	now := time.Now().UnixMilli() - epoch
	if now == lastMs {
		counter++
	} else {
		counter = 0
		lastMs = now
	}
	c := counter
	counterMu.Unlock()

	// 7 characters for timestamp (base62 can represent ~3.5 trillion values)
	id := make([]byte, 12)
	for i := 6; i >= 0; i-- {
		id[i] = alphabet[now%62]
		now /= 62
	}

	// Add counter to randomness
	var randomBytes [4]byte
	rand.Read(randomBytes[:])
	random := binary.BigEndian.Uint32(randomBytes[:])
	random = (random << 16) | uint32(c)

	// 5 characters for random + counter
	for i := 11; i >= 7; i-- {
		id[i] = alphabet[random%62]
		random /= 62
	}

	return string(id)
}

// IsValidShortID checks if a string is a valid short ID format
func IsValidShortID(id string) bool {
	if len(id) != 12 {
		return false
	}
	for _, c := range id {
		valid := false
		for _, a := range alphabet {
			if c == a {
				valid = true
				break
			}
		}
		if !valid {
			return false
		}
	}
	return true
}
