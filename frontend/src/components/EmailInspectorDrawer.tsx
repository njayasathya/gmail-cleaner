import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Mail, ExternalLink, Trash2, MailCheck,
  CheckSquare, Square, Search, Loader2
} from 'lucide-react';
import { Sender, EmailMessageItem } from '../types';
import {
  fetchSenderMessages, trashSpecificMessages, deleteSpecificMessages, markReadSpecificMessages
} from '../services/api';
import { formatBytes, formatShortDate } from '../utils/format';

interface EmailInspectorDrawerProps {
  sender: Sender | null;
  onClose: () => void;
  onMessagesModified?: () => void;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const EmailInspectorDrawer: React.FC<EmailInspectorDrawerProps> = ({
  sender,
  onClose,
  onMessagesModified,
  onNotify
}) => {
  const [messages, setMessages] = useState<EmailMessageItem[]>([]);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const reportError = (err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : fallback;
    if (onNotify) {
      onNotify('error', msg);
    } else {
      alert(msg);
    }
  };

  const loadMessages = useCallback(async () => {
    if (!sender) return;
    setIsLoading(true);
    setPage(1);
    try {
      const res = await fetchSenderMessages(sender.email, 1, 50);
      setMessages(res.messages);
      setTotalMessages(res.total);
    } catch (err) {
      reportError(err, 'Failed to load messages for sender');
    } finally {
      setIsLoading(false);
    }
  }, [sender]);

  const loadMore = async () => {
    if (!sender || isLoadingMore || messages.length >= totalMessages) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetchSenderMessages(sender.email, nextPage, 50);
      setMessages((prev) => [...prev, ...res.messages]);
      setPage(nextPage);
      setTotalMessages(res.total);
    } catch (err) {
      reportError(err, 'Failed to load more messages');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (sender) {
      setSelectedIds([]);
      setSearchFilter('');
      loadMessages();
    }
  }, [sender, loadMessages]);

  if (!sender) return null;

