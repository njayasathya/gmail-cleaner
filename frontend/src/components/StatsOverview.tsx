import React from 'react';
import { Users, Mail, MailOpen, HardDrive, BellOff, CheckCircle2 } from 'lucide-react';
import { StatsResponse } from '../types';
import { formatBytes } from '../utils/format';

interface StatsOverviewProps {
  stats: StatsResponse;
  onFilterUnsubscribe?: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, onFilterUnsubscribe }) => {
  const unreadRate =
    stats.total_emails > 0 ? Math.round((stats.total_unread / stats.total_emails) * 100) : 0;

  const cards = [
    {
      label: 'Total Senders',
      value: stats.total_senders.toLocaleString(),
      subtext: 'Unique email senders',
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
      iconBg: 'bg-blue-500/15 text-blue-400'
    },
    {
      label: 'Scanned Emails',
      value: stats.total_emails.toLocaleString(),
      subtext: 'Cataloged in database',
      icon: Mail,
      color: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400',
      iconBg: 'bg-indigo-500/15 text-indigo-400'
    },
    {
      label: 'Unread Emails',
      value: stats.total_unread.toLocaleString(),
      subtext: `${unreadRate}% unread rate`,
      icon: MailOpen,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
      iconBg: 'bg-amber-500/15 text-amber-400'
    },
    {
      label: 'Storage Consumed',
      value: formatBytes(stats.total_size_bytes),
      subtext: 'Estimated inbox space',
      icon: HardDrive,
      color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400',
      iconBg: 'bg-rose-500/15 text-rose-400'
    },
    {
      label: 'Newsletters',
      value: stats.newsletters_count.toLocaleString(),
      subtext: 'Eligible for 1-click unsub',
      icon: BellOff,
      color: 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-400',
      iconBg: 'bg-violet-500/15 text-violet-400',
      onClick: onFilterUnsubscribe
    },
    {
      label: 'Unsubscribed',
      value: stats.unsubscribed_count.toLocaleString(),
      subtext: 'Subscriptions cancelled',
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
      iconBg: 'bg-emerald-500/15 text-emerald-400'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            onClick={card.onClick}
            className={`p-5 rounded-2xl border bg-gradient-to-b ${card.color} ${
              card.onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">{card.label}</span>
              <div className={`p-2 rounded-xl ${card.iconBg}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{card.value}</div>
            <div className="text-xs text-slate-400 mt-1.5 truncate">{card.subtext}</div>
          </div>
        );
      })}
    </div>
  );
};
