package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jadefox10200/missiv/backend/internal/crypto"
	"github.com/jadefox10200/missiv/backend/internal/models"
)

// Upload handler constants
const (
	maxFileSize         = 10 * 1024 * 1024 // 10MB
	maxFileExtLength    = 10               // Maximum length for file extension
	maxFilenameLength   = 100              // Maximum length for sanitized filename
)

// Compiled regex for filename sanitization (compiled once at package level)
var safeFilenameRegex = regexp.MustCompile(`[^a-zA-Z0-9._-]`)

// Account handlers

func (s *Server) registerAccount(c *gin.Context) {
	var req models.RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Hash the password
	passwordHash, err := crypto.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Hash security question answers
	birthdayHash, err := crypto.HashPassword(req.Birthday)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash security answers"})
		return
	}

	firstPetHash, err := crypto.HashPassword(req.FirstPetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash security answers"})
		return
	}

	motherMaidenHash, err := crypto.HashPassword(req.MotherMaiden)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash security answers"})
		return
	}

	// Create account
	account := &models.Account{
		Username:         req.Username,
		PasswordHash:     passwordHash,
		DisplayName:      req.DisplayName,
		Desks:            []string{},
		BirthdayHash:     birthdayHash,
		FirstPetNameHash: firstPetHash,
		MotherMaidenHash: motherMaidenHash,
	}

	if err := s.storage.CreateAccount(account); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create first desk for the account
	keyPair, err := crypto.GenerateKeyPair()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate key pair"})
		return
	}

	deskID, err := crypto.GeneratePhoneStyleID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate desk ID"})
		return
	}

	desk := &models.Desk{
		ID:                deskID,
		AccountID:         account.ID,
		PublicKey:         crypto.PublicKeyToBase64(keyPair.PublicKey),
		Name:              "Primary Desk",
		AutoIndent:        true,
		FontFamily:        "Georgia, serif",
		FontSize:          "14px",
		DefaultSalutation: "Dear [User],",
		DefaultClosure:    "Sincerely,",
	}

	if err := s.storage.CreateDesk(desk, keyPair.PrivateKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create desk"})
		return
	}

	// Update account with first desk
	account.Desks = []string{deskID}
	account.ActiveDesk = deskID
	if err := s.storage.UpdateAccount(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update account"})
		return
	}

	// Generate token
	token, err := crypto.GenerateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, models.LoginResponse{
		Account: account,
		Token:   token,
	})
}

func (s *Server) loginAccount(c *gin.Context) {
	var req models.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get account by username
	account, err := s.storage.GetAccountByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	// Verify password
	valid, err := crypto.VerifyPassword(req.Password, account.PasswordHash)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	// Generate token
	token, err := crypto.GenerateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{
		Account: account,
		Token:   token,
	})
}

func (s *Server) recoverPassword(c *gin.Context) {
	var req models.RecoverPasswordRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get account by username
	account, err := s.storage.GetAccountByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials or security answers"})
		return
	}

	// Verify all security answers
	validBirthday, err := crypto.VerifyPassword(req.Birthday, account.BirthdayHash)
	if err != nil || !validBirthday {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials or security answers"})
		return
	}

	validPetName, err := crypto.VerifyPassword(req.FirstPetName, account.FirstPetNameHash)
	if err != nil || !validPetName {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials or security answers"})
		return
	}

	validMaiden, err := crypto.VerifyPassword(req.MotherMaiden, account.MotherMaidenHash)
	if err != nil || !validMaiden {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials or security answers"})
		return
	}

	// Hash new password
	newPasswordHash, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash new password"})
		return
	}

	// Update password
	account.PasswordHash = newPasswordHash
	if err := s.storage.UpdateAccount(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

// Desk handlers

func (s *Server) listDesks(c *gin.Context) {
	// In a real implementation, get accountID from authenticated user
	// For now, list all desks
	accountID := c.Query("account_id")
	if accountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_id is required"})
		return
	}

	desks, err := s.storage.ListDesksByAccount(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, desks)
}

