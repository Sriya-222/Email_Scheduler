import { User, Sender, Email, DashboardStats } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://reachinbox-backend-923e.onrender.com/api';

// --- Token management ---
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('auth_token');
}

// --- Core request function ---
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // Always send cookies for same-domain environments + cross-domain fallback
  options.credentials = 'include';

  // Build headers, always attach Bearer token if available
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON (not FormData — browser sets boundary automatically)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  options.headers = headers;

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (networkErr: any) {
    const err: any = new Error('Network error: cannot reach the server. Please try again.');
    err.status = 0;
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.error || `Request failed with status ${response.status}`);
    err.status = response.status;
    if (response.status === 401) {
      clearToken();
    }
    throw err;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // --- Auth ---
  async loginWithGoogle(idToken: string): Promise<{ user: User }> {
    const data = await request<{ user: User; token?: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return { user: data.user };
  },

  async getCurrentUser(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout — always clear local state
    } finally {
      clearToken();
    }
  },

  // --- Senders ---
  async getSenders(): Promise<Sender[]> {
    return request<Sender[]>('/senders');
  },

  async createSender(data: {
    name: string;
    smtp_user: string;
    smtp_pass: string;
    max_per_hour: number;
  }): Promise<Sender> {
    return request<Sender>('/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // --- Campaigns & Emails ---
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

  // --- Lead upload (multipart/form-data) ---
  async uploadLeads(file: File): Promise<{ count: number; emails: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ count: number; emails: string[] }>('/leads/parse', {
      method: 'POST',
      body: formData,
      // NOTE: Do NOT set Content-Type — browser must set multipart boundary automatically
    });
  },
};
