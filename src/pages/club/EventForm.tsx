import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CreditCard, FileText, Image as ImageIcon, MessageCircle, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { CampusEvent } from '../../lib/types';
import { CATEGORIES } from '../../lib/types';
import { fmtMoney, todayStr, upiLink } from '../../lib/format';
import { EventCard, ImagePicker, QrImage } from '../../components/EventBits';
import { Button, Card, CardHeader, ErrorNote, Field, Input, Modal, PageHeader, PageLoader, Select, Textarea, Toggle, useToast } from '../../components/ui';

const empty = {
  title: '',
  category: 'Workshop',
  tagline: '',
  description: '',
  rules: '',
  requirements: '',
  schedule: '',
  venue: '',
  eventDate: '',
  startTime: '10:00',
  endTime: '16:00',
  regDeadline: '',
  fee: '0',
  teamMin: '1',
  teamMax: '1',
  maxTeams: '100',
  poster: null as string | null,
  paymentQr: null as string | null,
  upiId: '',
  payeeName: '',
  whatsappLink: '',
  contactName: '',
  contactPhone: '',
  internalOnly: false,
};
type FormState = typeof empty;

function fromEvent(e: CampusEvent): FormState {
  return {
    title: e.title,
    category: e.category,
    tagline: e.tagline,
    description: e.description,
    rules: e.rules,
    requirements: e.requirements,
    schedule: e.schedule,
    venue: e.venue,
    eventDate: e.event_date,
    startTime: e.start_time,
    endTime: e.end_time,
    regDeadline: e.reg_deadline,
    fee: String(e.fee),
    teamMin: String(e.team_min),
    teamMax: String(e.team_max),
    maxTeams: String(e.max_teams),
    poster: e.poster_url,
    paymentQr: e.payment_qr_url,
    upiId: e.upi_id ?? '',
    payeeName: e.payee_name ?? '',
    whatsappLink: e.whatsapp_link ?? '',
    contactName: e.contact_name ?? '',
    contactPhone: e.contact_phone ?? '',
    internalOnly: !!e.internal_only,
  };
}

function Block({ icon, title, subtitle, children }: { icon: typeof FileText; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="grid gap-5 p-5">{children}</div>
    </Card>
  );
}

