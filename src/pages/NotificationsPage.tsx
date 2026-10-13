import { useNavigate } from 'react-router-dom';
import { Award, Bell, BellRing, CalendarCheck, CheckCircle2, CreditCard, Megaphone, MessageCircle, MessageSquareWarning, XCircle, type LucideIcon } from 'lucide-react';
import { api, useApi } from '../lib/api';
import type { Notification } from '../lib/types';
import { timeAgo } from '../lib/format';
import { useUnread } from '../components/Layout';
import { Button, EmptyState, PageHeader, PageLoader, cx } from '../components/ui';

const KIND: Record<string, { icon: LucideIcon; tone: string }> = {
  approval: { icon: CheckCircle2, tone: 'bg-success/15 text-success' },
  rejection: { icon: XCircle, tone: 'bg-danger/15 text-danger' },
  reminder: { icon: BellRing, tone: 'bg-accent2/15 text-accent2' },
  certificate: { icon: Award, tone: 'bg-accent/15 text-accent' },
  payment: { icon: CreditCard, tone: 'bg-accent2/15 text-accent2' },
  event: { icon: CalendarCheck, tone: 'bg-accent/15 text-accent' },
  complaint: { icon: MessageSquareWarning, tone: 'bg-accent2/15 text-accent2' },
  announcement: { icon: Megaphone, tone: 'bg-raised text-ink' },
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { refresh } = useUnread();
  const { data, loading, reload } = useApi<{ items: Notification[]; unread: number }>('/api/notifications');

  const markRead = async (ids?: string[]) => {
    await api('/api/notifications/read', { body: { ids } }).catch(() => {});
    reload();
    refresh();
  };

  if (loading) return <PageLoader />;
  const items = data?.items ?? [];

  return (
    <div className="animate-in mx-auto max-w-3xl">
      <PageHeader title="Notifications" subtitle={data?.unread ? `${data.unread} unread` : "You're all caught up."} actions={data?.unread ? <Button size="sm" onClick={() => markRead()}>Mark all as read</Button> : undefined} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" body="Approvals, reminders and certificates will show up here." />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <ul className="divide-y divide-line">
            {items.map(n => {
              const k = KIND[n.kind] ?? KIND.announcement;
              return (
                <li key={n.id} className={cx('flex gap-4 px-5 py-4 transition-colors', !n.read_at && 'bg-accent/[0.04]')}>
                  <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', k.tone)}>
                    <k.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      className="block w-full text-left"
                      onClick={() => {
                        if (!n.read_at) markRead([n.id]);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className={cx('text-sm', n.read_at ? 'font-medium text-ink' : 'font-semibold text-ink')}>{n.title}</p>
                        <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.body}</p>
                    </button>
                    {n.action_url && (
                      <a href={n.action_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 text-[13px] font-semibold text-success hover:bg-success/20">
                        <MessageCircle className="size-4" /> {n.action_label ?? 'Open link'}
                      </a>
                    )}
                  </div>
                  {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
