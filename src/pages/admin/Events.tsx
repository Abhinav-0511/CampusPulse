import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarX, Check, ExternalLink, Settings2, Star, X } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { CampusEvent } from '../../lib/types';
import { fmtDate, fmtMoney, fmtTime, teamSizeLabel, timeAgo } from '../../lib/format';
import { Poster } from '../../components/EventBits';
import { Button, EmptyState, ErrorNote, Field, LinkButton, Modal, PageHeader, PageLoader, StatusPill, Tabs, Textarea, cx, useToast } from '../../components/ui';

type Filter = 'pending' | 'published' | 'completed' | 'rejected' | 'cancelled' | 'all';

export function AdminEventsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as Filter) || 'pending';
  const { data, loading, reload } = useApi<CampusEvent[]>('/api/admin/events');
  const [action, setAction] = useState<{ event: CampusEvent; kind: 'reject' | 'unpublish' } | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <PageLoader />;
  const all = data ?? [];
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter(e => e.status === s).length);
  const list = filter === 'all' ? all : all.filter(e => e.status === filter);

  // Overlapping venue bookings, so the admin can spot clashes before approving.
  const clashFor = (e: CampusEvent) =>
    all.find(o => o.id !== e.id && ['published', 'pending'].includes(o.status) && o.venue.toLowerCase() === e.venue.toLowerCase() && o.event_date === e.event_date && o.start_time < e.end_time && o.end_time > e.start_time);

  const review = async (e: CampusEvent, kind: 'approve' | 'reject' | 'unpublish', reviewNote = '') => {
    setBusy(e.id);
    setErr(null);
    try {
      await api(`/api/admin/events/${e.id}/review`, { body: { action: kind, note: reviewNote } });
      toast(kind === 'approve' ? `"${e.title}" is live` : kind === 'reject' ? 'Sent back to the club with your note' : 'Event unpublished');
      setAction(null);
      setNote('');
      reload();
    } catch (error) {
      setErr((error as Error).message);
      if (kind === 'approve') toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const feature = async (e: CampusEvent) => {
    await api(`/api/admin/events/${e.id}/feature`, { body: { featured: !e.featured } });
    toast(e.featured ? 'Removed from featured' : 'Featured on student home');
    reload();
  };

  return (
    <div className="animate-in">
      <PageHeader title="Events" subtitle="Approve submissions, feature events on the student home page, and oversee every club." />
      <Tabs
        tabs={[
          { id: 'pending', label: 'Awaiting approval', count: count('pending') },
          { id: 'published', label: 'Live', count: count('published') },
          { id: 'completed', label: 'Completed', count: count('completed') },
          { id: 'rejected', label: 'Changes requested', count: count('rejected') },
          { id: 'cancelled', label: 'Cancelled', count: count('cancelled') },
          { id: 'all', label: 'All', count: count('all') },
        ]}
        value={filter}
        onChange={v => setParams({ status: v }, { replace: true })}
      />
      <div className="mt-6 grid gap-4">
        {list.length === 0 ? (
          <EmptyState icon={CalendarX} title={filter === 'pending' ? 'No events waiting for approval' : 'No events here'} />
        ) : (
          list.map(e => {
            const clash = clashFor(e);
            return (
              <article key={e.id} className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="flex flex-col md:flex-row">
                  <Poster src={e.poster_url} title={e.title} color={e.club_color} className="h-40 w-full shrink-0 md:h-auto md:w-52" />
                  <div className="min-w-0 flex-1 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-semibold text-ink">{e.title}</p>
                          <StatusPill status={e.status} kind="event" />
                          {!!e.featured && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-accent2">
                              <Star className="size-3.5 fill-current" /> Featured
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[13px]" style={{ color: e.club_color }}>
                          {e.club_name}
                        </p>
                      </div>
                      <span className="text-xs text-muted">Submitted {timeAgo(e.created_at)}</span>
                    </div>
                    <p className="mt-3 text-[13px] text-muted">
                      {fmtDate(e.event_date)} · {fmtTime(e.start_time)}–{fmtTime(e.end_time)} · {e.venue} · {e.category} · {teamSizeLabel(e.team_min, e.team_max)} · {fmtMoney(e.fee)} · {e.max_teams} spots
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-ink/90">{e.description}</p>
                    {e.status === 'pending' && e.fee > 0 && !e.payment_qr_url && !e.upi_id && <p className="mt-2 text-xs text-danger">Paid event with no payment QR or UPI ID.</p>}
                    {clash && e.status === 'pending' && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent2/10 px-3 py-2 text-[13px] text-ink">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent2" />
                        Venue clash with "{clash.title}" ({clash.club_short_name}, {fmtTime(clash.start_time)}–{fmtTime(clash.end_time)}).
                      </p>
                    )}
                    {e.admin_note && e.status !== 'pending' && <p className="mt-2 text-xs text-muted">Admin note: {e.admin_note}</p>}
                    {e.status !== 'pending' && (
                      <p className="mt-2 text-xs text-muted">
                        {e.approved_count} confirmed · {e.pending_count} pending · {e.checked_in_count} checked in
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {e.status === 'pending' && (
                        <>
                          <Button size="sm" variant="success" icon={Check} loading={busy === e.id} onClick={() => review(e, 'approve')}>
                            Approve & publish
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            icon={X}
                            onClick={() => {
                              setNote('');
                              setErr(null);
                              setAction({ event: e, kind: 'reject' });
                            }}
                          >
                            Request changes
                          </Button>
                        </>
                      )}
                      {e.status === 'published' && (
                        <>
                          <Button size="sm" icon={Star} onClick={() => feature(e)} className={cx(!!e.featured && 'text-accent2')}>
                            {e.featured ? 'Unfeature' : 'Feature'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNote('');
                              setErr(null);
                              setAction({ event: e, kind: 'unpublish' });
                            }}
                          >
                            Unpublish
                          </Button>
                        </>
                      )}
                      {['published', 'completed'].includes(e.status) && (
                        <Link to={`/events/${e.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-ink">
                          <ExternalLink className="size-4" /> Student view
                        </Link>
                      )}
                      <LinkButton to={`/club/events/${e.id}`} size="sm" variant="ghost" icon={Settings2}>
                        Registrations
                      </LinkButton>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action?.kind === 'reject' ? 'Request changes' : 'Unpublish event'}
        subtitle={action?.event.title}
        footer={
          <>
            <Button onClick={() => setAction(null)}>Cancel</Button>
            <Button variant="danger" loading={!!busy} disabled={action?.kind === 'reject' && !note.trim()} onClick={() => action && review(action.event, action.kind, note)}>
              {action?.kind === 'reject' ? 'Send to club' : 'Unpublish'}
            </Button>
          </>
        }
      >
        <Field label="Note to the club" hint={action?.kind === 'reject' ? 'Tell them what to change. They can edit and resubmit.' : 'Optional. The event goes back to awaiting approval and students can no longer see it.'}>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={4} />
        </Field>
        <div className="mt-4">
          <ErrorNote>{err}</ErrorNote>
        </div>
      </Modal>
    </div>
  );
}
