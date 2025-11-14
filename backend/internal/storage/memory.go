package storage

import (
	"fmt"
	"sync"
	"time"

	"github.com/jadefox10200/missiv/backend/internal/models"
)

// MemoryStorage provides in-memory storage for mivs and identities
// This is a simple implementation for initial setup. In production, use a database.
type MemoryStorage struct {
	mivs       map[string]*models.Miv
	identity   *models.Identity
	mivCounter int
	mu         sync.RWMutex
}

// NewMemoryStorage creates a new memory storage instance
func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		mivs: make(map[string]*models.Miv),
	}
}

// SetIdentity sets the current user identity
func (s *MemoryStorage) SetIdentity(identity *models.Identity) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.identity = identity
}

// GetIdentity returns the current user identity
func (s *MemoryStorage) GetIdentity() (*models.Identity, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.identity == nil {
		return nil, fmt.Errorf("identity not set")
	}
	
	return s.identity, nil
}

// CreateMiv creates a new miv
func (s *MemoryStorage) CreateMiv(miv *models.Miv) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if miv.ID == "" {
		s.mivCounter++
		miv.ID = fmt.Sprintf("miv-%d", s.mivCounter)
	}
	
	if miv.CreatedAt.IsZero() {
		miv.CreatedAt = time.Now()
	}
	
	s.mivs[miv.ID] = miv
	return nil
}

// GetMiv retrieves a miv by ID
func (s *MemoryStorage) GetMiv(id string) (*models.Miv, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	miv, exists := s.mivs[id]
	if !exists {
		return nil, fmt.Errorf("miv not found: %s", id)
	}
	
	return miv, nil
}

// ListMivs returns all mivs, optionally filtered by state
func (s *MemoryStorage) ListMivs(state models.MivState) ([]*models.Miv, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var result []*models.Miv
	
	for _, miv := range s.mivs {
		if state == "" || miv.State == state {
			result = append(result, miv)
		}
	}
	
	return result, nil
}

// UpdateMivState updates the state of a miv
func (s *MemoryStorage) UpdateMivState(id string, state models.MivState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	miv, exists := s.mivs[id]
	if !exists {
		return fmt.Errorf("miv not found: %s", id)
	}
	
	miv.State = state
	
	// Update timestamps based on state
	now := time.Now()
	switch state {
	case models.StateOUT:
		miv.SentAt = &now
	case models.StateIN:
		if miv.ReceivedAt == nil {
			miv.ReceivedAt = &now
		}
	}
	
	return nil
}

// DeleteMiv deletes a miv (for cleanup, though mivs are meant to be immutable)
func (s *MemoryStorage) DeleteMiv(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.mivs[id]; !exists {
		return fmt.Errorf("miv not found: %s", id)
	}
	
	delete(s.mivs, id)
	return nil
}
