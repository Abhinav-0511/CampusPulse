import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, ChevronRight, Clock, Search, Ticket } from 'lucide-react';
import { useApi } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { CampusEvent, ClubSummary, MyRegistration } from '../../lib/types';
import { CATEGORIES } from '../../lib/types';
import { daysUntil, fmtDate, fmtDateTimeLocal, fmtMoney, fmtTime } from '../../lib/format';
import { EventCard, SoonCard } from '../../components/EventBits';
import { EventCalendar } from '../../components/EventCalendar';
import { ClubAvatar, CopyButton, EmptyState, LinkButton, PageLoader, Section, cx } from '../../components/ui';

const HERO = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&auto=format&fit=crop&q=70';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent/80">
      View all <ChevronRight className="size-4" />
    </Link>
  );
}

export function StudentHome() {
  const user = useUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const events = useApi<CampusEvent[]>('/api/events?when=upcoming');
  const allEvents = useApi<CampusEvent[]>('/api/events?when=all');
  const clubs = useApi<ClubSummary[]>('/api/clubs');
  const mine = useApi<MyRegistration[]>('/api/my/registrations');

  const sections = useMemo(() => {
    const list = events.data ?? [];
    const featured = [...list.filter(e => e.featured), ...list.filter(e => !e.featured)].slice(0, 4);
    const soon = list.filter(e => daysUntil(e.event_date) <= 7);
    const deadlines = list
      .filter(e => e.registration_open)
      .sort((a, b) => a.reg_deadline.localeCompare(b.reg_deadline))
      .slice(0, 5);
    const categories = CATEGORIES.filter(c => list.some(e => e.category === c));
    return { featured, soon, deadlines, categories };
  }, [events.data]);

  // In-app day-before alert: confirmed registrations happening today or tomorrow.
  const imminent = (mine.data ?? []).filter(r => r.status === 'approved' && [0, 1].includes(daysUntil(r.event_date)));
  const actionNeeded = (mine.data ?? []).filter(r => r.status === 'rejected' && r.is_leader && daysUntil(r.event_date) >= 0);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/explore${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  };

  if (events.loading && !events.data) return <PageLoader />;

  return (
    <div className="animate-in">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface py-1 pl-3.5 pr-1">
          <span className="text-xs text-muted">Your ID</span>
          <span className="ml-1 font-mono text-sm font-semibold text-ink">{user.unique_code}</span>
          <CopyButton text={user.unique_code ?? ''} />
        </div>
      </div>

      {(imminent.length > 0 || actionNeeded.length > 0) && (
        <div className="mb-6 grid gap-3">
          {imminent.map(r => {
            const d = daysUntil(r.event_date);
            return (
              <Link key={r.id} to="/registrations" className="flex items-center gap-4 rounded-card border border-accent2/30 bg-accent2/5 p-4 transition-colors hover:bg-accent2/10">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent2/15 text-accent2">
                  <BellRing className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {d === 0 ? 'Today' : 'Tomorrow'}: {r.event_title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {fmtTime(r.start_time)} at {r.venue}. Keep your entry QR ready{r.team_name ? ` for Team ${r.team_name}` : ''}.
                  </p>
                </div>
                <span className="hidden items-center gap-1.5 text-sm font-medium text-accent2 sm:flex">
                  <Ticket className="size-4" /> View pass
                </span>
              </Link>
            );
          })}
          {actionNeeded.map(r => (
            <Link key={r.id} to="/registrations" className="flex items-center gap-4 rounded-card border border-danger/30 bg-danger/5 p-4 transition-colors hover:bg-danger/10">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/15 text-danger">
                <Clock className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Payment not verified: {r.event_title}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">{r.review_note ?? 'Resubmit a valid transaction ID to keep your spot.'}</p>
              </div>
              <span className="hidden text-sm font-medium text-danger sm:block">Resubmit</span>
            </Link>
          ))}
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-line bg-surface">
        <img src={HERO} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 to-canvas/30" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14">
          <h2 className="max-w-xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">Discover what's happening on your campus</h2>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
            {events.data?.length ?? 0} upcoming events from {clubs.data?.length ?? 0} clubs and departments. Find your next hackathon, workshop or stage.
          </p>
          <form onSubmit={search} className="mt-7 flex max-w-2xl items-center gap-2 rounded-card border border-line bg-canvas/80 p-1.5 backdrop-blur-sm">
            <span className="grid size-10 shrink-0 place-items-center text-muted">
              <Search className="size-[18px]" />
            </span>
            <input value={query} onChange={e => setQuery(e.target.value)} className="h-10 w-full min-w-0 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none" placeholder="Search events, clubs, categories or venues" />
            <button className="h-10 shrink-0 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent/90">Search</button>
          </form>
        </div>
      </section>

      {sections.categories.length > 0 && (
        <section className="pt-8">
          <div className="flex flex-wrap gap-2.5">
            {sections.categories.map(c => (
              <Link key={c} to={`/explore?category=${encodeURIComponent(c)}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-ink/20 hover:text-ink">
                {c}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Section title="Event calendar" action={<span className="text-xs text-muted">Pick a date to see its events</span>}>
        <EventCalendar events={allEvents.data ?? []} />
      </Section>

      {sections.featured.length === 0 ? (
        <div className="pt-10">
          <EmptyState icon={Search} title="No upcoming events yet" body="Clubs haven't published anything new. Check back soon." />
        </div>
      ) : (
        <Section title="Featured events" action={<ViewAll to="/explore" />}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sections.featured.map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </Section>
      )}

      {sections.soon.length > 0 && (
        <Section title="Happening this week" action={<ViewAll to="/explore" />}>
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {sections.soon.map(e => (
              <SoonCard key={e.id} event={e} />
            ))}
          </div>
        </Section>
      )}

      {sections.deadlines.length > 0 && (
        <Section title="Registration closing soon">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="divide-y divide-line">
              {sections.deadlines.map(e => {
                const left = daysUntil(e.reg_deadline.slice(0, 10));
                return (
                  <div key={e.id} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-raised/50 sm:px-5">
                    <span className="hidden size-8 shrink-0 place-items-center rounded-lg bg-raised text-ink sm:grid">
                      <Clock className="size-4" />
                    </span>
                    <Link to={`/events/${e.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">{e.title}</p>
                      <p className="truncate text-[13px] text-muted">
                        {e.club_short_name} · Closes {fmtDateTimeLocal(e.reg_deadline)} · {fmtMoney(e.fee)}
                      </p>
                    </Link>
                    <span className={cx('hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:inline', left <= 2 ? 'bg-danger/15 text-danger' : 'bg-accent2/15 text-accent2')}>
                      {left <= 0 ? 'Closes today' : left === 1 ? '1 day left' : `${left} days left`}
                    </span>
                    <LinkButton to={`/events/${e.id}/register`} variant="primary" size="sm">
                      Register
                    </LinkButton>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {clubs.data && clubs.data.length > 0 && (
        <Section title="Clubs & departments" action={<ViewAll to="/clubs" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.data.slice(0, 6).map(c => (
              <Link key={c.id} to={`/clubs/${c.id}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/20">
                <ClubAvatar name={c.short_name} color={c.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-muted">{c.upcoming_count ? `${c.upcoming_count} upcoming` : 'No upcoming events'}</p>
                </div>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {sections.featured.length > 0 && (
        <p className="pt-10 text-center text-xs text-muted">
          Showing events up to {fmtDate(events.data![events.data!.length - 1].event_date)}. Past events are on each club's page.
        </p>
      )}
    </div>
  );
}
