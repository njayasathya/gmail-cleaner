export interface Sender {
  email: str;
  name: str;
  domain: str;
  message_count: number;
  unread_count: number;
  total_size_bytes: number;
  has_unsubscribe: boolean;
  unsubscribe_url?: string | null;
  unsubscribe_mailto?: string | null;
  has_one_click: boolean;
  is_unsubscribed: boolean;
  unsubscribed_at?: string | null;
  categories: string;
  sample_subject?: string | null;
  last_received_at?: string | null;
}

export type str = string;

export interface SenderListResponse {
  total: number;
  page: number;
  page_size: number;
  senders: Sender[];
}

export interface StatsResponse {
  total_senders: number;
  total_emails: number;
  total_unread: number;
  total_size_bytes: number;
  newsletters_count: number;
  unsubscribed_count: number;
  user_email?: string | null;
  user_name?: string | null;
  user_picture?: string | null;
  is_authenticated: boolean;
  is_demo_mode: boolean;
  last_scan_at?: string | null;
}

export interface AuthStatus {
  is_authenticated: boolean;
  is_configured: boolean;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  is_demo_mode: boolean;
}

export interface JobProgress {
  id: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  success_count: number;
  error_count: number;
  current_item: string;
  message: string;
  error_details?: string | null;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export interface LabelInfo {
  id: string;
  name: string;
  type: 'system' | 'user';
  messages_total?: number;
  messages_unread?: number;
}

export interface SmartFilter {
  id: string;
  name: string;
  description: string;
  query: string;
  category: string;
  recommended_action: string;
}

export interface EmailMessageItem {
  id: string;
  thread_id: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  snippet: string;
  date?: string | null;
  size_estimate: number;
  label_ids: string[];
  is_unread: boolean;
  has_unsubscribe: boolean;
  gmail_url: string;
}

export interface SenderMessagesResponse {
  sender_email: string;
  sender_name: string;
  total: number;
  messages: EmailMessageItem[];
}

export interface UnsubscribeResult {
  email: string;
  status: 'success' | 'failed' | 'manual_required';
  method: string;
  message: string;
  manual_url?: string;
}
