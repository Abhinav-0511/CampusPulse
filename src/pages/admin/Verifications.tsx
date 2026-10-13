import { useState } from 'react';
import { Check, IdCard, X } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorNote, Field, Modal, PageHeader, PageLoader, StatusPill, Tabs, Textarea, cx, useToast } from '../../components/ui';

interface Pending {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  register_number: string;
  college_name: string;
  department: string | null;
  year_of_study: string | null;
  id_card_url: string;
  verification: 'pending' | 'rejected' | 'verified';
  verification_note: string | null;
  unique_code: string | null;
  created_at: string;
}

type Filter = 'pending' | 'rejected' | 'verified';
const REASONS = ['ID card photo is blurry or unreadable.', 'Name on the ID card does not match the sign-up details.', 'College on the ID card does not match.', 'ID card appears expired.'];

export function AdminVerificationsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('pending');
  const { data, loading, reload } = useApi<{ items: Pending[]; counts: Record<Filter, number> }>(`/api/admin/verifications?status=${filter}`, { pollMs: 20_000 });
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (p: Pending, action: 'approve' | 'reject', reason = '') => {
    setBusy(p.id);
    setErr(null);
    try {
      const res = await api<{ unique_code: string | null }>(`/api/admin/verifications/${p.id}`, { body: { action, note: reason } });
      toast(action === 'approve' ? `${p.name} verified. CampusPulse ID ${res.unique_code}` : `${p.name} asked to re-upload`);
      setRejecting(null);
      reload();
    } catch (e) {
      if (action === 'reject') setErr((e as Error).message);
      else toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) return <PageLoader />;
  const items = data?.items ?? [];

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <PageHeader title="Student verification" subtitle="Students from other colleges get a CampusPulse ID only after you check their college ID card." />
      <Tabs
        tabs={[
          { id: 'pending', label: 'Waiting', count: data?.counts.pending ?? 0 },
          { id: 'rejected', label: 'Asked to re-upload', count: data?.counts.rejected ?? 0 },
          { id: 'verified', label: 'Verified', count: data?.counts.verified ?? 0 },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="mt-6 grid gap-4">
        {items.length === 0 ? (
          <EmptyState icon={IdCard} title={filter === 'pending' ? 'No one is waiting for verification' : 'Nothing here'} />
        ) : (
          items.map(p => (
            <Card key={p.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <button onClick={() => setZoom(p.id_card_url)} className="relative shrink-0 bg-canvas md:w-80" aria-label={`View ${p.name}'s ID card`}>
                  <img src={p.id_card_url} alt={`${p.name}'s ID card`} className="aspect-[3/2] w-full" style={{ objectFit: 'contain' }} />
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[11px] text-ink">Click to enlarge</span>
                </button>
                <div className="min-w-0 flex-1 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-muted">Signed up {timeAgo(p.created_at)}</p>
                    </div>
                    <StatusPill status={p.verification === 'verified' ? 'approved' : p.verification} label={p.verification === 'verified' ? `Verified · ${p.unique_code}` : p.verification === 'pending' ? 'Waiting' : 'Re-upload requested'} />
                  </div>
                  <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {[
                      ['Register number', p.register_number],
                      ['College', p.college_name],
                      ['Department', p.department],
                      ['Year', p.year_of_study],
                      ['Email', p.email],
                      ['Phone', p.phone],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-xs text-muted">{k}</dt>
                        <dd className="truncate font-medium text-ink">{v ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                  {p.verification_note && <p className="mt-3 text-xs text-muted">Last reason: {p.verification_note}</p>}
                  {p.verification === 'pending' && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button variant="success" icon={Check} loading={busy === p.id} onClick={() => act(p, 'approve')}>
                        Approve & issue ID
                      </Button>
                      <Button
                        variant="danger"
                        icon={X}
                        onClick={() => {
                          setNote('');
                          setErr(null);
                          setRejecting(p);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="ID card" size="lg">
        {zoom && <img src={zoom} alt="ID card" className="mx-auto max-h-[72vh] rounded-xl" style={{ objectFit: 'contain' }} />}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Ask to re-upload ID card"
        subtitle={rejecting?.name}
        footer={
          <>
            <Button onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" loading={!!busy} disabled={!note.trim()} onClick={() => rejecting && act(rejecting, 'reject', note)}>
              Send to student
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {REASONS.map(r => (
              <button key={r} onClick={() => setNote(r)} className={cx('rounded-full border px-3 py-1.5 text-left text-xs transition-colors', note === r ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink')}>
                {r}
              </button>
            ))}
          </div>
          <Field label="Reason (shown to the student)">
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={300} />
          </Field>
          <ErrorNote>{err}</ErrorNote>
        </div>
      </Modal>
    </div>
  );
}
