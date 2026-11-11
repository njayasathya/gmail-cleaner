import React, { useState } from 'react';
import { Sparkles, X, RefreshCw, HardDrive, Tag, Layers } from 'lucide-react';

interface SmartFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerScanWithQuery: (query: string) => void;
}

export const SmartFilterModal: React.FC<SmartFilterModalProps> = ({
  isOpen,
  onClose,
  onTriggerScanWithQuery
}) => {
  const [category, setCategory] = useState<string>('promotions');
  const [olderThan, setOlderThan] = useState<string>('90d');
  const [minSize, setMinSize] = useState<string>('');
  const [readState, setReadState] = useState<string>('all');
  const [customKeyword, setCustomKeyword] = useState<string>('');

  if (!isOpen) return null;

  const buildQuery = (): string => {
    const parts: string[] = [];
    if (category) parts.push(`category:${category}`);
    if (olderThan) parts.push(`older_than:${olderThan}`);
    if (minSize) parts.push(`larger:${minSize}`);
    if (readState === 'unread') parts.push('is:unread');
    if (readState === 'read') parts.push('is:read');
    if (customKeyword.trim()) parts.push(customKeyword.trim());
    return parts.join(' ');
  };

  const currentQuery = buildQuery();

  const presets = [
    {
      title: 'Heavy Promotions (> 5MB)',
      desc: 'Marketing emails with large images taking up significant quota',
      query: 'category:promotions larger:5M',
      icon: HardDrive,
      color: 'border-rose-500/30 text-rose-400 bg-rose-500/10'
    },
    {
      title: 'Old Social Notifications (> 60 days)',
      desc: 'LinkedIn, X, Facebook updates you will never read',
      query: 'category:social older_than:60d',
      icon: Layers,
      color: 'border-blue-500/30 text-blue-400 bg-blue-500/10'
    },
    {
      title: 'Unread Promotions (> 30 days)',
      desc: 'Expired discount codes and marketing campaigns',
      query: 'category:promotions is:unread older_than:30d',
      icon: Sparkles,
      color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'
    },
    {
      title: 'Large Attachments (> 10MB)',
      desc: 'Massive PDF reports, slide decks, and video links',
      query: 'larger:10M',
      icon: HardDrive,
      color: 'border-amber-500/30 text-amber-400 bg-amber-500/10'
    },
    {
      title: 'Inactive Forum Digests (> 90 days)',
      desc: 'Mailing list archives and digest threads',
      query: 'category:forums older_than:90d',
      icon: Tag,
      color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Smart Filters &amp; Targeted Cleanup</h3>
              <p className="text-sm text-slate-400">Target specific email categories, large sizes, or date windows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div>
          <div className="text-sm font-semibold text-slate-200 mb-2.5">Recommended Clean Recipes</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {presets.map((p, i) => {
              const Icon = p.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onTriggerScanWithQuery(p.query);
                    onClose();
                  }}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-indigo-500/50 hover:bg-slate-900 transition text-left group"
                >
                  <div className={`p-2 rounded-xl ${p.color} flex-shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 text-sm group-hover:text-indigo-400 transition">
                      {p.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-snug">{p.desc}</div>
                    <div className="font-mono text-xs text-indigo-400/90 mt-1">{p.query}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Visual Filter Builder */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="text-sm font-semibold text-slate-200">Custom Filter Builder</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Gmail Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Any Category</option>
                <option value="promotions">Promotions (Marketing &amp; Deals)</option>
                <option value="social">Social (Social Networks &amp; Alerts)</option>
                <option value="updates">Updates (Newsletters &amp; Confirmations)</option>
                <option value="forums">Forums (Discussion Groups &amp; Lists)</option>
                <option value="primary">Primary (Personal Inbox)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Date Window</label>
              <select
                value={olderThan}
                onChange={(e) => setOlderThan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Any Date</option>
                <option value="7d">Older than 7 days</option>
                <option value="30d">Older than 30 days (1 month)</option>
                <option value="60d">Older than 60 days (2 months)</option>
                <option value="90d">Older than 90 days (3 months)</option>
                <option value="180d">Older than 6 months</option>
                <option value="1y">Older than 1 year</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Email Size Filter</label>
              <select
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Any Size</option>
                <option value="1M">Larger than 1 MB</option>
                <option value="5M">Larger than 5 MB</option>
                <option value="10M">Larger than 10 MB</option>
                <option value="25M">Larger than 25 MB</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Read / Unread</label>
              <select
                value={readState}
                onChange={(e) => setReadState(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All (Read &amp; Unread)</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5 text-sm font-medium">
              Additional Gmail Query / Keywords
            </label>
            <input
              type="text"
              value={customKeyword}
              onChange={(e) => setCustomKeyword(e.target.value)}
              placeholder='e.g. filename:pdf or subject:"weekly digest"'
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500 font-mono"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Generated Gmail Query</div>
              <div className="font-mono text-sm text-indigo-400 font-medium mt-1">
                {currentQuery || '(empty - all emails)'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onTriggerScanWithQuery(currentQuery);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-indigo-600/30"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Scan Emails Matching Filter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
