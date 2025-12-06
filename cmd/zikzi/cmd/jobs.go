package cmd

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/alex4386/zikzi/internal/models"
	"github.com/spf13/cobra"
)

var jobsCmd = &cobra.Command{
	Use:   "jobs",
	Short: "Manage print jobs",
	Long:  `Commands for managing print jobs in Zikzi.`,
}

var jobsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List print jobs",
	Long:  `List all print jobs with optional filtering.`,
	Run:   runJobsList,
}

var jobsShowCmd = &cobra.Command{
	Use:   "show <job-id>",
	Short: "Show job details",
	Long:  `Show detailed information about a specific print job.`,
	Args:  cobra.ExactArgs(1),
	Run:   runJobsShow,
}

var jobsDeleteCmd = &cobra.Command{
	Use:   "delete <job-id>",
	Short: "Delete a print job",
	Long:  `Delete a print job and its associated files.`,
	Args:  cobra.ExactArgs(1),
	Run:   runJobsDelete,
}

var jobsStatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show job statistics",
	Long:  `Display statistics about print jobs.`,
	Run:   runJobsStats,
}

var jobsCleanupCmd = &cobra.Command{
	Use:   "cleanup",
	Short: "Clean up old jobs",
	Long:  `Delete jobs older than specified days.`,
	Run:   runJobsCleanup,
}

var jobsOrphanedCmd = &cobra.Command{
	Use:   "orphaned",
	Short: "List orphaned jobs",
	Long:  `List all print jobs without an assigned user.`,
	Run:   runJobsOrphaned,
}

var jobsAssignCmd = &cobra.Command{
	Use:   "assign <job-id> <username>",
	Short: "Assign a job to a user",
	Long:  `Assign an orphaned or existing print job to a specific user.`,
	Args:  cobra.ExactArgs(2),
	Run:   runJobsAssign,
}

// Flags
var (
	jobsListStatus   string
	jobsListUser     string
	jobsListLimit    int
	jobsCleanupDays  int
	jobsCleanupForce bool
)

func init() {
	rootCmd.AddCommand(jobsCmd)
	jobsCmd.AddCommand(jobsListCmd)
	jobsCmd.AddCommand(jobsShowCmd)
	jobsCmd.AddCommand(jobsDeleteCmd)
	jobsCmd.AddCommand(jobsStatsCmd)
	jobsCmd.AddCommand(jobsCleanupCmd)
	jobsCmd.AddCommand(jobsOrphanedCmd)
	jobsCmd.AddCommand(jobsAssignCmd)

	jobsListCmd.Flags().StringVarP(&jobsListStatus, "status", "s", "", "Filter by status (received, processing, completed, failed)")
	jobsListCmd.Flags().StringVarP(&jobsListUser, "user", "u", "", "Filter by username")
	jobsListCmd.Flags().IntVarP(&jobsListLimit, "limit", "n", 50, "Maximum number of jobs to show")

	jobsCleanupCmd.Flags().IntVarP(&jobsCleanupDays, "days", "d", 30, "Delete jobs older than this many days")
	jobsCleanupCmd.Flags().BoolVarP(&jobsCleanupForce, "force", "f", false, "Skip confirmation")
}

func runJobsList(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	query := db.Preload("User").Order("created_at DESC")

	if jobsListStatus != "" {
		query = query.Where("status = ?", jobsListStatus)
	}

	if jobsListUser != "" {
		var user models.User
		if err := db.Where("username = ?", jobsListUser).First(&user).Error; err != nil {
			log.Fatalf("User '%s' not found", jobsListUser)
		}
		query = query.Where("user_id = ?", user.ID)
	}

	if jobsListLimit > 0 {
		query = query.Limit(jobsListLimit)
	}

	var jobs []models.PrintJob
	if err := query.Find(&jobs).Error; err != nil {
		log.Fatalf("Failed to list jobs: %v", err)
	}

	if len(jobs) == 0 {
		fmt.Println("No jobs found")
		return
	}

	fmt.Printf("%-12s %-15s %-18s %-25s %-10s %-20s\n", "ID", "User", "Source IP", "Document", "Status", "Created")
	fmt.Println(strings.Repeat("-", 105))
	for _, j := range jobs {
		username := "-"
		if j.User != nil {
			username = j.User.Username
		}
		docName := j.DocumentName
		if len(docName) > 23 {
			docName = docName[:20] + "..."
		}
		fmt.Printf("%-12s %-15s %-18s %-25s %-10s %-20s\n",
			j.ID, username, j.SourceIP, docName, j.Status, j.CreatedAt.Format("2006-01-02 15:04:05"))
	}
	fmt.Printf("\nTotal: %d jobs\n", len(jobs))
}

