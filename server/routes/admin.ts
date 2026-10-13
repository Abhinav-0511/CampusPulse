import { Router } from 'express';
import crypto from 'node:crypto';
import { q, insert, newId, nowIso, randomCode, update, tx, getSetting, setSetting, localDate } from '../db';
import { hashPassword, passwordProblem, requireAuth } from '../auth';
import { clubAdminIds, notify } from '../services';
import { EVENT_SELECT, decorateEvent, fail, getEvent, str, wrap, type EventRow } from './shared';

export const adminRouter = Router();
adminRouter.use(requireAuth('admin'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function tempPassword() {
  return `Cp${crypto.randomBytes(4).toString('hex')}9`;
}

/* ---------------------------------------------------------------- overview */

adminRouter.get(
  '/overview',
  wrap((_req, res) => {
    const today = localDate();
    const stats = q.get<any>(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
        (SELECT COUNT(*) FROM clubs WHERE status = 'active') AS clubs,
        (SELECT COUNT(*) FROM events WHERE status = 'published' AND event_date >= ?) AS events_live,
        (SELECT COUNT(*) FROM events WHERE status = 'pending') AS events_pending,
        (SELECT COUNT(*) FROM registrations WHERE status IN ('pending','approved')) AS registrations,
        (SELECT COUNT(*) FROM registrations WHERE status = 'pending') AS payments_pending,
        (SELECT COALESCE(SUM(amount), 0) FROM registrations WHERE status = 'approved') AS revenue,
        (SELECT COUNT(*) FROM complaints WHERE status != 'resolved') AS complaints_open,
        (SELECT COUNT(*) FROM certificates) AS certificates,
        (SELECT COUNT(*) FROM users WHERE role = 'student' AND verification = 'pending') AS verifications_pending`,
      today,
    );
    const clubs = q.all(
      `SELECT c.id, c.name, c.short_name, c.color, c.status,
        (SELECT COUNT(*) FROM events e WHERE e.club_id = c.id) AS events,
        (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.club_id = c.id AND r.status = 'approved') AS teams,
        (SELECT COALESCE(SUM(r.amount), 0) FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.club_id = c.id AND r.status = 'approved') AS revenue
       FROM clubs c ORDER BY teams DESC`,
    );
    const pendingEvents = q.all<EventRow>(`${EVENT_SELECT} WHERE e.status = 'pending' ORDER BY e.created_at LIMIT 6`).map(decorateEvent);
    const complaints = q.all(
      `SELECT cp.id, cp.subject, cp.priority, cp.status, cp.created_at, c.name AS club_name FROM complaints cp JOIN clubs c ON c.id = cp.club_id
       WHERE cp.status != 'resolved' ORDER BY CASE cp.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, cp.created_at LIMIT 6`,
    );
    const signups = q.all<{ day: string; n: number }>(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM registrations WHERE created_at >= ? GROUP BY day ORDER BY day`,
      new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10),
    );
    res.json({ stats, clubs, pendingEvents, complaints, signups });
  }),
);

/* ------------------------------------------------------------------- clubs */

adminRouter.get(
  '/clubs',
  wrap((_req, res) => {
    const clubs = q.all<any>(
      `SELECT c.*,
        (SELECT COUNT(*) FROM events e WHERE e.club_id = c.id) AS events,
        (SELECT COUNT(*) FROM complaints cp WHERE cp.club_id = c.id AND cp.status != 'resolved') AS open_complaints
       FROM clubs c ORDER BY c.name`,
    );
    const admins = q.all<any>(`SELECT id, name, email, phone, club_id, status, last_login_at FROM users WHERE role = 'club_admin' ORDER BY name`);
    res.json(clubs.map(c => ({ ...c, admins: admins.filter(a => a.club_id === c.id) })));
  }),
);

function parseClub(b: any) {
  const kind = b.kind === 'department' ? 'department' : 'club';
  const color = typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#0A84FF';
  const contactEmail = str(b.contactEmail, 'Contact email', { max: 120, required: false }) || null;
  if (contactEmail && !EMAIL_RE.test(contactEmail)) fail(400, 'Contact email is invalid.');
  return {
    name: str(b.name, 'Club name', { max: 80 }),
    short_name: str(b.shortName, 'Short name', { max: 16 }),
    kind,
    description: str(b.description, 'Description', { max: 1000, required: false }),
    color,
    contact_email: contactEmail,
  };
}

function createStaff(b: any, role: 'club_admin' | 'admin', clubId: string | null) {
  const name = str(b.name, 'Admin name', { max: 80 });
  const email = str(b.email, 'Login email', { max: 120 }).toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Login email is invalid.');
  if (q.get('SELECT 1 FROM users WHERE email = ?', email)) fail(409, `${email} is already in use.`);
  const password = typeof b.password === 'string' && b.password ? b.password : tempPassword();
  const pwErr = passwordProblem(password);
  if (pwErr) fail(400, pwErr);
  const id = newId();
  insert('users', {
    id,
    role,
    name,
    email,
    phone: str(b.phone, 'Phone', { max: 20, required: false }) || null,
    password_hash: hashPassword(password),
    club_id: clubId,
    status: 'active',
    created_at: nowIso(),
  });
  return { id, email, password };
}

adminRouter.post(
  '/clubs',
  wrap((req, res) => {
    const b = req.body ?? {};
    const club = parseClub(b);
    if (q.get('SELECT 1 FROM clubs WHERE name = ?', club.name)) fail(409, 'A club with this name already exists.');
    const id = newId();
    // Club and its first admin are created together so a club never exists without someone to run it.
    const credentials = tx(() => {
      insert('clubs', { id, ...club, status: 'active', created_at: nowIso() });
      const staff = createStaff(b.admin ?? {}, 'club_admin', id);
      return { email: staff.email, password: staff.password };
    });
    res.status(201).json({ club: q.get('SELECT * FROM clubs WHERE id = ?', id), credentials });
  }),
);

adminRouter.put(
  '/clubs/:id',
  wrap((req, res) => {
    const existing = q.get('SELECT id FROM clubs WHERE id = ?', req.params.id);
    if (!existing) fail(404, 'Club not found.');
    const club = parseClub(req.body ?? {});
    if (q.get('SELECT 1 FROM clubs WHERE name = ? AND id != ?', club.name, req.params.id)) fail(409, 'A club with this name already exists.');
    update('clubs', req.params.id, club);
    res.json(q.get('SELECT * FROM clubs WHERE id = ?', req.params.id));
  }),
);

adminRouter.post(
  '/clubs/:id/status',
  wrap((req, res) => {
    const status = req.body?.status === 'inactive' ? 'inactive' : 'active';
    update('clubs', req.params.id, { status });
    notify(clubAdminIds(req.params.id), {
      kind: 'announcement',
      title: status === 'active' ? 'Your club has been reactivated' : 'Your club has been deactivated',
      body: status === 'active' ? 'You can create and manage events again.' : 'Contact the portal admin for details. Your events are hidden from students meanwhile.',
    });
    res.json({ ok: true, status });
  }),
);

adminRouter.post(
  '/clubs/:id/admins',
  wrap((req, res) => {
    if (!q.get('SELECT 1 FROM clubs WHERE id = ?', req.params.id)) fail(404, 'Club not found.');
    const staff = createStaff(req.body ?? {}, 'club_admin', req.params.id);
    res.status(201).json({ credentials: { email: staff.email, password: staff.password } });
  }),
);

/* ------------------------------------------------------------------- users */

adminRouter.get(
  '/users',
  wrap((req, res) => {
    const { role, search } = req.query as Record<string, string | undefined>;
    const where: string[] = ['1 = 1'];
    const params: string[] = [];
    if (role) {
      where.push('u.role = ?');
      params.push(role);
    }
    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      where.push('(u.name LIKE ? OR u.email LIKE ? OR u.unique_code LIKE ? OR u.register_number LIKE ? OR u.college_name LIKE ?)');
      params.push(like, like, like, like, like);
    }
    const rows = q.all(
      `SELECT u.id, u.role, u.name, u.email, u.phone, u.unique_code, u.register_number, u.college_name, u.department, u.year_of_study, u.student_type,
         u.status, u.created_at, u.last_login_at, c.name AS club_name,
         (SELECT COUNT(*) FROM team_members tm JOIN registrations r ON r.id = tm.registration_id WHERE tm.user_id = u.id AND r.status = 'approved') AS events_joined
       FROM users u LEFT JOIN clubs c ON c.id = u.club_id
       WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT 300`,
      ...params,
    );
    res.json(rows);
  }),
);

