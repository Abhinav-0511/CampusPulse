import { useParams } from 'react-router-dom';
import { BadgeCheck, SearchX, ShieldX } from 'lucide-react';
import { useApi } from '../lib/api';
import { fmtTime, fmtTimestamp } from '../lib/format';
import { Brand } from '../components/Layout';
import { EmptyState, PageLoader, cx } from '../components/ui';

interface OdCheck {
  id: string;
  valid: boolean;
  name: string;
  register_number: string;
  department: string;
  year: string;
  event_title: string;
  event_date: string;
  time: string;
  venue: string;
  club_name: string;
  issued_at: string;
}

/** Public: opened by scanning the QR printed on an OD letter. */
export function OdVerifyPage() {
  const { id } = useParams();
  const { data, loading } = useApi<OdCheck>(`/api/od/${id}`);
  if (loading) return <PageLoader />;
  const [start, end] = data?.time.split('–') ?? [];
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center border-b border-line/60 px-4 py-3 sm:px-8">
        <Brand />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        {!data ? (
          <EmptyState icon={SearchX} title="OD letter not found" body="No OD letter exists with this number. It may be forged." />
        ) : (
          <div className="animate-in overflow-hidden rounded-card border border-line bg-surface">
            <div className={cx('flex items-center gap-3 p-5', data.valid ? 'bg-success/10' : 'bg-danger/10')}>
              {data.valid ? <BadgeCheck className="size-7 text-success" /> : <ShieldX className="size-7 text-danger" />}
              <div>
                <p className={cx('text-lg font-semibold', data.valid ? 'text-success' : 'text-danger')}>{data.valid ? 'Valid OD letter' : 'No longer valid'}</p>
                <p className="text-xs text-muted">
                  {data.valid ? 'Issued through CampusPulse by the organizing club.' : "The student's registration or the event was cancelled."}
                </p>
              </div>
            </div>
            <dl className="divide-y divide-line text-sm">
              {[
                ['OD number', data.id],
                ['Student', data.name],
                ['Register number', data.register_number],
                ['Department', `${data.department || '—'}${data.year ? ` · ${data.year}` : ''}`],
                ['Event', data.event_title],
                ['Date', data.event_date],
                ['Time', start && end ? `${fmtTime(start)} – ${fmtTime(end)}` : data.time],
                ['Venue', data.venue],
                ['Organized by', data.club_name],
                ['Issued', fmtTimestamp(data.issued_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
