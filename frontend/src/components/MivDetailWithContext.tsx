import React, { useState, useEffect } from 'react';
import { ConversationMiv, GetConversationResponse } from '../types';
import * as api from '../api/client';
import './MivDetailWithContext.css';

interface MivDetailWithContextProps {
  miv: ConversationMiv;
  currentDeskId: string;
  onReply: (body: string) => void;
}

function MivDetailWithContext({ miv, currentDeskId, onReply }: MivDetailWithContextProps) {
  const [conversation, setConversation] = useState<GetConversationResponse | null>(null);
  const [selectedMiv, setSelectedMiv] = useState<ConversationMiv>(miv);
  const [replyBody, setReplyBody] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversation = async () => {
      setLoading(true);
      try {
        const response = await api.getConversation(miv.conversation_id);
        setConversation(response);
        // Find the current miv in the conversation
        const currentMiv = response.mivs.find(m => m.id === miv.id) || miv;
        setSelectedMiv(currentMiv);
      } catch (err) {
        console.error('Failed to load conversation:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [miv]);

  const handleMivClick = (clickedMiv: ConversationMiv) => {
    setSelectedMiv(clickedMiv);
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    await onReply(replyBody);
    setReplyBody('');
    setShowReply(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatPhoneId = (id: string) => {
    if (id.length === 10) {
      return `(${id.slice(0, 3)}) ${id.slice(3, 6)}-${id.slice(6)}`;
    }
    return id;
  };

  if (loading || !conversation) {
    return (
      <div className="miv-detail-with-context">
        <div className="loading">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="miv-detail-with-context">
      {/* Conversation thread icons */}
      <div className="thread-context">
        <div className="thread-header">
          <h3>Conversation Thread</h3>
          <span className="thread-count">{conversation.mivs.length} messages</span>
        </div>
        <div className="thread-icons">
          {conversation.mivs.map((m, index) => (
            <div
              key={m.id}
              className={`thread-icon ${m.id === selectedMiv.id ? 'active' : ''} ${
                m.from === currentDeskId ? 'outgoing' : 'incoming'
              }`}
              onClick={() => handleMivClick(m)}
              title={`Message #${m.seq_no} - ${m.from === currentDeskId ? 'You' : formatPhoneId(m.from)}`}
            >
              <span className="icon-number">{m.seq_no}</span>
              <span className="icon-direction">{m.from === currentDeskId ? '→' : '←'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected miv detail */}
      <div className="miv-detail-content">
        <div className="miv-detail-header">
          <div className="miv-meta-row">
            <span className="miv-label">From:</span>
            <span className="miv-value">
              {selectedMiv.from === currentDeskId ? 'You' : formatPhoneId(selectedMiv.from)}
            </span>
          </div>
          <div className="miv-meta-row">
            <span className="miv-label">To:</span>
            <span className="miv-value">
              {selectedMiv.to === currentDeskId ? 'You' : formatPhoneId(selectedMiv.to)}
            </span>
          </div>
          <div className="miv-meta-row">
            <span className="miv-label">Date:</span>
            <span className="miv-value">{formatDate(selectedMiv.created_at)}</span>
          </div>
          <div className="miv-meta-row">
            <span className="miv-label">Sequence:</span>
            <span className="miv-value">#{selectedMiv.seq_no} in conversation</span>
          </div>
        </div>

        <div className="miv-subject-section">
          <h2>{selectedMiv.subject}</h2>
        </div>

        <div className="miv-body-section">
          <pre className="miv-body">{atob(selectedMiv.body)}</pre>
        </div>

        <div className="miv-actions">
          {selectedMiv.to === currentDeskId && !showReply && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowReply(true)}
            >
              Reply
            </button>
          )}
        </div>

        {showReply && (
          <form onSubmit={handleReplySubmit} className="reply-form">
            <h3>Reply</h3>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write your reply..."
              rows={6}
              required
            />
            <div className="reply-actions">
              <button type="submit" className="btn btn-primary">
                Send Reply
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowReply(false);
                  setReplyBody('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default MivDetailWithContext;
