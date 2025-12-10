package cmd

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/alex4386/zikzi/internal/models"
	"github.com/spf13/cobra"
)

var tokensCmd = &cobra.Command{
	Use:   "tokens",
	Short: "Manage IPP authentication tokens",
	Long:  `Commands for managing IPP authentication tokens for printer access.`,
}

var tokensListCmd = &cobra.Command{
	Use:   "list <username>",
	Short: "List tokens for a user",
	Long:  `List all IPP tokens for a specific user.`,
	Args:  cobra.ExactArgs(1),
	Run:   runTokensList,
}

var tokensCreateCmd = &cobra.Command{
	Use:   "create <username>",
	Short: "Create a new IPP token",
	Long: `Create a new IPP authentication token for a user.
The token will be displayed only once - save it securely.

The token can be used for:
- HTTP Basic authentication: username + token as password
- HTTP Digest authentication: username + token as password (if DigestHA1 computed)`,
	Args: cobra.ExactArgs(1),
	Run:  runTokensCreate,
}

var tokensRevokeCmd = &cobra.Command{
	Use:   "revoke <token-id>",
	Short: "Revoke an IPP token",
	Long:  `Revoke (deactivate) an IPP token. The token will no longer be usable.`,
	Args:  cobra.ExactArgs(1),
	Run:   runTokensRevoke,
}

var tokensDeleteCmd = &cobra.Command{
	Use:   "delete <token-id>",
	Short: "Delete an IPP token",
	Long:  `Permanently delete an IPP token from the database.`,
	Args:  cobra.ExactArgs(1),
	Run:   runTokensDelete,
}

// Flags for tokens create command
var (
	tokenName       string
	tokenExpireDays int
)

func init() {
	rootCmd.AddCommand(tokensCmd)
	tokensCmd.AddCommand(tokensListCmd)
	tokensCmd.AddCommand(tokensCreateCmd)
	tokensCmd.AddCommand(tokensRevokeCmd)
	tokensCmd.AddCommand(tokensDeleteCmd)

	tokensCreateCmd.Flags().StringVarP(&tokenName, "name", "n", "", "Token name/description (required)")
	tokensCreateCmd.Flags().IntVarP(&tokenExpireDays, "expires", "e", 0, "Days until expiration (0 = never)")
	tokensCreateCmd.MarkFlagRequired("name")
}

func runTokensList(cmd *cobra.Command, args []string) {
	username := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	// Find user
	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	// Get tokens for user
	var tokens []models.IPPToken
	if err := db.Where("user_id = ?", user.ID).Find(&tokens).Error; err != nil {
		log.Fatalf("Failed to list tokens: %v", err)
	}

	if len(tokens) == 0 {
		fmt.Printf("No tokens found for user '%s'\n", username)
		return
	}

	fmt.Printf("Tokens for user '%s':\n\n", username)
	fmt.Printf("%-12s %-20s %-8s %-20s %-20s\n", "ID", "Name", "Active", "Last Used", "Expires")
	fmt.Println(strings.Repeat("-", 85))

	for _, t := range tokens {
		activeStr := "Yes"
		if !t.IsActive {
			activeStr = "No"
		}

		lastUsed := "-"
		if t.LastUsedAt != nil {
			lastUsed = t.LastUsedAt.Format("2006-01-02 15:04")
		}

		expires := "Never"
		if t.ExpiresAt != nil {
			if t.IsExpired() {
				expires = "Expired"
			} else {
				expires = t.ExpiresAt.Format("2006-01-02")
			}
		}

		fmt.Printf("%-12s %-20s %-8s %-20s %-20s\n",
			t.ID, truncateString(t.Name, 20), activeStr, lastUsed, expires)
	}
}

func runTokensCreate(cmd *cobra.Command, args []string) {
	username := args[0]

	if tokenName == "" {
		log.Fatal("Token name is required (use --name)")
	}

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	// Find user
	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	// Generate token
	tokenValue, err := models.GenerateIPPToken()
	if err != nil {
		log.Fatalf("Failed to generate token: %v", err)
	}

	// Create token record (store plaintext for Digest auth compatibility)
	token := models.IPPToken{
		UserID:   user.ID,
		Name:     tokenName,
		Token:    tokenValue,
		IsActive: true,
	}

	// Set expiration if specified
	if tokenExpireDays > 0 {
		expires := time.Now().AddDate(0, 0, tokenExpireDays)
		token.ExpiresAt = &expires
	}

	if err := db.Create(&token).Error; err != nil {
		log.Fatalf("Failed to create token: %v", err)
	}

	fmt.Println("Token created successfully!")
	fmt.Println()
	fmt.Println("=== IMPORTANT: Save this token now - it will not be shown again ===")
	fmt.Println()
	fmt.Printf("Token ID:   %s\n", token.ID)
	fmt.Printf("Token Name: %s\n", token.Name)
	fmt.Printf("Username:   %s\n", username)
	fmt.Printf("Token:      %s\n", tokenValue)
	fmt.Println()
	fmt.Println("To use this token for IPP printing:")
	fmt.Printf("  Username: %s\n", username)
	fmt.Printf("  Password: %s\n", tokenValue)
	fmt.Println()
	if token.ExpiresAt != nil {
		fmt.Printf("Expires: %s\n", token.ExpiresAt.Format("2006-01-02"))
	} else {
		fmt.Println("Expires: Never")
	}
}

func runTokensRevoke(cmd *cobra.Command, args []string) {
	tokenID := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var token models.IPPToken
	if err := db.Where("id = ?", tokenID).First(&token).Error; err != nil {
		log.Fatalf("Token '%s' not found", tokenID)
	}

	if !token.IsActive {
		fmt.Printf("Token '%s' is already revoked\n", tokenID)
		return
	}

	token.IsActive = false
	if err := db.Save(&token).Error; err != nil {
		log.Fatalf("Failed to revoke token: %v", err)
	}

	fmt.Printf("Token '%s' (%s) has been revoked\n", tokenID, token.Name)
}

func runTokensDelete(cmd *cobra.Command, args []string) {
	tokenID := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var token models.IPPToken
	if err := db.Where("id = ?", tokenID).First(&token).Error; err != nil {
		log.Fatalf("Token '%s' not found", tokenID)
	}

	// Confirm deletion
	confirm := promptString(fmt.Sprintf("Are you sure you want to delete token '%s' (%s)? (yes/no): ", tokenID, token.Name))
	if strings.ToLower(confirm) != "yes" {
		fmt.Println("Cancelled")
		return
	}

	if err := db.Delete(&token).Error; err != nil {
		log.Fatalf("Failed to delete token: %v", err)
	}

	fmt.Printf("Token '%s' deleted successfully\n", tokenID)
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
