package printer

import (
	"context"
	"crypto/md5"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/OpenPrinting/goipp"
	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/logger"
	"github.com/alex4386/zikzi/internal/models"
	"github.com/alex4386/zikzi/internal/utils"
	"gorm.io/gorm"
)

// IPP Operation codes we support
const (
	OpPrintJob         goipp.Op = 0x0002
	OpValidateJob      goipp.Op = 0x0004
	OpGetJobAttributes goipp.Op = 0x0009
	OpGetJobs          goipp.Op = 0x000A
	OpGetPrinterAttrs  goipp.Op = 0x000B
	OpCancelJob        goipp.Op = 0x0008
)

// Digest auth nonce cache (nonce -> expiry time)
type nonceCache struct {
	mu     sync.RWMutex
	nonces map[string]time.Time
}

func newNonceCache() *nonceCache {
	nc := &nonceCache{
		nonces: make(map[string]time.Time),
	}
	// Start cleanup goroutine
	go nc.cleanup()
	return nc
}

func (nc *nonceCache) generate() string {
	b := make([]byte, 16)
	rand.Read(b)
	nonce := hex.EncodeToString(b)

	nc.mu.Lock()
	nc.nonces[nonce] = time.Now().Add(5 * time.Minute)
	nc.mu.Unlock()

	return nonce
}

func (nc *nonceCache) isValid(nonce string) bool {
	nc.mu.RLock()
	expiry, exists := nc.nonces[nonce]
	nc.mu.RUnlock()

	if !exists {
		return false
	}
	return time.Now().Before(expiry)
}

func (nc *nonceCache) invalidate(nonce string) {
	nc.mu.Lock()
	delete(nc.nonces, nonce)
	nc.mu.Unlock()
}

func (nc *nonceCache) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		nc.mu.Lock()
		now := time.Now()
		for nonce, expiry := range nc.nonces {
			if now.After(expiry) {
				delete(nc.nonces, nonce)
			}
		}
		nc.mu.Unlock()
	}
}

// IPPServer handles IPP protocol requests
type IPPServer struct {
	config         config.IPPConfig
	printerCfg     config.PrinterConfig
	storage        config.StorageConfig
	db             *gorm.DB
	ghostscript    *GhostScript
	httpServer     *http.Server
	printerURI     string
	trustedProxies []*net.IPNet
	nonceCache     *nonceCache
}

// NewIPPServer creates a new IPP server instance
func NewIPPServer(cfg config.IPPConfig, printerCfg config.PrinterConfig, storage config.StorageConfig, db *gorm.DB) *IPPServer {
	s := &IPPServer{
		config:      cfg,
		printerCfg:  printerCfg,
		storage:     storage,
		db:          db,
		ghostscript: NewGhostScript(storage.GhostscriptBin),
		nonceCache:  newNonceCache(),
	}

	// Parse trusted proxies
	s.trustedProxies = parseTrustedProxies(cfg.TrustedProxies)

	return s
}

// parseTrustedProxies parses a list of IP addresses or CIDR ranges
func parseTrustedProxies(proxies []string) []*net.IPNet {
	var networks []*net.IPNet
	for _, proxy := range proxies {
		// Try parsing as CIDR
		if strings.Contains(proxy, "/") {
			_, network, err := net.ParseCIDR(proxy)
			if err == nil {
				networks = append(networks, network)
			}
		} else {
			// Single IP - convert to /32 or /128
			ip := net.ParseIP(proxy)
			if ip != nil {
				var mask net.IPMask
				if ip.To4() != nil {
					mask = net.CIDRMask(32, 32)
				} else {
					mask = net.CIDRMask(128, 128)
				}
				networks = append(networks, &net.IPNet{IP: ip, Mask: mask})
			}
		}
	}
	return networks
}

