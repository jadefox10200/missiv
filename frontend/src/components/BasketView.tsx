import React, { useState, useEffect } from 'react';
import { ConversationMiv, MivState, Contact, ConversationWithLatest } from '../types';
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
  const [archivedConversations, setArchivedConversations] = useState<ConversationWithLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const loadMivs = async () => {
      setLoading(true);
      try {
        // Load contacts first
        const contactsResponse = await api.listContacts(deskId);
        setContacts(contactsResponse.contacts);
        
        // Get all conversations and extract mivs matching the selected basket state
        const response = await api.listConversations(deskId);
        const allMivs: ConversationMiv[] = [];
        
        // Handle case where conversations might be null or undefined
        const conversations = response?.conversations || [];
        
        // Handle ARCHIVED view separately - show conversations instead of mivs
        if (selectedBasket === 'ARCHIVED') {
          const archived = conversations.filter(conv => conv.conversation.is_archived);
          setArchivedConversations(archived);
          setMivs([]);
        } else {
          setArchivedConversations([]);
          
          for (const conv of conversations) {
            // Skip archived conversations for non-archived baskets
            if (conv.conversation.is_archived) {
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
                // Read but not replied messages - exclude if there's a reply from this desk after it
                if (miv.to !== deskId || !miv.read_at) {
                  return false;
                }
                // Check if there's any miv from this desk with a higher seq_no (meaning we replied)
                const hasReply = fullConv.mivs.some(
                  laterMiv => laterMiv.from === deskId && laterMiv.seq_no > miv.seq_no
                );
                return !hasReply; // Only include if not answered
              } else if (selectedBasket === 'SENT') {
                // Sent messages without replies - only show unanswered
                if (miv.from !== deskId) {
                  return false;
                }
                // Check if there's any reply from the recipient with a higher seq_no
                const hasReply = fullConv.mivs.some(
                  laterMiv => laterMiv.from !== deskId && laterMiv.seq_no > miv.seq_no
                );
                return !hasReply; // Only include if not answered
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
        }
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
      return `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6)}`;
    }
    return id;
  };

  const getDisplayName = (deskIdRef: string) => {
    const contact = contacts.find(c => c.desk_id_ref === deskIdRef);
    return contact ? contact.name : formatPhoneId(deskIdRef);
  };

  const getConversationPartner = (conv: ConversationWithLatest) => {
    // Get the "other person" in the conversation
    if (!conv.latest_miv) return 'Unknown';
    
    // If the latest miv is from us, the partner is the recipient
    const partnerDeskId = conv.latest_miv.from === deskId 
      ? conv.latest_miv.to 
      : conv.latest_miv.from;
    
    return getDisplayName(partnerDeskId);
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
        {selectedBasket !== 'ARCHIVED' && (
          <div className="basket-count">{mivs.length} {mivs.length === 1 ? 'message' : 'messages'}</div>
        )}
      </div>

      <div className="basket-list">
        {selectedBasket === 'ARCHIVED' ? (
          archivedConversations.length === 0 ? (
            <div className="empty-state">
              <p>No archived conversations</p>
            </div>
          ) : (
            archivedConversations.map((conv) => (
              <div
                key={conv.conversation.id}
                className="basket-item conversation-format"
                onClick={() => conv.latest_miv && onMivClick(conv.latest_miv)}
              >
                {/* Mirror conversation list format: FROM (partner) • DATE/TIME (range) • SUBJECT • COUNT */}
                <div className="basket-item-row">
                  <span className="basket-from">
                    {getConversationPartner(conv)}
                  </span>
                  <span className="basket-separator">•</span>
                  <span className="basket-date-range">
                    {formatDate(conv.conversation.created_at)} - {formatDate(conv.conversation.updated_at)}
                  </span>
                  <span className="basket-separator">•</span>
                  <span className="basket-subject">{conv.conversation.subject}</span>
                  <span className="basket-separator">•</span>
                  <span className="basket-count-inline">
                    {conv.conversation.miv_count} {conv.conversation.miv_count === 1 ? 'miv' : 'mivs'}
                  </span>
                </div>
              </div>
            ))
          )
        ) : mivs.length === 0 ? (
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
              {/* Format varies by basket type */}
              <div className="basket-item-row">
                {selectedBasket === 'SENT' ? (
                  <>
                    <span className="basket-from">
                      To: {getDisplayName(miv.to)}
                    </span>
                    <span className="basket-subject">{miv.subject}</span>
                    <span className="basket-date">{formatDate(miv.created_at)}</span>
                    <span className="basket-icon" title={miv.read_at ? 'Read' : 'Unread'}>
                      {miv.read_at ? '✓' : '○'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="basket-from">
                      {miv.from === deskId ? `To: ${getDisplayName(miv.to)}` : `From: ${getDisplayName(miv.from)}`}
                    </span>
                    <span className="basket-date">{formatDate(miv.created_at)}</span>
                    <span className="basket-subject">{miv.subject}</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default BasketView;
