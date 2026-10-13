import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, BadgeCheck, Calendar, Check, CheckCircle2, Clock, Hash, IdCard, Info, Loader2, MapPin, PencilLine, Plus, Smartphone, Trash2, UserRound } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { CampusEvent, Registration } from '../../lib/types';
import { fmtDate, fmtMoney, fmtTime, teamSizeLabel, upiLink } from '../../lib/format';
import { ImagePicker, Poster, QrImage } from '../../components/EventBits';
import { DepartmentSelect } from '../../components/DepartmentSelect';
import { Button, Card, CardHeader, Checkbox, CopyButton, EmptyState, ErrorNote, Field, Input, LinkButton, PageHeader, PageLoader, cx } from '../../components/ui';

interface MemberDraft {
  key: number;
  mode: 'id' | 'manual';
  code: string;
  lookup: { name: string; register_number: string; college_name: string; department: string | null; unique_code: string } | null;
  lookupState: 'idle' | 'loading' | 'error';
  lookupError?: string;
  name: string;
  registerNumber: string;
  collegeName: string;
  department: string;
  yearOfStudy: string;
  phone: string;
}

let keySeq = 1;
const blankMember = (collegeName: string): MemberDraft => ({ key: keySeq++, mode: 'id', code: '', lookup: null, lookupState: 'idle', name: '', registerNumber: '', collegeName, department: '', yearOfStudy: '', phone: '' });

function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx('grid size-6 place-items-center rounded-full text-xs font-bold', i < current ? 'bg-success text-black' : i === current ? 'bg-accent text-white' : 'bg-raised text-muted')}>{i < current ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}</span>
          <span className={cx('text-sm', i === current ? 'font-semibold text-ink' : 'text-muted')}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

