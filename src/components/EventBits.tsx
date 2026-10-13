import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Calendar, ImagePlus, Lock, MapPin, Users, X } from 'lucide-react';
import type { CampusEvent } from '../lib/types';
import { fileToDataUrl } from '../lib/api';
import { countdown, daysUntil, fmtDate, fmtMoney, fmtTime, msUntil, teamSizeLabel } from '../lib/format';
import { cx } from './ui';

/** Event poster with a branded gradient fallback when no image is set or it fails to load. */
export function Poster({ src, title, color = '#0A84FF', className }: { src: string | null | undefined; title: string; color?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={cx('relative flex items-end overflow-hidden p-4', className)} style={{ background: `radial-gradient(120% 90% at 0% 0%, ${color}55, transparent 60%), linear-gradient(135deg, #1C1C1E, #000)` }}>
        <span className="line-clamp-3 text-lg font-bold leading-tight tracking-tight text-white/90">{title}</span>
      </div>
    );
  }
  return <img src={src} alt={`Poster for ${title}`} className={cx('object-cover', className)} onError={() => setFailed(true)} loading="lazy" />;
}

export function RegistrationBadge({ event }: { event: CampusEvent }) {
  if (event.registration_open) {
    const left = event.spots_left;
    if (left <= Math.max(3, event.max_teams * 0.1)) return <span className="rounded-full bg-accent2/90 px-2.5 py-1 text-[11px] font-semibold text-black">Only {left} left</span>;
    return null;
  }
  return <span className="rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-muted backdrop-blur">{event.closed_reason}</span>;
}

export function InternalBadge({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full bg-accent2/90 px-2.5 py-1 text-[11px] font-semibold text-black', className)}>
      <Lock className="size-3" /> Internal only
    </span>
  );
}

export function EventCard({ event, compact }: { event: CampusEvent; compact?: boolean }) {
  return (
    <Link to={`/events/${event.id}`} className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-ink/20">
      <div className={cx('relative overflow-hidden', compact ? 'h-32' : 'h-40')}>
        <Poster src={event.poster_url} title={event.title} color={event.club_color} className="size-full transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent" />
        <span className={cx('absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold', event.fee === 0 ? 'bg-success/90 text-black' : 'bg-black/75 text-ink backdrop-blur')}>{fmtMoney(event.fee)}</span>
        <span className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {!!event.internal_only && <InternalBadge />}
          <RegistrationBadge event={event} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: event.club_color }}>
          {event.category}
        </p>
        <h3 className="mt-1 text-[15px] font-semibold leading-snug text-ink">{event.title}</h3>
        <p className="mt-0.5 text-[13px] text-muted">{event.club_name}</p>
        <div className="mt-3 space-y-1.5 text-[13px] text-muted">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0" />
            <span>
              {fmtDate(event.event_date)} · {fmtTime(event.start_time)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
          {!compact && (
            <div className="flex items-center gap-2">
              <Users className="size-3.5 shrink-0" />
              <span>{teamSizeLabel(event.team_min, event.team_max)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function SoonCard({ event }: { event: CampusEvent }) {
  const ms = msUntil(event.event_date, event.start_time);
  const days = daysUntil(event.event_date);
  return (
    <Link to={`/events/${event.id}`} className="flex w-64 shrink-0 flex-col rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/20">
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-raised text-center leading-none">
          <div>
            <p className="text-[10px] font-semibold uppercase text-accent2">{fmtDate(event.event_date, { month: 'short' })}</p>
            <p className="mt-0.5 text-lg font-bold text-ink">{fmtDate(event.event_date, { day: 'numeric' })}</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-accent2">{days <= 0 ? 'Today' : `Starts in ${countdown(ms)}`}</p>
          <h3 className="mt-0.5 truncate text-[14px] font-semibold text-ink">{event.title}</h3>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">{event.club_name}</p>
      <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{event.venue}</span>
      </div>
    </Link>
  );
}

/** Renders any string as a QR code image. */
export function QrImage({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(null));
  }, [value, size]);
  return src ? <img src={src} alt="QR code" width={size} height={size} className={cx('rounded-lg bg-white', className)} style={{ objectFit: 'contain' }} /> : <div style={{ width: size, height: size }} className={cx('animate-pulse rounded-lg bg-raised', className)} />;
}

export function ImagePicker({ value, onChange, label, hint, aspect = 'aspect-[16/9]', onError }: { value: string | null; onChange: (v: string | null) => void; label: string; hint?: string; aspect?: string; onError?: (msg: string) => void }) {
  const inputId = `img-${label.replace(/\W+/g, '-')}`;
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {value ? (
        <div className={cx('relative overflow-hidden rounded-card border border-line bg-canvas', aspect)}>
          <img src={value} alt={label} className="size-full object-contain" />
          <button type="button" onClick={() => onChange(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-black/70 text-ink backdrop-blur hover:bg-black" aria-label={`Remove ${label}`}>
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label htmlFor={inputId} className={cx('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-canvas px-6 text-center transition-colors hover:border-ink/25 hover:bg-raised', aspect)}>
          <span className="grid size-9 place-items-center rounded-lg bg-raised text-ink">
            <ImagePlus className="size-4" />
          </span>
          <span className="text-sm font-medium text-ink">Upload image</span>
          <span className="text-xs text-muted">{hint ?? 'PNG or JPG, up to 5 MB'}</span>
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            onChange(await fileToDataUrl(f));
          } catch (err) {
            onError?.((err as Error).message);
          }
        }}
      />
    </div>
  );
}
