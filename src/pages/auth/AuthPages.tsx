import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Award, Eye, EyeOff, QrCode, Ticket } from 'lucide-react';
import { api } from '../../lib/api';
import { homePath, useAuth } from '../../lib/auth';
import type { ClubSummary, User } from '../../lib/types';
import { Captcha, type CaptchaHandle } from '../../components/Captcha';
import { ImagePicker } from '../../components/EventBits';
import { Brand } from '../../components/Layout';
import { DepartmentSelect } from '../../components/DepartmentSelect';
import { Badge, Button, Checkbox, CopyButton, ErrorNote, Field, Input, Select } from '../../components/ui';

const HERO = 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1400&auto=format&fit=crop&q=70';

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* Sticky so the college branding stays in view while the form side scrolls. */}
      <div className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <img src={HERO} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black" />
        <div className="relative flex h-full flex-col p-10">
          <Brand />
          <img src="/college-logo.png" alt="SRM Easwari Engineering College" className="mt-8 h-auto w-[360px] max-w-full" style={{ objectFit: 'contain' }} />
          <div className="mt-12 max-w-md">
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-ink">Every campus event, from sign-up to certificate.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">Find events across clubs and departments, register your team in a minute, and keep your entry pass and certificates in one place.</p>
            <div className="mt-8 grid gap-3">
              {[
                { icon: Ticket, text: 'Register teams with one CampusPulse ID' },
                { icon: QrCode, text: 'QR entry pass for every confirmed team' },
                { icon: Award, text: 'Verified certificates after each event' },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-3 text-sm text-ink">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/10 backdrop-blur">
                    <f.icon className="size-4" />
                  </span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-auto pt-8 text-xs text-muted">Certificate holders can verify authenticity at <Link to="/verify" className="text-accent hover:underline">/verify</Link></p>
        </div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-4 lg:hidden">
          <Brand />
          <img src="/college-logo.png" alt="SRM Easwari Engineering College" className="h-9 w-auto" style={{ objectFit: 'contain' }} />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </div>
    </div>
  );
}

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={props.value} onChange={e => props.onChange(e.target.value)} autoComplete={props.autoComplete} placeholder={props.placeholder} className="pr-11" required />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-lg text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Every account the demo seed creates (server/seed.ts). */
const DEMO_GROUPS: { title: string; pw: string; accounts: { label: string; id: string; note?: string }[] }[] = [
  { title: 'Portal admin', pw: 'Admin@1234', accounts: [{ label: 'Dr. Lakshmi Narayanan', id: 'admin@campuspulse.edu' }] },
  {
    title: 'Club & department admins',
    pw: 'Club@1234',
    accounts: [
      { label: 'CodeCraft Coding Club', id: 'codecraft@campuspulse.edu', note: 'HackSprint, payments to verify' },
      { label: 'RoboRiders Robotics Club', id: 'robotics@campuspulse.edu', note: 'Event tomorrow, ODs' },
      { label: 'Department of ECE', id: 'ece@campuspulse.edu' },
      { label: 'Kalakriti Cultural Club', id: 'culturals@campuspulse.edu' },
      { label: 'Sports Council', id: 'sports@campuspulse.edu' },
      { label: 'Entrepreneurship Cell', id: 'ecell@campuspulse.edu' },
    ],
  },
  {
    title: 'Students',
    pw: 'Student@123',
    accounts: [
      { label: 'Ananya Iyer', id: 'ananya@student.edu', note: 'Team leader, tickets, ODs, certificates' },
      { label: 'Rahul Verma', id: 'rahul@student.edu', note: 'Team member' },
      { label: 'Karthik Raja', id: 'karthik@student.edu', note: 'Certificate locked until feedback' },
      { label: 'Sneha Pillai', id: 'sneha@student.edu', note: 'Payment pending' },
      { label: 'Arjun Mehta', id: 'arjun@student.edu' },
      { label: 'Divya Krishnan', id: 'divya0@student.edu' },
      { label: 'Mohammed Irfan', id: 'mohammed1@student.edu' },
      { label: 'Harini Suresh', id: 'harini2@student.edu' },
      { label: 'Aditya Rao', id: 'aditya3@student.edu', note: 'External student' },
      { label: 'Nithya Ramesh', id: 'nithya4@student.edu' },
      { label: 'Siddharth Nair', id: 'siddharth5@student.edu' },
      { label: 'Pooja Desai', id: 'pooja6@student.edu' },
      { label: 'Vignesh Kumar', id: 'vignesh7@student.edu', note: 'External student' },
      { label: 'Kavya Menon', id: 'kavya8@student.edu' },
      { label: 'Rohan Gupta', id: 'rohan9@student.edu' },
      { label: 'Aishwarya Bala', id: 'aishwarya10@student.edu' },
      { label: 'Naveen Prakash', id: 'naveen11@student.edu', note: 'External student' },
      { label: 'Meera Thomas', id: 'meera@student.edu', note: 'External, ID card waiting for admin verification' },
    ],
  },
];

