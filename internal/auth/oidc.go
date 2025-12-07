package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"github.com/alex4386/zikzi/internal/config"
	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCProvider handles OpenID Connect authentication
type OIDCProvider struct {
	config       config.OIDCConfig
	provider     *oidc.Provider
	oauth2Config oauth2.Config
	verifier     *oidc.IDTokenVerifier

	// State storage (in production, use Redis or database)
	states     map[string]stateData
	statesMu   sync.RWMutex
}

type stateData struct {
	CreatedAt   time.Time
	RedirectURL string
}

// OIDCClaims represents the claims from an ID token
type OIDCClaims struct {
	Subject           string   `json:"sub"`
	Email             string   `json:"email"`
	EmailVerified     bool     `json:"email_verified"`
	Name              string   `json:"name"`
	Picture           string   `json:"picture"`
	PreferredUsername string   `json:"preferred_username"`
	Groups            []string `json:"groups"` // OIDC groups claim
}

func NewOIDCProvider(cfg config.OIDCConfig) (*OIDCProvider, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, cfg.ProviderURL)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize OIDC provider: %w", err)
	}

	oauth2Config := oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})

	return &OIDCProvider{
		config:       cfg,
		provider:     provider,
		oauth2Config: oauth2Config,
		verifier:     verifier,
		states:       make(map[string]stateData),
	}, nil
}

// GenerateAuthURL creates an authorization URL with a random state
func (p *OIDCProvider) GenerateAuthURL(redirectAfterLogin string) (string, string, error) {
	state, err := generateRandomState()
	if err != nil {
		return "", "", err
	}

	p.statesMu.Lock()
	p.states[state] = stateData{
		CreatedAt:   time.Now(),
		RedirectURL: redirectAfterLogin,
	}
	p.statesMu.Unlock()

	// Clean up old states periodically
	go p.cleanupOldStates()

	url := p.oauth2Config.AuthCodeURL(state)
	return url, state, nil
}

// ValidateState checks if the state is valid and returns the redirect URL
func (p *OIDCProvider) ValidateState(state string) (string, bool) {
	p.statesMu.Lock()
	defer p.statesMu.Unlock()

	data, exists := p.states[state]
	if !exists {
		return "", false
	}

	// State expires after 10 minutes
	if time.Since(data.CreatedAt) > 10*time.Minute {
		delete(p.states, state)
		return "", false
	}

	delete(p.states, state)
	return data.RedirectURL, true
}

// ExchangeCode exchanges an authorization code for tokens and validates the ID token
func (p *OIDCProvider) ExchangeCode(ctx context.Context, code string) (*OIDCClaims, error) {
	token, err := p.oauth2Config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("no id_token in response")
	}

	idToken, err := p.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify ID token: %w", err)
	}

	var claims OIDCClaims
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}

	return &claims, nil
}

func (p *OIDCProvider) cleanupOldStates() {
	p.statesMu.Lock()
	defer p.statesMu.Unlock()

	for state, data := range p.states {
		if time.Since(data.CreatedAt) > 10*time.Minute {
			delete(p.states, state)
		}
	}
}

func generateRandomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