// isTrustedProxy checks if an IP is in the trusted proxies list
func (s *IPPServer) isTrustedProxy(ipStr string) bool {
	if len(s.trustedProxies) == 0 {
		// No specific proxies configured, trust all if TrustProxy is enabled
		return s.config.TrustProxy
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	for _, network := range s.trustedProxies {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// Start begins listening for IPP requests
func (s *IPPServer) Start(ctx context.Context) error {
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

	// Build printer URI
	hostname := s.config.Host
	if hostname == "0.0.0.0" || hostname == "" {
		hostname = "localhost"
	}
	s.printerURI = fmt.Sprintf("ipp://%s:%d/ipp/print", hostname, s.config.Port)

	mux := http.NewServeMux()
	mux.HandleFunc("/ipp/print", s.handleIPP)
	mux.HandleFunc("/ipp/", s.handleIPP)
	mux.HandleFunc("/", s.handleIPP) // Some clients send to root

	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	logger.Info("IPP server listening on %s (URI: %s)", addr, s.printerURI)

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		s.httpServer.Shutdown(shutdownCtx)
	}()

	if err := s.httpServer.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("IPP server error: %w", err)
	}
	return nil
}

// handleIPP processes IPP requests
func (s *IPPServer) handleIPP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		logger.Error("IPP: Failed to read request body: %v", err)
		s.sendError(w, goipp.StatusErrorInternal, 0)
		return
	}
	defer r.Body.Close()

	// Check if this is a valid IPP request (starts with version bytes)
	if len(body) < 8 {
		logger.Debug("IPP: Request too short: %d bytes", len(body))
		s.sendError(w, goipp.StatusErrorBadRequest, 0)
		return
	}

	// Parse the IPP message header first to get request ID
	var msg goipp.Message
	if err := msg.DecodeBytes(body); err != nil {
		logger.Debug("IPP: Failed to decode message: %v", err)
		s.sendError(w, goipp.StatusErrorBadRequest, 0)
		return
	}

	// Get client IP
	clientIP := s.getClientIP(r)
	logger.Debug("IPP: %s from %s (op: 0x%04x)", goipp.Op(msg.Code).String(), clientIP, msg.Code)

	// Check if operation requires authentication
	requiresAuth := s.operationRequiresAuth(goipp.Op(msg.Code))

	var auth authResult
	if requiresAuth {
		var needsChallenge bool
		auth, needsChallenge = s.authenticateRequest(r, clientIP)

		if !auth.authenticated {
			if needsChallenge {
				// Send auth challenge - client should retry with credentials
				logger.Debug("IPP: Sending auth challenge for %s from %s", goipp.Op(msg.Code).String(), clientIP)
				s.sendAuthChallenge(w)
				return
			}
			// No auth methods available/configured, and IP auth failed
			if !s.printerCfg.AllowUnregisteredIPs {
				logger.Warn("IPP: Rejected %s from unauthenticated client: %s", goipp.Op(msg.Code).String(), clientIP)
				s.sendResponse(w, s.makeResponse(goipp.StatusErrorNotAuthorized, msg.RequestID))
				return
			}
			// AllowUnregisteredIPs is true - allow anonymous access
		} else {
			logger.Debug("IPP: Authenticated via %s for user %s", auth.method, auth.userID)
		}
	}

	// Route to appropriate handler
	var resp *goipp.Message
	switch goipp.Op(msg.Code) {
	case OpPrintJob:
		resp = s.handlePrintJob(r, &msg, body, clientIP, auth)
	case OpValidateJob:
		resp = s.handleValidateJob(&msg)
	case OpGetPrinterAttrs:
		resp = s.handleGetPrinterAttributes(&msg)
	case OpGetJobs:
		resp = s.handleGetJobs(&msg, clientIP, auth)
	case OpGetJobAttributes:
		resp = s.handleGetJobAttributes(&msg)
	case OpCancelJob:
		resp = s.handleCancelJob(&msg)
	default:
		logger.Debug("IPP: Unsupported operation: 0x%04x", msg.Code)
		resp = s.makeResponse(goipp.StatusErrorOperationNotSupported, msg.RequestID)
	}

	// Send response
	s.sendResponse(w, resp)
}

// operationRequiresAuth returns true if the IPP operation requires authentication
func (s *IPPServer) operationRequiresAuth(op goipp.Op) bool {
	switch op {
	case OpPrintJob, OpValidateJob, OpGetJobs, OpCancelJob:
		return true
	case OpGetPrinterAttrs, OpGetJobAttributes:
		// These are informational and typically don't require auth
		return false
	default:
		return true
	}
}

