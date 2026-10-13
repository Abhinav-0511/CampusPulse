import { useState, type FormEvent } from 'react';
import { Megaphone, ShieldCheck } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, PageLoader, Select, Textarea, Toggle, useToast } from '../../components/ui';

export function AdminSettingsPage() {
  const toast = useToast();
  const settings = useApi<{ requireEventApproval: boolean }>('/api/admin/settings');
  const meta = useApi<{ collegeName: string; mailEnabled: boolean }>('/api/meta');
  const [msg, setMsg] = useState({ title: '', message: '', audience: 'students' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleApproval = async (v: boolean) => {
    settings.setData(await api('/api/admin/settings', { method: 'PUT', body: { requireEventApproval: v } }));
    toast(v ? 'New events now need your approval' : 'Clubs can now publish directly');
  };

  const broadcast = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ sent: number }>('/api/admin/announce', { body: msg });
      toast(`Announcement sent to ${res.sent} accounts`);
      setMsg(m => ({ ...m, title: '', message: '' }));
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (settings.loading) return <PageLoader />;
  return (
    <div className="animate-in mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle={meta.data?.collegeName} />
      <div className="grid gap-6">
        <Card>
          <CardHeader icon={ShieldCheck} title="Event governance" />
          <div className="grid gap-5 p-5">
            <Toggle checked={!!settings.data?.requireEventApproval} onChange={toggleApproval} label="Require admin approval for new events" hint="When on, events created by clubs stay hidden until you approve them in Events. When off, they go live immediately and you can still unpublish." />
            <div className="border-t border-line pt-5 text-sm">
              <p className="font-medium text-ink">Email delivery</p>
              <p className="mt-1 text-muted">
                {meta.data?.mailEnabled
                  ? 'SMTP is configured. Approvals, reminders, cancellations and certificates are also emailed.'
                  : 'Not configured. Notifications are in-app only. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env to also send emails.'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader icon={Megaphone} title="Broadcast announcement" subtitle="Appears in every recipient's notifications." />
          <form onSubmit={broadcast} className="grid gap-4 p-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <Field label="Title">
                <Input value={msg.title} onChange={e => setMsg(m => ({ ...m, title: e.target.value }))} maxLength={120} required />
              </Field>
              <Field label="Send to">
                <Select value={msg.audience} onChange={e => setMsg(m => ({ ...m, audience: e.target.value }))}>
                  <option value="students">All students</option>
                  <option value="club_admins">All club admins</option>
                  <option value="all">Everyone</option>
                </Select>
              </Field>
            </div>
            <Field label="Message">
              <Textarea value={msg.message} onChange={e => setMsg(m => ({ ...m, message: e.target.value }))} rows={4} maxLength={1000} required />
            </Field>
            <ErrorNote>{err}</ErrorNote>
            <Button type="submit" variant="primary" loading={busy} className="justify-self-start">
              Send announcement
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