export function EventFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { user, club } = useAuth();
  const [form, setForm] = useState<FormState | null>(editing ? null : { ...empty, contactName: user?.name ?? '', contactPhone: user?.phone ?? '' });
  const [original, setOriginal] = useState<CampusEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<{ list: string[]; id: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api<CampusEvent>(`/api/club/events/${id}`)
      .then(e => {
        setOriginal(e);
        setForm(fromEvent(e));
      })
      .catch(err => setError(err.message));
  }, [id]);

  if (!form) return error ? <ErrorNote>{error}</ErrorNote> : <PageLoader />;
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm(f => ({ ...f!, [k]: e.target.value }));
  const fee = Number(form.fee) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { ...form, fee, teamMin: Number(form.teamMin), teamMax: Number(form.teamMax), maxTeams: Number(form.maxTeams) };
      const res = await api<{ event: CampusEvent; warnings: string[] }>(editing ? `/api/club/events/${id}` : '/api/club/events', { method: editing ? 'PUT' : 'POST', body });
      const msg = editing ? (original?.status === 'rejected' ? 'Resubmitted for approval' : 'Event updated') : res.event.status === 'pending' ? 'Submitted for admin approval' : 'Event published';
      toast(msg);
      if (res.warnings.length) setWarnings({ list: res.warnings, id: res.event.id });
      else navigate(`/club/events/${res.event.id}`);
    } catch (err) {
      setError((err as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const preview = {
    id: 'preview',
    title: form.title || 'Your event title',
    category: form.category,
    club_name: club?.name ?? original?.club_name ?? 'Your club',
    club_color: club?.color ?? original?.club_color ?? '#0A84FF',
    poster_url: form.poster,
    fee,
    event_date: form.eventDate || todayStr(),
    start_time: form.startTime || '10:00',
    venue: form.venue || 'Venue',
    team_min: Number(form.teamMin) || 1,
    team_max: Number(form.teamMax) || 1,
    registration_open: true,
    spots_left: Number(form.maxTeams) || 100,
    max_teams: Number(form.maxTeams) || 100,
    internal_only: form.internalOnly ? 1 : 0,
  } as unknown as CampusEvent;

  return (
    <div className="animate-in">
      <PageHeader back={editing ? `/club/events/${id}` : '/club/events'} eyebrow={editing ? 'Edit event' : 'New event'} title={editing ? original?.title : 'Create an event'} subtitle={editing ? undefined : 'New events go to the portal admin for approval before students can see them.'} />
      {original?.status === 'rejected' && original.admin_note && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-ink">Changes requested by admin</p>
            <p className="mt-0.5 text-muted">{original.admin_note}</p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <ErrorNote>{error}</ErrorNote>
          <Block icon={ImageIcon} title="Basics">
            <Field label="Event title" required>
              <Input value={form.title} onChange={set('title')} maxLength={120} required placeholder="e.g. HackSprint 2026" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" required>
                <Select value={form.category} onChange={set('category')}>
                  {CATEGORIES.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tagline" hint="One line shown under the title.">
                <Input value={form.tagline} onChange={set('tagline')} maxLength={160} />
              </Field>
            </div>
            <ImagePicker label="Event poster" value={form.poster} onChange={v => setForm(f => ({ ...f!, poster: v }))} hint="Landscape works best (16:9). PNG or JPG, up to 5 MB." onError={setError} />
          </Block>

          <Block icon={FileText} title="Details" subtitle="Write one item per line for rules, requirements and schedule.">
            <Field label="Description" required>
              <Textarea value={form.description} onChange={set('description')} rows={5} required placeholder="What is it, who is it for, what do participants get?" />
            </Field>
            <Field label="Rules & eligibility">
              <Textarea value={form.rules} onChange={set('rules')} rows={4} placeholder={'Teams of 2 to 4 members.\nOpen to all years.'} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Requirements (what to bring)">
                <Textarea value={form.requirements} onChange={set('requirements')} rows={4} placeholder={'College ID card\nLaptop'} />
              </Field>
              <Field label="Schedule" hint='Format: "09:30 | Registration"'>
                <Textarea value={form.schedule} onChange={set('schedule')} rows={4} className="font-mono text-[13px]" placeholder={'09:30 | Check-in\n10:00 | Kick-off'} />
              </Field>
            </div>
          </Block>

          <Block icon={CalendarClock} title="When & where">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Date" required>
                <Input type="date" value={form.eventDate} min={editing ? undefined : todayStr()} onChange={set('eventDate')} required />
              </Field>
              <Field label="Starts" required>
                <Input type="time" value={form.startTime} onChange={set('startTime')} required />
              </Field>
              <Field label="Ends" required>
                <Input type="time" value={form.endTime} onChange={set('endTime')} required />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Venue" required hint="You'll be warned if another event has booked it at the same time.">
                <Input value={form.venue} onChange={set('venue')} required placeholder="e.g. Main Auditorium" />
              </Field>
              <Field label="Registration closes" required>
                <Input type="datetime-local" value={form.regDeadline} max={form.eventDate ? `${form.eventDate}T${form.startTime}` : undefined} onChange={set('regDeadline')} required />
              </Field>
            </div>
          </Block>

          <Block icon={Users} title="Participation">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Min team size" hint="1 for individual events">
                <Input type="number" min={1} max={20} value={form.teamMin} onChange={set('teamMin')} required />
              </Field>
              <Field label="Max team size">
                <Input type="number" min={1} max={20} value={form.teamMax} onChange={set('teamMax')} required />
              </Field>
              <Field label={Number(form.teamMax) > 1 ? 'Max teams' : 'Max participants'}>
                <Input type="number" min={1} value={form.maxTeams} onChange={set('maxTeams')} required />
              </Field>
            </div>
            <Toggle checked={form.internalOnly} onChange={v => setForm(f => ({ ...f!, internalOnly: v }))} label="Internal students only" hint="Only students of the host college (and teams made entirely of them) can register. Everyone sees it with an Internal only tag." />
          </Block>

          <Block icon={CreditCard} title="Payment" subtitle="Students pay your club directly by UPI and enter the transaction ID. You verify it before they get a pass.">
            <Field label={`Registration fee (₹) ${Number(form.teamMax) > 1 ? 'per team' : 'per person'}`} hint="Set 0 for free events. Free registrations are confirmed instantly.">
              <Input type="number" min={0} value={form.fee} onChange={set('fee')} required className="sm:w-48" />
            </Field>
            {fee > 0 && (
              <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
                <ImagePicker label="Payment QR" value={form.paymentQr} onChange={v => setForm(f => ({ ...f!, paymentQr: v }))} aspect="aspect-square" hint="Upload your UPI QR" onError={setError} />
                <div className="grid content-start gap-5">
                  <Field label="UPI ID" hint="If you add a UPI ID without a QR image, we generate a QR with the exact amount filled in.">
                    <Input value={form.upiId} onChange={set('upiId')} placeholder="club@okaxis" className="font-mono" />
                  </Field>
                  <Field label="Payee name">
                    <Input value={form.payeeName} onChange={set('payeeName')} placeholder="As shown in UPI apps" />
                  </Field>
                  {!form.paymentQr && form.upiId && (
                    <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-3">
                      <div className="rounded-lg bg-white p-1.5">
                        <QrImage value={upiLink(form.upiId, form.payeeName, fee, form.title)} size={72} />
                      </div>
                      <p className="text-xs text-muted">Students will see this generated QR for {fmtMoney(fee)}.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Block>

          <Block icon={MessageCircle} title="Communication">
            <Field label="WhatsApp group link" hint="Only shared with teams after you confirm them.">
              <Input value={form.whatsappLink} onChange={set('whatsappLink')} placeholder="https://chat.whatsapp.com/…" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Contact person" required>
                <Input value={form.contactName} onChange={set('contactName')} required />
              </Field>
              <Field label="Contact phone" required>
                <Input value={form.contactPhone} onChange={set('contactPhone')} type="tel" required />
              </Field>
            </div>
          </Block>

          <div className="flex justify-end gap-3">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant="primary" size="lg" loading={busy}>
              {editing ? (original?.status === 'rejected' ? 'Save & resubmit' : 'Save changes') : 'Submit event'}
            </Button>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
            <div className="pointer-events-none">
              <EventCard event={preview} />
            </div>
          </div>
        </aside>
      </form>

      <Modal
        open={!!warnings}
        onClose={() => navigate(`/club/events/${warnings!.id}`)}
        title="Saved, with a venue clash"
        footer={
          <>
            <Button
              onClick={() => {
                const target = warnings!.id;
                setWarnings(null);
                if (!editing) navigate(`/club/events/${target}/edit`, { replace: true });
              }}
            >
              Edit again
            </Button>
            <Button variant="primary" onClick={() => navigate(`/club/events/${warnings!.id}`)}>
              Keep as is
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {warnings?.list.map(w => (
            <li key={w} className="flex items-start gap-2 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent2" />
              {w}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">Coordinate with the other organizer or pick another venue or time.</p>
      </Modal>
    </div>
  );
}