// getAdvertisedAuthMethods returns the list of authentication methods to advertise
func (s *IPPServer) getAdvertisedAuthMethods() []string {
	var methods []string

	// "requesting-user-name" is always implied when IP auth is used
	if s.config.Auth.AllowIP {
		methods = append(methods, "requesting-user-name")
	}

	// HTTP Basic and Digest authentication
	if s.config.Auth.AllowLogin {
		methods = append(methods, "basic")
		methods = append(methods, "digest")
	}

	return methods
}

// handlePrintJob processes Print-Job requests
func (s *IPPServer) handlePrintJob(r *http.Request, msg *goipp.Message, body []byte, clientIP string, auth authResult) *goipp.Message {
	// Extract document data - it comes after the IPP attributes
	docData := s.extractDocumentData(body)
	if len(docData) == 0 {
		logger.Debug("IPP: No document data in Print-Job request")
		return s.makeResponse(goipp.StatusErrorBadRequest, msg.RequestID)
	}

	// Create print job record
	job := &models.PrintJob{
		SourceIP: clientIP,
		Status:   models.JobStatusReceived,
	}

	// Extract job attributes from operation group
	for _, attr := range msg.Operation {
		switch attr.Name {
		case "job-name":
			if len(attr.Values) > 0 {
				if str, ok := attr.Values[0].V.(goipp.String); ok {
					job.DocumentName = string(str)
				}
			}
		case "requesting-user-name":
			if len(attr.Values) > 0 {
				if str, ok := attr.Values[0].V.(goipp.String); ok {
					job.Hostname = string(str)
				}
			}
		}
	}

	// Use authenticated user ID if available
	if auth.authenticated && auth.userID != "" {
		job.UserID = auth.userID
	}

	if err := s.db.Create(job).Error; err != nil {
		logger.Error("IPP: Failed to create print job: %v", err)
		return s.makeResponse(goipp.StatusErrorInternal, msg.RequestID)
	}

	// Save the document data
	dataDir := filepath.Join(s.storage.Path, "jobs")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		logger.Error("IPP: Failed to create data directory: %v", err)
		return s.makeResponse(goipp.StatusErrorInternal, msg.RequestID)
	}

	// Determine file extension based on document format
	ext := ".ps"
	for _, attr := range msg.Operation {
		if attr.Name == "document-format" && len(attr.Values) > 0 {
			if str, ok := attr.Values[0].V.(goipp.String); ok {
				format := string(str)
				if strings.Contains(format, "pdf") {
					ext = ".pdf"
				}
			}
		}
	}

	filename := fmt.Sprintf("%s_%s%s", job.ID, time.Now().Format("20060102_150405"), ext)
	filePath := filepath.Join(dataDir, filename)

	if err := os.WriteFile(filePath, docData, 0644); err != nil {
		logger.Error("IPP: Failed to write document: %v", err)
		return s.makeResponse(goipp.StatusErrorInternal, msg.RequestID)
	}

	job.OriginalFile = filePath
	job.FileSize = int64(len(docData))
	job.Status = models.JobStatusProcessing
	job.AppName = "IPP Client"
	s.db.Save(job)

	// Queue for processing
	go s.processJob(job)

	// Build success response
	resp := s.makeResponse(goipp.StatusOk, msg.RequestID)

	// Add job-id and job-uri attributes
	jobURI := fmt.Sprintf("%s/jobs/%s", s.printerURI, job.ID)
	resp.Job.Add(goipp.MakeAttribute("job-id", goipp.TagInteger, goipp.Integer(1)))
	resp.Job.Add(goipp.MakeAttribute("job-uri", goipp.TagURI, goipp.String(jobURI)))
	resp.Job.Add(goipp.MakeAttribute("job-state", goipp.TagEnum, goipp.Integer(5))) // processing
	resp.Job.Add(goipp.MakeAttribute("job-state-reasons", goipp.TagKeyword, goipp.String("job-printing")))

	logger.Info("IPP: Print job %s created successfully", job.ID)
	return resp
}

// handleValidateJob validates a potential print job
func (s *IPPServer) handleValidateJob(msg *goipp.Message) *goipp.Message {
	// For now, accept all valid requests
	return s.makeResponse(goipp.StatusOk, msg.RequestID)
}

