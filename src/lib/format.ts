const parseDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
};

export const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
  parseDate(d).toLocaleDateString('en-IN', opts);

export const fmtDateShort = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' });

export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const fmtDateTimeLocal = (dt: string) => {
  const [d, t] = dt.split('T');
  return `${fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}, ${fmtTime(t)}`;
};

export const fmtTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const fmtMoney = (n: number) => (n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}`);

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Milliseconds until a local date + "HH:MM". */
export const msUntil = (date: string, time = '00:00') => {
  const [h, m] = time.split(':').map(Number);
  const d = parseDate(date);
  d.setHours(h, m);
  return d.getTime() - Date.now();
};

export function countdown(ms: number) {
  if (ms <= 0) return 'Started';
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const daysUntil = (date: string) => Math.round((parseDate(date).getTime() - parseDate(todayStr()).getTime()) / 864e5);

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const teamSizeLabel = (min: number, max: number) =>
  max === 1 ? 'Individual' : min === max ? `Team of ${min}` : `Team of ${min} to ${max}`;

export const initials = (name: string) =>
  name
    .replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

export function upiLink(upiId: string, payee: string | null, amount: number, note: string) {
  const p = new URLSearchParams({ pa: upiId, pn: payee || upiId, am: String(amount), cu: 'INR', tn: note.slice(0, 50) });
  return `upi://pay?${p.toString()}`;
}
