import { Router } from 'express';
import { q, insert, newId, nowIso, randomCode, tx, update, localDate, isHostCollege, COLLEGE_NAME } from '../db';
import { requireAuth } from '../auth';
import { clubAdminIds, notify, saveImage, ticketPayload } from '../services';
import { odDataFromRow, odRows, renderOdPdf, fmtLongDate } from '../od';
import { EVENT_SELECT, decorateEvent, fail, getEvent, membersOf, str, wrap, type EventRow } from './shared';

export const studentRouter = Router();

/** The WhatsApp group link is only for confirmed teams, so strip it everywhere else. */
function publicEvent(e: ReturnType<typeof decorateEvent>) {
  const { whatsapp_link: _w, ...rest } = e;
  return rest;
}

/* ----------------------------------------------------------- browse events */

studentRouter.get(
  '/events',
  requireAuth(),
  wrap((req, res) => {
    const { search, category, club, when = 'upcoming' } = req.query as Record<string, string | undefined>;
    const where: string[] = [`e.status IN ('published','completed')`, `c.status = 'active'`];
    const params: string[] = [];
    const today = localDate();
    if (when === 'upcoming') {
      where.push('e.event_date >= ?');
      params.push(today);
    } else if (when === 'past') {
      where.push('e.event_date < ?');
      params.push(today);
    }
    if (category) {
      where.push('e.category = ?');
      params.push(category);
    }
    if (club) {
      where.push('e.club_id = ?');
      params.push(club);
    }
    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      where.push('(e.title LIKE ? OR c.name LIKE ? OR c.short_name LIKE ? OR e.category LIKE ? OR e.venue LIKE ? OR e.tagline LIKE ?)');
      params.push(like, like, like, like, like, like);
    }
    const order = when === 'past' ? 'e.event_date DESC' : 'e.event_date ASC, e.start_time ASC';
    const rows = q.all<EventRow>(`${EVENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 200`, ...params);
    res.json(rows.map(r => publicEvent(decorateEvent(r))));
  }),
);

function myRegistrationFor(eventId: string, userId: string) {
  return q.get<any>(
    `SELECT r.* FROM registrations r
     WHERE r.event_id = ? AND r.status IN ('pending','approved','rejected')
       AND (r.leader_id = ? OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.registration_id = r.id AND tm.user_id = ?))
     ORDER BY r.created_at DESC LIMIT 1`,
    eventId,
    userId,
    userId,
  );
}

studentRouter.get(
  '/events/:id',
  requireAuth(),
  wrap((req, res) => {
    const event = getEvent(req.params.id);
    const user = req.user!;
    const manages = user.role === 'admin' || (user.role === 'club_admin' && user.club_id === event?.club_id);
    if (!event || (!['published', 'completed'].includes(event.status) && !manages)) fail(404, 'Event not found.');
    const mine = user.role === 'student' ? myRegistrationFor(event.id, user.id) : undefined;
    const showLink = manages || mine?.status === 'approved';
    res.json({
      event: showLink ? event : publicEvent(event),
      myRegistration: mine ? { ...mine, is_leader: mine.leader_id === user.id } : null,
    });
  }),
);

/* ------------------------------------------------------------------- clubs */

studentRouter.get(
  '/clubs',
  requireAuth(),
  wrap((_req, res) => {
    const today = localDate();
    const rows = q.all(
      `SELECT c.id, c.name, c.short_name, c.kind, c.description, c.color,
        (SELECT COUNT(*) FROM events e WHERE e.club_id = c.id AND e.status = 'published' AND e.event_date >= ?) AS upcoming_count,
        (SELECT COUNT(*) FROM events e WHERE e.club_id = c.id AND e.status IN ('published','completed')) AS event_count
       FROM clubs c WHERE c.status = 'active' ORDER BY c.name`,
      today,
    );
    res.json(rows);
  }),
);

studentRouter.get(
  '/clubs/:id',
  requireAuth(),
  wrap((req, res) => {
    const club = q.get(`SELECT id, name, short_name, kind, description, color, contact_email FROM clubs WHERE id = ? AND status = 'active'`, req.params.id);
    if (!club) fail(404, 'Club not found.');
    const events = q
      .all<EventRow>(`${EVENT_SELECT} WHERE e.club_id = ? AND e.status IN ('published','completed') ORDER BY e.event_date DESC`, req.params.id)
      .map(r => publicEvent(decorateEvent(r)));
    res.json({ club, events });
  }),
);

/* ------------------------------------------------------- team registration */

