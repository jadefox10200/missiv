package models

import "time"

// Account represents a user account with authentication
type Account struct {
	ID           string    `json:"id"`            // Unique account ID
	Username     string    `json:"username"`      // Username for login
	PasswordHash string    `json:"-"`             // Argon2 hashed password (not exposed in JSON)
	Email        string    `json:"email"`         // Email address
	DisplayName  string    `json:"display_name"`  // Display name
	CreatedAt    time.Time `json:"created_at"`    // When the account was created
	UpdatedAt    time.Time `json:"updated_at"`    // When the account was last updated
	Desks        []string  `json:"desks"`         // List of desk IDs (zIDs) this account owns
	ActiveDesk   string    `json:"active_desk"`   // Currently active desk ID
}

// Desk represents a desk/identity that belongs to an account
type Desk struct {
	ID         string    `json:"id"`          // Phone-number-style ID (zID)
	AccountID  string    `json:"account_id"`  // Parent account ID
	PublicKey  string    `json:"public_key"`  // Curve25519 public key (base64)
	Name       string    `json:"name"`        // Display name for this desk
	CreatedAt  time.Time `json:"created_at"`  // When the desk was created
}

// RegisterRequest represents an account registration request
type RegisterRequest struct {
	Username    string `json:"username" binding:"required,min=3,max=32"`
	Password    string `json:"password" binding:"required,min=8"`
	Email       string `json:"email" binding:"required,email"`
	DisplayName string `json:"display_name" binding:"required"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents a successful login response
type LoginResponse struct {
	Account *Account `json:"account"`
	Token   string   `json:"token"` // JWT token for authentication
}

// CreateDeskRequest represents a request to create a new desk
type CreateDeskRequest struct {
	Name string `json:"name" binding:"required"`
}

// SwitchDeskRequest represents a request to switch active desk
type SwitchDeskRequest struct {
	DeskID string `json:"desk_id" binding:"required"`
}
