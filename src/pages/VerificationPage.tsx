import { useEffect, useState } from 'react';
import { Check, Clock, IdCard, LogOut, RefreshCw, ShieldAlert, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { fileToDataUrl } from '../lib/api';
import { Brand } from '../components/Layout';
import { Button, Card, ErrorNote, cx, useToast } from '../components/ui';

/**
 * Where an external student lands until the admin verifies their ID card.
 * Everything else in the app is blocked by the server until then.
 */
export function VerificationPage() {
  const user = useUser();
  const { refresh, logout } = useAuth();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [newCard, setNewCard] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rejected = user.verification === 'rejected';

  // Quietly re-check every 20 s; once approved, the app swaps to the normal home page.
  useEffect(() => {
    const t = setInterval(() => refresh(), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const check = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  const resubmit = async () => {
    if (!newCard) return;
    setBusy(true);
    setErr(null);
    try {
      await api('/api/auth/verification', { body: { idCard: newCard } });
      toast('New ID card sent for review');
      setNewCard(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { label: 'Account created', done: true },
    { label: rejected ? 'ID card not accepted' : 'ID card under review', done: false, active: true, failed: rejected },
    { label: 'CampusPulse ID issued', done: false },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between border-b border-line/60 px-4 py-3 sm:px-8">
        <Brand />
        <Button size="sm" variant="ghost" icon={LogOut} onClick={logout}>
          Sign out
        </Button>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="animate-in">
          <span className={cx('grid size-14 place-items-center rounded-2xl', rejected ? 'bg-danger/15 text-danger' : 'bg-accent2/15 text-accent2')}>
            {rejected ? <ShieldAlert className="size-7" /> : <Clock className="size-7" />}
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{rejected ? 'Please upload your ID card again' : `Thanks, ${user.name.split(' ')[0]}! Your account is being verified`}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {rejected
              ? 'The portal admin could not verify your college ID card. Upload a clear photo of the front of your ID card to try again.'
              : 'Students from other colleges are verified by the portal admin using your college ID card. Once approved you get your CampusPulse ID and can register for events. This page updates by itself.'}
          </p>

          <Card className="mt-6 p-5">
            <ol className="space-y-4">
              {steps.map(s => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={cx('grid size-7 shrink-0 place-items-center rounded-full', s.done ? 'bg-success text-black' : s.failed ? 'bg-danger text-white' : s.active ? 'bg-accent2 text-black' : 'border border-line bg-raised text-muted')}>
                    {s.done ? <Check className="size-4" strokeWidth={3} /> : s.active ? <Clock className="size-4" /> : <IdCard className="size-3.5" />}
                  </span>
                  <span className={cx('text-sm', s.done || s.active ? 'font-medium text-ink' : 'text-muted')}>{s.label}</span>
                </li>
              ))}
            </ol>
            {rejected && user.verification_note && <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-ink">Reason: {user.verification_note}</p>}
          </Card>

          <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_220px]">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Submitted details</p>
              <dl className="mt-3 grid gap-2 text-sm">
                {[
                  ['Name', user.name],
                  ['Register number', user.register_number],
                  ['College', user.college_name],
                  ['Department', user.department],
                  ['Email', user.email],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card className="overflow-hidden">
              {newCard || user.id_card_url ? (
                <img src={newCard ?? user.id_card_url!} alt="Your ID card" className="aspect-[3/2] w-full bg-canvas" style={{ objectFit: 'contain' }} />
              ) : (
                <div className="grid aspect-[3/2] place-items-center text-xs text-muted">No ID card</div>
              )}
              <p className="px-4 py-2.5 text-center text-xs text-muted">{newCard ? 'New photo (not sent yet)' : 'Your ID card'}</p>
            </Card>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {rejected ? (
              <>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-ink hover:border-ink/25">
                  <Upload className="size-4" /> {newCard ? 'Choose a different photo' : 'Choose ID card photo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      try {
                        setNewCard(await fileToDataUrl(f));
                      } catch (error) {
                        setErr((error as Error).message);
                      }
                    }}
                  />
                </label>
                <Button variant="primary" loading={busy} disabled={!newCard} onClick={resubmit}>
                  Send for verification
                </Button>
              </>
            ) : (
              <Button icon={RefreshCw} loading={checking} onClick={check}>
                Check status
              </Button>
            )}
          </div>
          <div className="mt-4">
            <ErrorNote>{err}</ErrorNote>
          </div>
        </div>
      </main>
    </div>
  );
}