studentRouter.get(
  '/students/lookup',
  requireAuth('student'),
  wrap((req, res) => {
    const code = str(req.query.code, 'CampusPulse ID', { max: 20 }).toUpperCase();
    const s = q.get(
      `SELECT unique_code, name, register_number, college_name, department, student_type FROM users WHERE unique_code = ? AND role = 'student' AND status = 'active'`,
      code,
    );
    if (!s) fail(404, `No student found with ID ${code}.`);
    res.json(s);
  }),
);

interface MemberInput {
  uniqueCode?: string;
  name?: string;
  registerNumber?: string;
  collegeName?: string;
  department?: string;
  email?: string;
  phone?: string;
}

const TXN_RE = /^[A-Za-z0-9-]{6,40}$/;

function assertTransactionUnused(txn: string, exceptRegId?: string) {
  const dup = q.get(
    `SELECT 1 FROM registrations WHERE UPPER(transaction_id) = UPPER(?) AND id != ? AND status != 'rejected'`,
    txn,
    exceptRegId ?? '',
  );
  if (dup) fail(409, 'This transaction ID has already been used for another registration.');
}

studentRouter.post(
  '/events/:id/register',
  requireAuth('student'),
  wrap((req, res) => {
    const leader = req.user!;
    const b = req.body ?? {};
    const event = getEvent(req.params.id);
    if (!event || event.status !== 'published') fail(404, 'Event not found.');
    if (!event.registration_open) fail(400, event.closed_reason ?? 'Registrations are closed.');
    if (!leader.register_number || !leader.college_name) fail(400, 'Complete your profile (register number and college) before registering.');

    const rawMembers: MemberInput[] = Array.isArray(b.members) ? b.members : [];
    const teamSize = rawMembers.length + 1;
    if (teamSize < event.team_min || teamSize > event.team_max) {
      fail(400, event.team_min === event.team_max ? `Teams must have exactly ${event.team_min} member(s).` : `Teams must have ${event.team_min} to ${event.team_max} members.`);
    }
    const teamName = event.team_max > 1 ? str(b.teamName, 'Team name', { max: 60 }) : str(b.teamName, 'Team name', { max: 60, required: false }) || null;

    // Resolve members: a CampusPulse ID pulls verified details from that student's profile.
    const members = rawMembers.map((m, i) => {
      const label = `Member ${i + 2}`;
      const code = typeof m.uniqueCode === 'string' ? m.uniqueCode.trim().toUpperCase() : '';
      if (code) {
        const u = q.get<any>(`SELECT id, name, register_number, college_name, department, year_of_study, email, phone FROM users WHERE unique_code = ? AND role = 'student' AND status = 'active'`, code);
        if (!u) fail(400, `${label}: no student found with ID ${code}.`);
        if (u.id === leader.id) fail(400, `${label}: you are already the team leader.`);
        return { user_id: u.id, name: u.name, register_number: u.register_number, college_name: u.college_name, department: u.department, year_of_study: u.year_of_study, email: u.email, phone: u.phone };
      }
      return {
        user_id: null as string | null,
        name: str(m.name, `${label} name`, { max: 80 }),
        register_number: str(m.registerNumber, `${label} register number`, { max: 30 }).toUpperCase(),
        college_name: str(m.collegeName, `${label} college`, { max: 120 }),
        department: str(m.department, `${label} department`, { max: 80 }),
        year_of_study: str((m as any).yearOfStudy, `${label} year`, { max: 20, required: false }) || null,
        email: str(m.email, `${label} email`, { max: 120, required: false }) || null,
        phone: str(m.phone, `${label} phone`, { max: 20, required: false }) || null,
      };
    });

    const everyone = [
      { user_id: leader.id, name: leader.name, register_number: leader.register_number, college_name: leader.college_name, department: leader.department, year_of_study: leader.year_of_study, email: leader.email, phone: leader.phone },
      ...members,
    ];
    if (event.internal_only) {
      const outsider = everyone.find(m => !isHostCollege(m.college_name));
      if (outsider) fail(403, `This event is only for ${COLLEGE_NAME} students. ${outsider.name} is from ${outsider.college_name}.`);
    }
    const seen = new Set<string>();
    for (const m of everyone) {
      const key = `${m.register_number}|${m.college_name}`.toUpperCase();
      if (seen.has(key)) fail(400, `${m.name} appears twice in the team.`);
      seen.add(key);
    }

    let transactionId: string | null = null;
    let proofUrl: string | null = null;
    if (event.fee > 0) {
      transactionId = str(b.transactionId, 'Transaction ID', { max: 40 });
      if (!TXN_RE.test(transactionId)) fail(400, 'Transaction ID should be 6–40 letters, numbers or dashes.');
      assertTransactionUnused(transactionId);
      proofUrl = saveImage(b.paymentProof, 'proof');
    }

    const regId = newId();
    const code = `REG-${randomCode(6)}`;
    const status = event.fee > 0 ? 'pending' : 'approved';
    const now = nowIso();

    tx(() => {
      // Re-check inside the transaction so two last-second submissions can't both take the final spot.
      const taken = q.get<{ n: number }>(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ? AND status IN ('pending','approved')`, event.id)!.n;
      if (taken >= event.max_teams) fail(409, 'Sorry, the last spot was just taken.');
      for (const m of everyone) {
        const clash = q.get<{ name: string }>(
          `SELECT tm.name FROM team_members tm JOIN registrations r ON r.id = tm.registration_id
           WHERE r.event_id = ? AND r.status IN ('pending','approved')
             AND ((tm.user_id IS NOT NULL AND tm.user_id = ?) OR (UPPER(tm.register_number) = UPPER(?) AND tm.college_name = ? COLLATE NOCASE))`,
          event.id,
          m.user_id,
          m.register_number,
          m.college_name,
        );
        if (clash) fail(409, `${m.name} is already registered for this event in another team.`);
      }
      insert('registrations', {
        id: regId,
        code,
        event_id: event.id,
        leader_id: leader.id,
        team_name: teamName,
        status,
        amount: event.fee,
        transaction_id: transactionId,
        payment_proof_url: proofUrl,
        reviewed_at: status === 'approved' ? now : null,
        created_at: now,
        updated_at: now,
      });
      everyone.forEach((m, i) =>
        insert('team_members', { id: newId(), registration_id: regId, ...m, is_leader: i === 0 ? 1 : 0, position: i }),
      );
    });

    const linked = everyone.map(m => m.user_id).filter(Boolean) as string[];
    if (status === 'approved') {
      notify(linked, {
        kind: 'approval',
        title: `You're in: ${event.title}`,
        body: `Registration ${code} is confirmed. Your entry QR is ready in My Registrations.${event.whatsapp_link ? ' Join the WhatsApp group for updates.' : ''}`,
        link: '/registrations',
        actionUrl: event.whatsapp_link ?? undefined,
        actionLabel: event.whatsapp_link ? 'Join WhatsApp group' : undefined,
        email: true,
      });
    } else {
      notify(linked, {
        kind: 'payment',
        title: `Payment submitted for ${event.title}`,
        body: `${teamName ? `Team ${teamName}` : 'Your registration'} (${code}) is awaiting payment verification by ${event.club_name}. You'll be notified once it's reviewed.`,
        link: '/registrations',
      });
      notify(clubAdminIds(event.club_id), {
        kind: 'payment',
        title: 'New registration to verify',
        body: `${leader.name}${teamName ? ` (Team ${teamName})` : ''} registered for ${event.title} and submitted transaction ${transactionId}.`,
        link: `/club/events/${event.id}?tab=pending`,
      });
    }
    res.status(201).json({ id: regId, code, status });
  }),
);

