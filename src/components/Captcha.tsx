import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Input } from './ui';

export interface CaptchaHandle {
  /** Fetches a fresh challenge; call after every failed submit since answers are single-use. */
  reset: () => void;
}

export const Captcha = forwardRef<CaptchaHandle, { onChange: (v: { captchaId: string; captchaAnswer: string }) => void }>(function Captcha({ onChange }, ref) {
  const [challenge, setChallenge] = useState<{ id: string; svg: string } | null>(null);
  const [answer, setAnswer] = useState('');

  const load = useCallback(async () => {
    setAnswer('');
    try {
      setChallenge(await api('/api/auth/captcha'));
    } catch {
      setChallenge(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useImperativeHandle(ref, () => ({ reset: load }), [load]);
  useEffect(() => {
    onChange({ captchaId: challenge?.id ?? '', captchaAnswer: answer });
  }, [challenge, answer, onChange]);

  return (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <ShieldCheck className="size-4 text-muted" /> Verify you're human
      </span>
      <div className="flex items-center gap-2">
        <div className="h-11 w-[150px] shrink-0 overflow-hidden rounded-xl border border-line bg-raised">
          {challenge && <img src={challenge.svg} alt="Captcha: type the characters shown" className="size-full" style={{ objectFit: 'fill' }} draggable={false} />}
        </div>
        <button type="button" onClick={load} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:text-ink" aria-label="New captcha">
          <RefreshCw className="size-4" />
        </button>
        <Input
          value={answer}
          onChange={e => setAnswer(e.target.value.toUpperCase().slice(0, 5))}
          placeholder="Enter code"
          autoComplete="off"
          spellCheck={false}
          className="font-mono tracking-[0.3em] placeholder:font-sans placeholder:tracking-normal"
          aria-label="Captcha answer"
        />
      </div>
    </div>
  );
});