// handleGetPrinterAttributes returns printer information
func (s *IPPServer) handleGetPrinterAttributes(msg *goipp.Message) *goipp.Message {
	resp := s.makeResponse(goipp.StatusOk, msg.RequestID)

	// Printer identification
	resp.Printer.Add(goipp.MakeAttribute("printer-uri-supported", goipp.TagURI, goipp.String(s.printerURI)))
	resp.Printer.Add(goipp.MakeAttribute("uri-security-supported", goipp.TagKeyword, goipp.String("none")))

	// Advertise authentication methods based on configuration
	authMethods := s.getAdvertisedAuthMethods()
	if len(authMethods) > 0 {
		authAttr := goipp.MakeAttribute("uri-authentication-supported", goipp.TagKeyword, goipp.String(authMethods[0]))
		for _, method := range authMethods[1:] {
			authAttr.Values.Add(goipp.TagKeyword, goipp.String(method))
		}
		resp.Printer.Add(authAttr)
	} else {
		resp.Printer.Add(goipp.MakeAttribute("uri-authentication-supported", goipp.TagKeyword, goipp.String("none")))
	}
	resp.Printer.Add(goipp.MakeAttribute("requesting-user-name-supported", goipp.TagBoolean, goipp.Boolean(true)))
	resp.Printer.Add(goipp.MakeAttribute("printer-name", goipp.TagName, goipp.String("Zikzi Printer")))
	resp.Printer.Add(goipp.MakeAttribute("printer-info", goipp.TagText, goipp.String("Zikzi Multi-User Printing Server")))
	resp.Printer.Add(goipp.MakeAttribute("printer-make-and-model", goipp.TagText, goipp.String("Zikzi Virtual Printer")))
	resp.Printer.Add(goipp.MakeAttribute("printer-state", goipp.TagEnum, goipp.Integer(3))) // idle
	resp.Printer.Add(goipp.MakeAttribute("printer-state-reasons", goipp.TagKeyword, goipp.String("none")))
	resp.Printer.Add(goipp.MakeAttribute("printer-is-accepting-jobs", goipp.TagBoolean, goipp.Boolean(true)))

	// Supported operations - build attribute with multiple values
	opsAttr := goipp.MakeAttribute("operations-supported", goipp.TagEnum, goipp.Integer(OpPrintJob))
	opsAttr.Values.Add(goipp.TagEnum, goipp.Integer(OpValidateJob))
	opsAttr.Values.Add(goipp.TagEnum, goipp.Integer(OpGetPrinterAttrs))
	opsAttr.Values.Add(goipp.TagEnum, goipp.Integer(OpGetJobs))
	opsAttr.Values.Add(goipp.TagEnum, goipp.Integer(OpGetJobAttributes))
	opsAttr.Values.Add(goipp.TagEnum, goipp.Integer(OpCancelJob))
	resp.Printer.Add(opsAttr)

	// Supported document formats
	fmtAttr := goipp.MakeAttribute("document-format-supported", goipp.TagMimeType, goipp.String("application/postscript"))
	fmtAttr.Values.Add(goipp.TagMimeType, goipp.String("application/pdf"))
	fmtAttr.Values.Add(goipp.TagMimeType, goipp.String("application/octet-stream"))
	resp.Printer.Add(fmtAttr)
	resp.Printer.Add(goipp.MakeAttribute("document-format-default", goipp.TagMimeType, goipp.String("application/postscript")))

	// Color support - IMPORTANT: advertise as color printer
	resp.Printer.Add(goipp.MakeAttribute("color-supported", goipp.TagBoolean, goipp.Boolean(true)))
	colorModeAttr := goipp.MakeAttribute("print-color-mode-supported", goipp.TagKeyword, goipp.String("auto"))
	colorModeAttr.Values.Add(goipp.TagKeyword, goipp.String("color"))
	colorModeAttr.Values.Add(goipp.TagKeyword, goipp.String("monochrome"))
	resp.Printer.Add(colorModeAttr)
	resp.Printer.Add(goipp.MakeAttribute("print-color-mode-default", goipp.TagKeyword, goipp.String("auto")))

	// Charset and language
	resp.Printer.Add(goipp.MakeAttribute("charset-configured", goipp.TagCharset, goipp.String("utf-8")))
	resp.Printer.Add(goipp.MakeAttribute("charset-supported", goipp.TagCharset, goipp.String("utf-8")))
	resp.Printer.Add(goipp.MakeAttribute("natural-language-configured", goipp.TagLanguage, goipp.String("en")))
	resp.Printer.Add(goipp.MakeAttribute("generated-natural-language-supported", goipp.TagLanguage, goipp.String("en")))

	// IPP versions
	verAttr := goipp.MakeAttribute("ipp-versions-supported", goipp.TagKeyword, goipp.String("1.0"))
	verAttr.Values.Add(goipp.TagKeyword, goipp.String("1.1"))
	verAttr.Values.Add(goipp.TagKeyword, goipp.String("2.0"))
	resp.Printer.Add(verAttr)

	// PDL override
	resp.Printer.Add(goipp.MakeAttribute("pdl-override-supported", goipp.TagKeyword, goipp.String("attempted")))

	// Multiple job support - helps clients understand the queue behavior
	resp.Printer.Add(goipp.MakeAttribute("multiple-document-jobs-supported", goipp.TagBoolean, goipp.Boolean(false)))
	resp.Printer.Add(goipp.MakeAttribute("multiple-operation-time-out", goipp.TagInteger, goipp.Integer(120)))

	// Queue info
	resp.Printer.Add(goipp.MakeAttribute("queued-job-count", goipp.TagInteger, goipp.Integer(s.getQueuedJobCount())))

	return resp
}

