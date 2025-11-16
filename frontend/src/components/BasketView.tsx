import React, { useState, useEffect } from 'react';
import { ConversationMiv, MivState } from '../types';
import * as api from '../api/client';
import './BasketView.css';

interface BasketViewProps {
  deskId: string;
  selectedBasket: MivState;
  onMivClick: (miv: ConversationMiv) => void;
  selectedMivId?: string;
}

function BasketView({ deskId, selectedBasket, onMivClick, selectedMivId }: BasketViewProps) {
  const [mivs, setMivs] = useState<ConversationMiv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMivs = async () => {
      setLoading(true);
      try {
        // Get all conversations and extract mivs matching the selected basket state
        const response = await api.listConversations(deskId);
        const allMivs: ConversationMiv[] = [];
        
        // Handle case where conversations might be null or undefined
        const conversations = response?.conversations || [];
        
        for (const conv of conversations) {
          // Skip archived conversations unless viewing archived basket
          if (conv.conversation.is_archived && selectedBasket !== 'ARCHIVED') {
            continue;
          }
          
          // Get full conversation to access all mivs
          const fullConv = await api.getConversation(conv.conversation.id);
          const filteredMivs = fullConv.mivs.filter(miv => {
            // Filter based on selected basket and desk perspective
            if (selectedBasket === 'IN') {
              // Unread received messages
              return miv.to === deskId && !miv.read_at;
            } else if (selectedBasket === 'PENDING') {
              // Read but not replied messages
              return miv.to === deskId && miv.read_at;
            } else if (selectedBasket === 'SENT') {
              // Sent messages without replies (combines old OUT and UNANSWERED)
              return miv.from === deskId;
            } else if (selectedBasket === 'ARCHIVED') {
              // Show all messages from archived conversations
              return conv.conversation.is_archived;
            }
            return false;
          });
          allMivs.push(...filteredMivs);
        }
        
        // Sort by most recent first
        allMivs.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        setMivs(allMivs);
      } catch (err) {
        console.error('Failed to load basket mivs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMivs();
  }, [deskId, selectedBasket]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatPhoneId = (id: string) => {
    if (id.length === 10) {
      return `(${id.slice(0, 3)}) ${id.slice(3, 6)}-${id.slice(6)}`;
    }
    return id;
  };

  const getBasketTitle = () => {
    switch (selectedBasket) {
      case 'IN':
        return 'Inbox';
      case 'PENDING':
        return 'Pending';
      case 'SENT':
        return 'Sent';
      case 'ARCHIVED':
        return 'Archived';
      default:
        return 'Messages';
    }
  };

  const getBasketDescription = () => {
    switch (selectedBasket) {
      case 'IN':
        return 'Unread received messages';
      case 'PENDING':
        return 'Messages you\'ve looked at but not answered';
      case 'SENT':
        return 'Sent messages awaiting replies';
      case 'ARCHIVED':
        return 'Archived conversations';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="basket-view">
        <div className="basket-header">
          <h2>{getBasketTitle()}</h2>
        </div>
        <div className="basket-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="basket-view">
      <div className="basket-header">
        <h2>{getBasketTitle()}</h2>
        <p className="basket-description">{getBasketDescription()}</p>
        <div className="basket-count">{mivs.length} {mivs.length === 1 ? 'message' : 'messages'}</div>
      </div>

      <div className="basket-list">
        {mivs.length === 0 ? (
          <div className="empty-state">
            <p>No messages in {getBasketTitle().toLowerCase()}</p>
          </div>
        ) : (
          mivs.map((miv) => (
            <div
              key={miv.id}
              className={`basket-item ${selectedMivId === miv.id ? 'selected' : ''}`}
              onClick={() => onMivClick(miv)}
            >
              {selectedBasket === 'IN' ? (
                // Simplified INBOX view: only from, date/time, and subject
                <>
                  <div className="basket-item-header">
                    <span className="basket-from">From: {formatPhoneId(miv.from)}</span>
                    <span className="basket-date">{formatDate(miv.created_at)}</span>
                  </div>
                  <div className="basket-subject">{miv.subject}</div>
                </>
              ) : (
                // Full view for other baskets
                <>
                  <div className="basket-item-header">
                    <span className="basket-from">
                      {miv.from === deskId ? `To: ${formatPhoneId(miv.to)}` : `From: ${formatPhoneId(miv.from)}`}
                    </span>
                    <span className="basket-date">{formatDate(miv.created_at)}</span>
                  </div>
                  <div className="basket-subject">{miv.subject}</div>
                  <div className="basket-preview">
                    {atob(miv.body).substring(0, 100)}
                    {atob(miv.body).length > 100 ? '...' : ''}
                  </div>
                  <div className="basket-meta">
                    <span className="basket-seq">#{miv.seq_no} in conversation</span>
                    {selectedBasket === 'SENT' && miv.read_at && (
                      <span className="basket-read">✓ Read</span>
                    )}
                    {selectedBasket === 'SENT' && !miv.read_at && (
                      <span className="basket-unread">○ Unread</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default BasketView;
