package models

import "time"

// Contact represents a saved contact for a desk
type Contact struct {
	ID        string    `json:"id"`          // Unique contact ID
	DeskID    string    `json:"desk_id"`     // Desk this contact belongs to
	Name      string    `json:"name"`        // Display name for the contact
	DeskIDRef string    `json:"desk_id_ref"` // The desk ID (phone number) this contact refers to
	Notes     string    `json:"notes"`       // Optional notes about the contact
	CreatedAt time.Time `json:"created_at"`  // When the contact was created
	UpdatedAt time.Time `json:"updated_at"`  // When the contact was last updated
}

// CreateContactRequest represents a request to create a new contact
type CreateContactRequest struct {
	Name      string `json:"name" binding:"required"`
	DeskIDRef string `json:"desk_id_ref" binding:"required"`
	Notes     string `json:"notes"`
}

// UpdateContactRequest represents a request to update a contact
type UpdateContactRequest struct {
	Name      string `json:"name"`
	DeskIDRef string `json:"desk_id_ref"`
	Notes     string `json:"notes"`
}

// ListContactsResponse represents a list of contacts
type ListContactsResponse struct {
	Contacts []*Contact `json:"contacts"`
	Total    int        `json:"total"`
}
