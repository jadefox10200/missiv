package api

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/jadefox10200/missiv/backend/internal/crypto"
	"github.com/jadefox10200/missiv/backend/internal/models"
)

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
		ID:        deskID,
		AccountID: account.ID,
		PublicKey: crypto.PublicKeyToBase64(keyPair.PublicKey),
		Name:      "Primary Desk",
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
		ID:        deskID,
		AccountID: accountID,
		PublicKey: crypto.PublicKeyToBase64(keyPair.PublicKey),
		Name:      req.Name,
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
		State:          models.StatePENDING,
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
		State:          models.StatePENDING,
		IsEncrypted:    false,
	}

	if err := s.storage.CreateConversationMiv(miv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reply"})
		return
	}

	// Create notification for recipient
	notification := &models.Notification{
		DeskID:         recipientID,
		Type:           models.NotificationTypeReply,
		MivID:          miv.ID,
		ConversationID: conversationID,
		Message:        fmt.Sprintf("Reply from %s in: %s", deskID, conv.Subject),
		Read:           false,
	}
	s.storage.CreateNotification(notification)

	c.JSON(http.StatusCreated, miv)
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
