import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Award, CheckCircle2, Star } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { Poster } from '../../components/EventBits';
import { Button, Card, EmptyState, ErrorNote, Field, LinkButton, PageLoader, Textarea, cx } from '../../components/ui';

interface Status {
  event: { id: string; title: string; club_name: string; club_color: string; event_date: string; poster_url: string | null };
  eligible: boolean;
  reason: string | null;
  mine: { rating: number; comment: string | null; created_at: string } | null;
}

const LABELS = ['', 'Poor', 'Below average', 'Good', 'Very good', 'Excellent'];

export function Stars({ value, onChange, size = 'size-9' }: { value: number; onChange?: (v: number) => void; size?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={cx('transition-transform', onChange && 'hover:scale-110')}
        >
          <Star className={cx(size, n <= shown ? 'fill-accent2 text-accent2' : 'text-line')} />
        </button>
      ))}
    </div>
  );
}

/** Opened by scanning the event's feedback QR. */
export function FeedbackPage() {
  const { eventId } = useParams();
  const { data, loading, error, setData } = useApi<Status>(`/api/feedback/${eventId}`);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState icon={AlertCircle} title="Event not found" body={error ?? undefined} />;
  const { event } = data;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await api<Status>(`/api/feedback/${event.id}`, { body: { rating, comment } }));
      window.scrollTo(0, 0);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-in mx-auto max-w-xl">
      <Card className="overflow-hidden">
        <div className="relative">
          <Poster src={event.poster_url} title={event.title} color={event.club_color} className="h-36 w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/85 to-surface/30" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Event feedback</p>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{event.title}</h1>
            <p className="text-sm text-muted">
              {event.club_name} · {fmtDate(event.event_date)}
            </p>
          </div>
        </div>

        <div className="p-6">
          {data.mine ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <p className="mt-3 text-lg font-semibold text-ink">Thanks for your feedback!</p>
              <div className="mt-3 flex justify-center">
                <Stars value={data.mine.rating} size="size-6" />
              </div>
              {data.mine.comment && <p className="mt-3 text-sm italic text-muted">"{data.mine.comment}"</p>}
              <p className="mt-5 text-sm text-muted">Your certificate for this event is unlocked once the club issues certificates.</p>
              <LinkButton to="/certificates" variant="primary" icon={Award} className="mt-5">
                Go to certificates
              </LinkButton>
            </div>
          ) : !data.eligible ? (
            <div className="flex items-start gap-3 rounded-xl bg-raised p-4 text-sm text-ink">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent2" />
              {data.reason}
            </div>
          ) : (
            <div className="grid gap-5">
              <div>
                <p className="text-sm font-medium text-ink">How was the event?</p>
                <div className="mt-3 flex items-center gap-4">
                  <Stars value={rating} onChange={setRating} />
                  <span className="text-sm text-muted">{LABELS[rating]}</span>
                </div>
              </div>
              <Field label="What did you like, and what should we improve?" hint="Optional. The organizing club reads every comment.">
                <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} maxLength={1000} />
              </Field>
              <ErrorNote>{err}</ErrorNote>
              <Button variant="primary" size="lg" loading={busy} disabled={!rating} onClick={submit}>
                Submit feedback
              </Button>
              <p className="text-center text-xs text-muted">Giving feedback unlocks your certificate for this event.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
