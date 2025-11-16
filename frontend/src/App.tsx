import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import DeskSwitcher from './components/DeskSwitcher';
import ConversationList from './components/ConversationList';
import ConversationThread from './components/ConversationThread';
import BasketView from './components/BasketView';
import MivDetailWithContext from './components/MivDetailWithContext';
import NotificationPanel from './components/NotificationPanel';
import ComposeMiv from './components/ComposeMiv';
import {
  Account,
  Desk,
  ConversationWithLatest,
  ConversationMiv,
  GetConversationResponse,
  Notification,
  RegisterRequest,
  CreateMivRequest,
  MivState,
} from './types';
import * as api from './api/client';
import './App.css';

type View = 'baskets' | 'conversations' | 'compose' | 'notifications';

function App() {
  // Authentication state
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Desk state
  const [desks, setDesks] = useState<Desk[]>([]);
  const [activeDesk, setActiveDesk] = useState<Desk | null>(null);

  // Basket view state (primary interface)
  const [selectedBasket, setSelectedBasket] = useState<MivState>('IN');
  const [selectedMiv, setSelectedMiv] = useState<ConversationMiv | null>(null);

  // Conversation view state (supplementary)
  const [conversations, setConversations] = useState<ConversationWithLatest[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<GetConversationResponse | null>(null);
  const [currentView, setCurrentView] = useState<View>('baskets');

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load saved session on mount
  useEffect(() => {
    const savedAccount = localStorage.getItem('account');
    const savedToken = localStorage.getItem('token');

    if (savedAccount && savedToken) {
      try {
        const acc = JSON.parse(savedAccount);
        setAccount(acc);
        setToken(savedToken);
      } catch (e) {
        localStorage.removeItem('account');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  // Load desks when account is set
  useEffect(() => {
    const loadDesks = async () => {
      if (!account) return;

      try {
        const deskList = await api.listDesks(account.id);
        setDesks(deskList);

        if (deskList.length > 0 && !activeDesk) {
          const activeDeskId = account.active_desk || deskList[0].id;
          const desk = deskList.find(d => d.id === activeDeskId) || deskList[0];
          setActiveDesk(desk);
        }
      } catch (err: any) {
        console.error('Failed to load desks:', err);
        // If there's an authentication error, clear the session
        if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('not found'))) {
          alert('Your session is no longer valid. Please sign in again.');
          handleLogout();
        }
      }
    };

    if (account) {
      loadDesks();
    }
  }, [account, activeDesk]);

  // Load conversations and notifications when active desk changes
  useEffect(() => {
    const loadData = async () => {
      if (!activeDesk) return;

      try {
        const [convResponse, notifResponse] = await Promise.all([
          api.listConversations(activeDesk.id),
          api.listNotifications(activeDesk.id, false)
        ]);
        setConversations(convResponse.conversations);
        setNotifications(notifResponse.notifications);
        setUnreadCount(notifResponse.unread_count);
      } catch (err: any) {
        console.error('Failed to load data:', err);
        // If there's an authentication error, clear the session
        if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
          alert('Your session is no longer valid. Please sign in again.');
          handleLogout();
        }
      }
    };

    if (activeDesk) {
      loadData();

      // Poll for updates every 10 seconds
      const interval = setInterval(() => {
        loadData();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [activeDesk]);

  const refreshConversations = async () => {
    if (!activeDesk) return;
    try {
      const response = await api.listConversations(activeDesk.id);
      setConversations(response.conversations);
    } catch (err) {
      console.error('Failed to refresh conversations:', err);
    }
  };

  const refreshNotifications = async () => {
    if (!activeDesk) return;
    try {
      const response = await api.listNotifications(activeDesk.id, false);
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
    } catch (err) {
      console.error('Failed to refresh notifications:', err);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    const response = await api.login({ username, password });
    setAccount(response.account);
    setToken(response.token);
    localStorage.setItem('account', JSON.stringify(response.account));
    localStorage.setItem('token', response.token);
  };

  const handleRegister = async (request: RegisterRequest) => {
    const response = await api.register(request);
    setAccount(response.account);
    setToken(response.token);
    localStorage.setItem('account', JSON.stringify(response.account));
    localStorage.setItem('token', response.token);
  };

  const handleLogout = () => {
    setAccount(null);
    setToken(null);
    setDesks([]);
    setActiveDesk(null);
    setConversations([]);
    setNotifications([]);
    localStorage.removeItem('account');
    localStorage.removeItem('token');
  };

  const handleCreateDesk = async (name: string) => {
    if (!account) return;

    try {
      const newDesk = await api.createDesk(account.id, { name });
      setDesks([...desks, newDesk]);
    } catch (err) {
      console.error('Failed to create desk:', err);
    }
  };

  const handleSwitchDesk = async (deskId: string) => {
    if (!account) return;

    try {
      const updatedAccount = await api.switchDesk(account.id, { desk_id: deskId });
      setAccount(updatedAccount);
      localStorage.setItem('account', JSON.stringify(updatedAccount));

      const desk = desks.find(d => d.id === deskId);
      if (desk) {
        setActiveDesk(desk);
        setSelectedConversation(null);
      }
    } catch (err) {
      console.error('Failed to switch desk:', err);
    }
  };

  const handleMivClick = async (miv: ConversationMiv) => {
    setSelectedMiv(miv);
    // When clicking a miv in a basket, automatically mark it as read if it's incoming and unread
    if (miv.to === activeDesk?.id && !miv.read_at) {
      try {
        await api.markMivAsRead(miv.id);
        // Update the selected miv with read status
        const updatedMiv = { ...miv, read_at: new Date().toISOString() };
        setSelectedMiv(updatedMiv);
      } catch (err) {
        console.error('Failed to mark miv as read:', err);
      }
    }
  };

  const handleMivReply = async (body: string, isAck: boolean = false) => {
    if (!activeDesk || !selectedMiv) return;

    try {
      await api.replyToConversation(selectedMiv.conversation_id, activeDesk.id, { 
        body,
        is_ack: isAck 
      });
      
      // Reload the miv to show the updated conversation
      const response = await api.getConversation(selectedMiv.conversation_id, activeDesk.id);
      const updatedMiv = response.mivs.find(m => m.id === selectedMiv.id) || selectedMiv;
      setSelectedMiv(updatedMiv);
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  };

  const handleConversationClick = async (conv: ConversationWithLatest) => {
    try {
      // Pass desk_id to automatically mark messages as read
      const response = await api.getConversation(conv.conversation.id, activeDesk?.id);
      setSelectedConversation(response);
      setCurrentView('conversations');
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleSendConversation = async (request: CreateMivRequest) => {
    if (!activeDesk) return;

    try {
      const response = await api.createConversation(activeDesk.id, request);
      setSelectedConversation(response);
      setCurrentView('conversations');
      await refreshConversations();
    } catch (err) {
      console.error('Failed to create conversation:', err);
      throw err;
    }
  };

  const handleReply = async (body: string, isAck: boolean = false) => {
    if (!activeDesk || !selectedConversation) return;

    try {
      await api.replyToConversation(selectedConversation.conversation.id, activeDesk.id, { 
        body,
        is_ack: isAck 
      });
      
      // Reload conversation
      const response = await api.getConversation(selectedConversation.conversation.id, activeDesk.id);
      setSelectedConversation(response);
      await refreshConversations();
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.conversation_id) {
      try {
        // Pass desk_id to automatically mark messages as read
        const response = await api.getConversation(notification.conversation_id, activeDesk?.id);
        setSelectedConversation(response);
        setCurrentView('conversations');

        if (!notification.read) {
          await api.markNotificationAsRead(notification.id);
          await refreshNotifications();
        }
      } catch (err) {
        console.error('Failed to load conversation from notification:', err);
      }
    }
  };

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationAsRead(notificationId);
      await refreshNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="app loading">
        <div>Loading...</div>
      </div>
    );
  }

  if (!account || !token) {
    return <Auth onLogin={handleLogin} onRegister={handleRegister} />;
  }

  if (!activeDesk) {
    return (
      <div className="app loading">
        <div>Loading desk...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>Missiv</h1>
          <div className="user-info">
            <div className="user-name">{account.display_name}</div>
            <div className="user-username">@{account.username}</div>
          </div>
        </div>

        <DeskSwitcher
          desks={desks}
          activeDeskId={activeDesk.id}
          onSwitchDesk={handleSwitchDesk}
          onCreateDesk={handleCreateDesk}
        />

        <button
          onClick={() => setCurrentView('compose')}
          className="compose-btn"
        >
          + New Conversation
        </button>

        <nav className="nav-menu">
          <div className="nav-section">
            <h4>Baskets</h4>
            <button
              className={currentView === 'baskets' && selectedBasket === 'IN' ? 'active' : ''}
              onClick={() => {
                setCurrentView('baskets');
                setSelectedBasket('IN');
                setSelectedMiv(null);
              }}
            >
              📥 Inbox
            </button>
            <button
              className={currentView === 'baskets' && selectedBasket === 'PENDING' ? 'active' : ''}
              onClick={() => {
                setCurrentView('baskets');
                setSelectedBasket('PENDING');
                setSelectedMiv(null);
              }}
            >
              ⏳ Pending
            </button>
            <button
              className={currentView === 'baskets' && selectedBasket === 'SENT' ? 'active' : ''}
              onClick={() => {
                setCurrentView('baskets');
                setSelectedBasket('SENT');
                setSelectedMiv(null);
              }}
            >
              📤 Sent
            </button>
            <button
              className={currentView === 'baskets' && selectedBasket === 'ARCHIVED' ? 'active' : ''}
              onClick={() => {
                setCurrentView('baskets');
                setSelectedBasket('ARCHIVED');
                setSelectedMiv(null);
              }}
            >
              📁 Archived
            </button>
          </div>

          <div className="nav-section">
            <h4>Other</h4>
            <button
              className={currentView === 'conversations' ? 'active' : ''}
              onClick={() => setCurrentView('conversations')}
            >
              💬 Conversations
            </button>
            <button
              className={currentView === 'notifications' ? 'active' : ''}
              onClick={() => setCurrentView('notifications')}
            >
              🔔 Notifications
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            Sign Out
          </button>
        </div>
      </div>

      <div className="main-content">
        {currentView === 'compose' ? (
          <ComposeMiv
            onSend={handleSendConversation}
            onCancel={() => setCurrentView('baskets')}
          />
        ) : currentView === 'notifications' ? (
          <div className="notifications-view">
            <NotificationPanel
              notifications={notifications}
              onNotificationClick={handleNotificationClick}
              onMarkAsRead={handleMarkNotificationAsRead}
            />
          </div>
        ) : currentView === 'baskets' ? (
          <>
            <div className="basket-list-container">
              <BasketView
                deskId={activeDesk.id}
                selectedBasket={selectedBasket}
                onMivClick={handleMivClick}
                selectedMivId={selectedMiv?.id}
              />
            </div>
            <div className="basket-detail-container">
              {selectedMiv ? (
                <MivDetailWithContext
                  miv={selectedMiv}
                  currentDeskId={activeDesk.id}
                  onReply={handleMivReply}
                />
              ) : (
                <div className="empty-selection">
                  <p>Select a message to view</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="conversation-list-container">
              <ConversationList
                conversations={conversations}
                selectedConversationId={selectedConversation?.conversation.id}
                onConversationClick={handleConversationClick}
              />
            </div>
            <div className="conversation-thread-container">
              {selectedConversation ? (
                <ConversationThread
                  conversation={selectedConversation}
                  currentDeskId={activeDesk.id}
                  onReply={handleReply}
                />
              ) : (
                <div className="empty-conversation">
                  <p>Select a conversation to view</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
