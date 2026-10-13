import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Download,
  ExternalLink,
  FileSignature,
  FileSpreadsheet,
  IndianRupee,
  Lock,
  Maximize2,
  Megaphone,
  MessageSquareText,
  Pencil,
  ScanLine,
  Search,
  Star,
  Ticket,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { api, sameCollege, useApi, useMeta } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { CampusEvent, ClubRegistration } from '../../lib/types';
import { fmtDate, fmtMoney, fmtTime, fmtTimestamp, timeAgo, todayStr } from '../../lib/format';
import { Poster, QrImage } from '../../components/EventBits';
import { Stars } from '../student/Feedback';
import { Badge, Button, Card, CardHeader, CopyButton, EmptyState, ErrorNote, Field, Input, LinkButton, Modal, PageLoader, Progress, Select, Stat, StatusPill, Tabs, Textarea, btnClass, cx, useToast } from '../../components/ui';

type Tab = 'pending' | 'registrations' | 'od' | 'attendance' | 'feedback' | 'results';
const AWARDS = ['Winner', 'Runner-up', 'Second Runner-up', 'Special Mention'];
const REJECT_REASONS = ['Transaction ID not found in our UPI statement.', 'Amount paid does not match the fee.', 'This payment was already used for another registration.', 'Screenshot is unclear. Please upload a clearer one.'];

