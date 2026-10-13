import { Router } from 'express';
import { q, insert, newId, nowIso, randomCode, update, studentTypeFor } from '../db';
import { createCaptcha, verifyCaptcha } from '../captcha';
import { createSession, destroySession, hashPassword, passwordProblem, rateLimit, requireAuth, requireSession, verifyPassword, type SessionUser } from '../auth';
import { adminIds, notify, saveImage } from '../services';
import { fail, str, wrap } from './shared';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s-]{8,15}$/;

function uniqueStudentCode() {
  for (;;) {
    const code = `CP-${randomCode(6)}`;
    if (!q.get('SELECT 1 FROM users WHERE unique_code = ?', code)) return code;
  }
}

function meResponse(user: SessionUser) {
  const club = user.club_id ? q.get('SELECT id, name, short_name, color, kind, status FROM clubs WHERE id = ?', user.club_id) : null;
  return { user, club };
}

authRouter.get('/captcha', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(createCaptcha());
});

authRouter.post(
  '/register',
  wrap((req, res) => {
    if (!rateLimit(`register:${req.ip}`, 10, 15 * 60_000)) fail(429, 'Too many sign-up attempts. Try again in a few minutes.');
    const b = req.body ?? {};
    if (!verifyCaptcha(b.captchaId, b.captchaAnswer)) fail(400, 'Captcha did not match. Please try the new one.');

    const name = str(b.name, 'Full name', { max: 80 });
    const email = str(b.email, 'Email', { max: 120 }).toLowerCase();
    const phone = str(b.phone, 'Phone number', { max: 20 });
    const registerNumber = str(b.registerNumber, 'Register number', { max: 30 }).toUpperCase();
    const collegeName = str(b.collegeName, 'College name', { max: 120 });
    const department = str(b.department, 'Department', { max: 80 });
    const yearOfStudy = str(b.yearOfStudy, 'Year of study', { max: 20 });
    const password = String(b.password ?? '');

    if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address.');
    if (!PHONE_RE.test(phone)) fail(400, 'Enter a valid phone number.');
    const pwErr = passwordProblem(password);
    if (pwErr) fail(400, pwErr);
    if (q.get('SELECT 1 FROM users WHERE email = ?', email)) fail(409, 'An account with this email already exists. Sign in instead.');
    if (q.get('SELECT 1 FROM users WHERE register_number = ? AND college_name = ? COLLATE NOCASE', registerNumber, collegeName)) {
      fail(409, 'This register number is already registered for your college.');
    }

    // External students prove they're real students with an ID card photo; the admin verifies it before
    // they get a CampusPulse ID. Internal (host college) students are verified immediately.
    const external = studentTypeFor(collegeName) === 'external';
    const idCardUrl = external ? saveImage(b.idCard, 'idcard') : null;
    if (external && !idCardUrl) fail(400, 'Upload a clear photo of your college ID card.');

    const id = newId();
    const uniqueCode = external ? null : uniqueStudentCode();
    insert('users', {
      id,
      role: 'student',
      name,
      email,
      phone,
      password_hash: hashPassword(password),
      unique_code: uniqueCode,
      register_number: registerNumber,
      college_name: collegeName,
      student_type: studentTypeFor(collegeName),
      verification: external ? 'pending' : 'verified',
      id_card_url: idCardUrl,
      department,
      year_of_study: yearOfStudy,
      status: 'active',
      created_at: nowIso(),
    });
    if (external) {
      notify(adminIds(), {
        kind: 'announcement',
        title: 'External student to verify',
        body: `${name} (${collegeName}) signed up and uploaded an ID card for verification.`,
        link: '/admin/verifications',
      });
    } else {
      notify(id, {
        kind: 'announcement',
        title: 'Welcome to CampusPulse',
        body: `Your CampusPulse ID is ${uniqueCode}. Share it with your team leader so they can add you to a team in one step.`,
        link: '/profile',
      });
    }
    createSession(res, id);
    const user = q.get<SessionUser>('SELECT * FROM users WHERE id = ?', id)!;
    delete (user as any).password_hash;
    res.status(201).json(meResponse(user));
  }),
);

