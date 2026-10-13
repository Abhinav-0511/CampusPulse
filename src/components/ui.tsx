import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, ChevronLeft, Copy, Loader2, X, type LucideIcon } from 'lucide-react';
import { initials } from '../lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/90 disabled:bg-accent/40',
  secondary: 'border border-line bg-raised text-ink hover:border-ink/25 disabled:text-muted',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
  success: 'bg-success text-black hover:bg-success/90',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-2xl',
};

export const btnClass = (variant: Variant = 'secondary', size: Size = 'md', extra?: string) =>
  cx('inline-flex shrink-0 items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed', variants[variant], sizes[size], extra);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon: Icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={btnClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
});

export function LinkButton({ to, variant = 'secondary', size = 'md', icon: Icon, className, children }: { to: string; variant?: Variant; size?: Size; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={btnClass(variant, size, className)}>
      {Icon && <Icon className="size-4" />}
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ layout */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-card border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <IconTile icon={Icon} />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function IconTile({ icon: Icon, tone = 'default', className }: { icon: LucideIcon; tone?: 'default' | 'accent' | 'warn' | 'success' | 'danger'; className?: string }) {
  const tones = {
    default: 'bg-raised text-ink',
    accent: 'bg-accent/15 text-accent',
    warn: 'bg-accent2/15 text-accent2',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
  };
  return (
    <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', tones[tone], className)}>
      <Icon className="size-4" />
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, back }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string | true }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <button
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
            className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:text-ink"
            aria-label="Back"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-medium uppercase tracking-wider text-muted">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('pt-10', className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: 'default' | 'accent' | 'warn' | 'success' | 'danger' }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <IconTile icon={Icon} tone={tone} />
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------------- forms */

export function Field({ label, hint, error, children, className, required }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx('grid gap-1.5', className)}>
      <span className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-accent2">*</span>}
      </span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputBase = 'w-full rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, 'h-11', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-24 py-2.5 leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2398989F%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[right_12px_center] bg-no-repeat pr-9', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3', className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors', checked ? 'border-accent bg-accent' : 'border-line bg-canvas')}
      >
        {checked && <Check className="size-3.5 text-white" strokeWidth={3} />}
      </button>
      <span className="text-sm leading-relaxed text-ink">{children}</span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-success' : 'bg-raised border border-line')}
      >
        <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------- feedback */

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending verification', cls: 'border-accent2/30 bg-accent2/10 text-accent2' },
  approved: { label: 'Confirmed', cls: 'border-success/30 bg-success/10 text-success' },
  rejected: { label: 'Payment rejected', cls: 'border-danger/30 bg-danger/10 text-danger' },
  cancelled: { label: 'Cancelled', cls: 'border-line bg-raised text-muted' },
  published: { label: 'Live', cls: 'border-success/30 bg-success/10 text-success' },
  completed: { label: 'Completed', cls: 'border-accent/30 bg-accent/10 text-accent' },
  open: { label: 'Open', cls: 'border-accent2/30 bg-accent2/10 text-accent2' },
  in_progress: { label: 'In progress', cls: 'border-accent/30 bg-accent/10 text-accent' },
  resolved: { label: 'Resolved', cls: 'border-success/30 bg-success/10 text-success' },
  active: { label: 'Active', cls: 'border-success/30 bg-success/10 text-success' },
  inactive: { label: 'Inactive', cls: 'border-line bg-raised text-muted' },
  suspended: { label: 'Suspended', cls: 'border-danger/30 bg-danger/10 text-danger' },
};

export function StatusPill({ status, label, kind }: { status: string; label?: string; kind?: 'event' }) {
  const s = STATUS_STYLES[status] ?? { label: status, cls: 'border-line bg-raised text-muted' };
  const text = label ?? (kind === 'event' && status === 'pending' ? 'Awaiting approval' : kind === 'event' && status === 'rejected' ? 'Changes requested' : s.label);
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', s.cls)}>
      <span className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'warn' | 'success' | 'danger'; className?: string }) {
  const tones = {
    default: 'bg-raised text-ink border-line',
    accent: 'bg-accent/10 text-accent border-accent/25',
    warn: 'bg-accent2/10 text-accent2 border-accent2/25',
    success: 'bg-success/10 text-success border-success/25',
    danger: 'bg-danger/10 text-danger border-danger/25',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-muted', className)} />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="size-6" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-14 text-center">
      <IconTile icon={Icon} className="size-11 rounded-xl" />
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ClubAvatar({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'size-6 text-[10px] rounded-md', md: 'size-9 text-xs rounded-lg', lg: 'size-14 text-lg rounded-2xl' }[size];
  return (
    <span className={cx('grid shrink-0 place-items-center font-bold', s)} style={{ background: `${color}26`, color }}>
      {initials(name)}
    </span>
  );
}

export function CopyButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={cx('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-ink', className)}
      aria-label={`Copy ${label ?? text}`}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {label && <span>{done ? 'Copied' : label}</span>}
    </button>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-card border border-line bg-surface p-1', className)}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx('flex items-center gap-2 whitespace-nowrap rounded-[0.9rem] px-4 py-2 text-sm font-medium transition-colors', value === t.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink')}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums', value === t.id ? 'bg-canvas text-ink' : 'bg-raised text-muted')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'warn' | 'success' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = { accent: 'bg-accent', warn: 'bg-accent2', success: 'bg-success' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('animate-pop flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-card border border-line bg-surface sm:rounded-card', w)} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ toasts */

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map(t => (
          <div key={t.id} className="animate-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-ink shadow-2xl shadow-black/60">
            {t.tone === 'success' ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertCircle className="size-4 shrink-0 text-danger" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
