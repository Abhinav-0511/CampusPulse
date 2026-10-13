import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { AlertOctagon, Camera, CameraOff, Check, CheckCircle2, Keyboard, ScanLine, Users } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { CampusEvent, TeamMember } from '../../lib/types';
import { fmtDate, fmtTimestamp, todayStr } from '../../lib/format';
import { Button, Card, Checkbox, EmptyState, Input, LinkButton, PageHeader, PageLoader, Progress, Select, cx } from '../../components/ui';

interface Lookup {
  registration: { id: string; code: string; team_name: string | null; leader_name: string; leader_phone: string | null; checked_in_at: string | null; members: TeamMember[] };
  event: { id: string; title: string; event_date: string };
  manualEntry: boolean;
}

type Result = { kind: 'ok'; data: Lookup; present: string[]; saved: boolean } | { kind: 'error'; message: string };

function useCamera(onCode: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setState('off');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs HTTPS (or localhost). Use manual entry, or open the app over HTTPS on this device.');
      setState('error');
      return;
    }
    setState('starting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setState('on');
    } catch (err) {
      setError((err as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in your browser settings, or use manual entry.' : 'Could not start the camera. Use manual entry instead.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (state !== 'on') return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      if (!v || v.readyState < 2 || t - last < 120) return;
      last = t;
      const scale = Math.min(1, 720 / v.videoWidth);
      canvas.width = v.videoWidth * scale;
      canvas.height = v.videoHeight * scale;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) onCodeRef.current(code.data);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  useEffect(() => stop, [stop]);
  return { videoRef, state, error, start, stop };
}

export function ScannerPage() {
  const [params, setParams] = useSearchParams();
  const events = useApi<CampusEvent[]>('/api/club/events');
  const options = (events.data ?? []).filter(e => e.status === 'published' && e.event_date >= todayStr()).reverse();
  const eventId = params.get('event') || options[0]?.id || '';
  const event = options.find(e => e.id === eventId);
  const attendance = useApi<{ teams_total: number; teams_present: number; people_total: number; people_present: number }>(eventId ? `/api/club/events/${eventId}/attendance` : null, { pollMs: 5000 });

  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState('');
  const [saving, setSaving] = useState(false);
  const lastScan = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const busy = useRef(false);

  const lookup = useCallback(
    async (payload: string) => {
      const now = Date.now();
      if (busy.current || (payload === lastScan.current.text && now - lastScan.current.at < 4000)) return;
      lastScan.current = { text: payload, at: now };
      busy.current = true;
      navigator.vibrate?.(60);
      try {
        const data = await api<Lookup>('/api/club/checkin/lookup', { body: { payload, eventId } });
        const already = !!data.registration.checked_in_at;
        const present = already ? data.registration.members.filter(m => m.attended).map(m => m.id) : data.registration.members.map(m => m.id);
        setResult({ kind: 'ok', data, present, saved: false });
      } catch (err) {
        setResult({ kind: 'error', message: (err as Error).message });
      } finally {
        busy.current = false;
      }
    },
    [eventId],
  );

  const cam = useCamera(lookup);

  const confirm = async () => {
    if (result?.kind !== 'ok') return;
    setSaving(true);
    try {
      await api(`/api/club/registrations/${result.data.registration.id}/checkin`, { body: { memberIds: result.present } });
      setResult({ ...result, saved: true });
      attendance.reload();
      navigator.vibrate?.([40, 40, 40]);
    } catch (err) {
      setResult({ kind: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    if (manual.trim()) {
      lastScan.current = { text: '', at: 0 };
      lookup(manual.trim());
      setManual('');
    }
  };

  if (events.loading) return <PageLoader />;
  if (!options.length) return <EmptyState icon={ScanLine} title="No live events to check in" body="The scanner works for published events happening today or later." action={<LinkButton to="/club/events">View events</LinkButton>} />;

  const a = attendance.data;
  const reg = result?.kind === 'ok' ? result.data.registration : null;
  const alreadyIn = reg?.checked_in_at && result?.kind === 'ok' && !result.saved;

  return (
    <div className="animate-in">
      <PageHeader title="Check-in scanner" subtitle="Scan the team's entry pass. Untick anyone who isn't present." />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select value={eventId} onChange={e => setParams({ event: e.target.value }, { replace: true })} aria-label="Event">
          {options.map(e => (
            <option key={e.id} value={e.id}>
              {e.title} · {fmtDate(e.event_date)}
            </option>
          ))}
        </Select>
        {a && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2">
            <Users className="size-4 text-success" />
            <span className="text-sm tabular-nums text-ink">
              <span className="font-semibold">{a.people_present}</span>
              <span className="text-muted">/{a.people_total} present</span>
            </span>
            <div className="w-20">
              <Progress value={a.people_present} max={a.people_total} tone="success" />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-black sm:aspect-[4/3]">
              <video ref={cam.videoRef} className={cx('size-full object-cover', cam.state !== 'on' && 'hidden')} muted playsInline />
              {cam.state === 'on' ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="size-56 rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <span className="grid size-14 place-items-center rounded-2xl bg-raised text-ink">{cam.state === 'error' ? <CameraOff className="size-6" /> : <Camera className="size-6" />}</span>
                  <p className="max-w-xs text-sm text-muted">{cam.error ?? 'Point the camera at the QR on the participant’s phone.'}</p>
                  <Button variant="primary" onClick={cam.start} loading={cam.state === 'starting'}>
                    Start camera
                  </Button>
                </div>
              )}
            </div>
            {cam.state === 'on' && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3">
                <span className="flex items-center gap-2 text-xs text-success">
                  <span className="size-2 animate-pulse rounded-full bg-success" /> Scanning
                </span>
                <Button size="sm" variant="ghost" onClick={cam.stop}>
                  Stop camera
                </Button>
              </div>
            )}
          </Card>
          <form onSubmit={submitManual} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="absolute left-3.5 top-3.5 size-4 text-muted" />
              <Input value={manual} onChange={e => setManual(e.target.value)} placeholder="Type REG-XXXXXX or use a USB scanner" className="pl-10 font-mono" />
            </div>
            <Button type="submit">Look up</Button>
          </form>
        </div>

        <div>
          {!result ? (
            <div className="grid h-full min-h-64 place-items-center rounded-card border border-dashed border-line p-8 text-center">
              <div>
                <ScanLine className="mx-auto size-8 text-muted" />
                <p className="mt-3 text-sm text-muted">Scan results appear here.</p>
                {event && <p className="mt-1 text-xs text-muted">Checking in for {event.title}</p>}
              </div>
            </div>
          ) : result.kind === 'error' ? (
            <Card className="animate-pop border-danger/40 p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-danger/15 text-danger">
                  <AlertOctagon className="size-6" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-danger">Do not admit</p>
                  <p className="mt-1 text-sm text-ink">{result.message}</p>
                </div>
              </div>
              <Button className="mt-6 w-full" onClick={() => setResult(null)}>
                Clear
              </Button>
            </Card>
          ) : (
            <Card className={cx('animate-pop p-6', result.saved ? 'border-success/50' : alreadyIn ? 'border-accent2/50' : 'border-accent/40')}>
              <div className="flex items-start gap-3">
                <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', result.saved ? 'bg-success/15 text-success' : alreadyIn ? 'bg-accent2/15 text-accent2' : 'bg-accent/15 text-accent')}>
                  <CheckCircle2 className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className={cx('text-lg font-semibold', result.saved ? 'text-success' : alreadyIn ? 'text-accent2' : 'text-ink')}>{result.saved ? 'Checked in' : alreadyIn ? `Already checked in at ${fmtTimestamp(reg!.checked_in_at!)}` : 'Valid pass'}</p>
                  <p className="text-sm text-ink">{reg!.team_name ? `Team ${reg!.team_name}` : reg!.leader_name}</p>
                  <p className="font-mono text-xs text-muted">
                    {reg!.code}
                    {result.data.manualEntry && ' · entered manually, verify ID card'}
                  </p>
                </div>
              </div>
              <div className="mt-5 divide-y divide-line rounded-xl border border-line">
                {reg!.members.map(m => (
                  <div key={m.id} className="px-4 py-3">
                    <Checkbox checked={result.present.includes(m.id)} onChange={v => setResult({ ...result, saved: false, present: v ? [...result.present, m.id] : result.present.filter(x => x !== m.id) })}>
                      <span className="font-medium">{m.name}</span>
                      {m.is_leader ? <span className="ml-1.5 text-xs text-accent">Leader</span> : null}
                      <span className="block text-xs text-muted">
                        {m.register_number} · {m.college_name}
                      </span>
                    </Checkbox>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <Button className="flex-1" onClick={() => setResult(null)}>
                  {result.saved ? 'Next' : 'Cancel'}
                </Button>
                {!result.saved && (
                  <Button variant="success" icon={Check} className="flex-[2]" loading={saving} onClick={confirm}>
                    {alreadyIn ? 'Update attendance' : `Admit ${result.present.length} of ${reg!.members.length}`}
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
