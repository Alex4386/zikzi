package cmd

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/alex4386/zikzi/internal/models"
	"github.com/spf13/cobra"
)

var ipCmd = &cobra.Command{
	Use:   "ip",
	Short: "Manage IP registrations",
	Long:  `Commands for managing IP address registrations for user identification.`,
}

var ipListCmd = &cobra.Command{
	Use:   "list",
	Short: "List IP registrations",
	Long:  `List all IP address registrations.`,
	Run:   runIPList,
}

var ipAddCmd = &cobra.Command{
	Use:   "add <ip-address> <username>",
	Short: "Register an IP address",
	Long:  `Register an IP address for a user to enable automatic print job attribution.`,
	Args:  cobra.ExactArgs(2),
	Run:   runIPAdd,
}

var ipDeleteCmd = &cobra.Command{
	Use:   "delete <ip-address>",
	Short: "Delete an IP registration",
	Long:  `Remove an IP address registration.`,
	Args:  cobra.ExactArgs(1),
	Run:   runIPDelete,
}

var ipToggleCmd = &cobra.Command{
	Use:   "toggle <ip-address>",
	Short: "Toggle IP registration active status",
	Long:  `Enable or disable an IP registration without deleting it.`,
	Args:  cobra.ExactArgs(1),
	Run:   runIPToggle,
}

// Flags
var (
	ipAddDescription string
	ipAddExpireDays  int
	ipListUser       string
	ipListActive     string
)

func init() {
	rootCmd.AddCommand(ipCmd)
	ipCmd.AddCommand(ipListCmd)
	ipCmd.AddCommand(ipAddCmd)
	ipCmd.AddCommand(ipDeleteCmd)
	ipCmd.AddCommand(ipToggleCmd)

	ipAddCmd.Flags().StringVarP(&ipAddDescription, "description", "d", "", "Description for this IP registration")
	ipAddCmd.Flags().IntVarP(&ipAddExpireDays, "expires", "e", 0, "Expire after N days (0 = never)")

	ipListCmd.Flags().StringVarP(&ipListUser, "user", "u", "", "Filter by username")
	ipListCmd.Flags().StringVarP(&ipListActive, "active", "a", "", "Filter by active status (true/false)")
}

func runIPList(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	query := db.Preload("User").Order("created_at DESC")

	if ipListUser != "" {
		var user models.User
		if err := db.Where("username = ?", ipListUser).First(&user).Error; err != nil {
			log.Fatalf("User '%s' not found", ipListUser)
		}
		query = query.Where("user_id = ?", user.ID)
	}

	if ipListActive != "" {
		switch strings.ToLower(ipListActive) {
		case "true", "yes", "1":
			query = query.Where("is_active = ?", true)
		case "false", "no", "0":
			query = query.Where("is_active = ?", false)
		}
	}

	var registrations []models.IPRegistration
	if err := query.Find(&registrations).Error; err != nil {
		log.Fatalf("Failed to list IP registrations: %v", err)
	}

	if len(registrations) == 0 {
		fmt.Println("No IP registrations found")
		return
	}

	fmt.Printf("%-12s %-18s %-15s %-25s %-8s %-20s\n", "ID", "IP Address", "User", "Description", "Active", "Expires")
	fmt.Println(strings.Repeat("-", 105))
	for _, r := range registrations {
		username := "-"
		if r.User != nil {
			username = r.User.Username
		}
		desc := r.Description
		if len(desc) > 23 {
			desc = desc[:20] + "..."
		}
		if desc == "" {
			desc = "-"
		}
		activeStr := "Yes"
		if !r.IsActive {
			activeStr = "No"
		}
		expiresStr := "Never"
		if r.ExpiresAt != nil {
			if r.ExpiresAt.Before(time.Now()) {
				expiresStr = "Expired"
			} else {
				expiresStr = r.ExpiresAt.Format("2006-01-02 15:04")
			}
		}
		fmt.Printf("%-12s %-18s %-15s %-25s %-8s %-20s\n", r.ID, r.IPAddress, username, desc, activeStr, expiresStr)
	}
	fmt.Printf("\nTotal: %d registrations\n", len(registrations))
}

func runIPAdd(cmd *cobra.Command, args []string) {
	ipAddress := args[0]
	username := args[1]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	// Find user
	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	// Check if IP already registered
	var existing models.IPRegistration
	if err := db.Where("ip_address = ?", ipAddress).First(&existing).Error; err == nil {
		log.Fatalf("IP address '%s' is already registered", ipAddress)
	}

	registration := models.IPRegistration{
		UserID:      user.ID,
		IPAddress:   ipAddress,
		Description: ipAddDescription,
		IsActive:    true,
	}

	if ipAddExpireDays > 0 {
		expires := time.Now().AddDate(0, 0, ipAddExpireDays)
		registration.ExpiresAt = &expires
	}

	if err := db.Create(&registration).Error; err != nil {
		log.Fatalf("Failed to create IP registration: %v", err)
	}

	fmt.Printf("IP address '%s' registered for user '%s'\n", ipAddress, username)
}

func runIPDelete(cmd *cobra.Command, args []string) {
	ipAddress := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var registration models.IPRegistration
	if err := db.Where("ip_address = ?", ipAddress).First(&registration).Error; err != nil {
		log.Fatalf("IP registration '%s' not found", ipAddress)
	}

	confirm := promptString(fmt.Sprintf("Are you sure you want to delete IP registration '%s'? (yes/no): ", ipAddress))
	if strings.ToLower(confirm) != "yes" {
		fmt.Println("Cancelled")
		return
	}

	if err := db.Delete(&registration).Error; err != nil {
		log.Fatalf("Failed to delete IP registration: %v", err)
	}

	fmt.Printf("IP registration '%s' deleted successfully\n", ipAddress)
}

func runIPToggle(cmd *cobra.Command, args []string) {
	ipAddress := args[0]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var registration models.IPRegistration
	if err := db.Where("ip_address = ?", ipAddress).First(&registration).Error; err != nil {
		log.Fatalf("IP registration '%s' not found", ipAddress)
	}

	registration.IsActive = !registration.IsActive
	if err := db.Save(&registration).Error; err != nil {
		log.Fatalf("Failed to update IP registration: %v", err)
	}

	if registration.IsActive {
		fmt.Printf("IP registration '%s' is now active\n", ipAddress)
	} else {
		fmt.Printf("IP registration '%s' is now inactive\n", ipAddress)
	}
}
