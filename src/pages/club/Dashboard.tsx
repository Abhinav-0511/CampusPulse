import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, ChevronRight, Clock, IndianRupee, LifeBuoy, ScanLine, Ticket, Users } from 'lucide-react';
import { useApi } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { CampusEvent } from '../../lib/types';
import { fmtDate, fmtTime, timeAgo } from '../../lib/format';
import { Poster } from '../../components/EventBits';
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, PageLoader, Progress, Stat, StatusPill } from '../../components/ui';

interface Overview {
  club: { name: string; color: string };
  stats: { events_total: number; events_upcoming: number; events_awaiting_approval: number; payments_pending: number; teams_approved: number; participants: number; revenue: number };
  upcoming: CampusEvent[];
  pending: { id: string; code: string; team_name: string | null; amount: number; transaction_id: string; created_at: string; event_id: string; event_title: string; leader_name: string; member_count: number }[];
}

export function ClubDashboard() {
  const user = useUser();
  const { data, loading } = useApi<Overview>('/api/club/overview', { pollMs: 30_000 });
  if (loading || !data) return <PageLoader />;
  const { stats } = data;

  return (
    <div className="animate-in">
      <PageHeader
        eyebrow={data.club.name}
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        actions={
          <>
            <LinkButton to="/club/scan" icon={ScanLine}>
              Scanner
            </LinkButton>
            <LinkButton to="/club/events/new" variant="primary" icon={CalendarPlus}>
              Create event
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Clock} tone={stats.payments_pending ? 'warn' : 'default'} label="Payments to verify" value={stats.payments_pending} hint={stats.payments_pending ? 'Waiting on you' : 'All clear'} />
        <Stat icon={CalendarDays} label="Upcoming events" value={stats.events_upcoming} hint={stats.events_awaiting_approval ? `${stats.events_awaiting_approval} awaiting admin approval` : `${stats.events_total} total`} />
        <Stat icon={Ticket} tone="success" label="Confirmed teams" value={stats.teams_approved} hint={`${stats.participants} participants`} />
        <Stat icon={IndianRupee} tone="accent" label="Fees collected" value={`₹${stats.revenue.toLocaleString('en-IN')}`} hint="Verified payments" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Upcoming events" subtitle="Registrations at a glance" action={<Link to="/club/events" className="text-sm font-medium text-accent">All events</Link>} />
          {data.upcoming.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={CalendarPlus} title="No upcoming events" body="Create your next event and it goes to the portal admin for approval." action={<LinkButton to="/club/events/new" variant="primary">Create event</LinkButton>} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.upcoming.map(e => (
                <li key={e.id}>
                  <Link to={`/club/events/${e.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-raised/40">
                    <Poster src={e.poster_url} title={e.title} color={e.club_color} className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                        {e.status !== 'published' && <StatusPill status={e.status} kind="event" />}
                      </div>
                      <p className="text-xs text-muted">
                        {fmtDate(e.event_date)} · {fmtTime(e.start_time)}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={e.teams_count} max={e.max_teams} />
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {e.teams_count}/{e.max_teams}
                        </span>
                      </div>
                    </div>
                    {e.pending_count > 0 && <span className="shrink-0 rounded-full bg-accent2/15 px-2 py-0.5 text-xs font-semibold text-accent2">{e.pending_count} to verify</span>}
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment verification queue" subtitle="Oldest first" />
            {data.pending.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No payments waiting. Nice.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.pending.map(p => (
                  <li key={p.id}>
                    <Link to={`/club/events/${p.event_id}?tab=pending`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-raised/40">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent2/15 text-accent2">
                        <Users className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {p.team_name ?? p.leader_name} <span className="text-muted">· {p.member_count}</span>
                        </p>
                        <p className="truncate text-xs text-muted">
                          {p.event_title} · {timeAgo(p.created_at)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-ink">₹{p.amount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-raised text-ink">
              <LifeBuoy className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Need something from the admin?</p>
              <p className="text-xs text-muted">Venue issues, budget approvals, account access.</p>
            </div>
            <LinkButton to="/club/support" size="sm">
              Raise
            </LinkButton>
          </Card>
        </div>
      </div>
    </div>
  );
}
