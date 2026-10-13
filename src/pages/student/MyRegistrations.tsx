import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlertCircle, Award, Calendar, Check, Download, FileSignature, MapPin, MessageCircle, QrCode, RotateCcw, Star, Ticket, Users, X } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { MyRegistration } from '../../lib/types';
import { daysUntil, fmtDate, fmtMoney, fmtTime, fmtTimestamp, upiLink } from '../../lib/format';
import { ImagePicker, Poster, QrImage } from '../../components/EventBits';
import { Button, CopyButton, EmptyState, ErrorNote, Field, Input, LinkButton, Modal, PageHeader, PageLoader, StatusPill, Tabs, btnClass, cx, useToast } from '../../components/ui';

type Filter = 'all' | 'upcoming' | 'pending' | 'action' | 'past';

function Tracker({ r }: { r: MyRegistration }) {
  const steps = [
    { label: 'Registered', done: true },
    { label: r.fee > 0 ? 'Payment verified' : 'Confirmed', done: r.status === 'approved', failed: r.status === 'rejected' },
    { label: 'Checked in', done: !!r.checked_in_at },
    { label: 'Certificate', done: !!r.certificates_issued_at && !!r.checked_in_at },
  ];
  return (
    <ol className="flex items-center">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span className={cx('grid size-6 place-items-center rounded-full', s.failed ? 'bg-danger text-white' : s.done ? 'bg-success text-black' : 'border border-line bg-raised text-muted')}>
              {s.failed ? <X className="size-3.5" strokeWidth={3} /> : s.done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-muted" />}
            </span>
            <span className={cx('whitespace-nowrap text-[11px]', s.done ? 'text-ink' : 'text-muted')}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className={cx('mx-1.5 mb-5 h-px flex-1', steps[i + 1].done ? 'bg-success' : 'bg-line')} />}
        </li>
      ))}
    </ol>
  );
}

