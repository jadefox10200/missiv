import React, { useState, useEffect } from 'react';
import { GetConversationResponse, Contact } from '../types';
import * as api from '../api/client';
import './ConversationThread.css';

interface ConversationThreadProps {
  conversation: GetConversationResponse;
  currentDeskId: string;
  onReply: (body: string, isAck?: boolean) => void;
  onArchive?: () => void;
}

function ConversationThread({ conversation, currentDeskId, onReply, onArchive }: ConversationThreadProps) {
  const [replyBody, setReplyBody] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showAckConfirm, setShowAckConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ackBody, setAckBody] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const loadContactsData = async () => {
      try {
        const response = await api.listContacts(currentDeskId);
        setContacts(response.contacts || []);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      }
    };
    
    loadContactsData();
  }, [currentDeskId]);

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyBody.trim()) {
      onReply(replyBody.trim(), false);
      setReplyBody('');
      setShowReplyForm(false);
    }
  };

  const handleAck = () => {
    const messageToSend = ackBody.trim() || 'ACK - Conversation ended';
    onReply(messageToSend, true);
    setShowAckConfirm(false);
    setAckBody('');
  };

  const handleDelete = async () => {
    try {
      await api.archiveConversation(conversation.conversation.id);
      setShowDeleteConfirm(false);
      if (onArchive) {
        onArchive();
      }
    } catch (err) {
      console.error('Failed to archive conversation:', err);
      alert('Failed to archive conversation. Please try again.');
    }
  };

  // Ping-pong style: only show reply buttons if latest miv is to us and unanswered
  const shouldShowReplyButtons = () => {
    if (!conversation || conversation.mivs.length === 0) return false;
    
    const latestMiv = conversation.mivs[conversation.mivs.length - 1];
    
    // Only show if the latest message is TO us (not from us)
    if (latestMiv.to !== currentDeskId) return false;
    
    // Don't show if archived
    if (conversation.conversation.is_archived) return false;
    
    return true;
  };

  const isLatestMivAck = () => {
    if (!conversation || conversation.mivs.length === 0) return false;
    const latestMiv = conversation.mivs[conversation.mivs.length - 1];
    return latestMiv.is_ack;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDeskId = (id: string) => {
    if (id.length === 10) {
      return `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6)}`;
    }
    return id;
  };

  const getDisplayName = (deskIdRef: string) => {
    const contact = contacts.find(c => c.desk_id_ref === deskIdRef);
    return contact ? contact.name : formatDeskId(deskIdRef);
  };

  if (!conversation) {
    return (
      <div className="conversation-thread empty">
        <div className="empty-state">
          <p>Select a conversation to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-thread">
      <div className="conversation-thread-header">
        <h2>{conversation.conversation.subject}</h2>
        <div className="thread-meta">
          {conversation.mivs.length} {conversation.mivs.length === 1 ? 'message' : 'messages'}
          {conversation.conversation.is_archived && (
            <span className="archived-badge"> • Archived</span>
          )}
        </div>
      </div>

      <div className="conversation-messages-inbox-style">
        {conversation.mivs.map((miv, index) => {
          const isFromMe = miv.from === currentDeskId;
          
          return (
            <div
              key={miv.id}
              className="message-inbox-item"
            >
              {/* INBOX-style layout: FROM, DATE, SUBJECT (inline) */}
              <div className="message-inbox-header">
                <span className="message-inbox-from">
                  {isFromMe ? `To: ${getDisplayName(miv.to)}` : `From: ${getDisplayName(miv.from)}`}
                </span>
                <span className="message-inbox-date">{formatDate(miv.created_at)}</span>
                <span className="message-inbox-seq">#{miv.seq_no}</span>
              </div>
              
              <div className="message-inbox-body">
                {miv.is_ack && <span className="ack-badge">[ACK] </span>}
                {atob(miv.body)}
              </div>

              {miv.read_at && (
                <div className="message-status">
                  Read {formatDate(miv.read_at)}
                </div>
              )}
              
              {!miv.read_at && miv.sent_at && isFromMe && (
                <div className="message-status">
                  Sent {formatDate(miv.sent_at)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="conversation-reply">
        {shouldShowReplyButtons() && (
          <>
            {showDeleteConfirm ? (
              <div className="delete-confirm">
                <h3>Archive Conversation</h3>
                <p>Are you sure you want to archive this conversation? It will be removed from your inbox.</p>
                <div className="delete-actions">
                  <button onClick={handleDelete} className="btn btn-danger">
                    Yes, Archive
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : showAckConfirm ? (
              <div className="ack-confirm">
                <h3>Send Acknowledgment</h3>
                <p>Send an acknowledgment message? The recipient can reply to continue the conversation or delete it to end.</p>
                <textarea
                  value={ackBody}
                  onChange={(e) => setAckBody(e.target.value)}
                  placeholder="Optional: Type your acknowledgment message..."
                  rows={3}
                />
                <div className="ack-actions">
                  <button onClick={handleAck} className="btn btn-danger">
                    Yes, Send ACK
                  </button>
                  <button
                    onClick={() => {
                      setShowAckConfirm(false);
                      setAckBody('');
                    }}
                    className="btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : showReplyForm ? (
              <form onSubmit={handleReply} className="reply-form">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type your reply..."
                  rows={4}
                  autoFocus
                />
                <div className="reply-actions">
                  <button type="submit" className="btn btn-primary">
                    Send Reply
                  </button>
                  {!isLatestMivAck() && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        setShowReplyForm(false);
                        setShowAckConfirm(true);
                      }}
                    >
                      Send ACK
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyBody('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="reply-buttons">
                {isLatestMivAck() ? (
                  // For ACK mivs, show "Answer" and "Delete" buttons
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowReplyForm(true)}
                    >
                      Answer
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  // For non-ACK mivs, show "Reply" and "Send ACK" buttons
                  <>
                    <button
                      className="btn btn-reply"
                      onClick={() => setShowReplyForm(true)}
                    >
                      Reply to conversation
                    </button>
                    <button
                      className="btn btn-ack"
                      onClick={() => setShowAckConfirm(true)}
                    >
                      Send ACK
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ConversationThread;
