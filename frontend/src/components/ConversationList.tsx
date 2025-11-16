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

  if (!conversations || conversations.length === 0) {
    return (
      <div className="conversation-list">
        <div className="conversation-list-header">
          <h2>Conversations</h2>
          <p className="conversation-description">All your conversation threads</p>
          <div className="conversation-count">0 conversations</div>
        </div>
        <div className="empty-state">
          <p>No conversations yet</p>
          <p className="empty-hint">Start a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Conversations</h2>
        <p className="conversation-description">All your conversation threads</p>
        <div className="conversation-count">{conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}</div>
      </div>

      <div className="conversation-list-items">
        {conversations.map(conv => (
          <div
            key={conv.conversation.id}
            className={`conversation-item ${
              selectedConversationId === conv.conversation.id ? 'selected' : ''
            } ${conv.unread_count > 0 ? 'unread' : ''}`}
            onClick={() => onConversationClick(conv)}
          >
            <div className="conversation-item-header">
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
    </div>
  );
}

export default ConversationList;
