import React, { useState } from 'react';
import { RefreshCw, X, Zap, Layers, HardDrive, Search, Trash2 } from 'lucide-react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartScan: (query: string, maxEmails: number) => void;
  onResetDatabase?: () => Promise<void>;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onStartScan,
  onResetDatabase
}) => {
  const [scanDepth, setScanDepth] = useState<number>(1500);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [includeSent, setIncludeSent] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleScan = () => {
    let finalQuery = customQuery.trim();
    if (targetCategory && !finalQuery.includes(`category:${targetCategory}`)) {
      finalQuery = finalQuery ? `category:${targetCategory} ${finalQuery}` : `category:${targetCategory}`;
    }
    if (!includeSent && !finalQuery.includes('-in:sent')) {
      finalQuery = finalQuery ? `${finalQuery} -in:sent -in:draft` : '-in:sent -in:draft';
    }
    onStartScan(finalQuery, scanDepth);
    onClose();
  };

  const depthPresets = [
    {
      label: 'Quick Scan',
      count: 500,
      time: '~10-15s',
      desc: 'Latest 500 emails for a fast overview',
      icon: Zap,
      color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'
    },
    {
      label: 'Standard Scan',
      count: 1500,
      time: '~30-45s',
      desc: 'Catalog your most frequent senders',
      icon: Layers,
      color: 'border-violet-500/30 text-violet-400 bg-violet-500/10'
    },
    {
      label: 'Deep Clean Scan',
      count: 5000,
      time: '~1-2 mins',
      desc: 'Comprehensive multi-year inbox sweep',
      icon: HardDrive,
      color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Scan Gmail Inbox</h3>
              <p className="text-xs text-slate-400">Choose scan depth and optional target categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Depth Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">Scan Volume Depth</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {depthPresets.map((preset) => {
              const Icon = preset.icon;
              const isSelected = scanDepth === preset.count;
              return (
                <button
                  key={preset.count}
                  type="button"
                  onClick={() => setScanDepth(preset.count)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/40 shadow-sm'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-100">{preset.count} emails</span>
                    <span className="text-[10px] text-slate-500">{preset.time}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">{preset.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Category Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Target Category (Optional)</label>
          <select
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Scan Entire Inbox (All Categories)</option>
            <option value="promotions">Only Promotions &amp; Deals</option>
            <option value="social">Only Social Notifications</option>
            <option value="updates">Only Updates &amp; Newsletters</option>
            <option value="forums">Only Discussion Forums</option>
          </select>
        </div>

        {/* Incoming Only Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-left pr-4">
            <div className="text-xs font-semibold text-slate-200">Incoming Mail Only (Recommended)</div>
            <div className="text-[11px] text-slate-400">Excludes sent mail &amp; drafts so you don't clean your own emails</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={!includeSent}
              onChange={(e) => setIncludeSent(!e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Custom Gmail Search Query */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Custom Query Filter (Optional)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="e.g. is:unread or older_than:60d"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          {onResetDatabase ? (
            <button
              type="button"
              onClick={async () => {
                if (confirm('Clear the cached scan results from the database?')) {
                  await onResetDatabase();
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 text-xs transition"
              title="Clear all cached senders to start completely fresh"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Cache</span>
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleScan}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Start Scanning ({scanDepth.toLocaleString()} emails)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
