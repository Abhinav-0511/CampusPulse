import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Printer, SearchX, ShieldCheck } from 'lucide-react';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Certificate } from '../lib/types';
import { fmtDate } from '../lib/format';
import { CertificateArt } from '../components/Certificate';
import { Brand } from '../components/Layout';
import { Button, EmptyState, Input, PageLoader } from '../components/ui';

/** Public: shows a certificate with its verification status. Also the print view. */
export function CertificatePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const cert = useApi<Certificate>(`/api/certificates/${id}`);
  const meta = useApi<{ collegeName: string }>('/api/meta');

  if (cert.loading || meta.loading) return <PageLoader />;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="no-print flex items-center justify-between border-b border-line/60 px-4 py-3 sm:px-8">
        <Brand />
        {user ? (
          <Link to="/certificates" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> My certificates
          </Link>
        ) : (
          <Link to="/verify" className="text-sm text-muted hover:text-ink">
            Verify another
          </Link>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        {!cert.data ? (
          <EmptyState icon={SearchX} title="Certificate not found" body="No certificate exists with this ID. Check the ID printed at the bottom of the certificate." action={<Link to="/verify" className="text-sm text-accent">Try another ID</Link>} />
        ) : (
          <>
            <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-3">
                <BadgeCheck className="size-6 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-semibold text-ink">Verified certificate</p>
                  <p className="text-xs text-muted">
                    Issued to {cert.data.recipient_name} by {cert.data.club_name} for {cert.data.event_title} ({fmtDate(cert.data.event_date)}).
                  </p>
                </div>
              </div>
              <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                Download / Print PDF
              </Button>
            </div>
            <div className="print-area overflow-hidden rounded-card shadow-2xl shadow-black/60">
              <CertificateArt cert={cert.data} collegeName={meta.data?.collegeName ?? ''} />
            </div>
            <p className="no-print mt-4 text-center text-xs text-muted">Tip: in the print dialog choose "Save as PDF", landscape, with margins set to none.</p>
          </>
        )}
      </main>
    </div>
  );
}

export function VerifyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) navigate(`/certificate/${encodeURIComponent(code.trim().toUpperCase())}`);
  };
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center border-b border-line/60 px-4 py-3 sm:px-8">
        <Brand />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Verify a certificate</h1>
        <p className="mt-2 text-sm text-muted">Enter the certificate ID printed below the QR code, or scan the QR with your phone camera.</p>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="CERT-XXXX-XXXX" className="font-mono uppercase" />
          <Button type="submit" variant="primary">
            Verify
          </Button>
        </form>
      </main>
    </div>
  );
}
