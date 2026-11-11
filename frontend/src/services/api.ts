import {
  SenderListResponse,
  StatsResponse,
  AuthStatus,
  JobProgress,
  LabelInfo,
  UnsubscribeResult,
  SenderMessagesResponse
} from '../types';

const API_BASE = '/api';

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error('Failed to fetch auth status');
  return res.json();
}

export async function fetchLoginUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to get login URL');
  }
  const data = await res.json();
  return data.url;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
}

export async function saveCredentials(clientId: string, clientSecret: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save credentials');
  }
}

export async function seedDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/seed-demo-data`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed demo data');
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchSenders(params: {
  q?: string;
  category?: string;
  smart_query?: string;
  has_unsubscribe?: boolean;
  is_unsubscribed?: boolean;
  sort_by?: string;
  order?: string;
  page?: number;
  page_size?: number;
}): Promise<SenderListResponse> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.category) searchParams.set('category', params.category);
  if (params.smart_query) searchParams.set('smart_query', params.smart_query);
  if (params.has_unsubscribe !== undefined) searchParams.set('has_unsubscribe', String(params.has_unsubscribe));
  if (params.is_unsubscribed !== undefined) searchParams.set('is_unsubscribed', String(params.is_unsubscribed));
  if (params.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params.order) searchParams.set('order', params.order);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));

  const res = await fetch(`${API_BASE}/senders?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch senders');
  return res.json();
}

export async function triggerScan(query: string = '', maxEmails: number = 1000): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/scan?query=${encodeURIComponent(query)}&max_emails=${maxEmails}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start scan');
  }
  return res.json();
}

export async function resetScanDatabase(): Promise<void> {
  const res = await fetch(`${API_BASE}/scan/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reset scan database');
  }
}

export async function bulkTrash(senders: string[], filterQuery?: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/actions/trash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders, filter_query: filterQuery })
  });
  if (!res.ok) throw new Error('Failed to start bulk trash');
  return res.json();
}

export async function bulkPermanentDelete(senders: string[], filterQuery?: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/actions/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders, filter_query: filterQuery, permanent: true })
  });
  if (!res.ok) throw new Error('Failed to start permanent delete');
  return res.json();
}

export async function bulkArchive(senders: string[], filterQuery?: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/actions/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders, filter_query: filterQuery })
  });
  if (!res.ok) throw new Error('Failed to start archive');
  return res.json();
}

export async function bulkMarkRead(senders: string[], read: boolean = true, filterQuery?: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/actions/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders, read, filter_query: filterQuery })
  });
  if (!res.ok) throw new Error('Failed to update read status');
  return res.json();
}

export async function bulkMarkImportant(senders: string[], important: boolean = true, filterQuery?: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/actions/important`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders, important, filter_query: filterQuery })
  });
  if (!res.ok) throw new Error('Failed to update importance');
  return res.json();
}

export async function bulkApplyLabel(
  senders: string[],
  labelId: string,
  action: 'apply' | 'remove' = 'apply',
  filterQuery?: string
): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/actions/label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders, label_id: labelId, action, filter_query: filterQuery })
  });
  if (!res.ok) throw new Error('Failed to modify label');
  return res.json();
}

export async function unsubscribeSingle(email: string, trashExisting: boolean = false): Promise<UnsubscribeResult> {
  const res = await fetch(`${API_BASE}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, trash_existing: trashExisting })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to unsubscribe');
  }
  return res.json();
}

export async function unsubscribeBulk(senders: string[], trashExisting: boolean = false): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/unsubscribe/bulk?trash_existing=${trashExisting}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senders })
  });
  if (!res.ok) throw new Error('Failed to start bulk unsubscribe');
  return res.json();
}

export async function fetchLabels(): Promise<LabelInfo[]> {
  const res = await fetch(`${API_BASE}/labels`);
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}

export async function createLabel(name: string): Promise<LabelInfo> {
  const res = await fetch(`${API_BASE}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to create label');
  return res.json();
}

export async function deleteLabel(labelId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/labels/${labelId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete label');
}

export async function fetchSenderMessages(
  email: string,
  page = 1,
  pageSize = 50,
  smartQuery?: string
): Promise<SenderMessagesResponse> {
  const params = new URLSearchParams({
    email,
    page: String(page),
    page_size: String(pageSize)
  });
  if (smartQuery) params.set('smart_query', smartQuery);
  const res = await fetch(`${API_BASE}/sender-messages?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch messages for sender');
  return res.json();
}

export async function trashSpecificMessages(messageIds: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/messages/trash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_ids: messageIds })
  });
  if (!res.ok) throw new Error('Failed to trash messages');
}

export async function deleteSpecificMessages(messageIds: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/messages/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_ids: messageIds })
  });
  if (!res.ok) throw new Error('Failed to delete messages');
}

export async function markReadSpecificMessages(messageIds: string[], read = true): Promise<void> {
  const res = await fetch(`${API_BASE}/messages/read?read=${read}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_ids: messageIds })
  });
  if (!res.ok) throw new Error('Failed to update read status');
}

export function getExportCsvUrl(senders?: string[]): string {
  if (senders && senders.length > 0) {
    return `${API_BASE}/export/csv?senders=${encodeURIComponent(senders.join(','))}`;
  }
  return `${API_BASE}/export/csv?include_all=true`;
}

export async function cancelJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
}

export function streamJob(
  jobId: string,
  onProgress: (job: JobProgress) => void,
  onComplete?: () => void,
  onError?: (err: any) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);

  let settled = false;

  eventSource.addEventListener('progress', (e) => {
    try {
      const data: JobProgress = JSON.parse(e.data);
      onProgress(data);
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        settled = true;
        eventSource.close();
        if (onComplete) onComplete();
      }
    } catch {
      // Ignore malformed heartbeat or partial SSE frame
    }
  });

  eventSource.onerror = async (err) => {
    eventSource.close();
    if (settled) return;

    // Fast background jobs may finish before the stream stabilizes; poll once before reporting failure.
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`);
      if (res.ok) {
        const job: JobProgress = await res.json();
        onProgress(job);
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          settled = true;
          if (onComplete) onComplete();
          return;
        }
      }
    } catch {
      // Fall through to stream error callback
    }

    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}
