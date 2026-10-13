import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { q, localDate, localDateTime } from '../db';
import { HttpError } from '../services';
import type { SessionUser } from '../auth';

export const EVENT_CATEGORIES = ['Hackathon', 'Workshop', 'Technical', 'Cultural', 'Sports', 'Symposium', 'Seminar', 'Competition', 'Gaming', 'Other'];

/** Wraps async handlers so thrown HttpErrors become JSON responses. */
export const wrap =
  (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

export function str(v: unknown, field: string, opts: { max?: number; required?: boolean } = {}): string {
  const { max = 500, required = true } = opts;
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  if (required && !s) fail(400, `${field} is required.`);
  if (s.length > max) fail(400, `${field} must be at most ${max} characters.`);
  return s;
}

export function int(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, `${field} must be a whole number between ${min} and ${max}.`);
  return n;
}

export const EVENT_SELECT = `
  SELECT e.*, c.name AS club_name, c.short_name AS club_short_name, c.color AS club_color, c.kind AS club_kind,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('pending','approved')) AS teams_count,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS pending_count,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL) AS checked_in_count
  FROM events e JOIN clubs c ON c.id = e.club_id`;

export interface EventRow {
  id: string;
  club_id: string;
  title: string;
  status: string;
  event_date: string;
  start_time: string;
  reg_deadline: string;
  reg_open: number;
  max_teams: number;
  teams_count: number;
  fee: number;
  team_min: number;
  team_max: number;
  whatsapp_link: string | null;
  [key: string]: any;
}

/** Adds derived fields the UI needs so every screen agrees on what "open" means. */
export function decorateEvent<T extends EventRow>(e: T) {
  const today = localDate();
  const now = localDateTime();
  const spots_left = Math.max(0, e.max_teams - e.teams_count);
  const is_past = e.event_date < today;
  let closed_reason: string | null = null;
  if (e.status === 'cancelled') closed_reason = 'Event cancelled';
  else if (e.status === 'completed' || is_past) closed_reason = 'Event has ended';
  else if (e.status !== 'published') closed_reason = 'Not yet published';
  else if (!e.reg_open) closed_reason = 'Registrations closed by organizer';
  else if (e.reg_deadline < now) closed_reason = 'Registration deadline passed';
  else if (spots_left === 0) closed_reason = 'All spots are filled';
  return { ...e, spots_left, is_past, registration_open: closed_reason === null, closed_reason };
}

export function getEvent(id: string) {
  const row = q.get<EventRow>(`${EVENT_SELECT} WHERE e.id = ?`, id);
  return row ? decorateEvent(row) : undefined;
}

/** Club admins may manage only their own club's events; portal admins may manage any. */
export function assertCanManage(user: SessionUser, clubId: string) {
  if (user.role === 'admin') return;
  if (user.role === 'club_admin' && user.club_id === clubId) return;
  fail(403, 'This event belongs to another club.');
}

export function membersOf(registrationId: string) {
  return q.all(
    `SELECT id, user_id, name, register_number, college_name, department, email, phone, is_leader, attended
     FROM team_members WHERE registration_id = ? ORDER BY position`,
    registrationId,
  );
}