/* -------------------------------------------------------- my registrations */

function registrationsForUser(userId: string, onlyId?: string) {
  const rows = q.all<any>(
    `SELECT r.*, e.title AS event_title, e.poster_url, e.event_date, e.start_time, e.end_time, e.venue, e.fee, e.category,
       e.whatsapp_link, e.status AS event_status, e.payment_qr_url, e.upi_id, e.payee_name, e.certificates_issued_at,
       c.name AS club_name, c.color AS club_color, u.name AS leader_name,
       (SELECT COUNT(*) FROM feedback f WHERE f.event_id = r.event_id AND f.user_id = ?) AS feedback_given
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     JOIN clubs c ON c.id = e.club_id
     JOIN users u ON u.id = r.leader_id
     WHERE (r.leader_id = ? OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.registration_id = r.id AND tm.user_id = ?))
       ${onlyId ? 'AND r.id = ?' : ''}
     ORDER BY e.event_date DESC, r.created_at DESC`,
    userId,
    userId,
    userId,
    ...(onlyId ? [onlyId] : []),
  );
  return rows.map(r => ({
    ...r,
    is_leader: r.leader_id === userId,
    whatsapp_link: r.status === 'approved' ? r.whatsapp_link : null,
    qr_payload: r.status === 'approved' ? ticketPayload(r.code) : null,
    members: membersOf(r.id),
  }));
}

