import React from 'react';
import { Users, Mail, MailOpen, HardDrive, BellOff, CheckCircle2 } from 'lucide-react';
import { StatsResponse } from '../types';

interface StatsOverviewProps {
  stats: StatsResponse;
  onFilterCategory?: (category: string) => void;
  onFilterUnsubscribe?: (hasUnsub: boolean) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, onFilterUnsubscribe }) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const cards = [
    {
      label: 'Total Senders',
      value: stats.total_senders.toLocaleString(),
      subtext: 'Unique email senders',
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
      iconBg: 'bg-blue-500/10 text-blue-400'
    },
    {
      label: 'Scanned Emails',
      value: stats.total_emails.toLocaleString(),
      subtext: 'Cataloged in database',
      icon: Mail,
      color: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400',
      iconBg: 'bg-indigo-500/10 text-indigo-400'
    },
    {
      label: 'Unread Emails',
      value: stats.total_unread.toLocaleString(),
      subtext: `${stats.total_emails > 0 ? Math.round((stats.total_unread / stats.total_emails) * 100) : 0}% unread rate`,
      icon: MailOpen,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
      iconBg: 'bg-amber-500/10 text-amber-400'
    },
    {
      label: 'Storage Consumed',
      value: formatBytes(stats.total_size_bytes),
      subtext: 'Estimated total inbox space',
      icon: HardDrive,
      color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400',
      iconBg: 'bg-rose-500/10 text-rose-400'
    },
    {
      label: 'Newsletters',
      value: stats.newsletters_count.toLocaleString(),
      subtext: 'Eligible for 1-click unsub',
      icon: BellOff,
      color: 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-400',
      iconBg: 'bg-violet-500/10 text-violet-400',
      onClick: () => onFilterUnsubscribe && onFilterUnsubscribe(true)
    },
    {
      label: 'Unsubscribed',
      value: stats.unsubscribed_count.toLocaleString(),
      subtext: 'Subscriptions cancelled',
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
      iconBg: 'bg-emerald-500/10 text-emerald-400'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            onClick={card.onClick}
            className={`p-4 rounded-xl border bg-gradient-to-b ${card.color} ${
              card.onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{card.value}</div>
            <div className="text-[10px] text-slate-400 mt-1 truncate">{card.subtext}</div>
          </div>
        );
      })}
    </div>
  );
};