// handleGetJobs returns a list of jobs
func (s *IPPServer) handleGetJobs(msg *goipp.Message, clientIP string, auth authResult) *goipp.Message {
	resp := s.makeResponse(goipp.StatusOk, msg.RequestID)

	// Get jobs from database (limit to 100)
	var jobs []models.PrintJob
	query := s.db.Order("created_at DESC").Limit(100)

	// Filter by authenticated user if available
	if auth.authenticated && auth.userID != "" {
		query = query.Where("user_id = ?", auth.userID)
	}

	query.Find(&jobs)

	// Add job attributes (using job group for each job)
	for i, job := range jobs {
		jobState := s.getIPPJobState(job.Status)
		jobURI := fmt.Sprintf("%s/jobs/%s", s.printerURI, job.ID)

		resp.Job.Add(goipp.MakeAttribute("job-id", goipp.TagInteger, goipp.Integer(i+1)))
		resp.Job.Add(goipp.MakeAttribute("job-uri", goipp.TagURI, goipp.String(jobURI)))
		resp.Job.Add(goipp.MakeAttribute("job-state", goipp.TagEnum, goipp.Integer(jobState)))
		resp.Job.Add(goipp.MakeAttribute("job-name", goipp.TagName, goipp.String(job.DocumentName)))
	}

	return resp
}

// handleGetJobAttributes returns attributes for a specific job
func (s *IPPServer) handleGetJobAttributes(msg *goipp.Message) *goipp.Message {
	// Extract job-uri or job-id from request
	var jobID string
	for _, attr := range msg.Operation {
		if attr.Name == "job-uri" && len(attr.Values) > 0 {
			if str, ok := attr.Values[0].V.(goipp.String); ok {
				// Extract job ID from URI (e.g., "ipp://host/ipp/print/jobs/uuid")
				uri := string(str)
				if idx := strings.LastIndex(uri, "/"); idx != -1 {
					jobID = uri[idx+1:]
				}
			}
		}
	}

	if jobID == "" {
		return s.makeResponse(goipp.StatusErrorBadRequest, msg.RequestID)
	}

	// Look up job in database
	var job models.PrintJob
	if err := s.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return s.makeResponse(goipp.StatusErrorNotFound, msg.RequestID)
	}

	resp := s.makeResponse(goipp.StatusOk, msg.RequestID)

	// Add job attributes
	jobState := s.getIPPJobState(job.Status)
	jobURI := fmt.Sprintf("%s/jobs/%s", s.printerURI, job.ID)

	resp.Job.Add(goipp.MakeAttribute("job-id", goipp.TagInteger, goipp.Integer(1)))
	resp.Job.Add(goipp.MakeAttribute("job-uri", goipp.TagURI, goipp.String(jobURI)))
	resp.Job.Add(goipp.MakeAttribute("job-state", goipp.TagEnum, goipp.Integer(jobState)))
	resp.Job.Add(goipp.MakeAttribute("job-state-reasons", goipp.TagKeyword, goipp.String(s.getJobStateReason(job.Status))))
	resp.Job.Add(goipp.MakeAttribute("job-name", goipp.TagName, goipp.String(job.DocumentName)))
	resp.Job.Add(goipp.MakeAttribute("job-originating-user-name", goipp.TagName, goipp.String(job.Hostname)))

	if job.PageCount > 0 {
		resp.Job.Add(goipp.MakeAttribute("job-media-sheets-completed", goipp.TagInteger, goipp.Integer(job.PageCount)))
	}

	return resp
}

