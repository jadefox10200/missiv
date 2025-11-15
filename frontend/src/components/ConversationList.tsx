import React from 'react';
import { ConversationWithLatest } from '../types';
import './ConversationList.css';

interface ConversationListProps {
  conversations: ConversationWithLatest[];
  selectedConversationId?: string;
  onConversationClick: (conversation: ConversationWithLatest) => void;
}

function ConversationList({ 
  conversations, 
  selectedConversationId, 
  onConversationClick 
}: ConversationListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="conversation-list empty">
        <div className="empty-state">
          <p>No conversations yet</p>
          <p className="empty-hint">Start a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map(conv => (
        <div
          key={conv.conversation.id}
          className={`conversation-item ${
            selectedConversationId === conv.conversation.id ? 'selected' : ''
          } ${conv.unread_count > 0 ? 'unread' : ''}`}
          onClick={() => onConversationClick(conv)}
        >
          <div className="conversation-header">
            <div className="conversation-subject">{conv.conversation.subject}</div>
            <div className="conversation-time">
              {formatDate(conv.conversation.updated_at)}
            </div>
          </div>
          
          {conv.latest_miv && (
            <div className="conversation-preview">
              {atob(conv.latest_miv.body).substring(0, 100)}
              {atob(conv.latest_miv.body).length > 100 ? '...' : ''}
            </div>
          )}

          <div className="conversation-meta">
            <div className="conversation-count">
              {conv.conversation.miv_count} {conv.conversation.miv_count === 1 ? 'message' : 'messages'}
            </div>
            {conv.unread_count > 0 && (
              <div className="unread-badge">{conv.unread_count}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ConversationList;
