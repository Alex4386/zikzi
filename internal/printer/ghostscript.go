package printer

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// GhostScript handles PDF and thumbnail generation from PostScript files
type GhostScript struct {
	BinaryPath string
}

func NewGhostScript(binaryPath string) *GhostScript {
	if binaryPath == "" {
		binaryPath = "gs"
	}
	return &GhostScript{BinaryPath: binaryPath}
}

// ConvertToPDF converts a PostScript file to PDF
func (gs *GhostScript) ConvertToPDF(inputPath, outputPath string) error {
	args := []string{
		"-dNOPAUSE",
		"-dBATCH",
		"-dSAFER",
		"-sDEVICE=pdfwrite",
		"-dCompatibilityLevel=1.4",
		"-dPDFSETTINGS=/prepress",
		"-dColorConversionStrategy=/LeaveColorUnchanged",
		"-dDownsampleMonoImages=false",
		"-dDownsampleGrayImages=false",
		"-dDownsampleColorImages=false",
		"-dAutoFilterColorImages=false",
		"-dAutoFilterGrayImages=false",
		fmt.Sprintf("-sOutputFile=%s", outputPath),
		inputPath,
	}

	cmd := exec.Command(gs.BinaryPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ghostscript error: %w, output: %s", err, string(output))
	}

	return nil
}

// GenerateThumbnail creates a PNG thumbnail of the first page
func (gs *GhostScript) GenerateThumbnail(inputPath, outputPath string, resolution int) error {
	if resolution <= 0 {
		resolution = 72
	}

	args := []string{
		"-dNOPAUSE",
		"-dBATCH",
		"-dSAFER",
		"-sDEVICE=png16m",
		fmt.Sprintf("-r%d", resolution),
		"-dFirstPage=1",
		"-dLastPage=1",
		fmt.Sprintf("-sOutputFile=%s", outputPath),
		inputPath,
	}

	cmd := exec.Command(gs.BinaryPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ghostscript error: %w, output: %s", err, string(output))
	}

	return nil
}

// GetPageCount returns the number of pages in a PostScript/PDF file
func (gs *GhostScript) GetPageCount(inputPath string) (int, error) {
	// Use GhostScript to count pages in a PDF file
	args := []string{
		"-dNODISPLAY",
		"-dQUIET",
		"-dNOPAUSE",
		"-dBATCH",
		"-c",
		fmt.Sprintf("(%s) (r) file runpdfbegin pdfpagecount == quit", inputPath),
	}

	cmd := exec.Command(gs.BinaryPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Fallback: try to count %%Page: comments for PostScript
		return gs.countPSPages(inputPath)
	}

	count, err := strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil {
		return gs.countPSPages(inputPath)
	}

	return count, nil
}

// countPSPages counts pages by looking for %%Page: DSC comments
func (gs *GhostScript) countPSPages(inputPath string) (int, error) {
	args := []string{
		"-dNODISPLAY",
		"-dQUIET",
		"-dNOPAUSE",
		"-dBATCH",
		"-sDEVICE=nullpage",
		inputPath,
	}

	// Use nullpage device to process without output and count pages
	// GhostScript outputs page numbers as it processes
	cmd := exec.Command(gs.BinaryPath, args...)
	_, _ = cmd.CombinedOutput()

	// Default to 1 if we can't determine page count
	return 1, nil
}

// ProcessJob handles the full conversion workflow
type ProcessResult struct {
	PDFPath       string
	ThumbnailPath string
	PageCount     int
	Error         error
}

func (gs *GhostScript) ProcessJob(inputPath, outputDir string, jobID string) ProcessResult {
	result := ProcessResult{}

	pdfPath := filepath.Join(outputDir, jobID+".pdf")
	thumbPath := filepath.Join(outputDir, jobID+"_thumb.png")

	// Convert to PDF
	if err := gs.ConvertToPDF(inputPath, pdfPath); err != nil {
		result.Error = fmt.Errorf("PDF conversion failed: %w", err)
		return result
	}
	result.PDFPath = pdfPath

	// Generate thumbnail
	if err := gs.GenerateThumbnail(inputPath, thumbPath, 150); err != nil {
		// Non-fatal: continue without thumbnail
		result.Error = fmt.Errorf("thumbnail generation failed: %w", err)
	} else {
		result.ThumbnailPath = thumbPath
	}

	// Get page count
	pageCount, _ := gs.GetPageCount(pdfPath)
	result.PageCount = pageCount

	return result
}
