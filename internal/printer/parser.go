package printer

import (
	"bufio"
	"io"
	"regexp"
	"strings"
)

// PostScriptMetadata contains metadata extracted from PostScript DSC comments
type PostScriptMetadata struct {
	Title        string
	Creator      string // Application name
	CreationDate string
	For          string // Username or hostname
	Pages        int
	BoundingBox  string
}

var (
	dscTitleRegex    = regexp.MustCompile(`^%%Title:\s*(.+)$`)
	dscCreatorRegex  = regexp.MustCompile(`^%%Creator:\s*(.+)$`)
	dscDateRegex     = regexp.MustCompile(`^%%CreationDate:\s*(.+)$`)
	dscForRegex      = regexp.MustCompile(`^%%For:\s*(.+)$`)
	dscPagesRegex    = regexp.MustCompile(`^%%Pages:\s*(\d+)`)
	dscBBoxRegex     = regexp.MustCompile(`^%%BoundingBox:\s*(.+)$`)
	dscEndComments   = regexp.MustCompile(`^%%EndComments`)
)

// ParsePostScriptMetadata reads PostScript DSC comments from the stream
func ParsePostScriptMetadata(r io.Reader) PostScriptMetadata {
	meta := PostScriptMetadata{}
	scanner := bufio.NewScanner(r)

	// Read until we hit EndComments or non-comment line
	for scanner.Scan() {
		line := scanner.Text()

		// DSC comments start with %%
		if !strings.HasPrefix(line, "%%") && !strings.HasPrefix(line, "%!") {
			// Continue reading for potential later DSC comments
			continue
		}

		if dscEndComments.MatchString(line) {
			// Keep scanning to consume the rest of the file
			continue
		}

		if matches := dscTitleRegex.FindStringSubmatch(line); len(matches) > 1 {
			meta.Title = strings.TrimSpace(matches[1])
			// Remove parentheses if present (PostScript string format)
			meta.Title = strings.Trim(meta.Title, "()")
		}

		if matches := dscCreatorRegex.FindStringSubmatch(line); len(matches) > 1 {
			meta.Creator = strings.TrimSpace(matches[1])
		}

		if matches := dscDateRegex.FindStringSubmatch(line); len(matches) > 1 {
			meta.CreationDate = strings.TrimSpace(matches[1])
		}

		if matches := dscForRegex.FindStringSubmatch(line); len(matches) > 1 {
			meta.For = strings.TrimSpace(matches[1])
			meta.For = strings.Trim(meta.For, "()")
		}

		if matches := dscBBoxRegex.FindStringSubmatch(line); len(matches) > 1 {
			meta.BoundingBox = strings.TrimSpace(matches[1])
		}
	}

	return meta
}
