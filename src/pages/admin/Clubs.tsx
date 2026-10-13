import { useState, type FormEvent } from 'react';
import { Building2, KeyRound, Pencil, Plus, Power, UserPlus } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { Badge, Button, Card, ClubAvatar, CopyButton, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, PageLoader, Select, StatusPill, Textarea, useToast } from '../../components/ui';

interface AdminClub {
  id: string;
  name: string;
  short_name: string;
  kind: 'club' | 'department';
  description: string;
  color: string;
  contact_email: string | null;
  status: string;
  events: number;
  open_complaints: number;
  admins: { id: string; name: string; email: string; phone: string | null; status: string; last_login_at: string | null }[];
}

const COLORS = ['#0A84FF', '#FF9F0A', '#30D158', '#BF5AF2', '#FF453A', '#64D2FF', '#FFD60A', '#FF375F'];

export function CredentialsModal({ creds, onClose }: { creds: { email: string; password: string } | null; onClose: () => void }) {
  return (
    <Modal open={!!creds} onClose={onClose} title="Login credentials" subtitle="Share these privately. The password is shown only once." size="sm" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      {creds && (
        <div className="grid gap-3">
          {[
            ['Login ID', creds.email],
            ['Temporary password', creds.password],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">{k}</p>
                <p className="truncate font-mono text-sm font-semibold text-ink">{v}</p>
              </div>
              <CopyButton text={v} />
            </div>
          ))}
          <CopyButton text={`CampusPulse login\nID: ${creds.email}\nPassword: ${creds.password}\nPlease change your password after signing in (Profile → Change password).`} label="Copy both as message" className="justify-self-start" />
        </div>
      )}
    </Modal>
  );
}

function ClubForm({ initial, onSaved, onClose }: { initial: AdminClub | null; onSaved: (creds?: { email: string; password: string }) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    shortName: initial?.short_name ?? '',
    kind: initial?.kind ?? 'club',
    description: initial?.description ?? '',
    color: initial?.color ?? COLORS[0],
    contactEmail: initial?.contact_email ?? '',
    admin: { name: '', email: '', phone: '', password: '' },
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (initial) {
        await api(`/api/admin/clubs/${initial.id}`, { method: 'PUT', body: form });
        onSaved();
      } else {
        const res = await api<{ credentials: { email: string; password: string } }>('/api/admin/clubs', { body: form });
        onSaved(res.credentials);
      }
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit club' : 'Create club or department'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="club-form" loading={busy}>
            {initial ? 'Save' : 'Create club & admin'}
          </Button>
        </>
      }
    >
      <form id="club-form" onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
          <Field label="Name" required>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </Field>
          <Field label="Short name" required>
            <Input value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))} maxLength={16} required />
          </Field>
          <Field label="Type">
            <Select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'club' }))}>
              <option value="club">Club</option>
              <option value="department">Department</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Public contact email">
            <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink">Colour</span>
            <div className="flex h-11 items-center gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} className="size-7 rounded-full transition-transform" style={{ background: c, outline: form.color === c ? '2px solid white' : 'none', outlineOffset: 2 }} aria-label={`Colour ${c}`} />
              ))}
            </div>
          </div>
        </div>
        {!initial && (
          <div className="rounded-card border border-line bg-canvas p-4">
            <p className="text-sm font-semibold text-ink">Club admin account</p>
            <p className="mt-0.5 text-xs text-muted">This person signs in to create events and verify payments. Leave the password blank to generate one.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Admin name" required>
                <Input value={form.admin.name} onChange={e => setForm(f => ({ ...f, admin: { ...f.admin, name: e.target.value } }))} required />
              </Field>
              <Field label="Login email" required>
                <Input type="email" value={form.admin.email} onChange={e => setForm(f => ({ ...f, admin: { ...f.admin, email: e.target.value } }))} required />
              </Field>
              <Field label="Phone">
                <Input value={form.admin.phone} onChange={e => setForm(f => ({ ...f, admin: { ...f.admin, phone: e.target.value } }))} />
              </Field>
              <Field label="Password" hint="Optional">
                <Input value={form.admin.password} onChange={e => setForm(f => ({ ...f, admin: { ...f.admin, password: e.target.value } }))} placeholder="Auto-generate" />
              </Field>
            </div>
          </div>
        )}
        <ErrorNote>{err}</ErrorNote>
      </form>
    </Modal>
  );
}

function AddAdmin({ club, onClose, onCreated }: { club: AdminClub; onClose: () => void; onCreated: (c: { email: string; password: string }) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ credentials: { email: string; password: string } }>(`/api/admin/clubs/${club.id}/admins`, { body: form });
      onCreated(res.credentials);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Add admin to ${club.short_name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="add-admin" loading={busy}>Create account</Button></>}>
      <form id="add-admin" onSubmit={submit} className="grid gap-4">
        <Field label="Name" required>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </Field>
        <Field label="Login email" required>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Password" hint="Blank to auto-generate">
            <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
        </div>
        <ErrorNote>{err}</ErrorNote>
      </form>
    </Modal>
  );
}

export function AdminClubsPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<AdminClub[]>('/api/admin/clubs');
  const [editing, setEditing] = useState<AdminClub | 'new' | null>(null);
  const [adding, setAdding] = useState<AdminClub | null>(null);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const toggle = async (c: AdminClub) => {
    await api(`/api/admin/clubs/${c.id}/status`, { body: { status: c.status === 'active' ? 'inactive' : 'active' } });
    toast(c.status === 'active' ? `${c.short_name} deactivated. Its events are hidden.` : `${c.short_name} reactivated`);
    reload();
  };
  const resetPw = async (userId: string) => {
    const res = await api<{ credentials: { email: string; password: string } }>(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
    setCreds(res.credentials);
  };

  if (loading) return <PageLoader />;
  return (
    <div className="animate-in">
      <PageHeader title="Clubs & departments" subtitle="Create clubs, give them admin logins, and switch them off if needed." actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New club</Button>} />
      {!data?.length ? (
        <EmptyState icon={Building2} title="No clubs yet" action={<Button variant="primary" onClick={() => setEditing('new')}>Create the first club</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map(c => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <ClubAvatar name={c.short_name} color={c.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink">{c.name}</p>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="text-xs capitalize text-muted">
                    {c.kind} · {c.events} events{c.open_complaints ? ` · ${c.open_complaints} open complaints` : ''}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)} aria-label="Edit club" />
              </div>
              {c.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{c.description}</p>}
              <div className="mt-4 divide-y divide-line rounded-xl border border-line">
                {c.admins.length === 0 && <p className="px-4 py-3 text-sm text-danger">No admin. Add one so this club can run events.</p>}
                {c.admins.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {a.name} {a.status !== 'active' && <Badge tone="danger">Suspended</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {a.email} · {a.last_login_at ? `active ${timeAgo(a.last_login_at)}` : 'never signed in'}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => resetPw(a.id)} title="Reset password">
                      Reset
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" icon={UserPlus} onClick={() => setAdding(c)}>
                  Add admin
                </Button>
                <Button size="sm" variant={c.status === 'active' ? 'ghost' : 'success'} icon={Power} onClick={() => toggle(c)}>
                  {c.status === 'active' ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <ClubForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={c => {
            setEditing(null);
            reload();
            toast(c ? 'Club created' : 'Club updated');
            if (c) setCreds(c);
          }}
        />
      )}
      {adding && (
        <AddAdmin
          club={adding}
          onClose={() => setAdding(null)}
          onCreated={c => {
            setAdding(null);
            reload();
            setCreds(c);
          }}
        />
      )}
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
