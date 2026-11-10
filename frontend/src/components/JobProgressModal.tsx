import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle, StopCircle, X } from 'lucide-react';
import { JobProgress } from '../types';

interface JobProgressModalProps {
  job: JobProgress | null;
  onCancel: (id: string) => void;
  onClose: () => void;
}

export const JobProgressModal: React.FC<JobProgressModalProps> = ({
  job,
  onCancel,
  onClose
}) => {
  if (!job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';
  const isRunning = job.status === 'running' || job.status === 'pending';

  const actionTitle =
    {
      scan: 'Scanning Gmail Inbox',
      trash: 'Trashing Emails in Bulk',
      permanent_delete: 'Permanently Deleting Emails',
      archive: 'Archiving Emails',
      mark_read: 'Marking Emails as Read',
      mark_unread: 'Marking Emails as Unread',
      mark_important: 'Updating Importance',
      unmark_important: 'Removing Importance',
      label: 'Applying Custom Label',
      bulk_unsubscribe: 'Bulk Unsubscribing Newsletters'
    }[job.action] || `Executing ${job.action}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {isRunning && (
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            {isCompleted && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            )}
            {isFailed && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
            )}
            {isCancelled && (
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold text-white">{actionTitle}</h3>
              <p className="text-sm text-slate-400 capitalize">Status: {job.status}</p>
            </div>
          </div>

          {!isRunning && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Animated Progress Bar */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-slate-200">
              {job.processed_items.toLocaleString()} / {job.total_items.toLocaleString()} items
            </span>
            <span className="font-bold text-indigo-400">{job.percentage}%</span>
          </div>

          <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isFailed
                  ? 'bg-rose-500'
                  : isCancelled
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-500'
              }`}
              style={{ width: `${Math.max(3, job.percentage)}%` }}
            />
          </div>
        </div>

        {/* Current status message */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
          <div className="text-sm text-slate-300">{job.message || 'Processing requests...'}</div>
          {job.current_item && (
            <div className="text-xs font-mono text-slate-400 truncate">
              Target: <span className="text-indigo-400">{job.current_item}</span>
            </div>
          )}
        </div>

        {/* Error Log if present */}
        {job.error_details && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 max-h-36 overflow-y-auto font-mono">
            {job.error_details}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-500 font-mono">Job ID: {job.id}</div>

          <div className="flex gap-2">
            {isRunning ? (
              <button
                onClick={() => onCancel(job.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-500/30 text-sm font-medium transition"
              >
                <StopCircle className="w-4 h-4" />
                <span>Cancel Task</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
