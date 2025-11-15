export type MivState = 'IN' | 'PENDING' | 'OUT' | 'UNANSWERED' | 'ARCHIVED';

export type NotificationType = 'READ_RECEIPT' | 'NEW_MIV' | 'REPLY';

export interface Miv {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  state: MivState;
  created_at: string;
  sent_at?: string;
  received_at?: string;
  is_encrypted: boolean;
}

export interface Identity {
  id: string;
  public_key: string;
  name: string;
}

export interface CreateMivRequest {
  to: string;
  subject: string;
  body: string;
}

export interface UpdateStateRequest {
  state: MivState;
}

// Account and Authentication types

export interface Account {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  desks: string[];
  active_desk: string;
}

export interface Desk {
  id: string;
  account_id: string;
  public_key: string;
  name: string;
  created_at: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  display_name: string;
  birthday: string;
  first_pet_name: string;
  mother_maiden: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  account: Account;
  token: string;
}

export interface CreateDeskRequest {
  name: string;
}

export interface SwitchDeskRequest {
  desk_id: string;
}

export interface RecoverPasswordRequest {
  username: string;
  birthday: string;
  first_pet_name: string;
  mother_maiden: string;
  new_password: string;
}

// Conversation types

export interface Conversation {
  id: string;
  subject: string;
  desk_id: string;
  created_at: string;
  updated_at: string;
  miv_count: number;
}

export interface ConversationMiv {
  id: string;
  conversation_id: string;
  seq_no: number;
  from: string;
  to: string;
  subject: string;
  body: string;
  state: MivState;
  created_at: string;
  sent_at?: string;
  received_at?: string;
  read_at?: string;
  is_encrypted: boolean;
}

export interface CreateConversationRequest {
  to: string;
  subject: string;
  body: string;
}

export interface ReplyToConversationRequest {
  body: string;
}

export interface ConversationWithLatest {
  conversation: Conversation;
  latest_miv?: ConversationMiv;
  unread_count: number;
}

export interface ListConversationsResponse {
  conversations: ConversationWithLatest[];
  total: number;
}

export interface GetConversationResponse {
  conversation: Conversation;
  mivs: ConversationMiv[];
}

// Notification types

export interface Notification {
  id: string;
  desk_id: string;
  type: NotificationType;
  miv_id: string;
  conversation_id?: string;
  message: string;
  read: boolean;
  created_at: string;
  read_at?: string;
}

export interface ListNotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  total: number;
}
