import { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { Complaint } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { Badge, Button, Card, ClubAvatar, EmptyState, ErrorNote, Field, Modal, PageHeader, PageLoader, Select, StatusPill, Tabs, Textarea, useToast } from '../../components/ui';

type Filter = 'active' | 'resolved' | 'all';

export function AdminComplaintsPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<Complaint[]>('/api/admin/complaints');
  const [filter, setFilter] = useState<Filter>('active');
  const [open, setOpen] = useState<Complaint | null>(null);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<Complaint['status']>('in_progress');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader />;
  const all = data ?? [];
  const list = all.filter(c => (filter === 'all' ? true : filter === 'resolved' ? c.status === 'resolved' : c.status !== 'resolved'));

  const openComplaint = (c: Complaint) => {
    setOpen(c);
    setReply('');
    setErr(null);
    setStatus(c.status === 'open' ? 'in_progress' : c.status);
  };

  const save = async () => {
    if (!open) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/admin/complaints/${open.id}`, { body: { status, reply } });
      toast('Reply sent to the club');
      setOpen(null);
      reload();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <PageHeader title="Complaints & requests" subtitle="Issues raised by club admins. Replies notify the club." />
      <Tabs
        tabs={[
          { id: 'active', label: 'Open', count: all.filter(c => c.status !== 'resolved').length },
          { id: 'resolved', label: 'Resolved', count: all.filter(c => c.status === 'resolved').length },
          { id: 'all', label: 'All', count: all.length },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="mt-6 grid gap-3">
        {list.length === 0 ? (
          <EmptyState icon={MessageSquareWarning} title="Nothing here" body={filter === 'active' ? 'No open complaints right now.' : undefined} />
        ) : (
          list.map(c => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-start gap-3">
                <ClubAvatar name={c.club_name ?? ''} color={c.club_color ?? '#0A84FF'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink">{c.subject}</p>
                    {c.priority === 'high' && <Badge tone="danger">High priority</Badge>}
                  </div>
                  <p className="text-xs text-muted">
                    {c.club_name} · {c.raised_by_name} ({c.raised_by_email}) · {c.category} · {timeAgo(c.created_at)}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90">{c.description}</p>
              {c.admin_reply && (
                <p className="mt-3 rounded-xl bg-raised px-4 py-3 text-sm text-muted">
                  <span className="font-medium text-ink">Your reply:</span> {c.admin_reply}
                </p>
              )}
              <div className="mt-4">
                <Button size="sm" variant={c.status === 'resolved' ? 'secondary' : 'primary'} onClick={() => openComplaint(c)}>
                  {c.status === 'resolved' ? 'Reopen / reply' : 'Reply & update'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject ?? ''}
        subtitle={open?.club_name}
        footer={
          <>
            <Button onClick={() => setOpen(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Save & notify club
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Status">
            <Select value={status} onChange={e => setStatus(e.target.value as Complaint['status'])}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </Select>
          </Field>
          <Field label="Reply" hint={open?.admin_reply ? 'Leave blank to keep the previous reply.' : undefined}>
            <Textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} placeholder={open?.admin_reply ?? 'What has been done or what happens next?'} />
          </Field>
          <ErrorNote>{err}</ErrorNote>
        </div>
      </Modal>
    </div>
  );
}