export function RegisterEventPage() {
  const { id } = useParams();
  const user = useUser();
  const { data, loading } = useApi<{ event: CampusEvent; myRegistration: Registration | null }>(`/api/events/${id}`);

  const [step, setStep] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<MemberDraft[] | null>(null);
  const [txn, setTxn] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; status: string } | null>(null);

  if (loading || !data) return <PageLoader />;
  const { event, myRegistration } = data;
  const paid = event.fee > 0;
  const team = event.team_max > 1;
  const list = members ?? Array.from({ length: event.team_min - 1 }, () => blankMember(user.college_name ?? ''));
  const setList = (fn: (l: MemberDraft[]) => MemberDraft[]) => setMembers(fn(list));
  const patch = (key: number, p: Partial<MemberDraft>) => setList(l => l.map(m => (m.key === key ? { ...m, ...p } : m)));
  const steps = paid ? ['Team', 'Payment'] : ['Team', 'Confirm'];

  if (result) {
    const confirmed = result.status === 'approved';
    return (
      <div className="animate-in mx-auto max-w-xl py-6 text-center">
        <span className={cx('mx-auto grid size-16 place-items-center rounded-2xl', confirmed ? 'bg-success/15 text-success' : 'bg-accent2/15 text-accent2')}>{confirmed ? <CheckCircle2 className="size-8" /> : <Clock className="size-8" />}</span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{confirmed ? "You're registered!" : 'Submitted for verification'}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {confirmed
            ? `Your entry QR for ${event.title} is ready. Show it at the venue on ${fmtDate(event.event_date)}.`
            : `${event.club_short_name} will verify your payment, usually within 24 hours. You and your linked teammates will be notified, and the WhatsApp group link will be shared once approved.`}
        </p>
        <div className="mx-auto mt-6 w-fit rounded-xl border border-line bg-surface px-5 py-3">
          <p className="text-xs text-muted">Registration ID</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{result.code}</p>
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <LinkButton to="/registrations" variant="primary">
            {confirmed ? 'View entry pass' : 'Track status'}
          </LinkButton>
          <LinkButton to="/explore">Explore more</LinkButton>
        </div>
      </div>
    );
  }

  if (myRegistration && myRegistration.status !== 'cancelled') {
    return <EmptyState icon={BadgeCheck} title="You're already registered" body={`Registration ${myRegistration.code} is ${myRegistration.status}.`} action={<LinkButton to="/registrations">Go to My Registrations</LinkButton>} />;
  }
  if (event.internal_only && user.student_type !== 'internal') {
    return <EmptyState icon={AlertCircle} title="Internal students only" body="This event is open only to students of the host college." action={<LinkButton to={`/events/${event.id}`}>Back to event</LinkButton>} />;
  }
  if (!event.registration_open) {
    return <EmptyState icon={AlertCircle} title="Registration is closed" body={event.closed_reason ?? undefined} action={<LinkButton to={`/events/${event.id}`}>Back to event</LinkButton>} />;
  }

  const lookup = async (m: MemberDraft) => {
    const code = m.code.trim().toUpperCase();
    if (!code) return;
    if (code === user.unique_code) return patch(m.key, { lookupState: 'error', lookupError: "That's your own ID. You're already the team leader." });
    if (list.some(o => o.key !== m.key && o.lookup?.unique_code === code)) return patch(m.key, { lookupState: 'error', lookupError: 'This student is already in your team.' });
    patch(m.key, { lookupState: 'loading', lookupError: undefined });
    try {
      const s = await api(`/api/students/lookup?code=${encodeURIComponent(code)}`);
      patch(m.key, { lookup: s, lookupState: 'idle', code });
    } catch (err) {
      patch(m.key, { lookup: null, lookupState: 'error', lookupError: (err as Error).message });
    }
  };

  const validateTeam = () => {
    if (team && !teamName.trim()) return 'Give your team a name.';
    for (const [i, m] of list.entries()) {
      const n = `Member ${i + 2}`;
      if (m.mode === 'id' && !m.lookup) return `${n}: find the student by CampusPulse ID, or switch to "Enter manually".`;
      if (m.mode === 'manual' && (!m.name.trim() || !m.registerNumber.trim() || !m.collegeName.trim() || !m.department.trim())) return `${n}: name, register number, college and department are required (used on the certificate and OD letter).`;
    }
    return null;
  };

  const submit = async () => {
    setError(null);
    if (paid) {
      if (!/^[A-Za-z0-9-]{6,40}$/.test(txn.trim())) return setError('Enter the UPI transaction ID / UTR exactly as shown in your payment app (6–40 letters or numbers).');
      if (!declared) return setError('Please confirm the declaration before submitting.');
    }
    setBusy(true);
    try {
      const body = {
        teamName: teamName.trim(),
        members: list.map(m =>
          m.mode === 'id' ? { uniqueCode: m.lookup!.unique_code } : { name: m.name, registerNumber: m.registerNumber, collegeName: m.collegeName, department: m.department, yearOfStudy: m.yearOfStudy, phone: m.phone },
        ),
        transactionId: paid ? txn.trim() : undefined,
        paymentProof: paid ? proof : undefined,
      };
      setResult(await api(`/api/events/${event.id}/register`, { body }));
      window.scrollTo(0, 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const qrValue = event.upi_id ? upiLink(event.upi_id, event.payee_name, event.fee, `${event.title} ${teamName || user.name}`) : null;
  const teamCount = list.length + 1;

  return (
    <div className="animate-in mx-auto max-w-6xl">
      <PageHeader back={`/events/${event.id}`} eyebrow="Registration" title={event.title} actions={<Steps steps={steps} current={step} />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {step === 0 && (
            <>
              {team && (
                <Card>
                  <CardHeader title="Team details" subtitle={`${teamSizeLabel(event.team_min, event.team_max)}, including you as leader.${event.internal_only ? ' All members must be internal students.' : ''}`} />
                  <div className="p-5">
                    <Field label="Team name" required>
                      <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Null Pointers" maxLength={60} />
                    </Field>
                  </div>
                </Card>
              )}

              <Card>
                <CardHeader title={team ? 'Team members' : 'Participant'} subtitle={team ? `${teamCount} of ${event.team_max} members` : 'Certificates will use these details.'} />
                <div className="divide-y divide-line">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                      <UserRound className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {user.name} <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">{team ? 'Leader' : 'You'}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {user.register_number} · {user.college_name} · <span className="font-mono">{user.unique_code}</span>
                      </p>
                    </div>
                  </div>

                  {list.map((m, i) => (
                    <div key={m.key} className="px-5 py-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-ink">Member {i + 2}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => patch(m.key, { mode: m.mode === 'id' ? 'manual' : 'id' })} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10">
                            {m.mode === 'id' ? <PencilLine className="size-3.5" /> : <IdCard className="size-3.5" />}
                            {m.mode === 'id' ? 'Enter manually' : 'Use CampusPulse ID'}
                          </button>
                          {teamCount > event.team_min && (
                            <button onClick={() => setList(l => l.filter(x => x.key !== m.key))} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove member ${i + 2}`}>
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {m.mode === 'id' ? (
                        m.lookup ? (
                          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
                            <BadgeCheck className="size-5 shrink-0 text-success" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ink">{m.lookup.name}</p>
                              <p className="truncate text-xs text-muted">
                                {m.lookup.register_number} · {m.lookup.college_name}
                              </p>
                            </div>
                            <button onClick={() => patch(m.key, { lookup: null, code: '' })} className="text-xs font-medium text-muted hover:text-ink">
                              Change
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex gap-2">
                              <Input
                                value={m.code}
                                onChange={e => patch(m.key, { code: e.target.value.toUpperCase(), lookupState: 'idle' })}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookup(m))}
                                placeholder="CP-XXXXXX"
                                className="font-mono uppercase"
                              />
                              <Button onClick={() => lookup(m)} loading={m.lookupState === 'loading'}>
                                Find
                              </Button>
                            </div>
                            <p className={cx('mt-1.5 text-xs', m.lookupState === 'error' ? 'text-danger' : 'text-muted')}>
                              {m.lookupState === 'error' ? m.lookupError : 'Their details are filled in from their CampusPulse profile, and the certificate shows up in their account too.'}
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input value={m.name} onChange={e => patch(m.key, { name: e.target.value })} placeholder="Full name *" aria-label="Full name" />
                          <Input value={m.registerNumber} onChange={e => patch(m.key, { registerNumber: e.target.value.toUpperCase() })} placeholder="Register number *" aria-label="Register number" />
                          <Input value={m.collegeName} onChange={e => patch(m.key, { collegeName: e.target.value })} placeholder="College *" aria-label="College" className="sm:col-span-2" />
                          <DepartmentSelect value={m.department} onChange={v => patch(m.key, { department: v })} placeholder="Department *" />
                          <Input value={m.yearOfStudy} onChange={e => patch(m.key, { yearOfStudy: e.target.value })} placeholder="Year (e.g. 2nd Year)" aria-label="Year of study" />
                          <Input value={m.phone} onChange={e => patch(m.key, { phone: e.target.value })} placeholder="Phone" aria-label="Phone" type="tel" className="sm:col-span-2" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {teamCount < event.team_max && (
                  <div className="border-t border-line p-3">
                    <Button variant="ghost" icon={Plus} className="w-full" onClick={() => setList(l => [...l, blankMember(user.college_name ?? '')])}>
                      Add member ({teamCount}/{event.team_max})
                    </Button>
                  </div>
                )}
              </Card>

              <ErrorNote>{error}</ErrorNote>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    const err = validateTeam();
                    setError(err);
                    if (!err) {
                      setStep(1);
                      window.scrollTo(0, 0);
                    }
                  }}
                >
                  Continue to {paid ? 'payment' : 'confirm'}
                </Button>
              </div>
            </>
          )}

          {step === 1 && paid && (
            <>
              <Card>
                <CardHeader title="Pay with UPI" subtitle={`Pay ${event.payee_name ?? event.club_name} directly. Scan with GPay, PhonePe, Paytm or any UPI app.`} />
                <div className="grid gap-6 p-5 sm:grid-cols-[220px_1fr]">
                  <div className="mx-auto w-full max-w-[220px]">
                    <div className="rounded-card border border-line bg-white p-3">
                      {event.payment_qr_url ? <img src={event.payment_qr_url} alt={`Payment QR for ${event.payee_name ?? event.club_name}`} className="aspect-square w-full rounded-lg" style={{ objectFit: 'contain' }} /> : qrValue ? <QrImage value={qrValue} size={194} /> : null}
                    </div>
                    <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-wider text-muted">{event.payee_name ?? event.club_short_name}</p>
                  </div>
                  <div className="flex flex-col justify-center gap-4">
                    <div>
                      <p className="text-xs text-muted">Amount to pay</p>
                      <p className="text-3xl font-bold tracking-tight text-ink">{fmtMoney(event.fee)}</p>
                    </div>
                    {event.upi_id && (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted">UPI ID</p>
                          <p className="truncate font-mono text-sm font-medium text-ink">{event.upi_id}</p>
                        </div>
                        <CopyButton text={event.upi_id} label="Copy" />
                      </div>
                    )}
                    {qrValue && (
                      <a href={qrValue} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-raised text-sm font-semibold text-ink sm:hidden">
                        <Smartphone className="size-4" /> Open UPI app
                      </a>
                    )}
                    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                      <Info className="mt-0.5 size-3.5 shrink-0" /> Pay the exact amount. After paying, copy the transaction ID (UTR / reference number) from your UPI app.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Payment details" subtitle="The club matches these against their UPI statement before approving." />
                <div className="grid gap-5 p-5">
                  <Field label="Transaction ID / UTR" hint="Usually a 12-digit number in your UPI app's payment history." required>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-3.5 size-4 text-muted" />
                      <Input value={txn} onChange={e => setTxn(e.target.value.replace(/\s/g, ''))} placeholder="e.g. 428917365012" className="pl-10 font-mono" maxLength={40} />
                    </div>
                  </Field>
                  <ImagePicker label="Payment screenshot (recommended)" value={proof} onChange={setProof} aspect="aspect-[3/2] max-h-64" hint="Speeds up verification. PNG or JPG, up to 5 MB." onError={setError} />
                  <Checkbox checked={declared} onChange={setDeclared} className="rounded-xl border border-line bg-canvas px-4 py-3.5">
                    I confirm I paid {fmtMoney(event.fee)} for this registration and the transaction ID is my own.
                  </Checkbox>
                </div>
              </Card>
            </>
          )}

          {step === 1 && !paid && (
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">This event is free</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">Your registration is confirmed as soon as you submit, and your entry QR appears in My Registrations.</p>
                </div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <>
              <ErrorNote>{error}</ErrorNote>
              <div className="flex justify-between gap-3">
                <Button
                  size="lg"
                  onClick={() => {
                    setStep(0);
                    setError(null);
                  }}
                >
                  Back
                </Button>
                <Button variant="primary" size="lg" loading={busy} onClick={submit}>
                  {paid ? 'Submit for verification' : 'Confirm registration'}
                </Button>
              </div>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card className="overflow-hidden">
            <Poster src={event.poster_url} title={event.title} color={event.club_color} className="h-36 w-full" />
            <div className="p-5">
              <p className="text-[15px] font-semibold text-ink">{event.title}</p>
              <p className="text-xs text-muted">{event.club_name}</p>
              <div className="mt-4 space-y-2 text-[13px] text-muted">
                <p className="flex items-center gap-2">
                  <Calendar className="size-3.5" /> {fmtDate(event.event_date)}, {fmtTime(event.start_time)}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="size-3.5" /> {event.venue}
                </p>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Your team</p>
                {team && teamName && <p className="mt-1.5 text-sm font-semibold text-ink">{teamName}</p>}
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  <li>{user.name} (you)</li>
                  {list.map((m, i) => (
                    <li key={m.key} className={cx(!(m.lookup?.name || m.name) && 'text-muted')}>
                      {m.lookup?.name || m.name || `Member ${i + 2}`}
                      {m.lookupState === 'loading' && <Loader2 className="ml-1 inline size-3 animate-spin" />}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <span className="text-sm text-muted">Total</span>
                <span className={cx('text-xl font-bold', paid ? 'text-ink' : 'text-success')}>{fmtMoney(event.fee)}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
