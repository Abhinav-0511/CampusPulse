import type { Certificate } from '../lib/types';
import { fmtDate } from '../lib/format';
import { QrImage } from './EventBits';

/**
 * A4-landscape certificate. Sizes use container query units (cqw) so the same
 * markup scales from a phone preview to a full printed page.
 */
export function CertificateArt({ cert, collegeName }: { cert: Certificate; collegeName: string }) {
  const verifyUrl = `${window.location.origin}/certificate/${cert.id}`;
  const merit = !!cert.award;
  const gold = '#A87B2A';
  return (
    <div className="w-full" style={{ containerType: 'inline-size' }}>
      <div className="relative w-full overflow-hidden text-[#1d1d1f]" style={{ aspectRatio: '297 / 210', background: '#FBF8F1', fontSize: '1.6cqw' }}>
        <div className="absolute" style={{ inset: '2.2cqw', border: `0.25cqw solid ${merit ? gold : '#1d1d1f'}` }} />
        <div className="absolute" style={{ inset: '2.9cqw', border: `0.08cqw solid ${merit ? gold : '#1d1d1f'}55` }} />
        <div className="absolute left-0 top-0 h-full" style={{ width: '1.1cqw', background: cert.club_color }} />

        <div className="absolute flex flex-col items-center text-center" style={{ inset: '4.4cqw 9cqw 5cqw' }}>
          <img src="/college-seal-print.png" alt="" style={{ height: '6.4cqw', width: 'auto', marginBottom: '0.9cqw', objectFit: 'contain' }} />
          <p style={{ fontSize: '1.25cqw', letterSpacing: '0.35em', fontWeight: 600 }} className="uppercase text-[#55555a]">
            {collegeName}
          </p>
          <p style={{ fontSize: '1.15cqw', marginTop: '0.6cqw' }} className="text-[#6e6e73]">
            {cert.club_name}
          </p>

          <h1 className="font-serif" style={{ fontSize: '4.4cqw', fontWeight: 600, marginTop: '1.8cqw', lineHeight: 1.05, color: merit ? gold : '#1d1d1f' }}>
            Certificate of {merit ? 'Achievement' : 'Participation'}
          </h1>
          <p style={{ fontSize: '1.4cqw', marginTop: '2.4cqw', letterSpacing: '0.12em' }} className="uppercase text-[#6e6e73]">
            This is to certify that
          </p>
          <p className="font-serif" style={{ fontSize: '4.6cqw', fontWeight: 500, marginTop: '1.4cqw', lineHeight: 1.1 }}>
            {cert.recipient_name}
          </p>
          <div style={{ width: '32cqw', height: '0.1cqw', background: '#1d1d1f33', marginTop: '1.2cqw' }} />
          <p style={{ fontSize: '1.35cqw', marginTop: '1cqw' }} className="text-[#55555a]">
            {cert.register_number} · {cert.college_name}
          </p>
          <p style={{ fontSize: '1.65cqw', marginTop: '2cqw', lineHeight: 1.6, maxWidth: '62cqw' }}>
            {merit ? (
              <>
                has been awarded <strong style={{ color: gold }}>{cert.award}</strong> in{' '}
              </>
            ) : (
              'has successfully participated in '
            )}
            <strong>{cert.event_title}</strong>
            {cert.team_name ? <> as a member of team <strong>{cert.team_name}</strong></> : null}, organised by {cert.club_name} on {fmtDate(cert.event_date, { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>

          <div className="mt-auto flex w-full items-end justify-between">
            <div className="text-left" style={{ width: '22cqw' }}>
              <div style={{ height: '0.1cqw', background: '#1d1d1f88' }} />
              <p style={{ fontSize: '1.2cqw', marginTop: '0.7cqw', fontWeight: 600 }}>Event Coordinator</p>
              <p style={{ fontSize: '1.05cqw' }} className="text-[#6e6e73]">
                {cert.club_name}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div style={{ width: '7.5cqw', padding: '0.4cqw', background: '#fff', border: '0.08cqw solid #1d1d1f22' }}>
                <QrImage value={verifyUrl} size={120} className="h-auto w-full rounded-none" />
              </div>
              <p className="font-mono" style={{ fontSize: '0.95cqw', marginTop: '0.6cqw' }}>
                {cert.id}
              </p>
              <p style={{ fontSize: '0.85cqw' }} className="text-[#6e6e73]">
                Scan to verify
              </p>
            </div>
            <div className="text-right" style={{ width: '22cqw' }}>
              <div style={{ height: '0.1cqw', background: '#1d1d1f88' }} />
              <p style={{ fontSize: '1.2cqw', marginTop: '0.7cqw', fontWeight: 600 }}>Head of Institution</p>
              <p style={{ fontSize: '1.05cqw' }} className="text-[#6e6e73]">
                {collegeName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
