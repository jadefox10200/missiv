import { Miv, Identity, CreateMivRequest, UpdateStateRequest } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

// Identity API
export const getIdentity = async (): Promise<Identity> => {
  const response = await fetch(`${API_BASE_URL}/identity`);
  if (!response.ok) {
    throw new Error('Failed to fetch identity');
  }
  return response.json();
};

export const createIdentity = async (name: string): Promise<Identity> => {
  const response = await fetch(`${API_BASE_URL}/identity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error('Failed to create identity');
  }
  return response.json();
};

// Miv API
export const listMivs = async (): Promise<Miv[]> => {
  const response = await fetch(`${API_BASE_URL}/mivs`);
  if (!response.ok) {
    throw new Error('Failed to fetch mivs');
  }
  return response.json();
};

export const getMiv = async (id: string): Promise<Miv> => {
  const response = await fetch(`${API_BASE_URL}/mivs/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch miv');
  }
  return response.json();
};

export const createMiv = async (request: CreateMivRequest): Promise<Miv> => {
  const response = await fetch(`${API_BASE_URL}/mivs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to create miv');
  }
  return response.json();
};

export const updateMivState = async (id: string, request: UpdateStateRequest): Promise<Miv> => {
  const response = await fetch(`${API_BASE_URL}/mivs/${id}/state`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to update miv state');
  }
  return response.json();
};

// Filtered miv endpoints
export const getInbox = async (): Promise<Miv[]> => {
  const response = await fetch(`${API_BASE_URL}/mivs/inbox`);
  if (!response.ok) {
    throw new Error('Failed to fetch inbox');
  }
  return response.json();
};

export const getPending = async (): Promise<Miv[]> => {
  const response = await fetch(`${API_BASE_URL}/mivs/pending`);
  if (!response.ok) {
    throw new Error('Failed to fetch pending mivs');
  }
  return response.json();
};

export const getSent = async (): Promise<Miv[]> => {
  const response = await fetch(`${API_BASE_URL}/mivs/sent`);
  if (!response.ok) {
    throw new Error('Failed to fetch sent mivs');
  }
  return response.json();
};

export const getUnanswered = async (): Promise<Miv[]> => {
  const response = await fetch(`${API_BASE_URL}/mivs/unanswered`);
  if (!response.ok) {
    throw new Error('Failed to fetch unanswered mivs');
  }
  return response.json();
};

export const getArchived = async (): Promise<Miv[]> => {
  const response = await fetch(`${API_BASE_URL}/mivs/archived`);
  if (!response.ok) {
    throw new Error('Failed to fetch archived mivs');
  }
  return response.json();
};