func (s *Server) createDesk(c *gin.Context) {
	var req models.CreateDeskRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, get accountID from authenticated user
	accountID := c.Query("account_id")
	if accountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_id is required"})
		return
	}

	// Generate key pair for the new desk
	keyPair, err := crypto.GenerateKeyPair()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate key pair"})
		return
	}

	// Generate desk ID
	deskID, err := crypto.GeneratePhoneStyleID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate desk ID"})
		return
	}

	desk := &models.Desk{
		ID:                deskID,
		AccountID:         accountID,
		PublicKey:         crypto.PublicKeyToBase64(keyPair.PublicKey),
		Name:              req.Name,
		AutoIndent:        true,
		FontFamily:        "Georgia, serif",
		FontSize:          "14px",
		DefaultSalutation: "Dear [User],",
		DefaultClosure:    "Sincerely,",
	}

	if err := s.storage.CreateDesk(desk, keyPair.PrivateKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create desk"})
		return
	}

	// Update account's desk list
	account, err := s.storage.GetAccountByID(accountID)
	if err == nil {
		account.Desks = append(account.Desks, deskID)
		s.storage.UpdateAccount(account)
	}

	c.JSON(http.StatusCreated, desk)
}

func (s *Server) switchDesk(c *gin.Context) {
	var req models.SwitchDeskRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, get accountID from authenticated user
	accountID := c.Query("account_id")
	if accountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_id is required"})
		return
	}

	// Verify desk belongs to account
	desk, err := s.storage.GetDesk(req.DeskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Desk not found"})
		return
	}

	if desk.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Desk does not belong to account"})
		return
	}

	// Update active desk
	account, err := s.storage.GetAccountByID(accountID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	account.ActiveDesk = req.DeskID
	if err := s.storage.UpdateAccount(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to switch desk"})
		return
	}

	c.JSON(http.StatusOK, account)
}

func (s *Server) updateDesk(c *gin.Context) {
	deskID := c.Param("desk_id")
	if deskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "desk_id is required"})
		return
	}

	var req models.UpdateDeskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing desk
	desk, err := s.storage.GetDesk(deskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Desk not found"})
		return
	}

	// TODO: Add authorization check to verify user owns this desk
	// This requires implementing proper authentication middleware

	// Update fields if provided
	if req.Name != nil {
		desk.Name = *req.Name
	}
	if req.AutoIndent != nil {
		desk.AutoIndent = *req.AutoIndent
	}
	if req.FontFamily != nil {
		desk.FontFamily = *req.FontFamily
	}
	if req.FontSize != nil {
		desk.FontSize = *req.FontSize
	}
	if req.DefaultSalutation != nil {
		desk.DefaultSalutation = *req.DefaultSalutation
	}
	if req.DefaultClosure != nil {
		desk.DefaultClosure = *req.DefaultClosure
	}

	if err := s.storage.UpdateDesk(desk); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update desk"})
		return
	}

	c.JSON(http.StatusOK, desk)
}

// Conversation handlers

func (s *Server) listConversations(c *gin.Context) {
	deskID := c.Query("desk_id")
	if deskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "desk_id is required"})
		return
	}

	conversations, err := s.storage.ListConversationsByDesk(deskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build response with latest miv and unread count
	var response []*models.ConversationWithLatest
	for _, conv := range conversations {
		mivs, err := s.storage.GetConversationMivs(conv.ID)
		if err != nil {
			continue
		}

		var latestMiv *models.ConversationMiv
		unreadCount := 0
		if len(mivs) > 0 {
			latestMiv = mivs[len(mivs)-1]
			for _, miv := range mivs {
				if miv.To == deskID && miv.ReadAt == nil {
					unreadCount++
				}
			}
		}

		response = append(response, &models.ConversationWithLatest{
			Conversation: conv,
			LatestMiv:    latestMiv,
			UnreadCount:  unreadCount,
		})
	}

	// Sort by updated_at descending
	sort.Slice(response, func(i, j int) bool {
		return response[i].Conversation.UpdatedAt.After(response[j].Conversation.UpdatedAt)
	})

	c.JSON(http.StatusOK, models.ListConversationsResponse{
		Conversations: response,
		Total:         len(response),
	})
}