authRouter.post(
  '/login',
  wrap((req, res) => {
    if (!rateLimit(`login:${req.ip}`, 20, 15 * 60_000)) fail(429, 'Too many sign-in attempts. Try again in a few minutes.');
    const b = req.body ?? {};
    if (!verifyCaptcha(b.captchaId, b.captchaAnswer)) fail(400, 'Captcha did not match. Please try the new one.');
    const identifier = str(b.identifier, 'Email or CampusPulse ID', { max: 120 });
    const password = String(b.password ?? '');

    const row = q.get<SessionUser & { password_hash: string }>(
      'SELECT * FROM users WHERE email = ? COLLATE NOCASE OR unique_code = ? COLLATE NOCASE',
      identifier,
      identifier,
    );
    if (!row || !verifyPassword(password, row.password_hash)) fail(401, 'Incorrect email/ID or password.');
    if (row.status !== 'active') fail(403, 'This account has been suspended. Contact the portal admin.');
    createSession(res, row.id);
    const { password_hash: _ph, ...user } = row;
    res.json(meResponse(user as SessionUser));
  }),
);

authRouter.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null, club: null });
  res.json(meResponse(req.user));
});

/* ------------------------------------------- external student verification */

authRouter.get('/verification', requireSession, (req, res) => {
  const u = req.user!;
  res.json({ verification: u.verification, verification_note: u.verification_note, id_card_url: u.id_card_url });
});

authRouter.post(
  '/verification',
  requireSession,
  wrap((req, res) => {
    const u = req.user!;
    if (u.verification === 'verified') fail(400, 'Your account is already verified.');
    const url = saveImage(req.body?.idCard, 'idcard');
    if (!url) fail(400, 'Upload a clear photo of your college ID card.');
    update('users', u.id, { id_card_url: url, verification: 'pending', verification_note: null });
    notify(adminIds(), {
      kind: 'announcement',
      title: 'ID card resubmitted',
      body: `${u.name} (${u.college_name}) uploaded a new ID card for verification.`,
      link: '/admin/verifications',
    });
    res.json({ verification: 'pending', verification_note: null, id_card_url: url });
  }),
);

authRouter.patch(
  '/me',
  requireAuth(),
  wrap((req, res) => {
    const b = req.body ?? {};
    const u = req.user!;
    const changes: Record<string, string> = {};
    if (b.name !== undefined) changes.name = str(b.name, 'Full name', { max: 80 });
    if (b.phone !== undefined) {
      changes.phone = str(b.phone, 'Phone number', { max: 20 });
      if (!PHONE_RE.test(changes.phone)) fail(400, 'Enter a valid phone number.');
    }
    if (u.role === 'student') {
      if (b.registerNumber !== undefined) changes.register_number = str(b.registerNumber, 'Register number', { max: 30 }).toUpperCase();
      if (b.collegeName !== undefined && str(b.collegeName, 'College name', { max: 120 }).toLowerCase() !== (u.college_name ?? '').toLowerCase()) {
        fail(400, 'Your college cannot be changed after sign-up. Contact the portal admin if it is wrong.');
      }
      if (b.department !== undefined) changes.department = str(b.department, 'Department', { max: 80 });
      if (b.yearOfStudy !== undefined) changes.year_of_study = str(b.yearOfStudy, 'Year of study', { max: 20 });
    }
    update('users', u.id, changes);
    const user = q.get<SessionUser>(
      'SELECT id, role, name, email, phone, unique_code, register_number, college_name, department, year_of_study, student_type, club_id, status FROM users WHERE id = ?',
      u.id,
    )!;
    res.json(meResponse(user));
  }),
);

authRouter.post(
  '/me/password',
  requireAuth(),
  wrap((req, res) => {
    const { current, next } = req.body ?? {};
    const row = q.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.user!.id)!;
    if (!verifyPassword(String(current ?? ''), row.password_hash)) fail(400, 'Current password is incorrect.');
    const pwErr = passwordProblem(String(next ?? ''));
    if (pwErr) fail(400, pwErr);
    q.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), req.user!.id);
    res.json({ ok: true });
  }),
);
