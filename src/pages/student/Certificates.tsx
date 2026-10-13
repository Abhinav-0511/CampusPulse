import { Link } from 'react-router-dom';
import { Award, ExternalLink, Lock, Medal, Star } from 'lucide-react';
import { useApi } from '../../lib/api';
import type { Certificate } from '../../lib/types';
import { fmtDate } from '../../lib/format';
import { CertificateArt } from '../../components/Certificate';
import { Badge, EmptyState, LinkButton, PageHeader, PageLoader } from '../../components/ui';

export function CertificatesPage() {
  const certs = useApi<Certificate[]>('/api/my/certificates');
  const meta = useApi<{ collegeName: string }>('/api/meta');
  if (certs.loading) return <PageLoader />;
  const list = certs.data ?? [];

  // Group by event so a team leader sees each team's certificates together.
  const groups = new Map<string, Certificate[]>();
  for (const c of list) groups.set(c.event_id, [...(groups.get(c.event_id) ?? []), c]);

  return (
    <div className="animate-in">
      <PageHeader title="Certificates" subtitle="Team leaders receive certificates for every member. Anyone can verify them with the ID or QR code." />
      {list.length === 0 ? (
        <EmptyState icon={Award} title="No certificates yet" body="Certificates appear here after the organizing club issues them for an event you attended." action={<LinkButton to="/registrations">View my registrations</LinkButton>} />
      ) : (
        <div className="space-y-10">
          {[...groups.values()].map(items => (
            <section key={items[0].event_id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-ink">{items[0].event_title}</h2>
                  <p className="text-sm text-muted">
                    {items[0].club_name} · {fmtDate(items[0].event_date)}
                    {items[0].team_name && ` · Team ${items[0].team_name}`}
                  </p>
                </div>
                {items[0].award && (
                  <Badge tone="warn" className="px-3 py-1 text-xs">
                    <Medal className="size-3.5" /> {items[0].award}
                  </Badge>
                )}
              </div>
              {items[0].locked ? (
                <div className="flex flex-wrap items-center gap-4 rounded-card border border-accent2/30 bg-accent2/5 p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent2/15 text-accent2">
                    <Lock className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {items.length} certificate{items.length === 1 ? '' : 's'} waiting
                    </p>
                    <p className="text-sm text-muted">Share quick feedback on the event to unlock and download them.</p>
                  </div>
                  <LinkButton to={`/feedback/${items[0].event_id}`} variant="primary" icon={Star}>
                    Give feedback
                  </LinkButton>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(c => (
                  <Link key={c.id} to={`/certificate/${c.id}`} className="group overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-ink/20">
                    <div className="pointer-events-none">
                      <CertificateArt cert={c} collegeName={meta.data?.collegeName ?? ''} />
                    </div>
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{c.recipient_name}</p>
                        <p className="font-mono text-xs text-muted">{c.id}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
                        Open <ExternalLink className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
