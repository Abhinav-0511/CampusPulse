import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Backpack, Calendar, CheckCircle2, ChevronLeft, Clock, Link2, MapPin, MessageCircle, Phone, Settings2, Share2, Tag, Ticket, Users, type LucideIcon } from 'lucide-react';
import { useApi, useMeta } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { CampusEvent, Registration } from '../../lib/types';
import { countdown, fmtDate, fmtDateTimeLocal, fmtMoney, fmtTime, teamSizeLabel } from '../../lib/format';
import { InternalBadge, Poster } from '../../components/EventBits';
import { ClubAvatar, EmptyState, IconTile, LinkButton, PageLoader, Progress, StatusPill, Tabs, cx, useToast } from '../../components/ui';

type Mine = (Registration & { is_leader: boolean }) | null;

function Fact({ icon, label, children, className }: { icon: LucideIcon; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-card bg-surface p-4', className)}>
      <IconTile icon={icon} />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-sm font-semibold leading-snug text-ink">{children}</div>
    </div>
  );
}

const lines = (s: string) =>
  s
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

export function ScheduleList({ text }: { text: string }) {
  const items = lines(text).map(l => {
    const [time, ...rest] = l.split('|');
    return rest.length ? { time: time.trim(), what: rest.join('|').trim() } : { time: '', what: l };
  });
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className={cx('flex gap-4 py-3.5', i > 0 && 'border-t border-line/60')}>
          <span className="w-16 shrink-0 font-mono text-xs text-muted">{/^\d{1,2}:\d{2}$/.test(it.time) ? fmtTime(it.time.padStart(5, '0')) : it.time}</span>
          <span className="text-sm text-ink">{it.what}</span>
        </div>
      ))}
    </div>
  );
}

function RegistrationPanel({ event, mine }: { event: CampusEvent; mine: Mine }) {
  const user = useUser();
  const meta = useMeta();
  if (user.role !== 'student') {
    const manages = user.role === 'admin' || user.club_id === event.club_id;
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-sm text-muted">You're viewing this event as {user.role === 'admin' ? 'the portal admin' : 'a club admin'}.</p>
        {manages && (
          <LinkButton to={`/club/events/${event.id}`} variant="primary" className="mt-4 w-full" icon={Settings2}>
            Manage event
          </LinkButton>
        )}
      </div>
    );
  }

  if (mine) {
    const map = {
      pending: { tone: 'border-accent2/30 bg-accent2/5', icon: Clock, title: 'Payment under review', body: `${event.club_short_name} is verifying your transaction. You'll get a notification once it's approved.` },
      approved: { tone: 'border-success/30 bg-success/5', icon: CheckCircle2, title: "You're registered", body: 'Your entry QR is in My Registrations. Show it at the venue for check-in.' },
      rejected: { tone: 'border-danger/30 bg-danger/5', icon: AlertCircle, title: 'Payment not verified', body: mine.review_note ? `Reason: ${mine.review_note}` : 'Resubmit a valid transaction ID from My Registrations.' },
      cancelled: { tone: '', icon: AlertCircle, title: 'Cancelled', body: '' },
    }[mine.status];
    return (
      <div className={cx('rounded-card border p-5', map.tone)}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">{map.title}</p>
          <StatusPill status={mine.status} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{map.body}</p>
        <p className="mt-3 font-mono text-xs text-muted">
          {mine.code}
          {mine.team_name ? ` · Team ${mine.team_name}` : ''}
        </p>
        <div className="mt-4 grid gap-2">
          <LinkButton to="/registrations" variant={mine.status === 'approved' ? 'primary' : 'secondary'} icon={Ticket}>
            {mine.status === 'approved' ? 'View entry pass' : mine.status === 'rejected' && mine.is_leader ? 'Resubmit payment' : 'View registration'}
          </LinkButton>
          {mine.status === 'approved' && event.whatsapp_link && (
            <a href={event.whatsapp_link} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 text-sm font-semibold text-success hover:bg-success/20">
              <MessageCircle className="size-4" /> Join WhatsApp group
            </a>
          )}
        </div>
      </div>
    );
  }

  const deadlineMs = new Date(event.reg_deadline).getTime() - Date.now();
  const outsider = !!event.internal_only && user.student_type !== 'internal';
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className={cx('text-2xl font-bold tracking-tight', event.fee === 0 ? 'text-success' : 'text-ink')}>{fmtMoney(event.fee)}</span>
        <span className="text-xs text-muted">{event.fee > 0 ? (event.team_max > 1 ? 'per team' : 'per person') : 'no payment needed'}</span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>{event.teams_count} registered</span>
          <span>{event.spots_left} spots left</span>
        </div>
        <Progress value={event.teams_count} max={event.max_teams} tone={event.spots_left < event.max_teams * 0.15 ? 'warn' : 'accent'} />
      </div>
      {outsider ? (
        <div className="mt-5 rounded-xl bg-accent2/10 px-4 py-3 text-center text-sm font-medium text-accent2">This event is only for {meta?.collegeName ?? 'host college'} students.</div>
      ) : event.registration_open ? (
        <>
          <LinkButton to={`/events/${event.id}/register`} variant="primary" size="lg" className="mt-5 w-full">
            {event.team_max > 1 ? 'Register your team' : 'Register now'}
          </LinkButton>
          <p className="mt-3 text-center text-xs text-muted">Registration closes in {countdown(deadlineMs)}</p>
        </>
      ) : (
        <div className="mt-5 rounded-xl bg-raised px-4 py-3 text-center text-sm font-medium text-muted">{event.closed_reason}</div>
      )}
    </div>
  );
}

