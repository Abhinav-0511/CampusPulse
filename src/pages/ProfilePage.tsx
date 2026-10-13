import { useState, type FormEvent } from 'react';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import type { ClubSummary, User } from '../lib/types';
import { QrImage } from '../components/EventBits';
import { DepartmentSelect } from '../components/DepartmentSelect';
import { Badge, Button, Card, CardHeader, CopyButton, ErrorNote, Field, Input, PageHeader, useToast } from '../components/ui';

const ROLE_LABEL = { student: 'Student', club_admin: 'Club Admin', admin: 'Portal Admin' };

export function ProfilePage() {
  const user = useUser();
  const { club, setMe, logout } = useAuth();
  const toast = useToast();
  const student = user.role === 'student';
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? '',
    registerNumber: user.register_number ?? '',
    collegeName: user.college_name ?? '',
    department: user.department ?? '',
    yearOfStudy: user.year_of_study ?? '',
  });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'profile' | 'pw' | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('profile');
    setErr(null);
    try {
      const body = student ? form : { name: form.name, phone: form.phone };
      setMe(await api<{ user: User; club: ClubSummary | null }>('/api/auth/me', { method: 'PATCH', body }));
      toast('Profile updated');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    if (pw.next !== pw.confirm) return setPwErr('New passwords do not match.');
    setBusy('pw');
    try {
      await api('/api/auth/me/password', { body: { current: pw.current, next: pw.next } });
      setPw({ current: '', next: '', confirm: '' });
      toast('Password changed');
    } catch (e) {
      setPwErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-in mx-auto max-w-4xl">
      <PageHeader title="Profile" subtitle={`${ROLE_LABEL[user.role]}${club ? ` · ${club.name}` : ''} · ${user.email}`} actions={<Button icon={LogOut} onClick={logout}>Sign out</Button>} />

      {student && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-col items-center gap-6 p-6 sm:flex-row">
            <div className="rounded-2xl bg-white p-2.5">
              <QrImage value={user.unique_code!} size={120} />
            </div>
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Your CampusPulse ID</p>
                <Badge tone={user.student_type === 'internal' ? 'accent' : 'default'}>{user.student_type === 'internal' ? 'Internal student' : 'External student'}</Badge>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 sm:justify-start">
                <p className="font-mono text-3xl font-semibold tracking-wider text-ink">{user.unique_code}</p>
                <CopyButton text={user.unique_code!} />
              </div>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">Give this to your team leader. They enter it during registration to add you with your verified details, and your certificates then show up in your account too.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={UserRound} title="Personal details" subtitle={student ? 'Certificates use your name, register number and college exactly as shown.' : undefined} />
          <form onSubmit={save} className="grid gap-4 p-5">
            <Field label="Full name">
              <Input value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} type="tel" />
            </Field>
            {student && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Register number">
                    <Input value={form.registerNumber} onChange={set('registerNumber')} className="uppercase" required />
                  </Field>
                  <Field label="Year of study">
                    <Input value={form.yearOfStudy} onChange={set('yearOfStudy')} required />
                  </Field>
                </div>
                <Field label="College">
                  <Input value={form.collegeName} disabled title="Fixed after sign-up" />
                </Field>
                <Field label="Department">
                  <DepartmentSelect value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} required />
                </Field>
              </>
            )}
            <ErrorNote>{err}</ErrorNote>
            <Button type="submit" variant="primary" loading={busy === 'profile'} className="justify-self-start">
              Save changes
            </Button>
          </form>
        </Card>

        <Card className="self-start">
          <CardHeader icon={KeyRound} title="Change password" />
          <form onSubmit={changePw} className="grid gap-4 p-5">
            <Field label="Current password">
              <Input type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" required />
            </Field>
            <Field label="New password" hint="8+ characters with letters and numbers.">
              <Input type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} autoComplete="new-password" required />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" required />
            </Field>
            <ErrorNote>{pwErr}</ErrorNote>
            <Button type="submit" loading={busy === 'pw'} className="justify-self-start">
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
