import { Generated, ColumnType } from 'kysely';

export interface SendersTable {
  id: string;
  name: string;
  smtp_user: string;
  smtp_pass: string;
  max_per_hour: Generated<number>;
  created_at: Generated<Date>;
}

export interface CampaignsTable {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  delay_ms: number;
  hourly_limit: number;
  created_at: Generated<Date>;
}

export interface EmailsTable {
  id: string;
  campaign_id: string;
  sender_id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'rescheduled';
  attempts: Generated<number>;
  sent_at: Date | null;
  error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Database {
  senders: SendersTable;
  campaigns: CampaignsTable;
  emails: EmailsTable;
}

export interface UserSession {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}
