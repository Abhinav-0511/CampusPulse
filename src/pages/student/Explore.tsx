import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX, X } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { CampusEvent, ClubSummary } from '../../lib/types';
import { CATEGORIES } from '../../lib/types';
import { EventCard } from '../../components/EventBits';
import { fmtDate } from '../../lib/format';
import { Button, Checkbox, EmptyState, PageHeader, Select, Spinner, cx } from '../../components/ui';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const club = params.get('club') ?? '';
  const when = params.get('when') ?? 'upcoming';
  const price = params.get('price') ?? '';
  const openOnly = params.get('open') === '1';
  const sort = params.get('sort') ?? 'date';
  const date = params.get('date') ?? '';

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  // Debounce typing into the URL so every keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== q) update('q', text);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const apiPath = `/api/events?${new URLSearchParams({ when, ...(q && { search: q }), ...(category && { category }), ...(club && { club }) })}`;
  const events = useApi<CampusEvent[]>(apiPath);
  const clubs = useApi<ClubSummary[]>('/api/clubs');

  const results = useMemo(() => {
    let list = events.data ?? [];
    if (price === 'free') list = list.filter(e => e.fee === 0);
    if (price === 'paid') list = list.filter(e => e.fee > 0);
    if (openOnly) list = list.filter(e => e.registration_open);
    if (date) list = list.filter(e => e.event_date === date);
    if (sort === 'deadline') list = [...list].sort((a, b) => a.reg_deadline.localeCompare(b.reg_deadline));
    if (sort === 'fee') list = [...list].sort((a, b) => a.fee - b.fee);
    return list;
  }, [events.data, price, openOnly, sort, date]);

  const activeChips = [
    category && { key: 'category', label: category },
    club && { key: 'club', label: clubs.data?.find(c => c.id === club)?.short_name ?? 'Club' },
    price && { key: 'price', label: price === 'free' ? 'Free' : 'Paid' },
    openOnly && { key: 'open', label: 'Open for registration' },
    when === 'past' && { key: 'when', label: 'Past events' },
    date && { key: 'date', label: fmtDate(date) },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="animate-in">
      <PageHeader title="Explore events" subtitle="Search across every club and department." />

      <div className="flex items-center gap-2 rounded-card border border-line bg-surface p-1.5">
        <span className="grid size-10 shrink-0 place-items-center text-muted">
          <Search className="size-[18px]" />
        </span>
        <input value={text} onChange={e => setText(e.target.value)} className="h-10 w-full min-w-0 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none" placeholder="Search by event, club, category or venue" autoFocus={!q} />
        {text && (
          <button onClick={() => setText('')} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => update('category', '')} className={cx('shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors', !category ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface text-muted hover:text-ink')}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => update('category', category === c ? '' : c)} className={cx('shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors', category === c ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface text-muted hover:text-ink')}>
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select value={club} onChange={e => update('club', e.target.value)} aria-label="Club">
          <option value="">All clubs</option>
          {clubs.data?.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={price} onChange={e => update('price', e.target.value)} aria-label="Fee">
          <option value="">Any fee</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </Select>
        <Select value={when} onChange={e => update('when', e.target.value === 'upcoming' ? '' : e.target.value)} aria-label="When">
          <option value="upcoming">Upcoming</option>
          <option value="past">Past events</option>
          <option value="all">All dates</option>
        </Select>
        <Select value={sort} onChange={e => update('sort', e.target.value === 'date' ? '' : e.target.value)} aria-label="Sort">
          <option value="date">Sort: Event date</option>
          <option value="deadline">Sort: Deadline</option>
          <option value="fee">Sort: Fee</option>
        </Select>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">
            {events.loading ? 'Searching…' : `${results.length} event${results.length === 1 ? '' : 's'}`}
            {q && <span> for "{q}"</span>}
          </p>
          {activeChips.map(c => (
            <button key={c.key} onClick={() => update(c.key, '')} className="flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-ink hover:bg-line">
              {c.label} <X className="size-3" />
            </button>
          ))}
        </div>
        <Checkbox checked={openOnly} onChange={v => update('open', v ? '1' : '')}>
          Open for registration
        </Checkbox>
      </div>

      <div className="mt-6">
        {events.loading && !events.data ? (
          <div className="grid place-items-center py-20">
            <Spinner />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No events match"
            body="Try a different search or clear some filters."
            action={
              <Button onClick={() => setParams({}, { replace: true })} size="sm">
                Clear all filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
