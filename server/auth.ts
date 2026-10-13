import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { q, nowIso } from './db';

export type Role = 'admin' | 'club_admin' | 'student';

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  unique_code: string | null;
  register_number: string | null;
  college_name: string | null;
  department: string | null;
  year_of_study: string | null;
  student_type: 'internal' | 'external';
  verification: 'verified' | 'pending' | 'rejected';
  verification_note: string | null;
  id_card_url: string | null;
  club_id: string | null;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const COOKIE = 'cp_session';
const SESSION_DAYS = 7;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain letters and numbers.';
  return null;
}

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSession(res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  q.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, userId, nowIso(), expires.toISOString());
  q.run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), userId);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!res.req?.secure,
    expires,
    path: '/',
  });
}

export function destroySession(req: Request, res: Response) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.run('DELETE FROM sessions WHERE token = ?', token);
  res.clearCookie(COOKIE, { path: '/' });
}

const USER_COLUMNS = `u.id, u.role, u.name, u.email, u.phone, u.unique_code, u.register_number, u.college_name,
  u.department, u.year_of_study, u.student_type, u.verification, u.verification_note, u.id_card_url, u.club_id, u.status`;

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const user = q.get<SessionUser>(
      `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
      token,
      nowIso(),
    );
    if (user && user.status === 'active') req.user = user;
  }
  next();
}

/** Signed in, even if still awaiting ID verification (only the verification-status endpoints use this). */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

export function requireAuth(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (req.user.verification !== 'verified') return res.status(403).json({ error: 'Your account is waiting for ID card verification by the admin.' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this action.' });
    }
    next();
  };
}

/** Club admins must be attached to an active club to act on it. */
export function requireClub(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.club_id) return res.status(403).json({ error: 'Your account is not linked to a club.' });
  const club = q.get<{ status: string }>('SELECT status FROM clubs WHERE id = ?', req.user.club_id);
  if (!club || club.status !== 'active') return res.status(403).json({ error: 'Your club is currently deactivated. Contact the portal admin.' });
  next();
}

// Simple fixed-window limiter for login/register to slow down credential stuffing.
const attempts = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}
