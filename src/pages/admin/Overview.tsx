import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Building2, CalendarClock, CalendarDays, ChevronRight, Clock, GraduationCap, IdCard, IndianRupee, MessageSquareWarning, Ticket } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { CampusEvent } from '../../lib/types';
import { fmtDate, timeAgo } from '../../lib/format';
import { Badge, Card, CardHeader, ClubAvatar, PageHeader, PageLoader, Stat, StatusPill } from '../../components/ui';

interface Overview {
  stats: { verifications_pending: number; students: number; clubs: number; events_live: number; events_pending: number; registrations: number; payments_pending: number; revenue: number; complaints_open: number; certificates: number };
  clubs: { id: string; name: string; short_name: string; color: string; status: string; events: number; teams: number; revenue: number }[];
  pendingEvents: CampusEvent[];
  complaints: { id: string; subject: string; priority: string; status: string; created_at: string; club_name: string }[];
  signups: { day: string; n: number }[];
}

/** Registrations per day over the last 14 days. Single series, so no legend; hover shows the value. */
function DailyBars({ data }: { data: { day: string; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
    return { day: d, n: data.find(x => x.day === d)?.n ?? 0 };
  });
  const max = Math.max(1, ...days.map(d => d.n));
  const total = days.reduce((s, d) => s + d.n, 0);
  return (
    <Card>
      <CardHeader title="Registrations, last 14 days" subtitle={`${total} new registrations`} />
      <div className="px-5 pb-4 pt-6">
        <div className="relative flex h-36 items-end gap-[2px] border-b border-line">
          {days.map((d, i) => (
            <div key={d.day} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className="w-full rounded-t-[4px] bg-accent transition-opacity" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 3 : 0, opacity: hover === null || hover === i ? 1 : 0.45 }} />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs shadow-xl">
                  <span className="text-muted">{fmtDate(d.day, { day: 'numeric', month: 'short' })}</span> <span className="font-semibold text-ink">{d.n}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{fmtDate(days[0].day, { day: 'numeric', month: 'short' })}</span>
          <span>Today</span>
        </div>
      </div>
    </Card>
  );
}

export function AdminOverview() {
  const { data, loading } = useApi<Overview>('/api/admin/overview', { pollMs: 30_000 });
  if (loading || !data) return <PageLoader />;
  const s = data.stats;
  return (
    <div className="animate-in">
      <PageHeader eyebrow="Portal admin" title="Overview" subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} />
      {s.verifications_pending > 0 && (
        <Link to="/admin/verifications" className="mb-5 flex items-center gap-3 rounded-card border border-accent2/30 bg-accent2/5 p-4 text-sm transition-colors hover:bg-accent2/10">
          <IdCard className="size-5 shrink-0 text-accent2" />
          <span className="flex-1 text-ink">
            <span className="font-semibold">{s.verifications_pending} external student{s.verifications_pending === 1 ? '' : 's'}</span> waiting for ID card verification
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={GraduationCap} label="Students" value={s.students} hint={`${s.clubs} active clubs`} />
        <Stat icon={CalendarDays} tone="success" label="Live events" value={s.events_live} hint={s.events_pending ? `${s.events_pending} awaiting approval` : 'None awaiting approval'} />
        <Stat icon={Ticket} tone="accent" label="Registrations" value={s.registrations} hint={`${s.payments_pending} payments pending with clubs`} />
        <Stat icon={IndianRupee} label="Fees collected" value={`₹${s.revenue.toLocaleString('en-IN')}`} hint={`${s.certificates} certificates issued`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={CalendarClock} title="Events awaiting approval" action={<Link to="/admin/events?status=pending" className="text-sm font-medium text-accent">Review all</Link>} />
          {data.pendingEvents.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Nothing to review.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.pendingEvents.map(e => (
                <li key={e.id}>
                  <Link to="/admin/events?status=pending" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-raised/40">
                    <ClubAvatar name={e.club_short_name} color={e.club_color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{e.title}</p>
                      <p className="text-xs text-muted">
                        {e.club_short_name} · {fmtDate(e.event_date)} · submitted {timeAgo(e.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader icon={MessageSquareWarning} title="Open complaints" subtitle={`${s.complaints_open} unresolved`} action={<Link to="/admin/complaints" className="text-sm font-medium text-accent">Open inbox</Link>} />
          {data.complaints.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Inbox zero.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.complaints.map(c => (
                <li key={c.id}>
                  <Link to="/admin/complaints" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-raised/40">
                    <Clock className="size-4 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.subject}</p>
                      <p className="text-xs text-muted">
                        {c.club_name} · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    {c.priority === 'high' && <Badge tone="danger">High</Badge>}
                    <StatusPill status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <DailyBars data={data.signups} />
        <Card>
          <CardHeader icon={Building2} title="Clubs" subtitle="Ranked by confirmed teams" action={<Link to="/admin/clubs" className="text-sm font-medium text-accent">Manage</Link>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-medium">Club</th>
                  <th className="px-3 py-2.5 text-right font-medium">Events</th>
                  <th className="px-3 py-2.5 text-right font-medium">Teams</th>
                  <th className="px-5 py-2.5 text-right font-medium">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.clubs.map(c => (
                  <tr key={c.id}>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5">
                        <ClubAvatar name={c.short_name} color={c.color} size="sm" />
                        <span className="truncate text-ink">{c.name}</span>
                        {c.status !== 'active' && <Badge>Inactive</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{c.events}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{c.teams}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">₹{c.revenue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted">
        <Award className="size-3.5" /> Anyone can verify a certificate at /verify.
      </p>
    </div>
  );
}