  const filteredMessages = messages.filter((m) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return m.subject.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q);
  });

  const isAllSelected =
    filteredMessages.length > 0 &&
    filteredMessages.every((m) => selectedIds.includes(m.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMessages.map((m) => m.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleTrashSelected = async (ids: string[]) => {
    if (ids.length === 0) return;
    setIsProcessing(true);
    try {
      await trashSpecificMessages(ids);
      setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
      setTotalMessages((prev) => Math.max(0, prev - ids.length));
      setSelectedIds([]);
      onMessagesModified?.();
      onNotify?.('success', `Moved ${ids.length} message(s) to Trash.`);
    } catch (err) {
      reportError(err, 'Failed to trash messages');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelected = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} selected message(s)? This cannot be undone.`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await deleteSpecificMessages(ids);
      setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
      setTotalMessages((prev) => Math.max(0, prev - ids.length));
      setSelectedIds([]);
      onMessagesModified?.();
      onNotify?.('success', `Permanently deleted ${ids.length} message(s).`);
    } catch (err) {
      reportError(err, 'Failed to delete messages');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkReadSelected = async (ids: string[], read = true) => {
    if (ids.length === 0) return;
    setIsProcessing(true);
    try {
      await markReadSpecificMessages(ids, read);
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, is_unread: !read } : m))
      );
      setSelectedIds([]);
      onMessagesModified?.();
      onNotify?.('success', `Marked ${ids.length} message(s) as ${read ? 'read' : 'unread'}.`);
    } catch (err) {
      reportError(err, 'Failed to update read status');
    } finally {
      setIsProcessing(false);
    }
  };

  const gmailSearchUrl = `https://mail.google.com/mail/u/0/#search/from:${encodeURIComponent(sender.email)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-w-3xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white text-base flex-shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
                {sender.name ? sender.name[0].toUpperCase() : sender.domain[0]?.toUpperCase() || 'E'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-white text-lg truncate max-w-[340px]" title={sender.name}>
                    {sender.name || sender.email}
                  </h3>
                  {sender.domain && (
                    <span className="text-xs font-mono text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800">
                      @{sender.domain}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-400 truncate mt-0.5" title={sender.email}>
                  {sender.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <a
                href={gmailSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-sm font-semibold transition"
                title="Search this sender in official Gmail web interface"
              >
                <span>Open in Gmail</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-3.5 border-t border-slate-800/60 text-sm text-slate-400">
            <div>
              <span className="font-bold text-slate-100">{totalMessages || sender.message_count}</span> emails indexed
            </div>
            <div className="h-3.5 w-px bg-slate-800" />
            <div>
              <span className="font-bold text-slate-100">{sender.unread_count}</span> unread
            </div>
            <div className="h-3.5 w-px bg-slate-800" />
            <div>
              <span className="font-mono text-slate-200">{formatBytes(sender.total_size_bytes)}</span> estimated space
            </div>
          </div>
        </div>

        {/* Search & Selection Toolbar */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter messages by subject or snippet..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 hover:text-white text-sm font-medium transition"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All</span>
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-950/70 border border-indigo-700/50 text-sm">
              <span className="font-semibold text-indigo-200">
                {selectedIds.length} message(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleTrashSelected(selectedIds)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Trash</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleMarkReadSelected(selectedIds, true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <MailCheck className="w-3.5 h-3.5" />
                  <span>Mark Read</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleDeleteSelected(selectedIds)}
                  className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-semibold transition"
                >
                  Permanent Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Messages List Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 divide-y divide-slate-800/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="text-sm">Fetching emails for {sender.name || sender.email}...</div>
            </div>
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map((msg) => {
              const isSelected = selectedIds.includes(msg.id);
              const dateLabel = formatShortDate(msg.date);

              return (
                <div
                  key={msg.id}
                  className={`py-3.5 first:pt-0 transition-colors ${
                    msg.is_unread
                      ? 'bg-slate-950/60 border-l-2 border-indigo-500 pl-3.5 pr-3 rounded-r-xl my-1'
                      : ''
                  } ${
                    isSelected ? 'bg-indigo-950/40 rounded-xl p-3 border border-indigo-500/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSelect(msg.id)}
                      className="mt-1 text-slate-500 hover:text-slate-300 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          {msg.is_unread && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex-shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                              <span>UNREAD</span>
                            </span>
                          )}
                          <a
                            href={msg.gmail_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-base truncate hover:text-indigo-400 transition flex items-center gap-1.5 group ${
                              msg.is_unread ? 'font-bold text-white' : 'font-medium text-slate-200'
                            }`}
                            title={msg.subject}
                          >
                            <span>{msg.subject || '(No Subject)'}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-indigo-400 transition" />
                          </a>
                        </div>

                        <span className="font-mono text-xs text-slate-400 flex-shrink-0">
                          {formatBytes(msg.size_estimate)}
                        </span>
                      </div>

                      {msg.snippet && (
                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                          {msg.snippet}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {dateLabel && (
                            <span className="text-xs text-slate-400 font-medium">{dateLabel}</span>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {msg.label_ids.map((lbl) => (
                              <span
                                key={lbl}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300"
                              >
                                {lbl.replace('CATEGORY_', '').toLowerCase()}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTrashSelected([msg.id])}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Move this email to Trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <a
                            href={msg.gmail_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                            title="Open in Gmail tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center text-slate-500 space-y-2.5">
              <Mail className="w-10 h-10 mx-auto text-slate-600" />
              <div className="text-base font-semibold text-slate-200">No emails found</div>
              <div className="text-sm text-slate-400">
                {searchFilter ? 'Try clearing your search keyword' : 'No individual emails stored for this sender yet.'}
              </div>
            </div>
          )}

          {messages.length < totalMessages && !searchFilter && !isLoading && (
            <div className="pt-4 pb-2 text-center">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-sm font-medium text-slate-100 transition inline-flex items-center gap-2 shadow-sm"
              >
                {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : null}
                <span>Load more ({messages.length} of {totalMessages})</span>
              </button>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