function MembersTable({ reg }: { reg: ClubRegistration }) {
  const meta = useMeta();
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="bg-raised/50 text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Register no.</th>
            <th className="px-3 py-2 font-medium">College</th>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Present</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {reg.members.map(m => (
            <tr key={m.id}>
              <td className="px-3 py-2 text-ink">
                {m.name}
                {m.is_leader ? <span className="ml-1.5 text-[11px] font-semibold text-accent">Leader</span> : null}
                {m.user_id && !m.is_leader ? <span className="ml-1.5 text-[11px] text-success">Linked</span> : null}
              </td>
              <td className="px-3 py-2 font-mono text-muted">{m.register_number}</td>
              <td className="max-w-56 truncate px-3 py-2 text-muted">
                {meta && <span className={cx('mr-1.5 text-[11px] font-semibold', sameCollege(m.college_name, meta.collegeName) ? 'text-accent' : 'text-accent2')}>{sameCollege(m.college_name, meta.collegeName) ? 'INT' : 'EXT'}</span>}
                {m.college_name}
              </td>
              <td className="px-3 py-2 text-muted">{m.phone ?? m.email ?? '—'}</td>
              <td className="px-3 py-2">{m.attended ? <Check className="size-4 text-success" /> : <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingQueue({ regs, onReview }: { regs: ClubRegistration[]; onReview: (r: ClubRegistration, action: 'approve' | 'reject') => void }) {
  const [proof, setProof] = useState<string | null>(null);
  if (!regs.length) return <EmptyState icon={CheckCircle2} title="No payments waiting" body="New registrations for paid events will appear here for verification." />;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">Match each transaction ID against your UPI statement before approving. Oldest submissions are first.</p>
      {regs.map(r => (
        <Card key={r.id} className="overflow-hidden">
          <div className="flex flex-col gap-5 p-5 md:flex-row">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-ink">{r.team_name ?? r.leader_name}</p>
                <Badge>{r.members.length} {r.members.length === 1 ? 'member' : 'members'}</Badge>
                <span className="text-xs text-muted">{timeAgo(r.created_at)}</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Leader: {r.leader_name} · {r.leader_phone} · <span className="font-mono">{r.code}</span>
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-canvas px-4 py-3">
                  <p className="text-xs text-muted">Transaction ID</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-sm font-semibold text-ink">{r.transaction_id}</p>
                    <CopyButton text={r.transaction_id ?? ''} />
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-canvas px-4 py-3">
                  <p className="text-xs text-muted">Amount due</p>
                  <p className="text-sm font-semibold text-ink">{fmtMoney(r.amount)}</p>
                </div>
              </div>
              <details className="group mt-4">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent">
                  Team details <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3">
                  <MembersTable reg={r} />
                </div>
              </details>
            </div>
            <div className="flex shrink-0 flex-row gap-4 md:w-48 md:flex-col">
              {r.payment_proof_url ? (
                <button onClick={() => setProof(r.payment_proof_url)} className="relative h-28 w-28 overflow-hidden rounded-xl border border-line md:h-36 md:w-full">
                  <img src={r.payment_proof_url} alt="Payment screenshot" className="size-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[11px] text-ink">View screenshot</span>
                </button>
              ) : (
                <div className="grid h-28 w-28 place-items-center rounded-xl border border-dashed border-line px-3 text-center text-xs text-muted md:h-24 md:w-full">No screenshot</div>
              )}
              <div className="flex flex-1 flex-col gap-2">
                <Button variant="success" icon={Check} onClick={() => onReview(r, 'approve')}>
                  Approve
                </Button>
                <Button variant="danger" icon={X} onClick={() => onReview(r, 'reject')}>
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
      <Modal open={!!proof} onClose={() => setProof(null)} title="Payment screenshot" size="lg">
        {proof && <img src={proof} alt="Payment screenshot" className="mx-auto max-h-[70vh] rounded-xl" style={{ objectFit: 'contain' }} />}
      </Modal>
    </div>
  );
}

function RegistrationsTable({ regs, onCancel }: { regs: ClubRegistration[]; onCancel: (r: ClubRegistration) => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = regs.filter(r => (!status || r.status === status) && (!q || `${r.code} ${r.team_name} ${r.leader_name} ${r.transaction_id} ${r.members.map(m => `${m.name} ${m.register_number}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 size-4 text-muted" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search team, name, register number, transaction ID" className="pl-10" />
        </div>
        <Select value={status} onChange={e => setStatus(e.target.value)} className="sm:w-48">
          <option value="">All statuses</option>
          <option value="approved">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Users} title="No registrations found" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.map(r => (
              <li key={r.id}>
                <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-raised/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {r.team_name ?? r.leader_name}
                      {r.award && <span className="ml-2 text-xs font-semibold text-accent2">🏆 {r.award}</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      <span className="font-mono">{r.code}</span> · {r.leader_name} · {r.members.length} {r.members.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                  {r.checked_in_at && <Badge tone="success">Checked in</Badge>}
                  <StatusPill status={r.status} label={r.status === 'pending' ? 'Pending' : r.status === 'rejected' ? 'Rejected' : undefined} />
                  <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open === r.id && 'rotate-180')} />
                </button>
                {open === r.id && (
                  <div className="animate-pop space-y-4 border-t border-line bg-canvas/40 px-5 py-4">
                    <MembersTable reg={r} />
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                      <span>
                        Registered {fmtTimestamp(r.created_at)}
                        {r.transaction_id && (
                          <>
                            {' '}
                            · Txn <span className="font-mono text-ink">{r.transaction_id}</span>
                          </>
                        )}
                        {r.reviewed_by_name && ` · Reviewed by ${r.reviewed_by_name}`}
                        {r.review_note && ` · Note: ${r.review_note}`}
                      </span>
                      <div className="flex gap-2">
                        {r.payment_proof_url && (
                          <a href={r.payment_proof_url} target="_blank" rel="noreferrer" className={btnClass('secondary', 'sm')}>
                            Screenshot
                          </a>
                        )}
                        {['pending', 'approved'].includes(r.status) && (
                          <Button size="sm" variant="danger" onClick={() => onCancel(r)}>
                            Cancel registration
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Attendance({ event, isClubAdmin }: { event: CampusEvent; isClubAdmin: boolean }) {
  const { data } = useApi<{ teams_total: number; teams_present: number; people_total: number; people_present: number; recent: { id: string; code: string; team_name: string | null; leader_name: string; checked_in_at: string; present: number; total: number }[] }>(`/api/club/events/${event.id}/attendance`, { pollMs: 5000 });
  if (!data) return <PageLoader />;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Live attendance</p>
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="size-2 animate-pulse rounded-full bg-success" /> Updating
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
              {data.people_present}
              <span className="text-lg text-muted">/{data.people_total}</span>
            </p>
            <p className="mt-1 text-xs text-muted">People present</p>
            <div className="mt-3">
              <Progress value={data.people_present} max={data.people_total} tone="success" />
            </div>
          </div>
          <div>
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
              {data.teams_present}
              <span className="text-lg text-muted">/{data.teams_total}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{event.team_max > 1 ? 'Teams' : 'Registrations'} checked in</p>
            <div className="mt-3">
              <Progress value={data.teams_present} max={data.teams_total} />
            </div>
          </div>
        </div>
        {isClubAdmin && (
          <LinkButton to={`/club/scan?event=${event.id}`} variant="primary" icon={ScanLine} className="mt-8 w-full">
            Open check-in scanner
          </LinkButton>
        )}
      </Card>
      <Card>
        <CardHeader title="Recent check-ins" />
        {data.recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No one has checked in yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-8 place-items-center rounded-lg bg-success/15 text-success">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.team_name ?? r.leader_name}</p>
                  <p className="text-xs text-muted">
                    {r.present} of {r.total} present · <span className="font-mono">{r.code}</span>
                  </p>
                </div>
                <span className="text-xs text-muted">{timeAgo(r.checked_in_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

interface OdMember {
  member_id: string;
  name: string;
  register_number: string;
  department: string | null;
  year_of_study: string | null;
  is_leader: number;
  code: string;
  team_name: string | null;
  od_id: string | null;
  issued_at: string | null;
}

function OdTab({ event, isClubAdmin }: { event: CampusEvent; isClubAdmin: boolean }) {
  const toast = useToast();
  const { data, reload } = useApi<{ has_template: boolean; members: OdMember[] }>(`/api/club/events/${event.id}/od`);
  const [busy, setBusy] = useState(false);
  if (!data) return <PageLoader />;
  const pending = data.members.filter(m => !m.od_id);
  const issued = data.members.length - pending.length;

  const issue = async () => {
    setBusy(true);
    try {
      const res = await api<{ issued: number }>(`/api/club/events/${event.id}/od`, { method: 'POST', body: {} });
      toast(`Issued ${res.issued} OD letter${res.issued === 1 ? '' : 's'}. Students were notified.`);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!data.has_template && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-accent2/30 bg-accent2/5 p-4 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-accent2" />
          <p className="flex-1 text-ink">Upload your club's OD template before issuing OD letters.</p>
          {isClubAdmin && (
            <LinkButton to="/club/od-template" size="sm" variant="primary">
              Set up OD template
            </LinkButton>
          )}
        </div>
      )}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <FileSignature className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {issued} of {data.members.length} internal students have an OD letter
          </p>
          <p className="text-xs text-muted">Only internal students of confirmed (payment-verified) teams are listed. External members don't need an OD.</p>
        </div>
        {issued > 0 && (
          <a href={`/api/club/events/${event.id}/od.pdf`} className={btnClass('secondary', 'md')}>
            <Download className="size-4" /> All ODs (PDF)
          </a>
        )}
        <Button variant="primary" icon={FileSignature} loading={busy} disabled={!pending.length || !data.has_template} onClick={issue}>
          {pending.length ? `Issue OD to ${pending.length} student${pending.length === 1 ? '' : 's'}` : 'All issued'}
        </Button>
      </Card>
      {data.members.length === 0 ? (
        <EmptyState icon={FileSignature} title="No internal students yet" body="Students appear here once their team's payment is verified." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-3 py-3 font-medium">Department · Year</th>
                  <th className="px-3 py-3 font-medium">Team</th>
                  <th className="px-5 py-3 font-medium">OD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.members.map(m => (
                  <tr key={m.member_id}>
                    <td className="px-5 py-3">
                      <p className="text-ink">{m.name}</p>
                      <p className="font-mono text-xs text-muted">{m.register_number}</p>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {m.department ?? '—'} · {m.year_of_study ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-muted">{m.team_name ?? m.code}</td>
                    <td className="px-5 py-3">
                      {m.od_id ? (
                        <a href={`/api/od/${m.od_id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-accent hover:underline">
                          {m.od_id} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">Not issued</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FeedbackTab({ event }: { event: CampusEvent }) {
  const { data } = useApi<{ count: number; eligible: number; average: number | null; distribution: number[]; items: { rating: number; comment: string | null; created_at: string; name: string }[] }>(`/api/club/events/${event.id}/feedback`, { pollMs: 10_000 });
  const [big, setBig] = useState(false);
  const url = `${window.location.origin}/feedback/${event.id}`;
  const open = event.event_date <= todayStr();
  if (!data) return <PageLoader />;
  const max = Math.max(1, ...data.distribution);
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="self-start p-5 text-center">
        <p className="text-sm font-semibold text-ink">Feedback QR</p>
        <p className="mt-1 text-xs text-muted">{open ? 'Show this on the screen at the end of the event.' : `Students can submit from ${fmtDate(event.event_date)}.`}</p>
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
          <QrImage value={url} size={220} />
        </div>
        <p className="mt-3 break-all font-mono text-[11px] text-muted">{url}</p>
        <div className="mt-4 grid gap-2">
          <Button variant="primary" icon={Maximize2} onClick={() => setBig(true)}>
            Show full screen
          </Button>
          <CopyButton text={url} label="Copy link" className="justify-self-center" />
        </div>
        <p className="mt-4 text-xs text-muted">Students must give feedback before they can download their certificate.</p>
      </Card>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Star} tone="warn" label="Average rating" value={data.average ? `${data.average.toFixed(1)} / 5` : '—'} />
          <Stat icon={MessageSquareText} label="Responses" value={data.count} hint={data.eligible ? `of ${data.eligible} linked participants` : undefined} />
        </div>
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">Ratings</p>
          <div className="mt-4 space-y-2">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-12 shrink-0 text-muted">{star} star</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-accent2" style={{ width: `${(data.distribution[star - 1] / max) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-ink">{data.distribution[star - 1]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Comments" />
          {data.items.filter(i => i.comment).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No comments yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.items
                .filter(i => i.comment)
                .map((i, n) => (
                  <li key={n} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <Stars value={i.rating} size="size-4" />
                      <span className="text-xs text-muted">
                        {i.name} · {timeAgo(i.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink">{i.comment}</p>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
      {big && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-8 text-center" onClick={() => setBig(false)}>
          <p className="text-3xl font-semibold text-black">{event.title}: share your feedback</p>
          <QrImage value={url} size={Math.min(560, window.innerHeight - 260)} />
          <p className="text-lg text-neutral-600">Scan with your phone and sign in to CampusPulse. Feedback unlocks your certificate.</p>
          <p className="text-sm text-neutral-400">Click anywhere to close</p>
        </div>
      )}
    </div>
  );
}

function Results({ event, regs, reload }: { event: CampusEvent; regs: ClubRegistration[]; reload: () => void }) {
  const toast = useToast();
  const [scope, setScope] = useState<'attended' | 'all'>('attended');
  const [busy, setBusy] = useState(false);
  const confirmed = regs.filter(r => r.status === 'approved');
  const happened = event.event_date <= todayStr();
  const eligible = confirmed.filter(r => scope === 'all' || r.members.some(m => m.attended));

  const setAward = async (r: ClubRegistration, award: string) => {
    try {
      await api(`/api/club/registrations/${r.id}/award`, { body: { award } });
      toast(award ? `${r.team_name ?? r.leader_name}: ${award}` : 'Award removed');
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const issue = async () => {
    setBusy(true);
    try {
      const res = await api<{ issued: number; teams: number }>(`/api/club/events/${event.id}/certificates`, { body: { scope } });
      toast(`Certificates sent to ${res.teams} team leader${res.teams === 1 ? '' : 's'}`);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title="Awards" subtitle="Award winners get a Certificate of Achievement instead of Participation." />
        {confirmed.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No confirmed teams yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {confirmed.map(r => {
              const present = r.members.filter(m => m.attended).length;
              return (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.team_name ?? r.leader_name}</p>
                    <p className="text-xs text-muted">{r.checked_in_at ? `${present}/${r.members.length} attended` : 'Did not check in'}</p>
                  </div>
                  <Select value={r.award ?? ''} onChange={e => setAward(r, e.target.value)} className="h-9 w-44 text-[13px]" aria-label="Award">
                    <option value="">Participant</option>
                    {AWARDS.map(a => (
                      <option key={a}>{a}</option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHeader icon={Award} title="Certificates" subtitle={event.certificates_issued_at ? `Last issued ${fmtTimestamp(event.certificates_issued_at)}` : 'Not issued yet'} />
        <div className="grid gap-4 p-5">
          {!happened ? (
            <p className="flex items-start gap-2 text-sm text-muted">
              <Lock className="mt-0.5 size-4 shrink-0" /> You can issue certificates on or after {fmtDate(event.event_date)}.
            </p>
          ) : (
            <>
              <div className="grid gap-2">
                {(['attended', 'all'] as const).map(s => (
                  <label key={s} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors', scope === s ? 'border-accent bg-accent/5' : 'border-line')}>
                    <input type="radio" checked={scope === s} onChange={() => setScope(s)} className="mt-1 accent-[#0A84FF]" />
                    <span>
                      <span className="block text-sm font-medium text-ink">{s === 'attended' ? 'Only members who checked in' : 'All confirmed members'}</span>
                      <span className="text-xs text-muted">{s === 'attended' ? 'Recommended. Uses the attendance from QR check-in.' : 'Use if you did not scan attendance.'}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted">
                {eligible.length} team{eligible.length === 1 ? '' : 's'} will receive certificates. Team leaders are notified and can download every member's certificate.
              </p>
              <Button variant="primary" icon={Award} loading={busy} disabled={!eligible.length} onClick={issue}>
                {event.certificates_issued_at ? 'Re-issue certificates' : 'Generate & send certificates'}
              </Button>
              {event.certificates_issued_at && <p className="text-xs text-muted">Re-issuing updates awards on existing certificates and adds any newly eligible members. Certificate IDs stay the same.</p>}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export function ManageEventPage() {
  const { id } = useParams();
  const user = useUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const event = useApi<CampusEvent>(`/api/club/events/${id}`);
  const regs = useApi<ClubRegistration[]>(`/api/club/events/${id}/registrations`, { pollMs: 20_000 });
  const [review, setReview] = useState<{ reg: ClubRegistration; action: 'approve' | 'reject' | 'cancel' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'announce' | 'cancel' | null>(null);
  const [announce, setAnnounce] = useState({ title: '', message: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const all = regs.data ?? [];
  const pending = useMemo(() => all.filter(r => r.status === 'pending').reverse(), [all]);
  const tab = (params.get('tab') as Tab) || (pending.length ? 'pending' : 'registrations');
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  if (event.loading || regs.loading) return <PageLoader />;
  if (!event.data) return <EmptyState icon={AlertTriangle} title="Event not found" body={event.error ?? undefined} />;
  const e = event.data;
  const isClubAdmin = user.role === 'club_admin';
  const confirmed = all.filter(r => r.status === 'approved');
  const revenue = confirmed.reduce((s, r) => s + r.amount, 0);

  const submitReview = async () => {
    if (!review) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/club/registrations/${review.reg.id}/review`, { body: { action: review.action, note } });
      toast(review.action === 'approve' ? `Approved. ${review.reg.team_name ?? review.reg.leader_name} has been notified.` : review.action === 'reject' ? 'Rejected. The team can resubmit.' : 'Registration cancelled');
      setReview(null);
      setNote('');
      regs.reload();
      event.reload();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const quickApprove = async (r: ClubRegistration) => {
    try {
      await api(`/api/club/registrations/${r.id}/review`, { body: { action: 'approve' } });
      toast(`Approved. ${r.team_name ?? r.leader_name} has been notified.`);
      regs.reload();
      event.reload();
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  const toggleRegistration = async () => {
    try {
      event.setData(await api(`/api/club/events/${e.id}/registration`, { body: { open: !e.reg_open } }));
      toast(e.reg_open ? 'Registrations closed' : 'Registrations reopened');
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  const sendAnnouncement = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ sent: number }>(`/api/club/events/${e.id}/announce`, { body: announce });
      toast(`Sent to ${res.sent} participant account${res.sent === 1 ? '' : 's'}`);
      setModal(null);
      setAnnounce({ title: '', message: '' });
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelEvent = async () => {
    setBusy(true);
    setErr(null);
    try {
      event.setData(await api(`/api/club/events/${e.id}/cancel`, { body: { reason: cancelReason } }));
      toast('Event cancelled. Registered teams were notified.');
      setModal(null);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const editable = !['completed', 'cancelled'].includes(e.status);

  return (
    <div className="animate-in">
      <Link to={isClubAdmin ? '/club/events' : '/admin/events'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {isClubAdmin ? 'All events' : 'All events (admin)'}
      </Link>
      <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-start">
        <Poster src={e.poster_url} title={e.title} color={e.club_color} className="h-36 w-full shrink-0 rounded-card md:h-24 md:w-36" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{e.title}</h1>
            <StatusPill status={e.status} kind="event" />
            {e.status === 'published' && !e.registration_open && <Badge>{e.closed_reason}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {!isClubAdmin && `${e.club_name} · `}
            {fmtDate(e.event_date)} · {fmtTime(e.start_time)}–{fmtTime(e.end_time)} · {e.venue} · {fmtMoney(e.fee)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton to={`/events/${e.id}`} size="sm" icon={ExternalLink}>
              Student view
            </LinkButton>
            {editable && (
              <LinkButton to={`/club/events/${e.id}/edit`} size="sm" icon={Pencil}>
                Edit
              </LinkButton>
            )}
            <div className="relative">
              <Button size="sm" icon={FileSpreadsheet} onClick={() => setExportOpen(o => !o)}>
                Export Excel <ChevronDown className="size-3.5" />
              </Button>
              {exportOpen && (
                <div className="animate-pop absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-card border border-line bg-surface py-1.5 shadow-2xl shadow-black" onMouseLeave={() => setExportOpen(false)}>
                  {[
                    ['active', 'Confirmed + pending'],
                    ['approved', 'Confirmed only'],
                    ['all', 'Everything (incl. rejected)'],
                  ].map(([k, label]) => (
                    <a key={k} href={`/api/club/events/${e.id}/export?status=${k}`} download onClick={() => setExportOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-raised">
                      <Download className="size-4 text-muted" /> {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {e.status === 'published' && (
              <>
                {isClubAdmin && (
                  <LinkButton to={`/club/scan?event=${e.id}`} size="sm" icon={ScanLine}>
                    Scan
                  </LinkButton>
                )}
                <Button size="sm" icon={Megaphone} onClick={() => setModal('announce')}>
                  Announce
                </Button>
                {!e.is_past && (
                  <Button size="sm" icon={e.reg_open ? Lock : Unlock} onClick={toggleRegistration}>
                    {e.reg_open ? 'Close registrations' : 'Reopen registrations'}
                  </Button>
                )}
              </>
            )}
            {editable && (
              <Button size="sm" variant="ghost" icon={Ban} onClick={() => setModal('cancel')}>
                Cancel event
              </Button>
            )}
          </div>
        </div>
      </div>

      {e.status === 'pending' && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-accent2/30 bg-accent2/5 p-4 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-accent2" />
          <p className="text-ink">Waiting for portal admin approval. Students can't see this event yet.</p>
        </div>
      )}
      {e.status === 'rejected' && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-ink">Changes requested</p>
            <p className="text-muted">{e.admin_note}</p>
          </div>
        </div>
      )}
      {e.status === 'cancelled' && e.admin_note && <ErrorNote>Cancelled: {e.admin_note}</ErrorNote>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Ticket} tone="success" label="Confirmed" value={`${confirmed.length}/${e.max_teams}`} hint={`${confirmed.reduce((s, r) => s + r.members.length, 0)} participants`} />
        <Stat icon={Clock} tone={pending.length ? 'warn' : 'default'} label="To verify" value={pending.length} />
        <Stat icon={ScanLine} label="Checked in" value={confirmed.filter(r => r.checked_in_at).length} hint={`of ${confirmed.length} confirmed`} />
        <Stat icon={IndianRupee} tone="accent" label="Collected" value={`₹${revenue.toLocaleString('en-IN')}`} />
      </div>

      <Tabs
        className="mt-6"
        tabs={[
          { id: 'pending', label: 'Verify payments', count: pending.length },
          { id: 'registrations', label: 'Registrations', count: all.length },
          { id: 'od', label: 'OD letters' },
          { id: 'attendance', label: 'Attendance' },
          { id: 'feedback', label: 'Feedback' },
          { id: 'results', label: 'Awards & certificates' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === 'pending' && (
          <PendingQueue
            regs={pending}
            onReview={(reg, action) => {
              if (action === 'approve') quickApprove(reg);
              else {
                setNote('');
                setErr(null);
                setReview({ reg, action });
              }
            }}
          />
        )}
        {tab === 'registrations' && (
          <RegistrationsTable
            regs={all}
            onCancel={reg => {
              setNote('');
              setErr(null);
              setReview({ reg, action: 'cancel' });
            }}
          />
        )}
        {tab === 'od' && <OdTab event={e} isClubAdmin={isClubAdmin} />}
        {tab === 'attendance' && <Attendance event={e} isClubAdmin={isClubAdmin} />}
        {tab === 'feedback' && <FeedbackTab event={e} />}
        {tab === 'results' && (
          <Results
            event={e}
            regs={all}
            reload={() => {
              regs.reload();
              event.reload();
            }}
          />
        )}
      </div>

      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.action === 'reject' ? 'Reject payment' : 'Cancel registration'}
        subtitle={review ? `${review.reg.team_name ?? review.reg.leader_name} · ${review.reg.code}` : ''}
        footer={
          <>
            <Button onClick={() => setReview(null)}>Back</Button>
            <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={submitReview}>
              {review?.action === 'reject' ? 'Reject & notify team' : 'Cancel & notify team'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {review?.action === 'reject' && (
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map(r => (
                <button key={r} onClick={() => setNote(r)} className={cx('rounded-full border px-3 py-1.5 text-left text-xs transition-colors', note === r ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink')}>
                  {r}
                </button>
              ))}
            </div>
          )}
          <Field label="Reason (shown to the team)">
            <Textarea value={note} onChange={ev => setNote(ev.target.value)} rows={3} maxLength={500} />
          </Field>
          {review?.action === 'reject' && <p className="text-xs text-muted">The team keeps their details and can resubmit a corrected transaction ID.</p>}
          <ErrorNote>{err}</ErrorNote>
        </div>
      </Modal>

      <Modal
        open={modal === 'announce'}
        onClose={() => setModal(null)}
        title="Announce to confirmed teams"
        subtitle="Goes to every confirmed team's leader and linked members as an in-app notification."
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!announce.title.trim() || !announce.message.trim()} onClick={sendAnnouncement}>
              Send
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Title">
            <Input value={announce.title} onChange={ev => setAnnounce(a => ({ ...a, title: ev.target.value }))} placeholder="e.g. Venue changed to Hall B" maxLength={120} />
          </Field>
          <Field label="Message">
            <Textarea value={announce.message} onChange={ev => setAnnounce(a => ({ ...a, message: ev.target.value }))} rows={4} maxLength={1000} />
          </Field>
          <ErrorNote>{err}</ErrorNote>
        </div>
      </Modal>

      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title="Cancel this event?"
        subtitle="All registered teams are notified. This can't be undone."
        footer={
          <>
            <Button onClick={() => setModal(null)}>Keep event</Button>
            <Button variant="danger" loading={busy} disabled={!cancelReason.trim()} onClick={cancelEvent}>
              Cancel event
            </Button>
          </>
        }
      >
        <Field label="Reason (shown to participants)">
          <Textarea value={cancelReason} onChange={ev => setCancelReason(ev.target.value)} rows={3} />
        </Field>
        <div className="mt-4">
          <ErrorNote>{err}</ErrorNote>
        </div>
      </Modal>
    </div>
  );
}
