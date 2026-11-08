import React, { useState } from 'react';
import {
  Search, Trash2, Archive, CheckSquare, Square, Mail,
  MailCheck, Download, Tag, Star, ChevronLeft, ChevronRight,
  ExternalLink, BellOff, ArrowUpDown, Filter, AlertTriangle
} from 'lucide-react';
import { Sender, LabelInfo } from '../types';
import { getExportCsvUrl } from '../services/api';

interface SendersTableProps {
  senders: Sender[];
  totalSenders: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  sortBy: string;
  sortOrder: string;
  onSortChange: (sort: string, order: string) => void;
  selectedEmails: string[];
  onToggleSelect: (email: string) => void;
  onSelectAllPage: () => void;
  onClearSelection: () => void;
  onBulkTrash: (emails: string[]) => void;
  onBulkPermanentDelete: (emails: string[]) => void;
  onBulkArchive: (emails: string[]) => void;
  onBulkMarkRead: (emails: string[], read: boolean) => void;
  onBulkMarkImportant: (emails: string[], important: boolean) => void;
  onBulkLabel: (emails: string[], labelId: string, action: 'apply' | 'remove') => void;
  onUnsubscribeSingle: (email: string) => void;
  availableLabels: LabelInfo[];
}

export const SendersTable: React.FC<SendersTableProps> = ({
  senders,
  totalSenders,
  page,
  pageSize,
  onPageChange,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  sortOrder,
  onSortChange,
  selectedEmails,
  onToggleSelect,
  onSelectAllPage,
  onClearSelection,
  onBulkTrash,
  onBulkPermanentDelete,
  onBulkArchive,
  onBulkMarkRead,
  onBulkMarkImportant,
  onBulkLabel,
  onUnsubscribeSingle,
  availableLabels
}) => {
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const categories = [
    { id: '', label: 'All Categories' },
    { id: 'promotions', label: 'Promotions' },
    { id: 'social', label: 'Social' },
    { id: 'updates', label: 'Updates' },
    { id: 'forums', label: 'Forums' },
    { id: 'primary', label: 'Primary' }
  ];

  const totalPages = Math.ceil(totalSenders / pageSize) || 1;
  const isAllPageSelected = senders.length > 0 && senders.every(s => selectedEmails.includes(s.email));
  const maxEmailsInView = Math.max(...senders.map(s => s.message_count), 1);

  return (
    <div className="space-y-4">
      {/* Controls & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sender name, email, domain, or subject..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                onSortChange(sb, so);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="count-desc" className="bg-slate-900 text-slate-200">Most Emails</option>
              <option value="count-asc" className="bg-slate-900 text-slate-200">Fewest Emails</option>
              <option value="size-desc" className="bg-slate-900 text-slate-200">Highest Storage</option>
              <option value="unread-desc" className="bg-slate-900 text-slate-200">Most Unread</option>
              <option value="name-asc" className="bg-slate-900 text-slate-200">Name (A-Z)</option>
              <option value="domain-asc" className="bg-slate-900 text-slate-200">Domain (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedEmails.length > 0 && (
        <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-950/90 border border-indigo-700/50 rounded-xl shadow-xl backdrop-blur animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
              {selectedEmails.length}
            </span>
            <span className="text-xs font-medium text-indigo-200">
              {selectedEmails.length === 1 ? 'sender selected' : 'senders selected'}
            </span>
            <button
              onClick={onClearSelection}
              className="text-xs text-indigo-400 hover:text-white underline ml-1"
            >
              Deselect
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Trash Action */}
            <button
              onClick={() => onBulkTrash(selectedEmails)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/40 text-xs font-medium transition"
              title="Move emails from selected senders to Trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash All</span>
            </button>

            {/* Permanent Delete Action */}
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 text-red-400 hover:bg-red-900 hover:text-white border border-red-800 text-xs font-medium transition"
              title="Permanently batch-delete messages (cannot be recovered)"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Permanent Delete</span>
            </button>

            {/* Archive */}
            <button
              onClick={() => onBulkArchive(selectedEmails)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition"
              title="Archive emails (remove from Inbox)"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive</span>
            </button>

            {/* Mark Read */}
            <button
              onClick={() => onBulkMarkRead(selectedEmails, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition"
              title="Mark all as Read"
            >
              <MailCheck className="w-3.5 h-3.5" />
              <span>Mark Read</span>
            </button>

            {/* Mark Important */}
            <button
              onClick={() => onBulkMarkImportant(selectedEmails, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition"
              title="Mark as Important"
            >
              <Star className="w-3.5 h-3.5 fill-amber-300/20" />
              <span>Important</span>
            </button>

            {/* Apply Label Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Apply Label</span>
              </button>

              {showLabelDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 z-30">
                  <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase">Choose Label</div>
                  {availableLabels.length > 0 ? (
                    availableLabels.map((lbl) => (
                      <button
                        key={lbl.id}
                        onClick={() => {
                          onBulkLabel(selectedEmails, lbl.id, 'apply');
                          setShowLabelDropdown(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                      >
                        <span className="truncate">{lbl.name}</span>
                        <span className="text-[10px] text-slate-500">{lbl.type}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-1 text-xs text-slate-500">No custom labels</div>
                  )}
                </div>
              )}
            </div>

            {/* CSV Download */}
            <a
              href={getExportCsvUrl(selectedEmails)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/40 text-xs font-medium transition"
              title="Export metadata as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Permanent Delete */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Permanently Delete Emails?</h3>
              <p className="text-xs text-slate-400 mt-2">
                This will use Gmail's <span className="font-mono text-red-400">batchDelete</span> API to permanently erase all messages from the selected <span className="font-semibold text-white">{selectedEmails.length}</span> senders without placing them in the Trash.
              </p>
              <p className="text-xs font-semibold text-rose-400 mt-2">This action cannot be undone.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDelete(false);
                  onBulkPermanentDelete(selectedEmails);
                }}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition shadow-lg shadow-red-600/30"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Senders Data Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <button
                    onClick={onSelectAllPage}
                    className="text-slate-400 hover:text-slate-200 transition"
                    title={isAllPageSelected ? 'Deselect all' : 'Select all on page'}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Sender &amp; Domain</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4">Unread</th>
                <th className="py-3 px-4">Est. Size</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {senders.length > 0 ? (
                senders.map((sender) => {
                  const isSelected = selectedEmails.includes(sender.email);
                  const volumePercent = Math.min(100, Math.round((sender.message_count / maxEmailsInView) * 100));

                  return (
                    <tr
                      key={sender.email}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onToggleSelect(sender.email)}
                          className="text-slate-400 hover:text-slate-200 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Sender details */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-slate-300 text-xs flex-shrink-0 mt-0.5">
                            {sender.name ? sender.name[0].toUpperCase() : sender.domain[0]?.toUpperCase() || 'E'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-100 truncate max-w-[220px]" title={sender.name}>
                                {sender.name || sender.email}
                              </span>
                              {sender.domain && (
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  @{sender.domain}
                                </span>
                              )}
                              {sender.has_unsubscribe && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                                  sender.is_unsubscribed
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                }`}>
                                  {sender.is_unsubscribed ? 'Unsubscribed' : 'Newsletter'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[280px]" title={sender.email}>
                              {sender.email}
                            </div>
                            {sender.sample_subject && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[320px] mt-0.5 italic">
                                "{sender.sample_subject}"
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email Volume */}
                      <td className="py-3 px-4">
                        <div className="w-32">
                          <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1">
                            <span>{sender.message_count.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500">{volumePercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                              style={{ width: `${volumePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Unread Count */}
                      <td className="py-3 px-4">
                        {sender.unread_count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {sender.unread_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">0</span>
                        )}
                      </td>

                      {/* Total Size */}
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {formatBytes(sender.total_size_bytes)}
                      </td>

                      {/* Categories */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {sender.categories ? (
                            sender.categories.split(',').map((cat) => (
                              <span
                                key={cat}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 capitalize border border-slate-700/50"
                              >
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600 text-[10px]">Primary</span>
                          )}
                        </div>
                      </td>

                      {/* Quick Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click Unsubscribe button if newsletter and not unsubscribed */}
                          {sender.has_unsubscribe && !sender.is_unsubscribed && (
                            <button
                              onClick={() => onUnsubscribeSingle(sender.email)}
                              className="px-2.5 py-1 rounded bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 text-[11px] font-medium transition flex items-center gap-1"
                              title="1-Click Unsubscribe"
                            >
                              <BellOff className="w-3 h-3" />
                              <span>Unsub</span>
                            </button>
                          )}

                          {/* Quick Trash */}
                          <button
                            onClick={() => onBulkTrash([sender.email])}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Move all emails from this sender to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Archive */}
                          <button
                            onClick={() => onBulkArchive([sender.email])}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                            title="Archive all emails from this sender"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Mail className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <div className="text-sm font-medium text-slate-300">No senders found</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {searchQuery
                        ? 'Try clearing your search query or changing category filter.'
                        : 'Click "Scan Inbox" above to index your Gmail messages.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{senders.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-slate-200">{Math.min(page * pageSize, totalSenders)}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalSenders.toLocaleString()}</span> senders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