function DemoAccounts({ onPick }: { onPick: (id: string, pw: string) => void }) {
  const [allStudents, setAllStudents] = useState(false);
  return (
    <div className="mt-8 rounded-card border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Demo accounts · click to fill</p>
      {DEMO_GROUPS.map(g => {
        const list = g.title === 'Students' && !allStudents ? g.accounts.slice(0, 5) : g.accounts;
        return (
          <div key={g.title} className="mt-4">
            <div className="flex items-center justify-between px-3 pb-1">
              <p className="text-sm font-semibold text-ink">{g.title}</p>
              <p className="font-mono text-xs text-muted">password {g.pw}</p>
            </div>
            <div className="grid gap-0.5">
              {list.map(a => (
                <button key={a.id} type="button" onClick={() => onPick(a.id, g.pw)} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-raised">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{a.label}</span>
                    {a.note && <span className="block truncate text-xs text-muted">{a.note}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">{a.id}</span>
                </button>
              ))}
            </div>
            {g.title === 'Students' && (
              <button type="button" onClick={() => setAllStudents(v => !v)} className="mt-1 px-3 text-xs font-medium text-accent hover:underline">
                {allStudents ? 'Show fewer' : `Show all ${g.accounts.length} students`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LoginPage() {
  const { user, setMe } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ captchaId: '', captchaAnswer: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const captchaRef = useRef<CaptchaHandle>(null);
  const onCaptcha = useCallback((v: typeof captcha) => setCaptcha(v), []);
  const [showDemo, setShowDemo] = useState(false);
  useEffect(() => {
    api<{ showDemoAccounts?: boolean }>('/api/meta')
      .then(m => setShowDemo(!!m.showDemoAccounts))
      .catch(() => {});
  }, []);

  if (user) return <Navigate to={params.get('next') || homePath(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (captcha.captchaAnswer.length < 5) return setError('Enter the 5 characters shown in the captcha.');
    setBusy(true);
    try {
      const me = await api<{ user: User; club: ClubSummary | null }>('/api/auth/login', { body: { identifier, password, ...captcha } });
      setMe(me);
      navigate(params.get('next') || homePath(me.user.role), { replace: true });
    } catch (err) {
      setError((err as Error).message);
      captchaRef.current?.reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted">
        New student?{' '}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Create your account
        </Link>
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-5">
        <Field label="Email or CampusPulse ID">
          <Input value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" placeholder="you@college.edu or CP-XXXXXX" required />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <Captcha ref={captchaRef} onChange={onCaptcha} />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          Sign in <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted">Club and admin accounts are created by the portal admin. Forgot your password? Ask your club coordinator or the portal admin to reset it.</p>

      {showDemo && (
        <DemoAccounts
          onPick={(id, pw) => {
            setIdentifier(id);
            setPassword(pw);
          }}
        />
      )}
    </AuthShell>
  );
}

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'PG 1st Year', 'PG 2nd Year'];

export function RegisterPage() {
  const { user, setMe } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', registerNumber: '', collegeName: '', department: '', yearOfStudy: '', password: '', confirm: '' });
  const [captcha, setCaptcha] = useState({ captchaId: '', captchaAnswer: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<User | null>(null);
  const [hostCollege, setHostCollege] = useState('');
  const [idCard, setIdCard] = useState<string | null>(null);
  const [internal, setInternal] = useState(true);
  const captchaRef = useRef<CaptchaHandle>(null);
  const onCaptcha = useCallback((v: typeof captcha) => setCaptcha(v), []);

  useEffect(() => {
    api<{ collegeName: string }>('/api/meta')
      .then(m => {
        setHostCollege(m.collegeName);
        setForm(f => (f.collegeName ? f : { ...f, collegeName: m.collegeName }));
      })
      .catch(() => {});
  }, []);

  if (user && !created) return <Navigate to={homePath(user.role)} replace />;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (captcha.captchaAnswer.length < 5) return setError('Enter the 5 characters shown in the captcha.');
    if (!internal && !idCard) return setError('Upload a photo of your college ID card.');
    setBusy(true);
    try {
      const { confirm: _c, ...body } = form;
      const me = await api<{ user: User; club: null }>('/api/auth/register', { body: { ...body, ...captcha, idCard: internal ? undefined : idCard } });
      if (me.user.verification === 'verified') setCreated(me.user);
      else navigate('/', { replace: true }); // external: straight to the verification status page
      setMe(me);
    } catch (err) {
      setError((err as Error).message);
      captchaRef.current?.reset();
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <AuthShell>
        <div className="animate-in">
          <p className="text-xs font-medium uppercase tracking-wider text-success">Account created</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Welcome, {created.name.split(' ')[0]}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">This is your CampusPulse ID. Your team leader adds you to a team with it, and it links your certificates to your account.</p>
          <div className="mt-6 rounded-card border border-accent/30 bg-accent/5 p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Your CampusPulse ID</p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-wider text-ink">{created.unique_code}</p>
            <CopyButton text={created.unique_code!} label="Copy ID" className="mt-3" />
          </div>
          <dl className="mt-6 divide-y divide-line rounded-card border border-line bg-surface text-sm">
            {[
              ['Name on certificates', created.name],
              ['Register number', created.register_number],
              ['College', created.college_name],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">Student type</dt>
              <dd>
                <Badge tone={created.student_type === 'internal' ? 'accent' : 'default'}>{created.student_type === 'internal' ? 'Internal' : 'External'}</Badge>
              </dd>
            </div>
          </dl>
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>
            Start exploring events <ArrowRight className="size-4" />
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your student account</h1>
      <p className="mt-1.5 text-sm text-muted">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-5">
        <Field label="Full name" hint="Exactly as it should appear on certificates." required>
          <Input value={form.name} onChange={set('name')} autoComplete="name" required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Register number" required>
            <Input value={form.registerNumber} onChange={set('registerNumber')} placeholder="e.g. 21CS045" className="uppercase placeholder:normal-case" required />
          </Field>
          <Field label="Year of study" required>
            <Select value={form.yearOfStudy} onChange={set('yearOfStudy')} required>
              <option value="">Select</option>
              {YEARS.map(y => (
                <option key={y}>{y}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Checkbox
          checked={internal}
          onChange={v => {
            setInternal(v);
            setForm(f => ({ ...f, collegeName: v ? hostCollege : '' }));
          }}
          className="rounded-xl border border-line bg-surface px-4 py-3"
        >
          I'm a student of {hostCollege || 'this college'} <span className="text-muted">(internal student)</span>
        </Checkbox>
        {!internal && (
          <>
            <Field label="Your college name" hint="You can join open events. Some events are for internal students only." required>
              <Input value={form.collegeName} onChange={set('collegeName')} required />
            </Field>
            <ImagePicker label="College ID card photo *" value={idCard} onChange={setIdCard} aspect="h-48 w-full" hint="Front side, clearly readable. The admin verifies it before you get your CampusPulse ID." onError={setError} />
          </>
        )}
        <Field label="Department" required>
          <DepartmentSelect value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </Field>
          <Field label="Phone (WhatsApp)" required>
            <Input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+91 98765 43210" required />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password" hint="8+ characters with letters and numbers." required>
            <PasswordInput value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" required>
            <PasswordInput value={form.confirm} onChange={v => setForm(f => ({ ...f, confirm: v }))} autoComplete="new-password" />
          </Field>
        </div>
        <Captcha ref={captchaRef} onChange={onCaptcha} />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