// handleCancelJob cancels a print job
func (s *IPPServer) handleCancelJob(msg *goipp.Message) *goipp.Message {
	// For simplicity, acknowledge the cancel request
	return s.makeResponse(goipp.StatusOk, msg.RequestID)
}

// makeResponse creates a basic IPP response
func (s *IPPServer) makeResponse(status goipp.Status, requestID uint32) *goipp.Message {
	resp := &goipp.Message{
		Version:   goipp.MakeVersion(2, 0),
		Code:      goipp.Code(status),
		RequestID: requestID,
	}

	// Add required operation attributes
	resp.Operation.Add(goipp.MakeAttribute("attributes-charset", goipp.TagCharset, goipp.String("utf-8")))
	resp.Operation.Add(goipp.MakeAttribute("attributes-natural-language", goipp.TagLanguage, goipp.String("en")))

	return resp
}

// sendResponse sends an IPP response
func (s *IPPServer) sendResponse(w http.ResponseWriter, resp *goipp.Message) {
	w.Header().Set("Content-Type", "application/ipp")

	data, err := resp.EncodeBytes()
	if err != nil {
		logger.Error("IPP: Failed to encode response: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Write(data)
}

// sendError sends an IPP error response
func (s *IPPServer) sendError(w http.ResponseWriter, status goipp.Status, requestID uint32) {
	resp := s.makeResponse(status, requestID)
	s.sendResponse(w, resp)
}

// processJob handles the PDF conversion workflow
func (s *IPPServer) processJob(job *models.PrintJob) {
	outputDir := filepath.Join(s.storage.Path, "jobs")

	result := s.ghostscript.ProcessJob(job.OriginalFile, outputDir, job.ID)

	now := time.Now()
	job.ProcessedAt = &now

	if result.Error != nil {
		job.Status = models.JobStatusFailed
		job.Error = result.Error.Error()
		logger.Error("IPP: Print job %s failed: %v", job.ID, result.Error)
	} else {
		job.Status = models.JobStatusCompleted
		job.PDFFile = result.PDFPath
		job.ThumbnailFile = result.ThumbnailPath
		job.PageCount = result.PageCount
		logger.Info("IPP: Print job %s completed: %d pages", job.ID, result.PageCount)
	}

	s.db.Save(job)
}

// getQueuedJobCount returns the number of pending jobs
func (s *IPPServer) getQueuedJobCount() int {
	var count int64
	s.db.Model(&models.PrintJob{}).Where("status IN ?", []string{
		string(models.JobStatusReceived),
		string(models.JobStatusProcessing),
	}).Count(&count)
	return int(count)
}

// getIPPJobState converts internal status to IPP job state
func (s *IPPServer) getIPPJobState(status string) int {
	switch status {
	case models.JobStatusReceived:
		return 3 // pending
	case models.JobStatusProcessing:
		return 5 // processing
	case models.JobStatusCompleted:
		return 9 // completed
	case models.JobStatusFailed:
		return 8 // aborted
	default:
		return 3 // pending
	}
}

// getJobStateReason returns the IPP job-state-reasons keyword
func (s *IPPServer) getJobStateReason(status string) string {
	switch status {
	case models.JobStatusReceived:
		return "job-incoming"
	case models.JobStatusProcessing:
		return "job-printing"
	case models.JobStatusCompleted:
		return "job-completed-successfully"
	case models.JobStatusFailed:
		return "job-aborted-by-system"
	default:
		return "none"
	}
}

// extractDocumentData extracts document bytes from IPP request
func (s *IPPServer) extractDocumentData(body []byte) []byte {
	// IPP requests contain: version(2) + opcode(2) + requestID(4) + attributes + end-tag(1) + document
	// Find the end-of-attributes tag (0x03) and return everything after it
	endTag := byte(0x03)
	for i := 8; i < len(body); i++ {
		if body[i] == endTag {
			// Return document data after end tag
			if i+1 < len(body) {
				return body[i+1:]
			}
			break
		}
	}
	return nil
}

// getClientIP extracts the client IP from the request
func (s *IPPServer) getClientIP(r *http.Request) string {
	// Get the direct remote address first
	remoteIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteIP = r.RemoteAddr
	}

	// Only check proxy headers if the remote IP is a trusted proxy
	if s.isTrustedProxy(remoteIP) {
		// Check X-Forwarded-For header
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if len(parts) > 0 {
				return strings.TrimSpace(parts[0])
			}
		}

		// Check X-Real-IP header
		if xri := r.Header.Get("X-Real-IP"); xri != "" {
			return xri
		}
	}

	return remoteIP
}