func (s *Server) getConversation(c *gin.Context) {
	id := c.Param("id")
	deskID := c.Query("desk_id")

	conv, err := s.storage.GetConversation(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	mivs, err := s.storage.GetConversationMivs(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If desk_id is provided, adjust miv states based on desk perspective
	if deskID != "" {
		// Adjust states from the perspective of the querying desk
		for _, miv := range mivs {
			if miv.To == deskID {
				// For incoming mivs
				if miv.ReadAt == nil {
					miv.State = models.StateIN
				} else {
					// Check if we've replied to this miv
					hasReply := false
					for _, laterMiv := range mivs {
						if laterMiv.From == deskID && laterMiv.SeqNo > miv.SeqNo {
							hasReply = true
							break
						}
					}
					if !hasReply {
						miv.State = models.StatePENDING
					} else {
						// Has reply - clear the state so it doesn't appear in baskets
						miv.State = ""
					}
				}
			} else if miv.From == deskID {
				// For outgoing mivs, check if there's a reply or if it's forgotten
				hasReply := false
				for _, laterMiv := range mivs {
					if laterMiv.From != deskID && laterMiv.SeqNo > miv.SeqNo {
						hasReply = true
						break
					}
				}
				// Only show in SENT basket if not forgotten and no reply
				if !hasReply && !miv.IsForgotten {
					miv.State = models.StateSENT
				} else {
					// Has reply or is forgotten - clear the state so it doesn't appear in baskets
					miv.State = ""
				}
			}
		}

		// Note: Removed automatic marking as read when viewing conversation
		// Mivs must be explicitly marked as read using the /mivs/:id/read endpoint
	}

	c.JSON(http.StatusOK, models.GetConversationResponse{
		Conversation: conv,
		Mivs:         mivs,
	})
}

func (s *Server) createConversation(c *gin.Context) {
	var req models.CreateConversationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deskID := c.Query("desk_id")
	if deskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "desk_id is required"})
		return
	}

	// Validate that recipient desk exists
	_, err := s.storage.GetDesk(req.To)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Recipient desk '%s' does not exist. Please verify the desk number and try again.", req.To)})
		return
	}

	// Create conversation
	conv := &models.Conversation{
		Subject: req.Subject,
		DeskID:  deskID,
	}

	if err := s.storage.CreateConversation(conv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
		return
	}

	// Create first miv
	miv := &models.ConversationMiv{
		ConversationID: conv.ID,
		SeqNo:          1,
		From:           deskID,
		To:             req.To,
		Subject:        req.Subject,
		Body:           base64.StdEncoding.EncodeToString([]byte(req.Body)),
		State:          models.StateSENT, // Use SENT state for newly created mivs
		IsEncrypted:    false,
	}

	if err := s.storage.CreateConversationMiv(miv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create miv"})
		return
	}

	// Create notification for recipient
	notification := &models.Notification{
		DeskID:         req.To,
		Type:           models.NotificationTypeNewMiv,
		MivID:          miv.ID,
		ConversationID: conv.ID,
		Message:        fmt.Sprintf("New message from %s: %s", deskID, req.Subject),
		Read:           false,
	}
	s.storage.CreateNotification(notification)

	c.JSON(http.StatusCreated, models.GetConversationResponse{
		Conversation: conv,
		Mivs:         []*models.ConversationMiv{miv},
	})
}

