import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { Role } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, StatusPill, Tabs, useToast } from '../../components/ui';
import { CredentialsModal } from './Clubs';

interface AdminUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  unique_code: string | null;
  register_number: string | null;
  college_name: string | null;
  department: string | null;
  year_of_study: string | null;
  student_type: 'internal' | 'external';
  status: string;
  created_at: string;
  last_login_at: string | null;
  club_name: string | null;
  events_joined: number;
}

function CreateStaff({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { email: string; password: string }) => void }) {
  const clubs = useApi<{ id: string; name: string }[]>('/api/admin/clubs');
  const [form, setForm] = useState({ role: 'club_admin', clubId: '', name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ credentials: { email: string; password: string } }>('/api/admin/users', { body: form });
      onCreated(res.credentials);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Create staff account" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="staff-form" loading={busy}>Create</Button></>}>
      <form id="staff-form" onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="club_admin">Club admin</option>
              <option value="admin">Portal admin</option>
            </Select>
          </Field>
          {form.role === 'club_admin' && (
            <Field label="Club" required>
              <Select value={form.clubId} onChange={e => setForm(f => ({ ...f, clubId: e.target.value }))} required>
                <option value="">Select club</option>
                {clubs.data?.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
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
        {form.role === 'admin' && <p className="text-xs text-accent2">Portal admins have full control over every club, event and user.</p>}
        <ErrorNote>{err}</ErrorNote>
      </form>
    </Modal>
  );
}

export function AdminUsersPage() {
  const me = useUser();
  const toast = useToast();
  const [role, setRole] = useState<Role>('student');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading, reload } = useApi<AdminUser[]>(`/api/admin/users?role=${role}${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}`);
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const setStatus = async (u: AdminUser) => {
    const status = u.status === 'active' ? 'suspended' : 'active';
    try {
      await api(`/api/admin/users/${u.id}/status`, { body: { status } });
      toast(status === 'suspended' ? `${u.name} suspended and signed out` : `${u.name} reactivated`);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  const reset = async (u: AdminUser) => {
    const res = await api<{ credentials: { email: string; password: string } }>(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' });
    setCreds(res.credentials);
  };

  return (
    <div className="animate-in">
      <PageHeader title="Users" subtitle="Search students, manage staff accounts and reset passwords." actions={<Button variant="primary" icon={UserPlus} onClick={() => setCreating(true)}>Create staff</Button>} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs
          tabs={[
            { id: 'student' as Role, label: 'Students' },
            { id: 'club_admin' as Role, label: 'Club admins' },
            { id: 'admin' as Role, label: 'Portal admins' },
          ]}
          value={role}
          onChange={setRole}
        />
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 size-4 text-muted" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, email, CampusPulse ID, register number or college" className="pl-10" />
        </div>
      </div>
      <Card className="mt-5 overflow-hidden">
        {loading && !data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : !data?.length ? (
          <div className="p-5">
            <EmptyState icon={Users} title="No users found" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">{role === 'student' ? 'ID / Register no.' : role === 'club_admin' ? 'Club' : 'Email'}</th>
                  <th className="px-3 py-3 font-medium">{role === 'student' ? 'College' : 'Last active'}</th>
                  {role === 'student' && <th className="px-3 py-3 text-right font-medium">Events</th>}
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map(u => (
                  <tr key={u.id} className="align-middle">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">
                        {u.name}
                        {role === 'student' && <span className={u.student_type === 'internal' ? 'ml-2 text-[11px] font-semibold text-accent' : 'ml-2 text-[11px] font-semibold text-muted'}>{u.student_type === 'internal' ? 'Internal' : 'External'}</span>}
                      </p>
                      <p className="text-xs text-muted">{role === 'admin' ? u.phone ?? '' : u.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      {role === 'student' ? (
                        <>
                          <p className="font-mono text-xs text-ink">{u.unique_code}</p>
                          <p className="font-mono text-xs text-muted">{u.register_number}</p>
                        </>
                      ) : role === 'club_admin' ? (
                        <span className="text-ink">{u.club_name ?? '—'}</span>
                      ) : (
                        <span className="text-ink">{u.email}</span>
                      )}
                    </td>
                    <td className="max-w-56 px-3 py-3">
                      {role === 'student' ? (
                        <>
                          <p className="truncate text-ink">{u.college_name}</p>
                          <p className="truncate text-xs text-muted">
                            {u.department} · {u.year_of_study}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted">{u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}</span>
                      )}
                    </td>
                    {role === 'student' && <td className="px-3 py-3 text-right tabular-nums text-ink">{u.events_joined}</td>}
                    <td className="px-3 py-3">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => reset(u)}>
                          Reset
                        </Button>
                        {u.id !== me.id && (
                          <Button size="sm" variant={u.status === 'active' ? 'ghost' : 'success'} icon={ShieldCheck} onClick={() => setStatus(u)}>
                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating && (
        <CreateStaff
          onClose={() => setCreating(false)}
          onCreated={c => {
            setCreating(false);
            setCreds(c);
            reload();
          }}
        />
      )}
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
