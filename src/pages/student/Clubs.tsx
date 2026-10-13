import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, ChevronRight, Mail, Search } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { CampusEvent, ClubSummary } from '../../lib/types';
import { EventCard } from '../../components/EventBits';
import { Badge, ClubAvatar, EmptyState, PageHeader, PageLoader, Section } from '../../components/ui';

export function ClubsPage() {
  const { data, loading } = useApi<ClubSummary[]>('/api/clubs');
  const [q, setQ] = useState('');
  if (loading) return <PageLoader />;
  const list = (data ?? []).filter(c => `${c.name} ${c.short_name} ${c.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="animate-in">
      <PageHeader title="Clubs & departments" subtitle="Follow what each club is running this semester." />
      <div className="mb-6 flex items-center gap-2 rounded-card border border-line bg-surface p-1.5">
        <span className="grid size-10 place-items-center text-muted">
          <Search className="size-[18px]" />
        </span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clubs" className="h-10 w-full bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Building2} title="No clubs found" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(c => (
            <Link key={c.id} to={`/clubs/${c.id}`} className="group flex flex-col rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink/20">
              <div className="flex items-center gap-3">
                <ClubAvatar name={c.short_name} color={c.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{c.name}</p>
                  <p className="text-xs capitalize text-muted">{c.kind}</p>
                </div>
                <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{c.description}</p>
              <div className="mt-4 flex gap-2">
                <Badge tone={c.upcoming_count ? 'accent' : 'default'}>{c.upcoming_count} upcoming</Badge>
                <Badge>{c.event_count} events total</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClubDetailPage() {
  const { id } = useParams();
  const { data, loading } = useApi<{ club: ClubSummary; events: CampusEvent[] }>(`/api/clubs/${id}`);
  if (loading) return <PageLoader />;
  if (!data) return <EmptyState icon={Building2} title="Club not found" />;
  const { club, events } = data;
  const upcoming = events.filter(e => !e.is_past && e.status === 'published').reverse();
  const past = events.filter(e => e.is_past || e.status === 'completed');
  return (
    <div className="animate-in">
      <PageHeader back="/clubs" title={club.name} />
      <div className="relative -mt-2 overflow-hidden rounded-card border border-line bg-surface p-6">
        <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(80% 120% at 0% 0%, ${club.color}30, transparent 60%)` }} />
        <div className="relative flex flex-wrap items-center gap-5">
          <ClubAvatar name={club.short_name} color={club.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{club.kind}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink">{club.description}</p>
            {club.contact_email && (
              <a href={`mailto:${club.contact_email}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                <Mail className="size-4" /> {club.contact_email}
              </a>
            )}
          </div>
        </div>
      </div>
      <Section title={`Upcoming (${upcoming.length})`}>
        {upcoming.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcoming.map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Building2} title="No upcoming events" body="Check back later." />
        )}
      </Section>
      {past.length > 0 && (
        <Section title="Past events">
          <div className="grid grid-cols-1 gap-5 opacity-80 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {past.map(e => (
              <EventCard key={e.id} event={e} compact />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