func (s *Server) replyToConversation(c *gin.Context) {
	conversationID := c.Param("id")

	var req models.ReplyToConversationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deskID := c.Query("desk_id")
	if deskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "desk_id is required"})
		return
	}

	// Get conversation
	conv, err := s.storage.GetConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	// Get existing mivs to determine recipient
	mivs, err := s.storage.GetConversationMivs(conversationID)
	if err != nil || len(mivs) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get conversation mivs"})
		return
	}

	// Determine recipient (the other party in the conversation)
	var recipientID string
	for _, m := range mivs {
		if m.From != deskID {
			recipientID = m.From
			break
		}
		if m.To != deskID {
			recipientID = m.To
			break
		}
	}

	if recipientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not determine recipient"})
		return
	}

	// Create reply miv
	miv := &models.ConversationMiv{
		ConversationID: conversationID,
		From:           deskID,
		To:             recipientID,
		Subject:        conv.Subject,
		Body:           base64.StdEncoding.EncodeToString([]byte(req.Body)),
		State:          models.StateSENT, // Use SENT state for replies
		IsEncrypted:    false,
		IsAck:          req.IsAck,
	}

	if err := s.storage.CreateConversationMiv(miv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reply"})
		return
	}

	// If conversation was archived but we got a reply, unarchive it
	if conv.IsArchived {
		conv.IsArchived = false
		s.storage.UpdateConversation(conv)
	}

	// If this is an ACK, archive the conversation for the sender
	if req.IsAck {
		conv.IsArchived = true
		s.storage.UpdateConversation(conv)
	}

	// Create notification for recipient
	notifType := models.NotificationTypeReply
	message := fmt.Sprintf("Reply from %s in: %s", deskID, conv.Subject)
	if req.IsAck {
		message = fmt.Sprintf("ACK from %s in: %s", deskID, conv.Subject)
	}

	notification := &models.Notification{
		DeskID:         recipientID,
		Type:           notifType,
		MivID:          miv.ID,
		ConversationID: conversationID,
		Message:        message,
		Read:           false,
	}
	s.storage.CreateNotification(notification)

	c.JSON(http.StatusCreated, miv)
}

func (s *Server) archiveConversation(c *gin.Context) {
	conversationID := c.Param("id")

	// Get conversation
	conv, err := s.storage.GetConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	// Archive the conversation
	conv.IsArchived = true
	if err := s.storage.UpdateConversation(conv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive conversation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Conversation archived successfully", "conversation": conv})
}

// Notification handlers

func (s *Server) listNotifications(c *gin.Context) {
	deskID := c.Query("desk_id")
	if deskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "desk_id is required"})
		return
	}

	unreadOnly := c.Query("unread_only") == "true"

	notifications, err := s.storage.ListNotificationsByDesk(deskID, unreadOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	unreadCount := 0
	for _, notif := range notifications {
		if !notif.Read {
			unreadCount++
		}
	}

	c.JSON(http.StatusOK, models.ListNotificationsResponse{
		Notifications: notifications,
		UnreadCount:   unreadCount,
		Total:         len(notifications),
	})
}

