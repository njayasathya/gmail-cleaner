import React, { useState } from 'react';
import { Tag, Plus, Trash2, X, FolderCheck } from 'lucide-react';
import { LabelInfo } from '../types';

interface LabelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: LabelInfo[];
  onCreateLabel: (name: string) => Promise<void>;
  onDeleteLabel: (id: string) => Promise<void>;
  onApplyLabelToSelected?: (labelId: string) => void;
  selectedEmailsCount?: number;
}

export const LabelManagerModal: React.FC<LabelManagerModalProps> = ({
  isOpen,
  onClose,
  labels,
  onCreateLabel,
  onDeleteLabel,
  onApplyLabelToSelected,
  selectedEmailsCount = 0
}) => {
  const [newLabelName, setNewLabelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateLabel(newLabelName.trim());
      setNewLabelName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userLabels = labels.filter((l) => l.type === 'user');
  const systemLabels = labels.filter((l) => l.type === 'system');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gmail Label Manager</h3>
              <p className="text-xs text-slate-400">Organize and tag emails from specific senders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create New Label Form */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            placeholder="New label name (e.g. Subscriptions, Invoices)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!newLabelName.trim() || isSubmitting}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </form>

        {/* User Labels List */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Custom Labels ({userLabels.length})
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {userLabels.length > 0 ? (
              userLabels.map((lbl) => (
                <div
                  key={lbl.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="font-medium text-slate-200 truncate">{lbl.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedEmailsCount > 0 && onApplyLabelToSelected && (
                      <button
                        onClick={() => onApplyLabelToSelected(lbl.id)}
                        className="px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-[10px] font-medium transition"
                      >
                        Apply to {selectedEmailsCount} selected
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteLabel(lbl.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                      title="Delete label"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 py-3 text-center">No custom labels created yet.</div>
            )}
          </div>
        </div>

        {/* System Labels Overview */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            System Labels
          </div>
          <div className="flex flex-wrap gap-1.5">
            {systemLabels.map((lbl) => (
              <span
                key={lbl.id}
                className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400"
              >
                {lbl.name}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
