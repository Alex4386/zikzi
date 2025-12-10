package cmd

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/database"
	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/utils"
	"github.com/spf13/cobra"
	"golang.org/x/term"
	"gorm.io/gorm"
)

var usersCmd = &cobra.Command{
	Use:   "users",
	Short: "Manage users",
	Long:  `Commands for managing Zikzi users.`,
}

var usersAddCmd = &cobra.Command{
	Use:   "add",
	Short: "Add a new user",
	Long:  `Add a new user to the Zikzi system.`,
	Run:   runUsersAdd,
}

var usersListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all users",
	Long:  `List all users in the Zikzi system.`,
	Run:   runUsersList,
}

var usersDeleteCmd = &cobra.Command{
	Use:   "delete <username>",
	Short: "Delete a user",
	Long:  `Delete a user from the Zikzi system.`,
	Args:  cobra.ExactArgs(1),
	Run:   runUsersDelete,
}

var usersSetAdminCmd = &cobra.Command{
	Use:   "set-admin <username> <true|false>",
	Short: "Set admin status for a user",
	Long:  `Set or revoke admin privileges for a user.`,
	Args:  cobra.ExactArgs(2),
	Run:   runUsersSetAdmin,
}

var usersSetPasswordCmd = &cobra.Command{
	Use:   "set-password <username>",
	Short: "Set password for a user",
	Long:  `Change the password for an existing user.`,
	Args:  cobra.ExactArgs(1),
	Run:   runUsersSetPassword,
}

var setPasswordValue string

// Flags for users add command
var (
	addUsername    string
	addEmail       string
	addDisplayName string
	addPassword    string
	addIsAdmin     bool
)

func init() {
	rootCmd.AddCommand(usersCmd)
	usersCmd.AddCommand(usersAddCmd)
	usersCmd.AddCommand(usersListCmd)
	usersCmd.AddCommand(usersDeleteCmd)
	usersCmd.AddCommand(usersSetAdminCmd)
	usersCmd.AddCommand(usersSetPasswordCmd)

	usersAddCmd.Flags().StringVarP(&addUsername, "username", "u", "", "Username (required)")
	usersSetPasswordCmd.Flags().StringVarP(&setPasswordValue, "password", "p", "", "New password (will prompt if not provided)")
	usersAddCmd.Flags().StringVarP(&addEmail, "email", "e", "", "Email address")
	usersAddCmd.Flags().StringVarP(&addDisplayName, "display-name", "d", "", "Display name")
	usersAddCmd.Flags().StringVarP(&addPassword, "password", "p", "", "Password (will prompt if not provided)")
	usersAddCmd.Flags().BoolVar(&addIsAdmin, "admin", false, "Create as admin user")
}

func getDB() (*gorm.DB, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	db, err := database.Connect(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := database.Migrate(db); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return db, nil
}

func promptPassword() (string, error) {
	fmt.Print("Password: ")
	password, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	if err != nil {
		return "", err
	}

	fmt.Print("Confirm password: ")
	confirm, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	if err != nil {
		return "", err
	}

	if string(password) != string(confirm) {
		return "", fmt.Errorf("passwords do not match")
	}

	return string(password), nil
}

func promptString(prompt string) string {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(prompt)
	input, _ := reader.ReadString('\n')
	return strings.TrimSpace(input)
}

func runUsersAdd(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	// Prompt for username if not provided
	username := addUsername
	if username == "" {
		username = promptString("Username: ")
		if username == "" {
			log.Fatal("Username is required")
		}
	}

	// Check if user already exists
	var existing models.User
	if err := db.Where("username = ?", username).First(&existing).Error; err == nil {
		log.Fatalf("User '%s' already exists", username)
	}

	// Prompt for password if not provided
	password := addPassword
	if password == "" {
		password, err = promptPassword()
		if err != nil {
			log.Fatalf("Password error: %v", err)
		}
	}

	if len(password) < 6 {
		log.Fatal("Password must be at least 6 characters")
	}

	// Hash password
	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Load config to get IPP auth realm
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Compute DigestHA1 for HTTP Digest authentication
	digestHA1 := utils.ComputeDigestHA1(username, cfg.IPP.Auth.Realm, password)

	// Use display name from flag or default to username
	displayName := addDisplayName
	if displayName == "" {
		displayName = username
	}

	// Create user
	user := models.User{
		Username:     username,
		Email:        addEmail,
		DisplayName:  displayName,
		PasswordHash: passwordHash,
		DigestHA1:    digestHA1,
		IsAdmin:      addIsAdmin,
	}

	if err := db.Create(&user).Error; err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}

	adminStr := ""
	if addIsAdmin {
		adminStr = " (admin)"
	}
	fmt.Printf("User '%s' created successfully%s\n", username, adminStr)
}

func runUsersList(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var users []models.User
	if err := db.Find(&users).Error; err != nil {
		log.Fatalf("Failed to list users: %v", err)
	}

	if len(users) == 0 {
		fmt.Println("No users found")
		return
	}

	fmt.Printf("%-12s %-20s %-30s %-20s %-5s\n", "ID", "Username", "Email", "Display Name", "Admin")
	fmt.Println(strings.Repeat("-", 95))
	for _, u := range users {
		adminStr := "No"
		if u.IsAdmin {
			adminStr = "Yes"
		}
		email := u.Email
		if email == "" {
			email = "-"
		}
		fmt.Printf("%-12s %-20s %-30s %-20s %-5s\n", u.ID, u.Username, email, u.DisplayName, adminStr)
	}
}

func runUsersDelete(cmd *cobra.Command, args []string) {
	username := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	// Confirm deletion
	confirm := promptString(fmt.Sprintf("Are you sure you want to delete user '%s'? (yes/no): ", username))
	if strings.ToLower(confirm) != "yes" {
		fmt.Println("Cancelled")
		return
	}

	if err := db.Delete(&user).Error; err != nil {
		log.Fatalf("Failed to delete user: %v", err)
	}

	fmt.Printf("User '%s' deleted successfully\n", username)
}

func runUsersSetAdmin(cmd *cobra.Command, args []string) {
	username := args[0]
	adminStr := strings.ToLower(args[1])

	var isAdmin bool
	switch adminStr {
	case "true", "yes", "1":
		isAdmin = true
	case "false", "no", "0":
		isAdmin = false
	default:
		log.Fatalf("Invalid value '%s': use true/false, yes/no, or 1/0", adminStr)
	}

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	user.IsAdmin = isAdmin
	if err := db.Save(&user).Error; err != nil {
		log.Fatalf("Failed to update user: %v", err)
	}

	if isAdmin {
		fmt.Printf("User '%s' is now an admin\n", username)
	} else {
		fmt.Printf("User '%s' is no longer an admin\n", username)
	}
}

func runUsersSetPassword(cmd *cobra.Command, args []string) {
	username := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	// Prompt for password if not provided
	password := setPasswordValue
	if password == "" {
		password, err = promptPassword()
		if err != nil {
			log.Fatalf("Password error: %v", err)
		}
	}

	if len(password) < 6 {
		log.Fatal("Password must be at least 6 characters")
	}

	// Hash password
	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Load config to get IPP auth realm
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Compute DigestHA1 for HTTP Digest authentication
	digestHA1 := utils.ComputeDigestHA1(username, cfg.IPP.Auth.Realm, password)

	user.PasswordHash = passwordHash
	user.DigestHA1 = digestHA1
	if err := db.Save(&user).Error; err != nil {
		log.Fatalf("Failed to update password: %v", err)
	}

	fmt.Printf("Password updated for user '%s'\n", username)
}
