import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronRight, MessageSquareWarning } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { CampusEvent } from '../../lib/types';
import { fmtDate, fmtMoney, fmtTime } from '../../lib/format';
import { Poster } from '../../components/EventBits';
import { EmptyState, LinkButton, PageHeader, PageLoader, Progress, StatusPill, Tabs } from '../../components/ui';

type Filter = 'upcoming' | 'review' | 'past' | 'all';

export function ClubEventsPage() {
  const { data, loading } = useApi<CampusEvent[]>('/api/club/events');
  const [filter, setFilter] = useState<Filter>('upcoming');
  if (loading) return <PageLoader />;
  const all = data ?? [];
  const groups: Record<Filter, CampusEvent[]> = {
    upcoming: all.filter(e => e.status === 'published' && !e.is_past).reverse(),
    review: all.filter(e => e.status === 'pending' || e.status === 'rejected'),
    past: all.filter(e => e.is_past || e.status === 'completed' || e.status === 'cancelled'),
    all,
  };
  const list = groups[filter];

  return (
    <div className="animate-in">
      <PageHeader title="Events" subtitle="Everything your club has run or is running." actions={<LinkButton to="/club/events/new" variant="primary" icon={CalendarPlus}>Create event</LinkButton>} />
      <Tabs
        tabs={[
          { id: 'upcoming', label: 'Live', count: groups.upcoming.length },
          { id: 'review', label: 'In review', count: groups.review.length },
          { id: 'past', label: 'Past', count: groups.past.length },
          { id: 'all', label: 'All', count: all.length },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="mt-6 grid gap-3">
        {list.length === 0 ? (
          <EmptyState icon={CalendarPlus} title="No events here" action={filter !== 'past' && <LinkButton to="/club/events/new" variant="primary">Create event</LinkButton>} />
        ) : (
          list.map(e => (
            <Link key={e.id} to={`/club/events/${e.id}`} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/20 sm:flex-row sm:items-center">
              <Poster src={e.poster_url} title={e.title} color={e.club_color} className="h-32 w-full shrink-0 rounded-xl sm:size-20" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-semibold text-ink">{e.title}</p>
                  <StatusPill status={e.status} kind="event" />
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {fmtDate(e.event_date)} · {fmtTime(e.start_time)} · {e.venue} · {fmtMoney(e.fee)}
                </p>
                {e.status === 'rejected' && e.admin_note && (
                  <p className="mt-2 flex items-start gap-1.5 text-[13px] text-danger">
                    <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0" /> {e.admin_note}
                  </p>
                )}
              </div>
              <div className="w-full shrink-0 sm:w-56">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>{e.approved_count} confirmed</span>
                  <span>{e.pending_count > 0 ? <span className="font-semibold text-accent2">{e.pending_count} to verify</span> : `${e.spots_left} spots left`}</span>
                </div>
                <Progress value={e.teams_count} max={e.max_teams} />
              </div>
              <ChevronRight className="hidden size-4 shrink-0 text-muted sm:block" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
