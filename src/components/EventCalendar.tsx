import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { fmtDate, fmtMoney, fmtTime, todayStr } from '../lib/format';
import { Poster } from './EventBits';
import { Card, cx } from './ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month grid with an event count on each date; picking a date lists that day's events beside it. */
export function EventCalendar({ events }: { events: CampusEvent[] }) {
  const today = todayStr();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => {
    const map = new Map<string, CampusEvent[]>();
    for (const e of events) map.set(e.event_date, [...(map.get(e.event_date) ?? []), e]);
    return map;
  }, [events]);

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthTotal = [...byDate.entries()].filter(([d]) => d.startsWith(`${month.y}-${pad(month.m + 1)}`)).reduce((s, [, list]) => s + list.length, 0);
  const shift = (delta: number) => setMonth(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const dayEvents = byDate.get(selected) ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-ink">{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
            <p className="text-xs text-muted">
              {monthTotal} event{monthTotal === 1 ? '' : 's'} this month
            </p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => shift(-1)} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink" aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setMonth({ y: d.getFullYear(), m: d.getMonth() });
                setSelected(today);
              }}
              className="h-9 rounded-lg border border-line px-3 text-xs font-medium text-muted hover:text-ink"
            >
              Today
            </button>
            <button onClick={() => shift(1)} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink" aria-label="Next month">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(w => (
            <span key={w} className="pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`blank-${i}`} />;
            const k = key(month.y, month.m, d);
            const count = byDate.get(k)?.length ?? 0;
            const isSel = k === selected;
            const isToday = k === today;
            return (
              <button
                key={k}
                onClick={() => setSelected(k)}
                aria-label={`${fmtDate(k)}: ${count} event${count === 1 ? '' : 's'}`}
                aria-pressed={isSel}
                className={cx(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors',
                  isSel ? 'bg-accent text-white' : count ? 'bg-raised text-ink hover:bg-line' : 'text-muted hover:bg-raised',
                  isToday && !isSel && 'ring-1 ring-accent',
                  k < today && !isSel && 'opacity-60',
                )}
              >
                <span className="font-medium tabular-nums">{d}</span>
                {count > 0 && (
                  <span className={cx('mt-0.5 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 tabular-nums', isSel ? 'bg-white text-accent' : 'bg-accent2 text-black')}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">{selected === today ? 'Today' : fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p className="text-xs text-muted">
              {dayEvents.length ? `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : 'No events'}
            </p>
          </div>
          <Link to={`/explore?when=all&date=${selected}`} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            Open in Explore <ExternalLink className="size-3.5" />
          </Link>
        </div>
        {dayEvents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <CalendarDays className="size-7 text-muted" />
            <p className="text-sm text-muted">Nothing scheduled on this day. Dates with an orange count have events.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {dayEvents.map(e => (
              <li key={e.id}>
                <Link to={`/events/${e.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-raised/40">
                  <Poster src={e.poster_url} title={e.title} color={e.club_color} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                    <p className="truncate text-xs text-muted">
                      {e.club_short_name} · {fmtTime(e.start_time)}–{fmtTime(e.end_time)} · {fmtMoney(e.fee)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                      <MapPin className="size-3" /> {e.venue}
                    </p>
                  </div>
                  <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', e.registration_open ? 'bg-success/15 text-success' : 'bg-raised text-muted')}>{e.registration_open ? 'Open' : e.is_past ? 'Ended' : 'Closed'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