export function EventDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error } = useApi<{ event: CampusEvent; myRegistration: Mine }>(`/api/events/${id}`);
  const [tab, setTab] = useState<'about' | 'rules' | 'schedule' | 'contact'>('about');
  const [shareOpen, setShareOpen] = useState(false);

  if (loading) return <PageLoader />;
  if (error || !data) return <EmptyState icon={AlertCircle} title="Event not found" body={error ?? undefined} action={<LinkButton to="/explore">Browse events</LinkButton>} />;
  const { event, myRegistration } = data;
  const url = window.location.href;
  const deadlineMs = new Date(event.reg_deadline).getTime() - Date.now();

  const tabs = [
    { id: 'about' as const, label: 'About' },
    ...(event.rules ? [{ id: 'rules' as const, label: 'Rules & Eligibility' }] : []),
    ...(event.schedule ? [{ id: 'schedule' as const, label: 'Schedule' }] : []),
    { id: 'contact' as const, label: 'Organizer' },
  ];

  return (
    <div className="animate-in mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <Link to="/explore" className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ChevronLeft className="size-4" /> Explore
        </Link>
        <div className="relative">
          <button onClick={() => setShareOpen(o => !o)} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink transition-colors hover:bg-raised">
            <Share2 className="size-4" /> Share
          </button>
          {shareOpen && (
            <div className="animate-pop absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-card border border-line bg-surface py-1.5 shadow-2xl shadow-black">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(url);
                  toast('Link copied');
                  setShareOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-raised"
              >
                <Link2 className="size-4 text-muted" /> Copy link
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${event.title} by ${event.club_name} on ${fmtDate(event.event_date)}. Register: ${url}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-raised" onClick={() => setShareOpen(false)}>
                <MessageCircle className="size-4 text-muted" /> Share to WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-card">
        <Poster src={event.poster_url} title={event.title} color={event.club_color} className="h-64 w-full sm:h-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-white">{event.category}</span>
            {!!event.internal_only && <InternalBadge className="text-xs" />}
            {event.registration_open ? (
              <span className="flex items-center gap-1.5 rounded-full bg-success/20 px-3 py-1 text-xs font-semibold text-success backdrop-blur">
                <span className="size-1.5 rounded-full bg-success" /> Registration open
              </span>
            ) : (
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-muted backdrop-blur">{event.closed_reason}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{event.title}</h1>
          {event.tagline && <p className="mt-1.5 max-w-2xl text-sm text-white/75">{event.tagline}</p>}
          <Link to={`/clubs/${event.club_id}`} className="mt-3 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white">
            <ClubAvatar name={event.club_short_name} color={event.club_color} size="sm" />
            {event.club_name}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Fact icon={Calendar} label="Date & time" className="col-span-2 md:col-span-1">
              {fmtDate(event.event_date)}
              <p className="font-normal text-muted">
                {fmtTime(event.start_time)} to {fmtTime(event.end_time)}
              </p>
            </Fact>
            <Fact icon={MapPin} label="Venue">
              {event.venue}
            </Fact>
            <Fact icon={Tag} label="Fee">
              <span className={event.fee === 0 ? 'text-success' : ''}>{fmtMoney(event.fee)}</span>
            </Fact>
            <Fact icon={Users} label="Team size">
              {teamSizeLabel(event.team_min, event.team_max)}
            </Fact>
            <Fact icon={Clock} label="Registration closes">
              {fmtDateTimeLocal(event.reg_deadline)}
              {event.registration_open && <p className="font-normal text-accent2">in {countdown(deadlineMs)}</p>}
            </Fact>
            <Fact icon={Ticket} label="Spots">
              {event.spots_left} of {event.max_teams}
              <p className="font-normal text-muted">{event.team_max > 1 ? 'teams' : 'seats'} remaining</p>
            </Fact>
          </div>

          <Tabs className="mt-8" tabs={tabs} value={tab} onChange={setTab} />
          <div className="mt-4 rounded-card bg-surface p-6">
            {tab === 'about' && (
              <div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{event.description}</p>
                {event.requirements && (
                  <div className="mt-6 flex items-start gap-3 rounded-xl bg-raised p-4">
                    <Backpack className="mt-0.5 size-4 shrink-0 text-accent2" />
                    <div>
                      <p className="text-sm font-medium text-ink">What to bring</p>
                      <ul className="mt-1.5 space-y-1 text-sm text-muted">
                        {lines(event.requirements).map(r => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === 'rules' && (
              <ol className="space-y-4">
                {lines(event.rules).map((r, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold text-muted">{i + 1}</span>
                    <p className="text-sm leading-relaxed text-ink">{r}</p>
                  </li>
                ))}
              </ol>
            )}
            {tab === 'schedule' && <ScheduleList text={event.schedule} />}
            {tab === 'contact' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <ClubAvatar name={event.club_short_name} color={event.club_color} />
                  <div>
                    <p className="text-sm font-semibold text-ink">{event.club_name}</p>
                    <Link to={`/clubs/${event.club_id}`} className="text-xs text-accent hover:underline">
                      View all events
                    </Link>
                  </div>
                </div>
                {event.contact_name && (
                  <div className="flex items-center gap-3">
                    <IconTile icon={Phone} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{event.contact_name}</p>
                      <a href={`tel:${event.contact_phone}`} className="text-xs text-muted hover:text-ink">
                        {event.contact_phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <RegistrationPanel event={event} mine={myRegistration} />
          {event.fee > 0 && !myRegistration && event.registration_open && (
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted">Payment is by UPI to {event.club_short_name}. You'll see their QR code and enter the transaction ID during registration. Your spot is confirmed after the club verifies it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
