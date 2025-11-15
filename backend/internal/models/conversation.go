package models

import "time"

// Conversation represents a threaded conversation
type Conversation struct {
	ID        string    `json:"id"`         // Unique conversation ID
	Subject   string    `json:"subject"`    // Conversation subject
	DeskID    string    `json:"desk_id"`    // Desk this conversation belongs to
	CreatedAt time.Time `json:"created_at"` // When the conversation was created
	UpdatedAt time.Time `json:"updated_at"` // When the conversation was last updated
	MivCount  int       `json:"miv_count"`  // Number of mivs in this conversation
}

// ConversationMiv represents a miv within a conversation thread
type ConversationMiv struct {
	ID             string     `json:"id"`
	ConversationID string     `json:"conversation_id"` // Parent conversation ID
	SeqNo          int        `json:"seq_no"`          // Sequence number in conversation (1, 2, 3, ...)
	From           string     `json:"from"`            // Sender desk ID
	To             string     `json:"to"`              // Recipient desk ID
	Subject        string     `json:"subject"`         // Miv subject (usually conversation subject for replies)
	Body           string     `json:"body"`            // Encrypted miv body
	State          MivState   `json:"state"`           // Current state
	CreatedAt      time.Time  `json:"created_at"`      // When the miv was created
	SentAt         *time.Time `json:"sent_at,omitempty"`     // When the miv was sent
	ReceivedAt     *time.Time `json:"received_at,omitempty"` // When the miv was received
	ReadAt         *time.Time `json:"read_at,omitempty"`     // When the miv was read
	IsEncrypted    bool       `json:"is_encrypted"`    // Whether the body is encrypted
}

// CreateConversationRequest represents a request to create a new conversation
type CreateConversationRequest struct {
	To      string `json:"to" binding:"required"`
	Subject string `json:"subject" binding:"required"`
	Body    string `json:"body" binding:"required"`
}

// ReplyToConversationRequest represents a request to reply in a conversation
type ReplyToConversationRequest struct {
	Body string `json:"body" binding:"required"`
}

// ListConversationsResponse represents a list of conversations with metadata
type ListConversationsResponse struct {
	Conversations []*ConversationWithLatest `json:"conversations"`
	Total         int                       `json:"total"`
}

// ConversationWithLatest includes conversation with latest miv info
type ConversationWithLatest struct {
	Conversation *Conversation `json:"conversation"`
	LatestMiv    *ConversationMiv `json:"latest_miv,omitempty"`
	UnreadCount  int           `json:"unread_count"`
}

// GetConversationResponse represents a conversation with all its mivs
type GetConversationResponse struct {
	Conversation *Conversation      `json:"conversation"`
	Mivs         []*ConversationMiv `json:"mivs"`
}