// authResult represents the result of an authentication attempt
type authResult struct {
	authenticated bool
	userID        string
	method        string // "ip", "basic", "digest"
}

// authenticateRequest attempts to authenticate the request using configured methods
// Returns: authResult with user info, and whether auth challenge should be sent
func (s *IPPServer) authenticateRequest(r *http.Request, clientIP string) (authResult, bool) {
	result := authResult{}

	// Try IP-based authentication first (if enabled)
	if s.config.Auth.AllowIP {
		var ipReg models.IPRegistration
		if err := s.db.Where("ip_address = ? AND is_active = ?", clientIP, true).First(&ipReg).Error; err == nil {
			result.authenticated = true
			result.userID = ipReg.UserID
			result.method = "ip"
			return result, false
		}
	}

	// Try HTTP authentication (if enabled)
	if s.config.Auth.AllowLogin {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			if strings.HasPrefix(authHeader, "Basic ") {
				if user := s.authenticateBasic(authHeader); user != nil {
					result.authenticated = true
					result.userID = user.ID
					result.method = "basic"
					return result, false
				}
			} else if strings.HasPrefix(authHeader, "Digest ") {
				if user := s.authenticateDigest(r, authHeader); user != nil {
					result.authenticated = true
					result.userID = user.ID
					result.method = "digest"
					return result, false
				}
			}
		}
		// Auth header missing or invalid - should send challenge
		return result, true
	}

	// No authentication methods succeeded or available
	return result, false
}

// authenticateBasic handles HTTP Basic authentication
// Supports: username/password OR username/token
func (s *IPPServer) authenticateBasic(authHeader string) *models.User {
	// Decode base64 credentials
	encoded := strings.TrimPrefix(authHeader, "Basic ")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil
	}

	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return nil
	}

	username := parts[0]
	credential := parts[1]

	// Find user by username
	var user models.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil
	}

	// Try password authentication first (if user allows it)
	if user.PasswordHash != "" && user.AllowIPPPassword && utils.VerifyPassword(user.PasswordHash, credential) {
		return &user
	}

	// Try IPP token authentication
	var tokens []models.IPPToken
	if err := s.db.Where("user_id = ? AND is_active = ?", user.ID, true).Find(&tokens).Error; err == nil {
		for _, token := range tokens {
			if token.IsValid() && models.VerifyIPPToken(token.Token, credential) {
				// Update last used info
				now := time.Now()
				token.LastUsedAt = &now
				s.db.Save(&token)
				return &user
			}
		}
	}

	return nil
}

