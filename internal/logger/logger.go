package logger

import (
	"io"
	"log"
	"os"
	"strings"
)

// Level represents log severity levels
type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

var (
	currentLevel = LevelInfo

	debugLogger = log.New(os.Stdout, "[DEBUG] ", log.LstdFlags)
	infoLogger  = log.New(os.Stdout, "[INFO] ", log.LstdFlags)
	warnLogger  = log.New(os.Stdout, "[WARN] ", log.LstdFlags)
	errorLogger = log.New(os.Stderr, "[ERROR] ", log.LstdFlags)
)

// SetLevel sets the minimum log level from a string
func SetLevel(level string) {
	switch strings.ToLower(level) {
	case "debug":
		currentLevel = LevelDebug
	case "info":
		currentLevel = LevelInfo
	case "warn", "warning":
		currentLevel = LevelWarn
	case "error":
		currentLevel = LevelError
	default:
		currentLevel = LevelInfo
	}
	updateLoggers()
}

func updateLoggers() {
	if currentLevel > LevelDebug {
		debugLogger.SetOutput(io.Discard)
	} else {
		debugLogger.SetOutput(os.Stdout)
	}
	if currentLevel > LevelInfo {
		infoLogger.SetOutput(io.Discard)
	} else {
		infoLogger.SetOutput(os.Stdout)
	}
	if currentLevel > LevelWarn {
		warnLogger.SetOutput(io.Discard)
	} else {
		warnLogger.SetOutput(os.Stdout)
	}
}

// Debug logs a debug message
func Debug(format string, v ...interface{}) {
	debugLogger.Printf(format, v...)
}

// Info logs an info message
func Info(format string, v ...interface{}) {
	infoLogger.Printf(format, v...)
}

// Warn logs a warning message
func Warn(format string, v ...interface{}) {
	warnLogger.Printf(format, v...)
}

// Error logs an error message
func Error(format string, v ...interface{}) {
	errorLogger.Printf(format, v...)
}

// Fatal logs an error message and exits
func Fatal(format string, v ...interface{}) {
	errorLogger.Fatalf(format, v...)
}