func runJobsShow(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	jobID := args[0]

	var job models.PrintJob
	if err := db.Preload("User").First(&job, "id = ?", jobID).Error; err != nil {
		log.Fatalf("Job not found: %s", args[0])
	}

	username := "-"
	if job.User != nil {
		username = job.User.Username
	}

	fmt.Printf("Job ID:        %s\n", job.ID)
	fmt.Printf("Status:        %s\n", job.Status)
	fmt.Printf("User:          %s\n", username)
	fmt.Printf("Source IP:     %s\n", job.SourceIP)
	fmt.Printf("Hostname:      %s\n", job.Hostname)
	fmt.Printf("Document:      %s\n", job.DocumentName)
	fmt.Printf("Application:   %s\n", job.AppName)
	fmt.Printf("OS Version:    %s\n", job.OSVersion)
	fmt.Printf("Page Count:    %d\n", job.PageCount)
	fmt.Printf("File Size:     %d bytes\n", job.FileSize)
	fmt.Printf("Created:       %s\n", job.CreatedAt.Format("2006-01-02 15:04:05"))
	if job.ProcessedAt != nil {
		fmt.Printf("Processed:     %s\n", job.ProcessedAt.Format("2006-01-02 15:04:05"))
	}
	if job.Error != "" {
		fmt.Printf("Error:         %s\n", job.Error)
	}
	fmt.Printf("\nFiles:\n")
	fmt.Printf("  Original:    %s\n", job.OriginalFile)
	fmt.Printf("  PDF:         %s\n", job.PDFFile)
	fmt.Printf("  Thumbnail:   %s\n", job.ThumbnailFile)
}

func runJobsDelete(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	jobID := args[0]

	var job models.PrintJob
	if err := db.First(&job, "id = ?", jobID).Error; err != nil {
		log.Fatalf("Job not found: %s", args[0])
	}

	confirm := promptString(fmt.Sprintf("Are you sure you want to delete job %s? (yes/no): ", job.ID))
	if strings.ToLower(confirm) != "yes" {
		fmt.Println("Cancelled")
		return
	}

	if err := db.Delete(&job).Error; err != nil {
		log.Fatalf("Failed to delete job: %v", err)
	}

	fmt.Printf("Job %s deleted successfully\n", job.ID)
}

func runJobsStats(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var total int64
	db.Model(&models.PrintJob{}).Count(&total)

	var received, processing, completed, failed int64
	db.Model(&models.PrintJob{}).Where("status = ?", models.JobStatusReceived).Count(&received)
	db.Model(&models.PrintJob{}).Where("status = ?", models.JobStatusProcessing).Count(&processing)
	db.Model(&models.PrintJob{}).Where("status = ?", models.JobStatusCompleted).Count(&completed)
	db.Model(&models.PrintJob{}).Where("status = ?", models.JobStatusFailed).Count(&failed)

	var totalSize int64
	db.Model(&models.PrintJob{}).Select("COALESCE(SUM(file_size), 0)").Scan(&totalSize)

	var totalPages int64
	db.Model(&models.PrintJob{}).Select("COALESCE(SUM(page_count), 0)").Scan(&totalPages)

	// Jobs today
	today := time.Now().Truncate(24 * time.Hour)
	var todayCount int64
	db.Model(&models.PrintJob{}).Where("created_at >= ?", today).Count(&todayCount)

	// Jobs this week
	weekAgo := time.Now().AddDate(0, 0, -7)
	var weekCount int64
	db.Model(&models.PrintJob{}).Where("created_at >= ?", weekAgo).Count(&weekCount)

	fmt.Println("Print Job Statistics")
	fmt.Println(strings.Repeat("=", 40))
	fmt.Printf("Total Jobs:      %d\n", total)
	fmt.Printf("  Received:      %d\n", received)
	fmt.Printf("  Processing:    %d\n", processing)
	fmt.Printf("  Completed:     %d\n", completed)
	fmt.Printf("  Failed:        %d\n", failed)
	fmt.Println()
	fmt.Printf("Total Pages:     %d\n", totalPages)
	fmt.Printf("Total Size:      %s\n", formatBytes(totalSize))
	fmt.Println()
	fmt.Printf("Jobs Today:      %d\n", todayCount)
	fmt.Printf("Jobs This Week:  %d\n", weekCount)
}