func (s *Server) markNotificationAsRead(c *gin.Context) {
	notificationID := c.Param("id")

	notif, err := s.storage.GetNotification(notificationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	if err := s.storage.MarkNotificationAsRead(notificationID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	// If it's a read receipt notification, update the miv state
	if notif.Type == models.NotificationTypeReadReceipt {
		// Get all conversation mivs
		mivs, err := s.storage.GetConversationMivs(notif.ConversationID)
		if err == nil {
			for _, miv := range mivs {
				if miv.ID == notif.MivID && miv.State == models.StateOUT {
					miv.State = models.StateUNANSWERED
					s.storage.UpdateConversationMiv(miv)
					break
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// Miv read handlers

func (s *Server) markMivAsRead(c *gin.Context) {
	mivID := c.Param("id")
	deskID := c.Query("desk_id")

	// If desk_id is not provided, try to get it from the active desk
	// For now, we require desk_id to be explicitly provided
	if deskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "desk_id is required"})
		return
	}

	if err := s.storage.MarkConversationMivAsRead(mivID, deskID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get the updated miv to return
	miv, err := s.storage.GetConversationMiv(mivID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated miv"})
		return
	}

	c.JSON(http.StatusOK, miv)
}

// Miv forget handler

func (s *Server) forgetMiv(c *gin.Context) {
	mivID := c.Param("id")

	// Get the miv first to validate it exists
	miv, err := s.storage.GetConversationMiv(mivID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Miv not found"})
		return
	}

	// Mark the miv as forgotten
	miv.IsForgotten = true
	if err := s.storage.UpdateConversationMiv(miv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forget miv"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Miv forgotten successfully", "miv": miv})
}

// Contact handlers

func (s *Server) createContact(c *gin.Context) {
	deskID := c.Param("desk_id")

	var req models.CreateContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify desk exists
	_, err := s.storage.GetDesk(deskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Desk not found"})
		return
	}

	contact := &models.Contact{
		DeskID:       deskID,
		Name:         req.Name,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		GreetingName: req.GreetingName,
		DeskIDRef:    req.DeskIDRef,
		Notes:        req.Notes,
	}

	if err := s.storage.CreateContact(contact); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create contact"})
		return
	}

	c.JSON(http.StatusCreated, contact)
}

func (s *Server) listContacts(c *gin.Context) {
	deskID := c.Param("desk_id")

	// Verify desk exists
	_, err := s.storage.GetDesk(deskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Desk not found"})
		return
	}

	contacts, err := s.storage.ListContactsForDesk(deskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list contacts"})
		return
	}

	response := &models.ListContactsResponse{
		Contacts: contacts,
		Total:    len(contacts),
	}

	c.JSON(http.StatusOK, response)
}

func (s *Server) getContact(c *gin.Context) {
	contactID := c.Param("contact_id")

	contact, err := s.storage.GetContact(contactID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	c.JSON(http.StatusOK, contact)
}

func (s *Server) updateContact(c *gin.Context) {
	contactID := c.Param("contact_id")

	var req models.UpdateContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing contact
	existing, err := s.storage.GetContact(contactID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	// Update fields
	if req.Name != "" {
		existing.Name = req.Name
	}
	// Always update optional fields to allow clearing
	existing.FirstName = req.FirstName
	existing.LastName = req.LastName
	existing.GreetingName = req.GreetingName
	if req.DeskIDRef != "" {
		existing.DeskIDRef = req.DeskIDRef
	}
	existing.Notes = req.Notes

	if err := s.storage.UpdateContact(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update contact"})
		return
	}

	c.JSON(http.StatusOK, existing)
}

func (s *Server) deleteContact(c *gin.Context) {
	contactID := c.Param("contact_id")

	if err := s.storage.DeleteContact(contactID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// Upload handler - Production implementation
func (s *Server) uploadFile(c *gin.Context) {
	// Get the file from the request
	file, err := c.FormFile("upload")
	if err != nil {
		log.Printf("Upload error: No file in request - %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Validate file size (limit to 10MB)
	if file.Size > maxFileSize {
		log.Printf("Upload error: File too large - %d bytes (max: %d)", file.Size, maxFileSize)
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large. Maximum size is 10MB"})
		return
	}

	// Validate file type (only images)
	contentType := file.Header.Get("Content-Type")
	allowedTypes := map[string]string{
		"image/jpeg": ".jpg",
		"image/jpg":  ".jpg",
		"image/png":  ".png",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}

	expectedExt, validContentType := allowedTypes[contentType]
	if !validContentType {
		log.Printf("Upload error: Invalid content type - %s", contentType)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Only images are allowed"})
		return
	}

	// Additional security: Validate file signature (magic bytes)
	// Note: This validates the file header but does not protect against polyglot files
	// (files with valid image headers but malicious payloads). For higher security,
	// consider re-encoding images or using a dedicated image validation library.
	// Open the file to read the first few bytes
	fileContent, err := file.Open()
	if err != nil {
		log.Printf("Upload error: Failed to open file - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}
	defer fileContent.Close()

	// Read the first 512 bytes for magic number validation
	buffer := make([]byte, 512)
	_, err = fileContent.Read(buffer)
	if err != nil {
		log.Printf("Upload error: Failed to read file header - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file header"})
		return
	}

	// Validate magic bytes for common image formats
	isValidImage := false
	detectedExt := ""
	
	// JPEG: FF D8 FF
	if len(buffer) >= 3 && buffer[0] == 0xFF && buffer[1] == 0xD8 && buffer[2] == 0xFF {
		isValidImage = true
		detectedExt = ".jpg"
	}
	// PNG: 89 50 4E 47
	if len(buffer) >= 4 && buffer[0] == 0x89 && buffer[1] == 0x50 && buffer[2] == 0x4E && buffer[3] == 0x47 {
		isValidImage = true
		detectedExt = ".png"
	}
	// GIF: 47 49 46
	if len(buffer) >= 3 && buffer[0] == 0x47 && buffer[1] == 0x49 && buffer[2] == 0x46 {
		isValidImage = true
		detectedExt = ".gif"
	}
	// WebP: 52 49 46 46 (RIFF) with "WEBP" at offset 8
	if len(buffer) >= 12 && buffer[0] == 0x52 && buffer[1] == 0x49 && buffer[2] == 0x46 && buffer[3] == 0x46 &&
		buffer[8] == 0x57 && buffer[9] == 0x45 && buffer[10] == 0x42 && buffer[11] == 0x50 {
		isValidImage = true
		detectedExt = ".webp"
	}

	if !isValidImage {
		log.Printf("Upload error: File magic bytes do not match any supported image format")
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is not a valid image"})
		return
	}

	// Validate that the detected file type matches the declared content type
	if detectedExt != expectedExt {
		log.Printf("Upload error: Content-Type mismatch - declared: %s (%s), detected: %s", 
			contentType, expectedExt, detectedExt)
		c.JSON(http.StatusBadRequest, gin.H{"error": "File type mismatch. The file content does not match the declared type"})
		return
	}

	// Sanitize the original filename to prevent path traversal attacks
	// Use a whitelist approach: only allow alphanumeric, dash, underscore, and dot
	sanitizedFilename := sanitizeFilename(file.Filename)
	
	// Extract and validate the file extension
	ext := filepath.Ext(sanitizedFilename)
	if ext == "" || len(ext) > maxFileExtLength {
		// If no extension or suspicious extension, use the detected one
		ext = detectedExt
	}

	// Generate cryptographically secure unique filename
	uniqueID, err := generateUniqueID()
	if err != nil {
		log.Printf("Upload error: Failed to generate unique ID - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate unique filename"})
		return
	}

	// Construct filename: uniqueID + timestamp + extension
	filename := fmt.Sprintf("%s_%d%s", uniqueID, time.Now().Unix(), ext)

	// Define upload directory (configurable via environment variable)
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	// Create uploads directory if it doesn't exist
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("Upload error: Failed to create upload directory - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Use filepath.Join for safe path construction
	filePath := filepath.Join(uploadDir, filename)
	
	// Additional security: Ensure the final path is still within the upload directory
	absUploadDir, err := filepath.Abs(uploadDir)
	if err != nil {
		log.Printf("Upload error: Failed to get absolute path of upload directory - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	
	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		log.Printf("Upload error: Failed to get absolute path of file - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	
	if !strings.HasPrefix(absFilePath, absUploadDir) {
		log.Printf("Upload error: Path traversal attempt detected - file path outside upload directory")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}

	// Save the file
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		log.Printf("Upload error: Failed to save file - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return the full URL where the file can be accessed
	// Get server URL from environment or use default
	serverURL := os.Getenv("SERVER_URL")
	if serverURL == "" {
		// Construct from request or use default
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		host := c.Request.Host
		if host == "" {
			host = "localhost:8080"
		}
		serverURL = fmt.Sprintf("%s://%s", scheme, host)
	}
	
	fileURL := fmt.Sprintf("%s/uploads/%s", serverURL, filename)
	
	log.Printf("File uploaded successfully: %s (size: %d bytes, type: %s)", filename, file.Size, contentType)

	c.JSON(http.StatusOK, gin.H{
		"url": fileURL,
	})
}

// sanitizeFilename removes potentially dangerous characters from filenames
// Only allows alphanumeric characters, dots, hyphens, and underscores
func sanitizeFilename(filename string) string {
	// Remove any path components
	filename = filepath.Base(filename)
	
	// Replace spaces with underscores
	filename = strings.ReplaceAll(filename, " ", "_")
	
	// Use package-level regex to keep only safe characters: alphanumeric, dot, hyphen, underscore
	filename = safeFilenameRegex.ReplaceAllString(filename, "")
	
	// Prevent filenames that start with a dot (hidden files)
	if strings.HasPrefix(filename, ".") {
		filename = "file" + filename
	}
	
	// Limit filename length using package-level constant
	if len(filename) > maxFilenameLength {
		ext := filepath.Ext(filename)
		nameWithoutExt := strings.TrimSuffix(filename, ext)
		if len(nameWithoutExt) > maxFilenameLength-len(ext) {
			nameWithoutExt = nameWithoutExt[:maxFilenameLength-len(ext)]
		}
		filename = nameWithoutExt + ext
	}
	
	return filename
}

// generateUniqueID creates a cryptographically secure random identifier
func generateUniqueID() (string, error) {
	bytes := make([]byte, 16) // 128 bits of randomness
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
