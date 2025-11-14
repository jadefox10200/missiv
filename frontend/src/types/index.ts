export type MivState = 'IN' | 'PENDING' | 'OUT' | 'ARCHIVED';

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