// authenticateDigest handles HTTP Digest authentication
func (s *IPPServer) authenticateDigest(r *http.Request, authHeader string) *models.User {
	// Parse digest auth header
	params := parseDigestAuth(strings.TrimPrefix(authHeader, "Digest "))
	if params == nil {
		return nil
	}

	username := params["username"]
	nonce := params["nonce"]
	uri := params["uri"]
	clientResponse := params["response"]
	nc := params["nc"]
	cnonce := params["cnonce"]
	qop := params["qop"]

	// Validate nonce
	if !s.nonceCache.isValid(nonce) {
		logger.Debug("IPP: Digest auth failed - invalid or expired nonce")
		return nil
	}

	// Find user
	var user models.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		logger.Debug("IPP: Digest auth failed - user not found: %s", username)
		return nil
	}

	realm := s.config.Auth.Realm

	// Try password authentication if user has DigestHA1 stored and allows password auth
	// Note: DigestHA1 must be pre-computed and stored when password is set
	if user.DigestHA1 != "" && user.AllowIPPPassword {
		expectedResponse := computeDigestResponse(
			user.DigestHA1,
			nonce, nc, cnonce, qop,
			r.Method, uri,
		)

		if expectedResponse == clientResponse {
			logger.Debug("IPP: Digest auth succeeded for user %s via password", username)
			return &user
		}
	}

	// Try IPP tokens - compute HA1 dynamically using plaintext token
	var tokens []models.IPPToken
	if err := s.db.Where("user_id = ? AND is_active = ?", user.ID, true).Find(&tokens).Error; err == nil {
		for _, token := range tokens {
			if !token.IsValid() {
				continue
			}

			// Compute HA1 dynamically: MD5(username:realm:token)
			ha1 := computeDigestHA1(username, realm, token.Token)

			// Compute expected response
			expectedResponse := computeDigestResponse(
				ha1,
				nonce, nc, cnonce, qop,
				r.Method, uri,
			)

			if expectedResponse == clientResponse {
				// Update last used info
				now := time.Now()
				token.LastUsedAt = &now
				s.db.Save(&token)

				logger.Debug("IPP: Digest auth succeeded for user %s via token", username)
				return &user
			}
		}
	}

	logger.Debug("IPP: Digest auth failed - no valid credential matched for user %s", username)
	return nil
}

// parseDigestAuth parses a Digest authentication header into a map
func parseDigestAuth(header string) map[string]string {
	result := make(map[string]string)
	// Parse key="value" or key=value pairs
	parts := strings.Split(header, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		idx := strings.Index(part, "=")
		if idx == -1 {
			continue
		}
		key := strings.TrimSpace(part[:idx])
		value := strings.TrimSpace(part[idx+1:])
		// Remove quotes if present
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			value = value[1 : len(value)-1]
		}
		result[key] = value
	}
	return result
}

// sendAuthChallenge sends WWW-Authenticate headers for Basic and Digest auth
func (s *IPPServer) sendAuthChallenge(w http.ResponseWriter) {
	realm := s.config.Auth.Realm
	nonce := s.nonceCache.generate()

	// Offer both Basic and Digest authentication
	// Basic is simpler and works well over HTTPS
	w.Header().Add("WWW-Authenticate", fmt.Sprintf(`Basic realm="%s"`, realm))

	// Digest provides better security over HTTP (password not sent in clear)
	w.Header().Add("WWW-Authenticate", fmt.Sprintf(
		`Digest realm="%s", nonce="%s", qop="auth", algorithm=MD5`,
		realm, nonce,
	))

	w.WriteHeader(http.StatusUnauthorized)
}

// computeDigestHA1 computes the HA1 hash for digest authentication
func computeDigestHA1(username, realm, password string) string {
	h := md5.Sum([]byte(username + ":" + realm + ":" + password))
	return hex.EncodeToString(h[:])
}

// computeDigestResponse computes the expected digest response
func computeDigestResponse(ha1, nonce, nc, cnonce, qop, method, uri string) string {
	ha2 := md5.Sum([]byte(method + ":" + uri))
	ha2Hex := hex.EncodeToString(ha2[:])

	var response string
	if qop == "auth" || qop == "auth-int" {
		data := ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + ha2Hex
		h := md5.Sum([]byte(data))
		response = hex.EncodeToString(h[:])
	} else {
		data := ha1 + ":" + nonce + ":" + ha2Hex
		h := md5.Sum([]byte(data))
		response = hex.EncodeToString(h[:])
	}
	return response
}
