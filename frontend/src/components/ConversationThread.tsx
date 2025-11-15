import React, { useState } from 'react';
import { GetConversationResponse } from '../types';
import './ConversationThread.css';

interface ConversationThreadProps {
  conversation: GetConversationResponse;
  currentDeskId: string;
  onReply: (body: string) => void;
}

function ConversationThread({ conversation, currentDeskId, onReply }: ConversationThreadProps) {
  const [replyBody, setReplyBody] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyBody.trim()) {
      onReply(replyBody.trim());
      setReplyBody('');
      setShowReplyForm(false);
    }
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
      return `(${id.slice(0, 3)}) ${id.slice(3, 6)}-${id.slice(6)}`;
    }
    return id;
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
        </div>
      </div>

      <div className="conversation-messages">
        {conversation.mivs.map((miv, index) => {
          const isFromMe = miv.from === currentDeskId;
          
          return (
            <div
              key={miv.id}
              className={`message ${isFromMe ? 'message-sent' : 'message-received'}`}
            >
              <div className="message-header">
                <div className="message-from">
                  <span className="from-label">{isFromMe ? 'You' : formatDeskId(miv.from)}</span>
                  <span className="message-seq">#{miv.seq_no}</span>
                </div>
                <div className="message-time">{formatDate(miv.created_at)}</div>
              </div>
              
              <div className="message-body">
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
        {showReplyForm ? (
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
          <button
            className="btn btn-reply"
            onClick={() => setShowReplyForm(true)}
          >
            Reply to conversation
          </button>
        )}
      </div>
    </div>
  );
}

export default ConversationThread;
