import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { UPLOAD_DIR, q, insert, newId, nowIso } from './db';

/* ------------------------------------------------------------------ uploads */

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Accepts a `data:image/...;base64,` URL from the browser and stores it under
 * data/uploads with an unguessable name. Existing `/uploads/...` or http(s)
 * URLs are passed through so edit forms can resubmit unchanged images.
 */
export function saveImage(input: unknown, prefix: string): string | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input !== 'string') throw new HttpError(400, 'Invalid image upload.');
  if (input.startsWith('/uploads/') || /^https?:\/\//.test(input)) return input;
  const m = input.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) throw new HttpError(400, 'Images must be PNG, JPG, WEBP or GIF.');
  const ext = MIME_EXT[m[1]];
  if (!ext) throw new HttpError(400, 'Images must be PNG, JPG, WEBP or GIF.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_UPLOAD_BYTES) throw new HttpError(400, 'Images must be 5 MB or smaller.');
  const name = `${prefix}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** Same as saveImage, for PDF uploads (OD templates). */
export function savePdf(input: unknown, prefix: string): string | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input !== 'string') throw new HttpError(400, 'Invalid PDF upload.');
  if (input.startsWith('/uploads/')) return input;
  const m = input.match(/^data:application\/pdf;base64,(.+)$/);
  if (!m) throw new HttpError(400, 'The template must be a PDF file.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_UPLOAD_BYTES) throw new HttpError(400, 'PDF templates must be 5 MB or smaller.');
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'That file is not a valid PDF.');
  const name = `${prefix}-${crypto.randomBytes(12).toString('hex')}.pdf`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/* ------------------------------------------------------------ check-in QR */

const QR_SECRET = process.env.QR_SECRET || 'campuspulse-local-qr-secret';

/** QR payload: CP1.<registration code>.<hmac>. The HMAC stops anyone forging a ticket from a guessed code. */
export function ticketPayload(code: string) {
  const sig = crypto.createHmac('sha256', QR_SECRET).update(code).digest('base64url').slice(0, 16);
  return `CP1.${code}.${sig}`;
}

/** Returns the registration code if the payload is genuine, or the raw code if staff typed it manually. */
export function parseTicket(input: string): { code: string; signed: boolean } | null {
  const text = input.trim();
  const m = text.match(/^CP1\.([A-Z0-9-]+)\.([A-Za-z0-9_-]+)$/);
  if (m) {
    return ticketPayload(m[1]) === text ? { code: m[1], signed: true } : null;
  }
  if (/^REG-[A-Z0-9]{6}$/i.test(text)) return { code: text.toUpperCase(), signed: false };
  return null;
}

/* ----------------------------------------------------------- notifications */

let transporter: nodemailer.Transporter | null = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export interface NotifyInput {
  kind: 'registration' | 'approval' | 'rejection' | 'reminder' | 'certificate' | 'event' | 'complaint' | 'announcement' | 'payment';
  title: string;
  body: string;
  link?: string;
  actionUrl?: string;
  actionLabel?: string;
  email?: boolean;
}

export function notify(userIds: string | string[], n: NotifyInput) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
  const created = nowIso();
  for (const userId of ids) {
    insert('notifications', {
      id: newId(),
      user_id: userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      action_url: n.actionUrl,
      action_label: n.actionLabel,
      created_at: created,
    });
  }
  if (n.email && transporter && ids.length) {
    const rows = q.all<{ email: string }>(`SELECT email FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const action = n.actionUrl ? `<p><a href="${esc(n.actionUrl)}">${esc(n.actionLabel || 'Open link')}</a></p>` : '';
    const open = n.link ? `<p><a href="${esc(appUrl + n.link)}">Open in CampusPulse</a></p>` : '';
    for (const { email } of rows) {
      transporter
        .sendMail({
          from: process.env.SMTP_FROM || 'CampusPulse <no-reply@campuspulse.local>',
          to: email,
          subject: n.title,
          text: `${n.body}${n.actionUrl ? `\n\n${n.actionLabel || 'Link'}: ${n.actionUrl}` : ''}`,
          html: `<p>${esc(n.body)}</p>${action}${open}`,
        })
        .catch(err => console.warn('[mail] failed to send to', email, err.message));
    }
  }
}

export const mailEnabled = () => !!transporter;

/** All accounts that should hear about a registration: the leader plus teammates who linked their CampusPulse ID. */
export function registrationAudience(registrationId: string) {
  const reg = q.get<{ leader_id: string }>('SELECT leader_id FROM registrations WHERE id = ?', registrationId);
  const members = q.all<{ user_id: string }>('SELECT user_id FROM team_members WHERE registration_id = ? AND user_id IS NOT NULL', registrationId);
  return [...new Set([reg?.leader_id, ...members.map(m => m.user_id)].filter(Boolean) as string[])];
}

export function clubAdminIds(clubId: string) {
  return q.all<{ id: string }>(`SELECT id FROM users WHERE role = 'club_admin' AND club_id = ? AND status = 'active'`, clubId).map(r => r.id);
}

export function adminIds() {
  return q.all<{ id: string }>(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`).map(r => r.id);
}
