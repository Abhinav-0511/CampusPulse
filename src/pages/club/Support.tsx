import { useState, type FormEvent } from 'react';
import { LifeBuoy, MessageSquareReply, Plus } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { Complaint } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, PageLoader, Select, StatusPill, Textarea, useToast } from '../../components/ui';

export const COMPLAINT_CATEGORIES = ['Venue / Infrastructure', 'Finance', 'Event approval', 'Account & access', 'Student conduct', 'Other'];

export function SupportPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<Complaint[]>('/api/club/complaints');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', category: COMPLAINT_CATEGORIES[0], priority: 'normal', description: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/api/club/complaints', { body: form });
      toast('Sent to the portal admin');
      setOpen(false);
      setForm({ subject: '', category: COMPLAINT_CATEGORIES[0], priority: 'normal', description: '' });
      reload();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  return (
    <div className="animate-in mx-auto max-w-4xl">
      <PageHeader title="Support" subtitle="Raise issues and requests with the portal admin and track their replies." actions={<Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>New request</Button>} />
      {!data?.length ? (
        <EmptyState icon={LifeBuoy} title="No requests yet" body="Need a venue fixed, a budget approved or an account added? Raise it here." action={<Button variant="primary" onClick={() => setOpen(true)}>New request</Button>} />
      ) : (
        <div className="grid gap-3">
          {data.map(c => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{c.subject}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {c.category} · by {c.raised_by_name} · {timeAgo(c.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.priority === 'high' && <Badge tone="danger">High priority</Badge>}
                  <StatusPill status={c.status} />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{c.description}</p>
              {c.admin_reply && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-raised p-4">
                  <MessageSquareReply className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <p className="text-xs font-medium text-muted">Admin reply · {timeAgo(c.updated_at)}</p>
                    <p className="mt-1 text-sm text-ink">{c.admin_reply}</p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New request to admin"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="complaint-form" loading={busy}>
              Send
            </Button>
          </>
        }
      >
        <form id="complaint-form" onSubmit={submit} className="grid gap-4">
          <Field label="Subject">
            <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} maxLength={120} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {COMPLAINT_CATEGORIES.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High (blocks an event)</option>
              </Select>
            </Field>
          </div>
          <Field label="Details">
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5} required />
          </Field>
          <ErrorNote>{err}</ErrorNote>
        </form>
      </Modal>
    </div>
  );
}
