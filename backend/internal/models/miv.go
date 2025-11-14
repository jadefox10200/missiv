package models

import "time"

// MivState represents the state of a miv
type MivState string

const (
	StateIN       MivState = "IN"       // Received mivs in inbox
	StatePENDING  MivState = "PENDING"  // Mivs being sent
	StateOUT      MivState = "OUT"      // Successfully sent mivs
	StateARCHIVED MivState = "ARCHIVED" // Archived mivs
)

// Miv represents a message in the Missiv system
type Miv struct {
	ID          string    `json:"id"`
	From        string    `json:"from"`        // Phone-number-style sender ID
	To          string    `json:"to"`          // Phone-number-style recipient ID
	Subject     string    `json:"subject"`     // Miv subject
	Body        string    `json:"body"`        // Encrypted miv body
	State       MivState  `json:"state"`       // Current state
	CreatedAt   time.Time `json:"created_at"`  // When the miv was created
	SentAt      *time.Time `json:"sent_at,omitempty"`     // When the miv was sent
	ReceivedAt  *time.Time `json:"received_at,omitempty"` // When the miv was received
	IsEncrypted bool      `json:"is_encrypted"` // Whether the body is encrypted
}

// CreateMivRequest represents a request to create a new miv
type CreateMivRequest struct {
	To      string `json:"to" binding:"required"`
	Subject string `json:"subject" binding:"required"`
	Body    string `json:"body" binding:"required"`
}

// UpdateStateRequest represents a request to update miv state
type UpdateStateRequest struct {
	State MivState `json:"state" binding:"required"`
}