function TicketModal({ r, onClose }: { r: MyRegistration; onClose: () => void }) {
  const download = async () => {
    const url = await QRCode.toDataURL(r.qr_payload!, { margin: 2, width: 800 });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.code}-entry-pass.png`;
    a.click();
  };
  return (
    <Modal open onClose={onClose} title="Entry pass" subtitle="Show this QR at the venue. One pass covers the whole team." size="sm">
      <div className="text-center">
        <p className="text-[15px] font-semibold text-ink">{r.event_title}</p>
        <p className="mt-1 text-xs text-muted">
          {fmtDate(r.event_date)} · {fmtTime(r.start_time)} · {r.venue}
        </p>
        <div className="mx-auto mt-5 w-fit rounded-card bg-white p-4">
          <QrImage value={r.qr_payload!} size={220} className="rounded-none" />
        </div>
        <p className="mt-4 font-mono text-lg font-semibold tracking-wider text-ink">{r.code}</p>
        {r.team_name && <p className="text-sm text-muted">Team {r.team_name}</p>}
        {r.checked_in_at && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            <Check className="size-3.5" /> Checked in {fmtTimestamp(r.checked_in_at)}
          </p>
        )}
      </div>
      <div className="mt-5 divide-y divide-line rounded-xl border border-line">
        {r.members.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="truncate text-ink">{m.name}</span>
            <span className="shrink-0 text-xs text-muted">{m.is_leader ? 'Leader' : m.register_number}</span>
          </div>
        ))}
      </div>
      <Button className="mt-5 w-full" icon={Download} onClick={download}>
        Save QR to phone
      </Button>
    </Modal>
  );
}

function ResubmitModal({ r, onClose, onDone }: { r: MyRegistration; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [txn, setTxn] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/my/registrations/${r.id}/payment`, { body: { transactionId: txn.trim(), paymentProof: proof } });
      toast('Payment resubmitted for verification');
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const qr = r.upi_id ? upiLink(r.upi_id, r.payee_name, r.fee, r.event_title) : null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Resubmit payment"
      subtitle={r.event_title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit} disabled={txn.length < 6}>
            Submit for verification
          </Button>
        </>
      }
    >
      {r.review_note && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span>
            <span className="font-semibold">Reason from organizer:</span> {r.review_note}
          </span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="w-28 shrink-0 rounded-xl bg-white p-2">{r.payment_qr_url ? <img src={r.payment_qr_url} alt="Payment QR" className="aspect-square w-full" style={{ objectFit: 'contain' }} /> : qr ? <QrImage value={qr} size={96} /> : null}</div>
        <div className="text-sm">
          <p className="text-muted">Amount</p>
          <p className="text-2xl font-bold text-ink">{fmtMoney(r.fee)}</p>
          {r.upi_id && (
            <p className="mt-1 flex items-center font-mono text-xs text-muted">
              {r.upi_id} <CopyButton text={r.upi_id} />
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <Field label="Correct transaction ID / UTR" required>
          <Input value={txn} onChange={e => setTxn(e.target.value.replace(/\s/g, ''))} className="font-mono" placeholder="e.g. 428917365012" />
        </Field>
        <ImagePicker label="Payment screenshot" value={proof} onChange={setProof} aspect="aspect-[3/2] max-h-52" onError={setError} />
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

interface MyOd {
  id: string;
  registration_id: string;
  name: string;
  register_number: string;
  mine: boolean;
}

function OdModal({ r, ods, onClose }: { r: MyRegistration; ods: MyOd[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="OD letters" subtitle={`${r.event_title} · ${fmtDate(r.event_date)}`} size="sm">
      <p className="mb-4 text-sm text-muted">Download and submit to your department. Each letter has a QR your HOD can scan to verify it.</p>
      <div className="divide-y divide-line rounded-xl border border-line">
        {ods.map(o => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {o.name} {o.mine && <span className="text-xs text-accent">(you)</span>}
              </p>
              <p className="font-mono text-xs text-muted">
                {o.register_number} · {o.id}
              </p>
            </div>
            <a href={`/api/od/${o.id}/pdf`} target="_blank" rel="noreferrer" className={btnClass('primary', 'sm')}>
              <Download className="size-4" /> PDF
            </a>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function MyRegistrationsPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<MyRegistration[]>('/api/my/registrations');
  const ods = useApi<MyOd[]>('/api/my/od');
  const [odFor, setOdFor] = useState<MyRegistration | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [ticket, setTicket] = useState<MyRegistration | null>(null);
  const [resubmit, setResubmit] = useState<MyRegistration | null>(null);
  const [cancelling, setCancelling] = useState<MyRegistration | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <PageLoader />;
  const all = (data ?? []).filter(r => r.status !== 'cancelled' || daysUntil(r.event_date) >= -30);
  const isPast = (r: MyRegistration) => daysUntil(r.event_date) < 0;
  const groups: Record<Filter, MyRegistration[]> = {
    all,
    upcoming: all.filter(r => r.status === 'approved' && !isPast(r)),
    pending: all.filter(r => r.status === 'pending'),
    action: all.filter(r => r.status === 'rejected' && !isPast(r)),
    past: all.filter(isPast),
  };
  const list = groups[filter];

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api(`/api/my/registrations/${cancelling.id}/cancel`, { method: 'POST' });
      toast('Registration cancelled');
      setCancelling(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="My Registrations" subtitle="Track payments, open your entry passes and join event groups." />
      <Tabs
        tabs={[
          { id: 'all', label: 'All', count: groups.all.length },
          { id: 'upcoming', label: 'Confirmed', count: groups.upcoming.length },
          { id: 'pending', label: 'Pending', count: groups.pending.length },
          { id: 'action', label: 'Action needed', count: groups.action.length },
          { id: 'past', label: 'Past', count: groups.past.length },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <div className="mt-6 grid gap-4">
        {list.length === 0 ? (
          <EmptyState icon={Ticket} title={filter === 'all' ? "You haven't registered for anything yet" : 'Nothing here'} body={filter === 'all' ? 'Find an event you like and register your team in a minute.' : undefined} action={filter === 'all' && <LinkButton to="/explore" variant="primary">Explore events</LinkButton>} />
        ) : (
          list.map(r => {
            const past = isPast(r);
            const canCancel = r.is_leader && !past && (r.status === 'pending' || r.status === 'rejected' || (r.status === 'approved' && r.fee === 0));
            return (
              <article key={r.id} className={cx('overflow-hidden rounded-card border bg-surface', r.status === 'rejected' && !past ? 'border-danger/40' : 'border-line')}>
                <div className="flex flex-col sm:flex-row">
                  <Link to={`/events/${r.event_id}`} className="relative h-36 shrink-0 sm:h-auto sm:w-48">
                    <Poster src={r.poster_url} title={r.event_title} color={r.club_color} className="absolute inset-0 size-full" />
                  </Link>
                  <div className="min-w-0 flex-1 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/events/${r.event_id}`} className="text-[15px] font-semibold text-ink hover:underline">
                          {r.event_title}
                        </Link>
                        <p className="text-[13px] text-muted">{r.club_name}</p>
                      </div>
                      <StatusPill status={r.event_status === 'cancelled' ? 'cancelled' : r.status} label={r.event_status === 'cancelled' ? 'Event cancelled' : undefined} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" /> {fmtDate(r.event_date)}, {fmtTime(r.start_time)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {r.venue}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5" /> {r.team_name ? `${r.team_name} · ` : ''}
                        {r.members.length} {r.members.length === 1 ? 'member' : 'members'}
                        {!r.is_leader && ` · led by ${r.leader_name}`}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted">
                      {r.code}
                      {r.transaction_id && ` · Txn ${r.transaction_id}`}
                      {r.amount > 0 && ` · ${fmtMoney(r.amount)}`}
                    </p>

                    {r.status === 'rejected' && r.review_note && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-ink">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                        {r.review_note}
                      </p>
                    )}
                    {r.status === 'pending' && <p className="mt-3 text-[13px] text-accent2">The club is verifying your payment. You'll be notified when it's approved.</p>}

                    {r.status !== 'cancelled' && r.event_status !== 'cancelled' && (
                      <div className="mt-5 max-w-lg">
                        <Tracker r={r} />
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {r.status === 'approved' && r.qr_payload && !past && (
                        <Button variant="primary" size="sm" icon={QrCode} onClick={() => setTicket(r)}>
                          Entry pass
                        </Button>
                      )}
                      {r.status === 'approved' && (ods.data ?? []).some(o => o.registration_id === r.id) && (
                        <Button size="sm" icon={FileSignature} onClick={() => setOdFor(r)}>
                          OD letter
                        </Button>
                      )}
                      {r.whatsapp_link && !past && (
                        <a href={r.whatsapp_link} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 text-[13px] font-semibold text-success hover:bg-success/20">
                          <MessageCircle className="size-4" /> WhatsApp group
                        </a>
                      )}
                      {r.status === 'rejected' && r.is_leader && !past && (
                        <Button variant="primary" size="sm" icon={RotateCcw} onClick={() => setResubmit(r)}>
                          Resubmit payment
                        </Button>
                      )}
                      {r.status === 'approved' && daysUntil(r.event_date) <= 0 && r.event_status !== 'cancelled' &&
                        (r.feedback_given ? (
                          <span className="inline-flex h-8 items-center gap-1.5 px-2 text-[13px] font-medium text-success">
                            <Check className="size-4" /> Feedback given
                          </span>
                        ) : (
                          <LinkButton to={`/feedback/${r.event_id}`} variant="primary" size="sm" icon={Star}>
                            Give feedback
                          </LinkButton>
                        ))}
                      {r.certificates_issued_at && (
                        <LinkButton to="/certificates" size="sm" icon={Award}>
                          Certificates
                        </LinkButton>
                      )}
                      {canCancel && (
                        <Button variant="ghost" size="sm" onClick={() => setCancelling(r)}>
                          Cancel registration
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {ticket && <TicketModal r={ticket} onClose={() => setTicket(null)} />}
      {odFor && <OdModal r={odFor} ods={(ods.data ?? []).filter(o => o.registration_id === odFor.id)} onClose={() => setOdFor(null)} />}
      {resubmit && (
        <ResubmitModal
          r={resubmit}
          onClose={() => setResubmit(null)}
          onDone={() => {
            setResubmit(null);
            reload();
          }}
        />
      )}
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this registration?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setCancelling(null)}>Keep it</Button>
            <Button variant="danger" loading={busy} onClick={cancel}>
              Cancel registration
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Your team's spot for <span className="text-ink">{cancelling?.event_title}</span> will be released. {cancelling && cancelling.fee > 0 && 'If you already paid, contact the organizers about a refund.'}
        </p>
      </Modal>
    </div>
  );
}
