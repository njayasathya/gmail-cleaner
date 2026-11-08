import React, { useState } from 'react';
import {
  BellOff, CheckCircle2, ExternalLink, Mail, Trash2,
  CheckSquare, Square, Zap, HelpCircle, AlertCircle
} from 'lucide-react';
import { Sender } from '../types';

interface UnsubscribeCenterProps {
  newsletters: Sender[];
  selectedEmails: string[];
  onToggleSelect: (email: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUnsubscribeSingle: (email: string, trashExisting: boolean) => void;
  onUnsubscribeBulk: (emails: string[], trashExisting: boolean) => void;
}

export const UnsubscribeCenter: React.FC<UnsubscribeCenterProps> = ({
  newsletters,
  selectedEmails,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onUnsubscribeSingle,
  onUnsubscribeBulk
}) => {
  const [filterState, setFilterState] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [trashExistingEmails, setTrashExistingEmails] = useState(false);

  const filteredNewsletters = newsletters.filter((n) => {
    if (filterState === 'active') return !n.is_unsubscribed;
    if (filterState === 'unsubscribed') return n.is_unsubscribed;
    return true;
  });

  const activeCount = newsletters.filter((n) => !n.is_unsubscribed).length;
  const unsubscribedCount = newsletters.filter((n) => n.is_unsubscribed).length;

  const isAllSelected =
    filteredNewsletters.length > 0 &&
    filteredNewsletters.every((n) => selectedEmails.includes(n.email));

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 border border-violet-800/40 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>RFC 8058 One-Click Compliant</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">1-Click Newsletter &amp; Subscription Hub</h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Instantly find and unsubscribe from newsletters, marketing spam, and subscription lists. We automatically dispatch RFC 8058 one-click requests and handle mailto unsubscribe loops on your behalf.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{activeCount}</div>
              <div className="text-[11px] text-slate-400">Active Subscriptions</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{unsubscribedCount}</div>
              <div className="text-[11px] text-slate-400">Unsubscribed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterState === 'all'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Subscriptions ({newsletters.length})
          </button>
          <button
            onClick={() => setFilterState('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterState === 'active'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilterState('unsubscribed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterState === 'unsubscribed'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Unsubscribed ({unsubscribedCount})
          </button>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={trashExistingEmails}
              onChange={(e) => setTrashExistingEmails(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Also trash past emails</span>
          </label>

          {selectedEmails.length > 0 && (
            <button
              onClick={() => onUnsubscribeBulk(selectedEmails, trashExistingEmails)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span>Bulk Unsubscribe ({selectedEmails.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Newsletters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredNewsletters.length > 0 ? (
          filteredNewsletters.map((sender) => {
            const isSelected = selectedEmails.includes(sender.email);

            return (
              <div
                key={sender.email}
                className={`p-4 rounded-xl border transition-all ${
                  sender.is_unsubscribed
                    ? 'bg-slate-900/30 border-slate-800/60 opacity-75'
                    : isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      onClick={() => onToggleSelect(sender.email)}
                      className="text-slate-400 hover:text-slate-200 transition mt-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 text-xs truncate" title={sender.name}>
                        {sender.name || sender.email}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate" title={sender.email}>
                        {sender.email}
                      </div>
                    </div>
                  </div>

                  {/* One-click badge */}
                  {sender.has_one_click ? (
                    <span
                      title="Supports RFC 8058 One-Click HTTP POST unsubscribe"
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 flex-shrink-0"
                    >
                      <Zap className="w-3 h-3 text-indigo-400" />
                      <span>1-Click</span>
                    </span>
                  ) : sender.unsubscribe_mailto ? (
                    <span
                      title="Sends automated mailto: unsubscribe email"
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 flex-shrink-0"
                    >
                      <Mail className="w-3 h-3 text-blue-400" />
                      <span>Mailto</span>
                    </span>
                  ) : (
                    <span
                      title="Standard HTTP unsubscribe link"
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 flex-shrink-0"
                    >
                      <span>Web Link</span>
                    </span>
                  )}
                </div>

                {/* Subject preview */}
                {sender.sample_subject && (
                  <div className="text-[11px] text-slate-500 truncate mt-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 italic">
                    "{sender.sample_subject}"
                  </div>
                )}

                {/* Footer with stats & action */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-xs">
                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-200">{sender.message_count}</span> emails received
                  </div>

                  <div>
                    {sender.is_unsubscribed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unsubscribed</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onUnsubscribeSingle(sender.email, trashExistingEmails)}
                        className="px-3 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/40 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <BellOff className="w-3.5 h-3.5" />
                        <span>Unsubscribe</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-slate-500">
            <BellOff className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <div className="text-sm font-medium text-slate-300">No newsletters match this filter</div>
            <div className="text-xs text-slate-500 mt-1">
              {filterState === 'unsubscribed'
                ? 'You have not unsubscribed from any newsletters yet.'
                : 'Scan your inbox to identify senders with List-Unsubscribe headers.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