adminRouter.post(
  '/users',
  wrap((req, res) => {
    const role = req.body?.role === 'admin' ? 'admin' : 'club_admin';
    const clubId = role === 'club_admin' ? str(req.body?.clubId, 'Club', { max: 64 }) : null;
    if (clubId && !q.get('SELECT 1 FROM clubs WHERE id = ?', clubId)) fail(400, 'Club not found.');
    const staff = createStaff(req.body ?? {}, role, clubId);
    res.status(201).json({ credentials: { email: staff.email, password: staff.password } });
  }),
);

adminRouter.post(
  '/users/:id/status',
  wrap((req, res) => {
    if (req.params.id === req.user!.id) fail(400, 'You cannot suspend your own account.');
    const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
    update('users', req.params.id, { status });
    if (status === 'suspended') q.run('DELETE FROM sessions WHERE user_id = ?', req.params.id);
    res.json({ ok: true, status });
  }),
);

adminRouter.post(
  '/users/:id/reset-password',
  wrap((req, res) => {
    const user = q.get<{ email: string }>('SELECT email FROM users WHERE id = ?', req.params.id);
    if (!user) fail(404, 'User not found.');
    const password = tempPassword();
    q.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), req.params.id);
    q.run('DELETE FROM sessions WHERE user_id = ?', req.params.id);
    res.json({ credentials: { email: user.email, password } });
  }),
);