studentRouter.get(
  '/my/registrations',
  requireAuth('student'),
  wrap((req, res) => {
    res.json(registrationsForUser(req.user!.id));
  }),
);

studentRouter.post(
  '/my/registrations/:id/payment',
  requireAuth('student'),
  wrap((req, res) => {
    const reg = q.get<any>('SELECT * FROM registrations WHERE id = ? AND leader_id = ?', req.params.id, req.user!.id);
    if (!reg) fail(404, 'Registration not found.');
    if (reg.status !== 'rejected') fail(400, 'Only rejected payments can be resubmitted.');
    const event = getEvent(reg.event_id)!;
    if (event.is_past || event.status !== 'published') fail(400, 'This event is no longer accepting payments.');
    const transactionId = str(req.body?.transactionId, 'Transaction ID', { max: 40 });
    if (!TXN_RE.test(transactionId)) fail(400, 'Transaction ID should be 6–40 letters, numbers or dashes.');
    assertTransactionUnused(transactionId, reg.id);
    // The rejected team released its spot; make sure there's still room before reclaiming it.
    const taken = q.get<{ n: number }>(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ? AND status IN ('pending','approved')`, event.id)!.n;
    if (taken >= event.max_teams) fail(409, 'All spots have been filled since your registration was rejected.');
    const proof = saveImage(req.body?.paymentProof, 'proof') ?? reg.payment_proof_url;
    update('registrations', reg.id, { transaction_id: transactionId, payment_proof_url: proof, status: 'pending', review_note: null, updated_at: nowIso() });
    notify(clubAdminIds(event.club_id), {
      kind: 'payment',
      title: 'Payment resubmitted',
      body: `${req.user!.name} resubmitted payment (${transactionId}) for ${event.title}.`,
      link: `/club/events/${event.id}?tab=pending`,
    });
    res.json(registrationsForUser(req.user!.id, reg.id)[0]);
  }),
);

studentRouter.post(
  '/my/registrations/:id/cancel',
  requireAuth('student'),
  wrap((req, res) => {
    const reg = q.get<any>(
      `SELECT r.*, e.fee, e.event_date FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ? AND r.leader_id = ?`,
      req.params.id,
      req.user!.id,
    );
    if (!reg) fail(404, 'Registration not found.');
    const cancellable = reg.status === 'pending' || reg.status === 'rejected' || (reg.status === 'approved' && reg.fee === 0);
    if (!cancellable) fail(400, 'Paid registrations that are already approved can only be cancelled by the organizing club.');
    if (reg.event_date < localDate()) fail(400, 'This event has already happened.');
    update('registrations', reg.id, { status: 'cancelled', updated_at: nowIso() });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------ certificates */

const CERT_SELECT = `
  SELECT cert.*, e.title AS event_title, e.event_date, e.category, e.venue, c.name AS club_name, c.color AS club_color, r.code AS registration_code
  FROM certificates cert
  JOIN events e ON e.id = cert.event_id
  JOIN clubs c ON c.id = e.club_id
  JOIN registrations r ON r.id = cert.registration_id
  JOIN team_members tm ON tm.id = cert.member_id`;

studentRouter.get(
  '/my/certificates',
  requireAuth('student'),
  wrap((req, res) => {
    const id = req.user!.id;
    const given = new Set(q.all<{ event_id: string }>('SELECT event_id FROM feedback WHERE user_id = ?', id).map(f => f.event_id));
    const certs = q.all<any>(`${CERT_SELECT} WHERE r.leader_id = ? OR tm.user_id = ? ORDER BY e.event_date DESC, tm.position`, id, id);
    // Certificates unlock once this student has rated the event; the ID stays hidden until then.
    res.json(certs.map(c => (given.has(c.event_id) ? { ...c, locked: false } : { ...c, id: null, locked: true })));
  }),
);

/** Public: anyone holding a certificate ID (printed on the certificate) can verify it. */
studentRouter.get(
  '/certificates/:id',
  wrap((req, res) => {
    const cert = q.get(`${CERT_SELECT} WHERE cert.id = ?`, req.params.id.toUpperCase());
    if (!cert) fail(404, 'No certificate exists with this ID.');
    res.json(cert);
  }),
);

/* ---------------------------------------------------------------- feedback */

function feedbackStatus(eventId: string, userId: string) {
  const event = getEvent(eventId);
  if (!event || !['published', 'completed'].includes(event.status)) fail(404, 'Event not found.');
  const reg = myRegistrationFor(event.id, userId);
  const mine = q.get<any>('SELECT rating, comment, created_at FROM feedback WHERE event_id = ? AND user_id = ?', event.id, userId) ?? null;
  let reason: string | null = null;
  if (!reg || reg.status !== 'approved') reason = 'Only students with a confirmed registration for this event can give feedback.';
  else if (event.event_date > localDate()) reason = 'Feedback opens on the day of the event.';
  return {
    event: { id: event.id, title: event.title, club_name: event.club_name, club_color: event.club_color, event_date: event.event_date, poster_url: event.poster_url },
    eligible: !reason,
    reason,
    mine,
  };
}

studentRouter.get(
  '/feedback/:eventId',
  requireAuth('student'),
  wrap((req, res) => {
    res.json(feedbackStatus(req.params.eventId, req.user!.id));
  }),
);

studentRouter.post(
  '/feedback/:eventId',
  requireAuth('student'),
  wrap((req, res) => {
    const status = feedbackStatus(req.params.eventId, req.user!.id);
    if (!status.eligible) fail(403, status.reason!);
    if (status.mine) fail(409, 'You have already given feedback for this event.');
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Choose a rating from 1 to 5 stars.');
    const comment = str(req.body?.comment, 'Comment', { max: 1000, required: false }) || null;
    insert('feedback', { id: newId(), event_id: status.event.id, user_id: req.user!.id, rating, comment, created_at: nowIso() });
    res.status(201).json(feedbackStatus(req.params.eventId, req.user!.id));
  }),
);

/* -------------------------------------------------------------- OD letters */

/** The leader sees every member's OD; a linked member sees their own. */
studentRouter.get(
  '/my/od',
  requireAuth('student'),
  wrap((req, res) => {
    const id = req.user!.id;
    const rows = odRows(`(r.leader_id = ? OR tm.user_id = ?) AND r.status = 'approved' AND e.status != 'cancelled'`, id, id);
    res.json(rows.map(r => ({ id: r.id, registration_id: r.registration_id, event_id: r.event_id, name: r.name, register_number: r.register_number, department: r.department, issued_at: r.issued_at, mine: r.user_id === id })));
  }),
);

studentRouter.get(
  '/od/:id/pdf',
  requireAuth(),
  wrap(async (req, res) => {
    const row = odRows('od.id = ?', req.params.id.toUpperCase())[0];
    if (!row) fail(404, 'OD letter not found.');
    const u = req.user!;
    const allowed = u.role === 'admin' || (u.role === 'club_admin' && u.club_id === row.club_id) || (u.role === 'student' && (row.leader_id === u.id || row.user_id === u.id));
    if (!allowed) fail(403, 'You can only download your own team\'s OD letters.');
    if (row.reg_status !== 'approved' || row.event_status === 'cancelled') fail(410, 'This OD letter is no longer valid.');
    const bytes = await renderOdPdf(row, [odDataFromRow(row)], process.env.APP_URL || `${req.protocol}://${req.get('host')}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="OD_${row.register_number}_${row.id}.pdf"`);
    res.end(Buffer.from(bytes));
  }),
);

/** Public: a teacher scans the QR on an OD letter to confirm it is genuine and still valid. */
studentRouter.get(
  '/od/:id',
  wrap((req, res) => {
    const row = odRows('od.id = ?', req.params.id.toUpperCase())[0];
    if (!row) fail(404, 'No OD letter exists with this number.');
    res.json({
      id: row.id,
      valid: row.reg_status === 'approved' && row.event_status !== 'cancelled',
      name: row.name,
      register_number: row.register_number,
      department: row.department,
      year: row.year_of_study,
      event_title: row.title,
      event_date: fmtLongDate(row.event_date),
      time: `${row.start_time}–${row.end_time}`,
      venue: row.venue,
      club_name: row.club_name,
      issued_at: row.issued_at,
    });
  }),
);

/* ----------------------------------------------------------- notifications */

studentRouter.get(
  '/notifications',
  requireAuth(),
  wrap((req, res) => {
    const items = q.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60', req.user!.id);
    const unread = q.get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user!.id)!.n;
    res.json({ items, unread });
  }),
);

studentRouter.post(
  '/notifications/read',
  requireAuth(),
  wrap((req, res) => {
    const ids: unknown = req.body?.ids;
    if (Array.isArray(ids) && ids.length) {
      for (const id of ids.slice(0, 100)) {
        q.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', nowIso(), String(id), req.user!.id);
      }
    } else {
      q.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), req.user!.id);
    }
    res.json({ ok: true });
  }),
);
