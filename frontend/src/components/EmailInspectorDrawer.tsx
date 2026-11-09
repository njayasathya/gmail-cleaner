import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Mail, ExternalLink, Trash2, MailCheck, CheckSquare,
  Square, Search, AlertCircle, Loader2, Calendar, HardDrive, Tag
} from 'lucide-react';
import { Sender, EmailMessageItem } from '../types';
import {
  fetchSenderMessages, trashSpecificMessages, deleteSpecificMessages, markReadSpecificMessages
} from '../services/api';

interface EmailInspectorDrawerProps {
  sender: Sender | null;
  onClose: () => void;
  onMessagesModified?: () => void;
}

export const EmailInspectorDrawer: React.FC<EmailInspectorDrawerProps> = ({
  sender,
  onClose,
  onMessagesModified
}) => {
  const [messages, setMessages] = useState<EmailMessageItem[]>([]);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadMessages = useCallback(async () => {
    if (!sender) return;
    setIsLoading(true);
    try {
      const res = await fetchSenderMessages(sender.email, 1, 100);
      setMessages(res.messages);
      setTotalMessages(res.total);
    } catch (err) {
      console.error('Error fetching messages for sender:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sender]);

  useEffect(() => {
    if (sender) {
      setSelectedIds([]);
      setSearchFilter('');
      loadMessages();
    }
  }, [sender, loadMessages]);

  if (!sender) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
      setSelectedIds([]);
      if (onMessagesModified) onMessagesModified();
    } catch (err: any) {
      alert(err.message || 'Failed to trash messages');
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
      setSelectedIds([]);
      if (onMessagesModified) onMessagesModified();
    } catch (err: any) {
      alert(err.message || 'Failed to delete messages');
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
      if (onMessagesModified) onMessagesModified();
    } catch (err: any) {
      alert(err.message || 'Failed to update read status');
    } finally {
      setIsProcessing(false);
    }
  };

  const gmailSearchUrl = `https://mail.google.com/mail/u/0/#search/from:${encodeURIComponent(sender.email)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click backdrop to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-Over Drawer Container */}
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
                {sender.name ? sender.name[0].toUpperCase() : sender.domain[0]?.toUpperCase() || 'E'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-100 text-sm truncate max-w-[260px]" title={sender.name}>
                    {sender.name || sender.email}
                  </h3>
                  {sender.domain && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      @{sender.domain}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5" title={sender.email}>
                  {sender.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Direct Gmail Search Button */}
              <a
                href={gmailSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition"
                title="Search this sender in official Gmail web interface"
              >
                <span>Open in Gmail</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sender Stats Summary Pills */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
            <div>
              <span className="font-bold text-slate-200">{totalMessages || sender.message_count}</span> emails found
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div>
              <span className="font-bold text-slate-200">{sender.unread_count}</span> unread
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div>
              <span className="font-mono text-slate-300">{formatBytes(sender.total_size_bytes)}</span> estimated space
            </div>
          </div>
        </div>

        {/* Search & Selection Toolbar */}
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter messages by subject or snippet..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white text-xs font-medium transition"
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Select All</span>
            </button>
          </div>

          {/* Floating Actions for selected messages */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-950/70 border border-indigo-700/50 text-xs">
              <span className="font-semibold text-indigo-300">
                {selectedIds.length} message(s) selected
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={isProcessing}
                  onClick={() => handleTrashSelected(selectedIds)}
                  className="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-medium transition flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Trash</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleMarkReadSelected(selectedIds, true)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition flex items-center gap-1"
                >
                  <MailCheck className="w-3 h-3" />
                  <span>Mark Read</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleDeleteSelected(selectedIds)}
                  className="px-2.5 py-1 rounded bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 text-[11px] font-medium transition"
                >
                  Permanent Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Messages List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              <div className="text-xs">Fetching emails for {sender.name || sender.email}...</div>
            </div>
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map((msg) => {
              const isSelected = selectedIds.includes(msg.id);

              return (
                <div
                  key={msg.id}
                  className={`pt-2.5 first:pt-0 transition-colors ${
                    isSelected ? 'bg-indigo-950/20 rounded-lg p-2.5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(msg.id)}
                      className="mt-0.5 text-slate-500 hover:text-slate-300 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Email Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {msg.is_unread && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" title="Unread" />
                          )}
                          <a
                            href={msg.gmail_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`text-xs truncate hover:text-indigo-400 transition flex items-center gap-1 group ${
                              msg.is_unread ? 'font-bold text-white' : 'font-medium text-slate-300'
                            }`}
                            title={msg.subject}
                          >
                            <span>{msg.subject || '(No Subject)'}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-400 transition" />
                          </a>
                        </div>

                        {/* Size badge */}
                        <span className="font-mono text-[10px] text-slate-500 flex-shrink-0">
                          {formatBytes(msg.size_estimate)}
                        </span>
                      </div>

                      {/* Snippet Preview */}
                      {msg.snippet && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {msg.snippet}
                        </p>
                      )}

                      {/* Labels and Actions Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-wrap gap-1">
                          {msg.label_ids.map((lbl) => (
                            <span
                              key={lbl}
                              className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-950 border border-slate-800 text-slate-400"
                            >
                              {lbl.replace('CATEGORY_', '').toLowerCase()}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTrashSelected([msg.id])}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Move this email to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={msg.gmail_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition"
                            title="Open in Gmail tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center text-slate-500 space-y-2">
              <Mail className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-xs font-semibold text-slate-300">No emails found</div>
              <div className="text-[11px] text-slate-500">
                {searchFilter ? 'Try clearing your search keyword' : 'No individual emails stored for this sender yet.'}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
