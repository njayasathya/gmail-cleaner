import React, { useState } from 'react';
import {
  Search, X, Trash2, Archive, CheckSquare, Square, Mail,
  MailCheck, Download, Tag, Star, ChevronLeft, ChevronRight,
  BellOff, ArrowUpDown, AlertTriangle, Eye, Plus
} from 'lucide-react';
import { Sender, LabelInfo } from '../types';
import { getExportCsvUrl } from '../services/api';
import { formatBytes } from '../utils/format';

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
  onInspectSender: (sender: Sender) => void;
  onOpenLabelManager?: () => void;
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
  onInspectSender,
  onOpenLabelManager,
  availableLabels
}) => {
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

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
      {/* Unified Sticky Command Bar (Search, Filters, Sort & Bulk Actions) */}
      <div className="sticky top-[72px] z-20 space-y-2.5 py-1">
        {/* Controls & Search Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-xl shadow-black/50">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search sender name, email, domain, or subject..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => onCategoryChange(c.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === c.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split('-');
                  onSortChange(sb, so);
                }}
                className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-950/95 border border-indigo-700/60 rounded-2xl shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                {selectedEmails.length}
              </span>
              <span className="text-sm font-medium text-indigo-100">
                {selectedEmails.length === 1 ? 'sender selected' : 'senders selected'}
              </span>
              <button
                onClick={onClearSelection}
                className="text-sm text-indigo-300 hover:text-white underline ml-1"
              >
                Deselect
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onBulkTrash(selectedEmails)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/30 text-rose-200 hover:bg-rose-600 hover:text-white border border-rose-500/40 text-sm font-medium transition"
                title="Move emails from selected senders to Trash"
              >
                <Trash2 className="w-4 h-4" />
                <span>Trash All</span>
              </button>

              <button
                onClick={() => setShowConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950 text-red-300 hover:bg-red-900 hover:text-white border border-red-800 text-sm font-medium transition"
                title="Permanently batch-delete messages (cannot be recovered)"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Permanent Delete</span>
              </button>

              <button
                onClick={() => onBulkArchive(selectedEmails)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
                title="Archive emails (remove from Inbox)"
              >
                <Archive className="w-4 h-4" />
                <span>Archive</span>
              </button>

              <button
                onClick={() => onBulkMarkRead(selectedEmails, true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
                title="Mark all as Read"
              >
                <MailCheck className="w-4 h-4" />
                <span>Mark Read</span>
              </button>

              <button
                onClick={() => onBulkMarkImportant(selectedEmails, true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
                title="Mark as Important"
              >
                <Star className="w-4 h-4 fill-amber-300/20" />
                <span>Important</span>
              </button>

              {/* Apply Label Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
                >
                  <Tag className="w-4 h-4" />
                  <span>Apply Label</span>
                </button>

                {showLabelDropdown && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 max-h-64 overflow-y-auto">
                    <div className="text-xs font-semibold text-slate-400 px-2.5 py-1.5 uppercase tracking-wider">
                      Choose Label
                    </div>
                    {availableLabels.length > 0 ? (
                      availableLabels.map((lbl) => (
                        <button
                          key={lbl.id}
                          onClick={() => {
                            onBulkLabel(selectedEmails, lbl.id, 'apply');
                            setShowLabelDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                        >
                          <span className="truncate">{lbl.name}</span>
                          <span className="text-xs text-slate-400">{lbl.type}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-500">No labels available</div>
                    )}
                    {onOpenLabelManager && (
                      <button
                        onClick={() => {
                          setShowLabelDropdown(false);
                          onOpenLabelManager();
                        }}
                        className="w-full mt-1 pt-2 border-t border-slate-800 text-left px-3 py-2 rounded-lg text-sm text-indigo-300 hover:bg-slate-800 flex items-center gap-1.5 font-medium transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Manage Labels...</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <a
                href={getExportCsvUrl(selectedEmails)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600 hover:text-white border border-emerald-500/40 text-sm font-medium transition"
                title="Export metadata as CSV"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Permanent Delete */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800/80 rounded-2xl max-w-lg w-full p-7 space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">Permanently Delete Emails?</h3>
              <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">
                This will use Gmail&apos;s <span className="font-mono text-red-400">batchDelete</span> API to permanently erase all messages from the selected <span className="font-semibold text-white">{selectedEmails.length}</span> senders without placing them in the Trash.
              </p>
              <p className="text-sm font-semibold text-rose-400 mt-2">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDelete(false);
                  onBulkPermanentDelete(selectedEmails);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition shadow-lg shadow-red-600/30"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Senders Data Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <th className="py-4 px-5 w-12">
                  <button
                    onClick={onSelectAllPage}
                    className="text-slate-400 hover:text-slate-200 transition"
                    title={isAllPageSelected ? 'Deselect all' : 'Select all on page'}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-5">Sender &amp; Domain</th>
                <th className="py-4 px-5">Volume</th>
                <th className="py-4 px-5">Unread</th>
                <th className="py-4 px-5">Est. Size</th>
                <th className="py-4 px-5">Category</th>
                <th className="py-4 px-5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm text-slate-200">
              {senders.length > 0 ? (
                senders.map((sender) => {
                  const isSelected = selectedEmails.includes(sender.email);
                  const volumePercent = Math.min(100, Math.round((sender.message_count / maxEmailsInView) * 100));

                  return (
                    <tr
                      key={sender.email}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/25' : ''
                      }`}
                    >
                      <td className="py-4 px-5">
                        <button
                          onClick={() => onToggleSelect(sender.email)}
                          className="text-slate-400 hover:text-slate-200 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-500" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>

                      {/* Sender details */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-slate-200 text-sm flex-shrink-0 mt-0.5">
                            {sender.name ? sender.name[0].toUpperCase() : sender.domain[0]?.toUpperCase() || 'E'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                onClick={() => onInspectSender(sender)}
                                className="text-base font-semibold text-white truncate max-w-[300px] cursor-pointer hover:text-indigo-400 hover:underline transition"
                                title="Click to inspect individual emails"
                              >
                                {sender.name || sender.email}
                              </span>
                              {sender.domain && (
                                <span className="text-xs font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                  @{sender.domain}
                                </span>
                              )}
                              {sender.has_unsubscribe && (
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                    sender.is_unsubscribed
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                  }`}
                                >
                                  {sender.is_unsubscribed ? 'Unsubscribed' : 'Newsletter'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-400 truncate max-w-[380px] mt-0.5" title={sender.email}>
                              {sender.email}
                            </div>
                            {sender.sample_subject && (
                              <div className="text-sm text-slate-500 truncate max-w-[520px] mt-1 italic">
                                &ldquo;{sender.sample_subject}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email Volume */}
                      <td className="py-4 px-5">
                        <div className="w-40">
                          <div className="flex justify-between items-center text-sm font-semibold text-slate-100 mb-1.5">
                            <span>{sender.message_count.toLocaleString()}</span>
                            <span className="text-xs text-slate-400">{volumePercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                              style={{ width: `${volumePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Unread Count */}
                      <td className="py-4 px-5">
                        {sender.unread_count > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {sender.unread_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-sm">0</span>
                        )}
                      </td>

                      {/* Total Size */}
                      <td className="py-4 px-5 font-mono text-sm text-slate-300 whitespace-nowrap">
                        {formatBytes(sender.total_size_bytes)}
                      </td>

                      {/* Categories */}
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5">
                          {sender.categories ? (
                            sender.categories.split(',').map((cat) => (
                              <span
                                key={cat}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 capitalize border border-slate-700/60"
                              >
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-xs">Primary</span>
                          )}
                        </div>
                      </td>

                      {/* Quick Action buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sender.has_unsubscribe && !sender.is_unsubscribed && (
                            <button
                              onClick={() => onUnsubscribeSingle(sender.email)}
                              className="px-3 py-1.5 rounded-lg bg-violet-600/25 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                              title="1-Click Unsubscribe"
                            >
                              <BellOff className="w-3.5 h-3.5" />
                              <span>Unsub</span>
                            </button>
                          )}

                          <button
                            onClick={() => onInspectSender(sender)}
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                            title="View & inspect individual emails from this sender"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onBulkTrash([sender.email])}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Move all emails from this sender to Trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onBulkArchive([sender.email])}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                            title="Archive all emails from this sender"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Mail className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <div className="text-base font-semibold text-slate-200">No senders found</div>
                    <div className="text-sm text-slate-400 mt-1">
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-800 bg-slate-900/60 text-sm text-slate-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-100">{senders.length > 0 ? (page - 1) * pageSize + 1 : 0}</span>{' '}
            to <span className="font-semibold text-slate-100">{Math.min(page * pageSize, totalSenders)}</span> of{' '}
            <span className="font-semibold text-slate-100">{totalSenders.toLocaleString()}</span> senders
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-200">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
