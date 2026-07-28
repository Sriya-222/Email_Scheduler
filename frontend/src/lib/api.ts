import { User, Sender, Email, DashboardStats } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://reachinbox-backend-923e.onrender.com/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  
  // Always include credentials to send/receive cookies
  options.credentials = 'include';
  
  if (options.body && !(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth API
  async loginWithGoogle(idToken: string): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  async getCurrentUser(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  async logout(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  },

  // Senders API
  async getSenders(): Promise<Sender[]> {
    return request<Sender[]>('/senders');
  },

  async createSender(data: { name: string; smtp_user: string; smtp_pass: string; max_per_hour: number }): Promise<Sender> {
    return request<Sender>('/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Campaigns & Emails API
  async createCampaign(data: {
    subject: string;
    body: string;
    leads: string[];
    senderId: string;
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
  }): Promise<{ campaignId: string; scheduledCount: number }> {
    return request<{ campaignId: string; scheduledCount: number }>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getEmails(params: {
    status?: string;
    campaignId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ emails: Email[]; totalCount: number; limit: number; offset: number }> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.campaignId) searchParams.append('campaignId', params.campaignId);
    if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.append('offset', String(params.offset));

    const queryString = searchParams.toString();
    const path = queryString ? `/emails?${queryString}` : '/emails';
    return request<{ emails: Email[]; totalCount: number; limit: number; offset: number }>(path);
  },

  async getStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/stats');
  },

  // Lead CSV Uploader
  async uploadLeads(file: File): Promise<{ count: number; emails: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ count: number; emails: string[] }>('/leads/parse', {
      method: 'POST',
      body: formData,
    });
  },
};
