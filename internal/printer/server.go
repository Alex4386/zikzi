package printer

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"time"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/alex4386/zikzi/internal/logger"
	"github.com/alex4386/zikzi/internal/models"
	proxyproto "github.com/pires/go-proxyproto"
	"gorm.io/gorm"
)

type Server struct {
	config      config.PrinterConfig
	storage     config.StorageConfig
	db          *gorm.DB
	ghostscript *GhostScript
}

func NewServer(cfg config.PrinterConfig, storage config.StorageConfig, db *gorm.DB) *Server {
	return &Server{
		config:      cfg,
		storage:     storage,
		db:          db,
		ghostscript: NewGhostScript(storage.GhostscriptBin),
	}
}

func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to start printer server: %w", err)
	}

	// Wrap listener with PROXY protocol support if enabled
	if s.config.ProxyProtocol {
		listener = s.wrapWithProxyProtocol(listener)
		logger.Info("PROXY protocol v1/v2 enabled for RAW printer")
	}

	defer listener.Close()

	logger.Info("PostScript printer server listening on %s", addr)

	go func() {
		<-ctx.Done()
		listener.Close()
	}()

	for {
		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-ctx.Done():
				return nil
			default:
				logger.Error("Accept error: %v", err)
				continue
			}
		}

		go s.handleConnection(ctx, conn)
	}
}

// wrapWithProxyProtocol wraps the listener with PROXY protocol support
func (s *Server) wrapWithProxyProtocol(listener net.Listener) net.Listener {
	policy := proxyproto.REQUIRE

	// If trusted proxies are configured, create a policy function
	if len(s.config.TrustedProxies) > 0 {
		policy = proxyproto.USE
	}

	proxyListener := &proxyproto.Listener{
		Listener:          listener,
		Policy:            func(upstream net.Addr) (proxyproto.Policy, error) {
			// If no trusted proxies configured, require PROXY protocol from everyone
			if len(s.config.TrustedProxies) == 0 {
				return proxyproto.REQUIRE, nil
			}

			// Check if the upstream is in trusted proxies list
			tcpAddr, ok := upstream.(*net.TCPAddr)
			if !ok {
				return proxyproto.REJECT, nil
			}

			for _, trusted := range s.config.TrustedProxies {
				_, cidr, err := net.ParseCIDR(trusted)
				if err != nil {
					// Not a CIDR, try as plain IP
					if tcpAddr.IP.String() == trusted {
						return proxyproto.USE, nil
					}
					continue
				}
				if cidr.Contains(tcpAddr.IP) {
					return proxyproto.USE, nil
				}
			}

			// Not from a trusted proxy - don't parse PROXY protocol, use direct IP
			return proxyproto.IGNORE, nil
		},
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Use simpler policy if no trusted proxies configured
	if len(s.config.TrustedProxies) == 0 {
		proxyListener.Policy = func(upstream net.Addr) (proxyproto.Policy, error) {
			return policy, nil
		}
	}

	return proxyListener
}

func (s *Server) handleConnection(ctx context.Context, conn net.Conn) {
	defer conn.Close()

	remoteAddr := conn.RemoteAddr().(*net.TCPAddr)
	logger.Debug("New print job from %s", remoteAddr.IP.String())

	// Create print job record
	job := &models.PrintJob{
		SourceIP: remoteAddr.IP.String(),
		Status:   models.JobStatusReceived,
	}

	// Try to find user by registered IP
	var ipReg models.IPRegistration
	if err := s.db.Where("ip_address = ? AND is_active = ?", remoteAddr.IP.String(), true).First(&ipReg).Error; err == nil {
		job.UserID = ipReg.UserID
	} else if !s.config.AllowUnregisteredIPs {
		// IP not registered and unregistered IPs are not allowed
		logger.Warn("Rejected print job from unregistered IP: %s", remoteAddr.IP.String())
		return
	}
	// If AllowUnregisteredIPs is true and no IP registration found, job.UserID remains empty (orphaned)

	if err := s.db.Create(job).Error; err != nil {
		logger.Error("Failed to create print job: %v", err)
		return
	}

	// Save the raw PostScript data
	dataDir := filepath.Join(s.storage.Path, "jobs")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		logger.Error("Failed to create data directory: %v", err)
		return
	}

	filename := fmt.Sprintf("%s_%s.ps", job.ID, time.Now().Format("20060102_150405"))
	psFilePath := filepath.Join(dataDir, filename)

	file, err := os.Create(psFilePath)
	if err != nil {
		logger.Error("Failed to create file: %v", err)
		return
	}

	// Use TeeReader to parse metadata while saving
	reader := bufio.NewReader(conn)
	teeReader := io.TeeReader(reader, file)

	// Parse PostScript metadata
	metadata := ParsePostScriptMetadata(teeReader)
	file.Close()

	// Update job with metadata
	job.OriginalFile = psFilePath
	job.DocumentName = metadata.Title
	job.Hostname = metadata.For
	job.AppName = metadata.Creator
	job.Status = models.JobStatusProcessing

	if stat, err := os.Stat(psFilePath); err == nil {
		job.FileSize = stat.Size()
	}

	s.db.Save(job)

	// Queue for PDF conversion (async)
	go s.processJob(job)
}

func (s *Server) processJob(job *models.PrintJob) {
	outputDir := filepath.Join(s.storage.Path, "jobs")

	result := s.ghostscript.ProcessJob(job.OriginalFile, outputDir, job.ID)

	now := time.Now()
	job.ProcessedAt = &now

	if result.Error != nil {
		job.Status = models.JobStatusFailed
		job.Error = result.Error.Error()
		logger.Error("Print job %s failed: %v", job.ID, result.Error)
	} else {
		job.Status = models.JobStatusCompleted
		job.PDFFile = result.PDFPath
		job.ThumbnailFile = result.ThumbnailPath
		job.PageCount = result.PageCount
		logger.Info("Print job %s completed: %d pages", job.ID, result.PageCount)
	}

	s.db.Save(job)
}