/* ------------------------------------------------- student ID verification */

adminRouter.get(
  '/verifications',
  wrap((req, res) => {
    const status = ['pending', 'rejected', 'verified'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
    const rows = q.all(
      `SELECT id, name, email, phone, register_number, college_name, department, year_of_study, id_card_url, verification, verification_note, unique_code, created_at
       FROM users WHERE role = 'student' AND student_type = 'external' AND verification = ? AND id_card_url IS NOT NULL
       ORDER BY created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`,
      status,
    );
    const counts = q.get<any>(
      `SELECT SUM(verification = 'pending') AS pending, SUM(verification = 'rejected') AS rejected, SUM(verification = 'verified' AND id_card_url IS NOT NULL) AS verified
       FROM users WHERE role = 'student' AND student_type = 'external'`,
    );
    res.json({ items: rows, counts: { pending: counts?.pending ?? 0, rejected: counts?.rejected ?? 0, verified: counts?.verified ?? 0 } });
  }),
);

adminRouter.post(
  '/verifications/:id',
  wrap((req, res) => {
    const u = q.get<any>(`SELECT * FROM users WHERE id = ? AND role = 'student'`, req.params.id);
    if (!u) fail(404, 'Student not found.');
    const action = req.body?.action;
    if (action === 'approve') {
      if (u.verification === 'verified') fail(400, 'Already verified.');
      let code: string;
      do code = `CP-${randomCode(6)}`;
      while (q.get('SELECT 1 FROM users WHERE unique_code = ?', code));
      update('users', u.id, { verification: 'verified', verification_note: null, unique_code: code });
      notify(u.id, {
        kind: 'approval',
        title: 'Your account is verified',
        body: `Welcome to CampusPulse! Your CampusPulse ID is ${code}. Share it with your team leader so they can add you to a team in one step.`,
        link: '/profile',
        email: true,
      });
    } else if (action === 'reject') {
      const note = str(req.body?.note, 'Reason', { max: 300 });
      update('users', u.id, { verification: 'rejected', verification_note: note });
      notify(u.id, { kind: 'rejection', title: 'ID card not accepted', body: `Reason: ${note}. Please upload a clearer photo of your college ID card.`, email: true });
    } else {
      fail(400, 'Unknown action.');
    }
    res.json(q.get('SELECT id, verification, verification_note, unique_code FROM users WHERE id = ?', u.id));
  }),
);

/* ------------------------------------------------------------------ events */

adminRouter.get(
  '/events',
  wrap((req, res) => {
    const status = req.query.status as string | undefined;
    const rows = status
      ? q.all<EventRow>(`${EVENT_SELECT} WHERE e.status = ? ORDER BY e.event_date`, status)
      : q.all<EventRow>(`${EVENT_SELECT} ORDER BY e.event_date DESC`);
    res.json(rows.map(decorateEvent));
  }),
);

adminRouter.post(
  '/events/:id/review',
  wrap((req, res) => {
    const event = getEvent(req.params.id);
    if (!event) fail(404, 'Event not found.');
    const action = req.body?.action;
    const note = str(req.body?.note, 'Note', { max: 500, required: action === 'reject' });
    if (action === 'approve') {
      if (event.status !== 'pending') fail(400, 'Only pending events can be approved.');
      update('events', event.id, { status: 'published', admin_note: note || null, updated_at: nowIso() });
      notify(clubAdminIds(event.club_id), {
        kind: 'event',
        title: `Approved: ${event.title}`,
        body: `Your event is now live for students.${note ? ` Note from admin: ${note}` : ''}`,
        link: `/club/events/${event.id}`,
      });
    } else if (action === 'reject') {
      if (event.status !== 'pending') fail(400, 'Only pending events can be rejected.');
      update('events', event.id, { status: 'rejected', admin_note: note, updated_at: nowIso() });
      notify(clubAdminIds(event.club_id), {
        kind: 'event',
        title: `Changes requested: ${event.title}`,
        body: `${note} Edit the event and save to resubmit it.`,
        link: `/club/events/${event.id}/edit`,
      });
    } else if (action === 'unpublish') {
      if (event.status !== 'published') fail(400, 'Only published events can be unpublished.');
      update('events', event.id, { status: 'pending', admin_note: note || 'Unpublished by admin for review.', updated_at: nowIso() });
      notify(clubAdminIds(event.club_id), {
        kind: 'event',
        title: `Unpublished: ${event.title}`,
        body: note || 'The portal admin took this event offline for review.',
        link: `/club/events/${event.id}`,
      });
    } else {
      fail(400, 'Unknown action.');
    }
    res.json(getEvent(event.id));
  }),
);

adminRouter.post(
  '/events/:id/feature',
  wrap((req, res) => {
    if (!getEvent(req.params.id)) fail(404, 'Event not found.');
    update('events', req.params.id, { featured: req.body?.featured ? 1 : 0 });
    res.json(getEvent(req.params.id));
  }),
);

/* -------------------------------------------------------------- complaints */

adminRouter.get(
  '/complaints',
  wrap((_req, res) => {
    res.json(
      q.all(
        `SELECT cp.*, c.name AS club_name, c.color AS club_color, u.name AS raised_by_name, u.email AS raised_by_email
         FROM complaints cp JOIN clubs c ON c.id = cp.club_id JOIN users u ON u.id = cp.raised_by
         ORDER BY CASE cp.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                  CASE cp.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, cp.created_at DESC`,
      ),
    );
  }),
);

adminRouter.post(
  '/complaints/:id',
  wrap((req, res) => {
    const cp = q.get<any>('SELECT * FROM complaints WHERE id = ?', req.params.id);
    if (!cp) fail(404, 'Complaint not found.');
    const status = ['open', 'in_progress', 'resolved'].includes(req.body?.status) ? req.body.status : cp.status;
    const reply = str(req.body?.reply, 'Reply', { max: 2000, required: false }) || cp.admin_reply;
    update('complaints', cp.id, { status, admin_reply: reply, updated_at: nowIso() });
    notify(cp.raised_by, {
      kind: 'complaint',
      title: `Complaint ${status === 'resolved' ? 'resolved' : 'updated'}: ${cp.subject}`,
      body: reply ? `Admin replied: ${reply}` : `Status changed to ${status.replace('_', ' ')}.`,
      link: '/club/support',
    });
    res.json(q.get('SELECT * FROM complaints WHERE id = ?', cp.id));
  }),
);

/* ---------------------------------------------------------------- settings */

adminRouter.get('/settings', (_req, res) => {
  res.json({ requireEventApproval: getSetting('require_event_approval', 'true') === 'true' });
});

adminRouter.put(
  '/settings',
  wrap((req, res) => {
    setSetting('require_event_approval', req.body?.requireEventApproval ? 'true' : 'false');
    res.json({ requireEventApproval: getSetting('require_event_approval', 'true') === 'true' });
  }),
);

adminRouter.post(
  '/announce',
  wrap((req, res) => {
    const title = str(req.body?.title, 'Title', { max: 120 });
    const message = str(req.body?.message, 'Message', { max: 1000 });
    const audience = req.body?.audience;
    const roles = audience === 'club_admins' ? ['club_admin'] : audience === 'all' ? ['student', 'club_admin'] : ['student'];
    const ids = q
      .all<{ id: string }>(`SELECT id FROM users WHERE status = 'active' AND role IN (${roles.map(() => '?').join(',')})`, ...roles)
      .map(r => r.id);
    notify(ids, { kind: 'announcement', title, body: message });
    res.json({ sent: ids.length });
  }),
);
