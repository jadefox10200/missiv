import React, { useState, useEffect } from 'react';
import { ConversationMiv, GetConversationResponse, Contact } from '../types';
import * as api from '../api/client';
import './MivDetailWithContext.css';

interface MivDetailWithContextProps {
  miv: ConversationMiv;
  currentDeskId: string;
  onReply: (body: string, isAck?: boolean) => void;
}

function MivDetailWithContext({ miv, currentDeskId, onReply }: MivDetailWithContextProps) {
  const [conversation, setConversation] = useState<GetConversationResponse | null>(null);
  const [selectedMiv, setSelectedMiv] = useState<ConversationMiv>(miv);
  const [replyBody, setReplyBody] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [showAckConfirm, setShowAckConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [convResponse, contactsResponse] = await Promise.all([
          api.getConversation(miv.conversation_id),
          api.listContacts(currentDeskId)
        ]);
        setConversation(convResponse);
        setContacts(contactsResponse.contacts);
        // Find the current miv in the conversation
        const currentMiv = convResponse.mivs.find(m => m.id === miv.id) || miv;
        setSelectedMiv(currentMiv);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [miv, currentDeskId]);

  const handleMivClick = (clickedMiv: ConversationMiv) => {
    setSelectedMiv(clickedMiv);
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    await onReply(replyBody, false);
    setReplyBody('');
    setShowReply(false);
  };

  const handleAck = async () => {
    await onReply('ACK - Conversation ended', true);
    setShowAckConfirm(false);
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

  const getDisplayName = (deskIdRef: string) => {
    const contact = contacts.find(c => c.desk_id_ref === deskIdRef);
    return contact ? contact.name : formatPhoneId(deskIdRef);
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
              {selectedMiv.from === currentDeskId ? 'You' : getDisplayName(selectedMiv.from)}
            </span>
          </div>
          <div className="miv-meta-row">
            <span className="miv-label">To:</span>
            <span className="miv-value">
              {selectedMiv.to === currentDeskId ? 'You' : getDisplayName(selectedMiv.to)}
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
          <pre className="miv-body">
            {selectedMiv.is_ack ? (
              <em>ACK - Conversation ended</em>
            ) : (
              atob(selectedMiv.body)
            )}
          </pre>
        </div>

        <div className="miv-actions">
          {selectedMiv.to === currentDeskId && !showReply && !showAckConfirm && (
            <>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowReply(true)}
              >
                Reply
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

        {showAckConfirm && (
          <div className="ack-confirm">
            <p>Are you sure you want to end this conversation with an ACK?</p>
            <div className="ack-actions">
              <button onClick={handleAck} className="btn btn-danger">
                Yes, Send ACK
              </button>
              <button
                onClick={() => setShowAckConfirm(false)}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
                className="btn btn-danger"
                onClick={() => {
                  setShowReply(false);
                  setShowAckConfirm(true);
                }}
              >
                Send ACK
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
