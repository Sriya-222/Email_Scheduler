export interface User {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export interface Sender {
  id: string;
  name: string;
  smtp_user: string;
  smtp_pass: string;
  max_per_hour: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  delay_ms: number;
  hourly_limit: number;
  created_at: string;
}

export interface Email {
  id: string;
  campaign_id: string;
  sender_id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'rescheduled';
  attempts: number;
  sent_at: string | null;
  error: string | null;
}

export interface DashboardStats {
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  rescheduled: number;
  total: number;
}