func runJobsCleanup(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	cutoff := time.Now().AddDate(0, 0, -jobsCleanupDays)

	var count int64
	db.Model(&models.PrintJob{}).Where("created_at < ?", cutoff).Count(&count)

	if count == 0 {
		fmt.Printf("No jobs older than %d days found\n", jobsCleanupDays)
		return
	}

	if !jobsCleanupForce {
		confirm := promptString(fmt.Sprintf("Delete %d jobs older than %d days? (yes/no): ", count, jobsCleanupDays))
		if strings.ToLower(confirm) != "yes" {
			fmt.Println("Cancelled")
			return
		}
	}

	result := db.Where("created_at < ?", cutoff).Delete(&models.PrintJob{})
	if result.Error != nil {
		log.Fatalf("Failed to cleanup jobs: %v", result.Error)
	}

	fmt.Printf("Deleted %d jobs\n", result.RowsAffected)
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func runJobsOrphaned(cmd *cobra.Command, args []string) {
	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	var jobs []models.PrintJob
	if err := db.Where("user_id IS NULL OR user_id = ''").Order("created_at DESC").Find(&jobs).Error; err != nil {
		log.Fatalf("Failed to list orphaned jobs: %v", err)
	}

	if len(jobs) == 0 {
		fmt.Println("No orphaned jobs found")
		return
	}

	fmt.Printf("%-12s %-18s %-15s %-25s %-10s %-20s\n", "ID", "Source IP", "Hostname", "Document", "Status", "Created")
	fmt.Println(strings.Repeat("-", 105))
	for _, j := range jobs {
		docName := j.DocumentName
		if len(docName) > 23 {
			docName = docName[:20] + "..."
		}
		hostname := j.Hostname
		if len(hostname) > 13 {
			hostname = hostname[:10] + "..."
		}
		if hostname == "" {
			hostname = "-"
		}
		fmt.Printf("%-12s %-18s %-15s %-25s %-10s %-20s\n",
			j.ID, j.SourceIP, hostname, docName, j.Status, j.CreatedAt.Format("2006-01-02 15:04:05"))
	}
	fmt.Printf("\nTotal: %d orphaned jobs\n", len(jobs))
}

func runJobsAssign(cmd *cobra.Command, args []string) {
	jobID := args[0]
	username := args[1]

	db, err := getDB()
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	// Find the job
	var job models.PrintJob
	if err := db.First(&job, "id = ?", jobID).Error; err != nil {
		log.Fatalf("Job %s not found", jobID)
	}

	// Find the user
	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Fatalf("User '%s' not found", username)
	}

	// Check if job already assigned
	if job.UserID != "" {
		var currentUser models.User
		if err := db.First(&currentUser, "id = ?", job.UserID).Error; err == nil {
			confirm := promptString(fmt.Sprintf("Job %s is already assigned to '%s'. Reassign to '%s'? (yes/no): ",
				jobID, currentUser.Username, username))
			if strings.ToLower(confirm) != "yes" {
				fmt.Println("Cancelled")
				return
			}
		}
	}

	// Assign the job
	job.UserID = user.ID
	if err := db.Save(&job).Error; err != nil {
		log.Fatalf("Failed to assign job: %v", err)
	}

	fmt.Printf("Job %s assigned to user '%s'\n", jobID, username)
}
