import { Router, type Request } from 'express';
import ExcelJS from 'exceljs';
import { q, insert, newId, nowIso, randomCode, tx, update, getSetting, localDate, isHostCollege } from '../db';
import { requireAuth, requireClub } from '../auth';
import { adminIds, notify, parseTicket, registrationAudience, saveImage, savePdf } from '../services';
import { DEFAULT_OD_BODY, OD_FIELDS, SAMPLE_OD, odDataFromRow, odRows, renderOdPdf } from '../od';
import { EVENT_CATEGORIES, EVENT_SELECT, assertCanManage, decorateEvent, fail, getEvent, int, membersOf, str, wrap, type EventRow } from './shared';

export const clubRouter = Router();
clubRouter.use(requireAuth('club_admin', 'admin'));

const clubOnly = [requireAuth('club_admin'), requireClub];

function managedEvent(req: Request, id = req.params.id) {
  const event = getEvent(id);
  if (!event) fail(404, 'Event not found.');
  assertCanManage(req.user!, event.club_id);
  return event;
}

function managedRegistration(req: Request) {
  const reg = q.get<any>('SELECT * FROM registrations WHERE id = ?', req.params.id);
  if (!reg) fail(404, 'Registration not found.');
  const event = managedEvent(req, reg.event_id);
  return { reg, event };
}

/* ---------------------------------------------------------------- overview */

clubRouter.get(
  '/overview',
  ...clubOnly,
  wrap((req, res) => {
    const clubId = req.user!.club_id!;
    const club = q.get('SELECT * FROM clubs WHERE id = ?', clubId);
    const today = localDate();
    const stats = q.get<any>(
      `SELECT
        (SELECT COUNT(*) FROM events WHERE club_id = ?) AS events_total,
        (SELECT COUNT(*) FROM events WHERE club_id = ? AND status = 'published' AND event_date >= ?) AS events_upcoming,
        (SELECT COUNT(*) FROM events WHERE club_id = ? AND status = 'pending') AS events_awaiting_approval,
        (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.club_id = ? AND r.status = 'pending') AS payments_pending,
        (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.club_id = ? AND r.status = 'approved') AS teams_approved,
        (SELECT COUNT(*) FROM team_members tm JOIN registrations r ON r.id = tm.registration_id JOIN events e ON e.id = r.event_id
           WHERE e.club_id = ? AND r.status = 'approved') AS participants,
        (SELECT COALESCE(SUM(r.amount), 0) FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.club_id = ? AND r.status = 'approved') AS revenue`,
      clubId, clubId, today, clubId, clubId, clubId, clubId, clubId,
    );
    const upcoming = q
      .all<EventRow>(`${EVENT_SELECT} WHERE e.club_id = ? AND e.event_date >= ? AND e.status IN ('published','pending') ORDER BY e.event_date LIMIT 6`, clubId, today)
      .map(decorateEvent);
    const pending = q.all(
      `SELECT r.id, r.code, r.team_name, r.amount, r.transaction_id, r.created_at, e.id AS event_id, e.title AS event_title, u.name AS leader_name,
         (SELECT COUNT(*) FROM team_members tm WHERE tm.registration_id = r.id) AS member_count
       FROM registrations r JOIN events e ON e.id = r.event_id JOIN users u ON u.id = r.leader_id
       WHERE e.club_id = ? AND r.status = 'pending' ORDER BY r.created_at LIMIT 8`,
      clubId,
    );
    res.json({ club, stats, upcoming, pending });
  }),
);

/* ------------------------------------------------------------------ events */

clubRouter.get(
  '/events',
  ...clubOnly,
  wrap((req, res) => {
    const rows = q.all<EventRow>(`${EVENT_SELECT} WHERE e.club_id = ? ORDER BY e.event_date DESC`, req.user!.club_id!);
    res.json(rows.map(decorateEvent));
  }),
);

clubRouter.get(
  '/events/:id',
  wrap((req, res) => {
    res.json(managedEvent(req));
  }),
);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseEventBody(body: any, isNew: boolean) {
  const b = body ?? {};
  const category = str(b.category, 'Category', { max: 30 });
  if (!EVENT_CATEGORIES.includes(category)) fail(400, 'Choose a valid category.');
  const eventDate = str(b.eventDate, 'Event date', { max: 10 });
  const startTime = str(b.startTime, 'Start time', { max: 5 });
  const endTime = str(b.endTime, 'End time', { max: 5 });
  const regDeadline = str(b.regDeadline, 'Registration deadline', { max: 16 });
  if (!DATE_RE.test(eventDate)) fail(400, 'Event date is invalid.');
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) fail(400, 'Times must be in HH:MM format.');
  if (endTime <= startTime) fail(400, 'End time must be after the start time.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(regDeadline)) fail(400, 'Registration deadline is invalid.');
  if (regDeadline > `${eventDate}T${startTime}`) fail(400, 'Registration must close before the event starts.');
  if (isNew && eventDate < localDate()) fail(400, 'Event date cannot be in the past.');

  const teamMin = int(b.teamMin ?? 1, 'Minimum team size', 1, 20);
  const teamMax = int(b.teamMax ?? 1, 'Maximum team size', 1, 20);
  if (teamMin > teamMax) fail(400, 'Minimum team size cannot exceed the maximum.');
  const fee = int(b.fee ?? 0, 'Fee', 0, 100000);

  const whatsappLink = str(b.whatsappLink, 'WhatsApp group link', { max: 300, required: false }) || null;
  if (whatsappLink && !/^https:\/\//.test(whatsappLink)) fail(400, 'WhatsApp link must start with https://');
  const upiId = str(b.upiId, 'UPI ID', { max: 80, required: false }) || null;
  if (upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) fail(400, 'UPI ID looks invalid (example: club@okaxis).');
  const paymentQr = saveImage(b.paymentQr, 'qr');
  if (fee > 0 && !paymentQr && !upiId) fail(400, 'Paid events need a payment QR image or a UPI ID.');

  return {
    title: str(b.title, 'Title', { max: 120 }),
    category,
    tagline: str(b.tagline, 'Tagline', { max: 160, required: false }),
    description: str(b.description, 'Description', { max: 5000 }),
    rules: str(b.rules, 'Rules', { max: 5000, required: false }),
    requirements: str(b.requirements, 'Requirements', { max: 3000, required: false }),
    schedule: str(b.schedule, 'Schedule', { max: 3000, required: false }),
    venue: str(b.venue, 'Venue', { max: 120 }),
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    reg_deadline: regDeadline,
    fee,
    team_min: teamMin,
    team_max: teamMax,
    max_teams: int(b.maxTeams ?? 100, 'Maximum teams', 1, 10000),
    poster_url: saveImage(b.poster, 'poster'),
    payment_qr_url: paymentQr,
    upi_id: upiId,
    payee_name: str(b.payeeName, 'Payee name', { max: 80, required: false }) || null,
    whatsapp_link: whatsappLink,
    contact_name: str(b.contactName, 'Contact name', { max: 80 }),
    contact_phone: str(b.contactPhone, 'Contact phone', { max: 20 }),
    internal_only: b.internalOnly ? 1 : 0,
  };
}

/** Non-blocking: overlapping bookings of the same venue are reported back as warnings. */
function venueWarnings(data: { venue: string; event_date: string; start_time: string; end_time: string }, excludeId: string | null) {
  const clashes = q.all<any>(
    `SELECT e.title, e.start_time, e.end_time, c.name AS club_name FROM events e JOIN clubs c ON c.id = e.club_id
     WHERE e.venue = ? COLLATE NOCASE AND e.event_date = ? AND e.status IN ('published','pending') AND e.id != ?
       AND e.start_time < ? AND e.end_time > ?`,
    data.venue, data.event_date, excludeId ?? '', data.end_time, data.start_time,
  );
  return clashes.map(c => `${data.venue} is also booked for "${c.title}" (${c.club_name}) from ${c.start_time} to ${c.end_time} that day.`);
}

clubRouter.post(
  '/events',
  ...clubOnly,
  wrap((req, res) => {
    const data = parseEventBody(req.body, true);
    const needsApproval = getSetting('require_event_approval', 'true') === 'true';
    const id = newId();
    const now = nowIso();
    insert('events', {
      id,
      club_id: req.user!.club_id!,
      ...data,
      status: needsApproval ? 'pending' : 'published',
      created_by: req.user!.id,
      created_at: now,
      updated_at: now,
    });
    const event = getEvent(id)!;
    if (needsApproval) {
      notify(adminIds(), {
        kind: 'event',
        title: 'Event awaiting approval',
        body: `${event.club_name} submitted "${event.title}" for ${event.event_date}.`,
        link: '/admin/events?status=pending',
      });
    }
    res.status(201).json({ event, warnings: venueWarnings(data, id) });
  }),
);

clubRouter.put(
  '/events/:id',
  wrap((req, res) => {
    const before = managedEvent(req);
    if (['completed', 'cancelled'].includes(before.status)) fail(400, `A ${before.status} event can no longer be edited.`);
    const data = parseEventBody(req.body, false);
    if (data.max_teams < before.teams_count) fail(400, `There are already ${before.teams_count} teams registered; capacity can't go below that.`);
    const changes: Record<string, unknown> = { ...data, updated_at: nowIso() };
    let resubmitted = false;
    if (before.status === 'rejected') {
      changes.status = 'pending';
      changes.admin_note = null;
      resubmitted = true;
    }
    update('events', before.id, changes);
    const event = getEvent(before.id)!;

    if (resubmitted) {
      notify(adminIds(), {
        kind: 'event',
        title: 'Event resubmitted for approval',
        body: `${event.club_name} updated and resubmitted "${event.title}".`,
        link: '/admin/events?status=pending',
      });
    }
    const logistics = ['event_date', 'start_time', 'end_time', 'venue'] as const;
    if (before.status === 'published' && logistics.some(k => before[k] !== event[k])) {
      const regs = q.all<{ id: string }>(`SELECT id FROM registrations WHERE event_id = ? AND status IN ('pending','approved')`, event.id);
      const audience = regs.flatMap(r => registrationAudience(r.id));
      notify(audience, {
        kind: 'event',
        title: `Schedule update: ${event.title}`,
        body: `Now on ${event.event_date}, ${event.start_time}–${event.end_time} at ${event.venue}.`,
        link: `/events/${event.id}`,
        email: true,
      });
    }
    res.json({ event, warnings: venueWarnings(data, event.id) });
  }),
);

clubRouter.post(
  '/events/:id/registration',
  wrap((req, res) => {
    const event = managedEvent(req);
    update('events', event.id, { reg_open: req.body?.open ? 1 : 0, updated_at: nowIso() });
    res.json(getEvent(event.id));
  }),
);

clubRouter.post(
  '/events/:id/cancel',
  wrap((req, res) => {
    const event = managedEvent(req);
    if (event.status === 'completed') fail(400, 'Completed events cannot be cancelled.');
    const reason = str(req.body?.reason, 'Reason', { max: 500 });
    update('events', event.id, { status: 'cancelled', admin_note: reason, updated_at: nowIso() });
    const regs = q.all<{ id: string }>(`SELECT id FROM registrations WHERE event_id = ? AND status IN ('pending','approved')`, event.id);
    notify(regs.flatMap(r => registrationAudience(r.id)), {
      kind: 'event',
      title: `Cancelled: ${event.title}`,
      body: `${event.club_name} cancelled this event. Reason: ${reason}${event.fee > 0 ? ' The organizers will contact you about refunds.' : ''}`,
      link: '/registrations',
      email: true,
    });
    res.json(getEvent(event.id));
  }),
);

clubRouter.delete(
  '/events/:id',
  wrap((req, res) => {
    const event = managedEvent(req);
    const any = q.get('SELECT 1 FROM registrations WHERE event_id = ? LIMIT 1', event.id);
    if (any) fail(400, 'This event has registrations. Cancel it instead of deleting.');
    q.run('DELETE FROM events WHERE id = ?', event.id);
    res.json({ ok: true });
  }),
);

/* ----------------------------------------------------------- registrations */

function eventRegistrations(eventId: string) {
  return q
    .all<any>(
      `SELECT r.*, u.name AS leader_name, u.email AS leader_email, u.phone AS leader_phone, u.unique_code AS leader_code,
         rv.name AS reviewed_by_name
       FROM registrations r JOIN users u ON u.id = r.leader_id LEFT JOIN users rv ON rv.id = r.reviewed_by
       WHERE r.event_id = ? ORDER BY r.created_at DESC`,
      eventId,
    )
    .map(r => ({ ...r, members: membersOf(r.id) }));
}

clubRouter.get(
  '/events/:id/registrations',
  wrap((req, res) => {
    const event = managedEvent(req);
    res.json(eventRegistrations(event.id));
  }),
);

clubRouter.post(
  '/registrations/:id/review',
  wrap((req, res) => {
    const { reg, event } = managedRegistration(req);
    const action = req.body?.action;
    const note = str(req.body?.note, 'Note', { max: 500, required: action !== 'approve' });
    const audience = registrationAudience(reg.id);
    const label = reg.team_name ? `Team ${reg.team_name}` : 'Your registration';

    if (action === 'approve') {
      if (reg.status !== 'pending') fail(400, 'Only pending registrations can be approved.');
      update('registrations', reg.id, { status: 'approved', review_note: note || null, reviewed_by: req.user!.id, reviewed_at: nowIso(), updated_at: nowIso() });
      notify(audience, {
        kind: 'approval',
        title: `Payment verified: ${event.title}`,
        body: `${label} (${reg.code}) is confirmed for ${event.event_date} at ${event.venue}. Your entry QR is ready in My Registrations.${event.whatsapp_link ? ' Join the WhatsApp group for updates.' : ''}`,
        link: '/registrations',
        actionUrl: event.whatsapp_link ?? undefined,
        actionLabel: event.whatsapp_link ? 'Join WhatsApp group' : undefined,
        email: true,
      });
    } else if (action === 'reject') {
      if (reg.status !== 'pending') fail(400, 'Only pending registrations can be rejected.');
      update('registrations', reg.id, { status: 'rejected', review_note: note, reviewed_by: req.user!.id, reviewed_at: nowIso(), updated_at: nowIso() });
      notify(audience, {
        kind: 'rejection',
        title: `Payment not verified: ${event.title}`,
        body: `${label} (${reg.code}) was not approved. Reason: ${note}. You can resubmit a correct transaction ID from My Registrations.`,
        link: '/registrations',
        email: true,
      });
    } else if (action === 'cancel') {
      if (!['pending', 'approved'].includes(reg.status)) fail(400, 'This registration is not active.');
      update('registrations', reg.id, { status: 'cancelled', review_note: note, reviewed_by: req.user!.id, reviewed_at: nowIso(), updated_at: nowIso() });
      notify(audience, {
        kind: 'rejection',
        title: `Registration cancelled: ${event.title}`,
        body: `${label} (${reg.code}) was cancelled by the organizers. Reason: ${note}`,
        link: '/registrations',
        email: true,
      });
    } else {
      fail(400, 'Unknown action.');
    }
    res.json({ ...q.get('SELECT * FROM registrations WHERE id = ?', reg.id), members: membersOf(reg.id) });
  }),
);

clubRouter.post(
  '/registrations/:id/award',
  wrap((req, res) => {
    const { reg } = managedRegistration(req);
    if (reg.status !== 'approved') fail(400, 'Only confirmed teams can receive awards.');
    const award = str(req.body?.award, 'Award', { max: 40, required: false }) || null;
    update('registrations', reg.id, { award, updated_at: nowIso() });
    q.run('UPDATE certificates SET award = ? WHERE registration_id = ?', award, reg.id);
    res.json({ ok: true, award });
  }),
);

/* ------------------------------------------------------------------ export */

clubRouter.get(
  '/events/:id/export',
  wrap(async (req, res) => {
    const event = managedEvent(req);
    const filter = String(req.query.status || 'active');
    const regs = eventRegistrations(event.id).filter(r =>
      filter === 'all' ? true : filter === 'active' ? ['pending', 'approved'].includes(r.status) : r.status === filter,
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CampusPulse';
    const header = (ws: ExcelJS.Worksheet) => {
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A84FF' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
    };

    const teams = wb.addWorksheet('Teams');
    teams.columns = [
      { header: 'S.No', key: 'sno', width: 6 },
      { header: 'Registration ID', key: 'code', width: 16 },
      { header: 'Team Name', key: 'team', width: 22 },
      { header: 'Leader', key: 'leader', width: 22 },
      { header: 'Leader Phone', key: 'phone', width: 16 },
      { header: 'Leader Email', key: 'email', width: 28 },
      { header: 'Members', key: 'count', width: 9 },
      { header: 'Status', key: 'status', width: 11 },
      { header: 'Amount (₹)', key: 'amount', width: 11 },
      { header: 'Transaction ID', key: 'txn', width: 22 },
      { header: 'Registered At', key: 'created', width: 20 },
      { header: 'Checked In At', key: 'checkin', width: 20 },
      { header: 'Award', key: 'award', width: 16 },
    ];
    regs.forEach((r, i) =>
      teams.addRow({
        sno: i + 1,
        code: r.code,
        team: r.team_name ?? '—',
        leader: r.leader_name,
        phone: r.leader_phone,
        email: r.leader_email,
        count: r.members.length,
        status: r.status,
        amount: r.amount,
        txn: r.transaction_id ?? (r.amount ? '' : 'Free'),
        created: new Date(r.created_at).toLocaleString('en-IN'),
        checkin: r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('en-IN') : '',
        award: r.award ?? '',
      }),
    );
    header(teams);

    const people = wb.addWorksheet('Participants');
    people.columns = [
      { header: 'S.No', key: 'sno', width: 6 },
      { header: 'Registration ID', key: 'code', width: 16 },
      { header: 'Team Name', key: 'team', width: 22 },
      { header: 'Role', key: 'role', width: 9 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Register Number', key: 'reg', width: 18 },
      { header: 'College', key: 'college', width: 34 },
      { header: 'Department', key: 'dept', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Status', key: 'status', width: 11 },
      { header: 'Attended', key: 'attended', width: 10 },
    ];
    let n = 0;
    for (const r of regs) {
      for (const m of r.members) {
        people.addRow({
          sno: ++n,
          code: r.code,
          team: r.team_name ?? '—',
          role: m.is_leader ? 'Leader' : 'Member',
          type: isHostCollege(m.college_name) ? 'Internal' : 'External',
          name: m.name,
          reg: m.register_number,
          college: m.college_name,
          dept: m.department ?? '',
          email: m.email ?? '',
          phone: m.phone ?? '',
          status: r.status,
          attended: m.attended ? 'Yes' : 'No',
        });
      }
    }
    header(people);

    const safe = event.title.replace(/[^\w]+/g, '_').slice(0, 40);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}_registrations.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }),
);

/* ---------------------------------------------------------------- check-in */

clubRouter.post(
  '/checkin/lookup',
  wrap((req, res) => {
    const parsed = parseTicket(String(req.body?.payload ?? ''));
    if (!parsed) fail(400, 'Not a valid CampusPulse ticket. The QR may be damaged or forged.');
    const reg = q.get<any>('SELECT * FROM registrations WHERE code = ?', parsed.code);
    if (!reg) fail(404, `No registration found for ${parsed.code}.`);
    const event = managedEvent(req, reg.event_id);
    const expected = req.body?.eventId;
    if (expected && expected !== reg.event_id) fail(409, `This ticket is for "${event.title}", not the event you're scanning for.`);
    if (reg.status !== 'approved') fail(409, `Registration ${reg.code} is ${reg.status}, not approved. Do not admit.`);
    const leader = q.get<any>('SELECT name, phone FROM users WHERE id = ?', reg.leader_id);
    res.json({ registration: { ...reg, members: membersOf(reg.id), leader_name: leader?.name, leader_phone: leader?.phone }, event: { id: event.id, title: event.title, event_date: event.event_date }, manualEntry: !parsed.signed });
  }),
);

clubRouter.post(
  '/registrations/:id/checkin',
  wrap((req, res) => {
    const { reg } = managedRegistration(req);
    if (reg.status !== 'approved') fail(400, 'Only approved registrations can be checked in.');
    const present: string[] = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : [];
    tx(() => {
      for (const m of membersOf(reg.id)) {
        q.run('UPDATE team_members SET attended = ? WHERE id = ?', present.includes(m.id) ? 1 : 0, m.id);
      }
      if (present.length) {
        update('registrations', reg.id, { checked_in_at: reg.checked_in_at ?? nowIso(), checked_in_by: reg.checked_in_by ?? req.user!.id, updated_at: nowIso() });
      } else {
        update('registrations', reg.id, { checked_in_at: null, checked_in_by: null, updated_at: nowIso() });
      }
    });
    res.json({ ...q.get('SELECT * FROM registrations WHERE id = ?', reg.id), members: membersOf(reg.id) });
  }),
);

clubRouter.get(
  '/events/:id/attendance',
  wrap((req, res) => {
    const event = managedEvent(req);
    const stats = q.get<any>(
      `SELECT
        (SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'approved') AS teams_total,
        (SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'approved' AND checked_in_at IS NOT NULL) AS teams_present,
        (SELECT COUNT(*) FROM team_members tm JOIN registrations r ON r.id = tm.registration_id WHERE r.event_id = ? AND r.status = 'approved') AS people_total,
        (SELECT COUNT(*) FROM team_members tm JOIN registrations r ON r.id = tm.registration_id WHERE r.event_id = ? AND r.status = 'approved' AND tm.attended = 1) AS people_present`,
      event.id, event.id, event.id, event.id,
    );
    const recent = q.all(
      `SELECT r.id, r.code, r.team_name, r.checked_in_at, u.name AS leader_name,
         (SELECT COUNT(*) FROM team_members tm WHERE tm.registration_id = r.id AND tm.attended = 1) AS present,
         (SELECT COUNT(*) FROM team_members tm WHERE tm.registration_id = r.id) AS total
       FROM registrations r JOIN users u ON u.id = r.leader_id
       WHERE r.event_id = ? AND r.checked_in_at IS NOT NULL ORDER BY r.checked_in_at DESC LIMIT 12`,
      event.id,
    );
    res.json({ ...stats, recent });
  }),
);

/* ------------------------------------------------------------ certificates */

clubRouter.post(
  '/events/:id/certificates',
  wrap((req, res) => {
    const event = managedEvent(req);
    if (event.status === 'cancelled') fail(400, 'Cancelled events do not get certificates.');
    if (event.event_date > localDate()) fail(400, 'Certificates can be issued once the event has taken place.');
    const onlyAttended = req.body?.scope !== 'all';
    const regs = q.all<any>(`SELECT * FROM registrations WHERE event_id = ? AND status = 'approved'`, event.id);
    let issued = 0;
    const leaders: string[] = [];
    tx(() => {
      for (const r of regs) {
        const members = membersOf(r.id).filter((m: any) => !onlyAttended || m.attended);
        if (!members.length) continue;
        for (const m of members as any[]) {
          const result = q.run(
            `INSERT INTO certificates (id, registration_id, member_id, event_id, recipient_name, register_number, college_name, team_name, award, issued_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(member_id) DO UPDATE SET award = excluded.award, recipient_name = excluded.recipient_name`,
            `CERT-${randomCode(4)}-${randomCode(4)}`, r.id, m.id, event.id, m.name, m.register_number, m.college_name, r.team_name, r.award, nowIso(),
          );
          issued += Number(result.changes);
        }
        leaders.push(r.id);
      }
      update('events', event.id, { status: 'completed', certificates_issued_at: nowIso(), reg_open: 0, updated_at: nowIso() });
    });
    for (const regId of leaders) {
      notify(registrationAudience(regId), {
        kind: 'certificate',
        title: `Certificates ready: ${event.title}`,
        body: `Certificates for your team are ready. Give quick feedback on the event to unlock and download them.`,
        link: `/feedback/${event.id}`,
        email: true,
      });
    }
    res.json({ issued, teams: leaders.length });
  }),
);

/* ---------------------------------------------------------------- feedback */

clubRouter.get(
  '/events/:id/feedback',
  wrap((req, res) => {
    const event = managedEvent(req);
    const items = q.all<any>(
      `SELECT f.rating, f.comment, f.created_at, u.name FROM feedback f JOIN users u ON u.id = f.user_id WHERE f.event_id = ? ORDER BY f.created_at DESC`,
      event.id,
    );
    const eligible = q.get<{ n: number }>(
      `SELECT COUNT(DISTINCT COALESCE(tm.user_id, r.leader_id)) AS n FROM registrations r JOIN team_members tm ON tm.registration_id = r.id
       WHERE r.event_id = ? AND r.status = 'approved' AND (tm.user_id IS NOT NULL)`,
      event.id,
    )!.n;
    const distribution = [1, 2, 3, 4, 5].map(star => items.filter(i => i.rating === star).length);
    const average = items.length ? items.reduce((s, i) => s + i.rating, 0) / items.length : null;
    res.json({ count: items.length, eligible, average, distribution, items });
  }),
);

/* -------------------------------------------------------------- OD letters */

const verifyBase = (req: Request) => process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

function sendPdf(res: import('express').Response, bytes: Uint8Array, filename: string, inline = true) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/[^\w.-]+/g, '_')}"`);
  res.end(Buffer.from(bytes));
}

clubRouter.get(
  '/od-template',
  ...clubOnly,
  wrap((req, res) => {
    const c = q.get<any>('SELECT name, od_template_url, od_body, od_top_mm, od_signatory_name, od_signatory_title FROM clubs WHERE id = ?', req.user!.club_id!)!;
    res.json({ ...c, od_body: c.od_body || DEFAULT_OD_BODY, default_body: DEFAULT_OD_BODY, fields: OD_FIELDS });
  }),
);

clubRouter.put(
  '/od-template',
  ...clubOnly,
  wrap((req, res) => {
    const b = req.body ?? {};
    update('clubs', req.user!.club_id!, {
      od_template_url: savePdf(b.template, 'od-template'),
      od_body: str(b.body, 'Letter text', { max: 5000 }),
      od_top_mm: int(b.topMm ?? 55, 'Text start position', 20, 200),
      od_signatory_name: str(b.signatoryName, 'Signatory name', { max: 80 }),
      od_signatory_title: str(b.signatoryTitle, 'Signatory designation', { max: 80 }),
    });
    res.json({ ok: true });
  }),
);

clubRouter.get(
  '/od-template/preview',
  ...clubOnly,
  wrap(async (req, res) => {
    const c = q.get<any>('SELECT * FROM clubs WHERE id = ?', req.user!.club_id!)!;
    const data = { ...SAMPLE_OD, club_name: c.name, signatory_name: c.od_signatory_name || SAMPLE_OD.signatory_name, signatory_title: c.od_signatory_title || SAMPLE_OD.signatory_title };
    sendPdf(res, await renderOdPdf(c, [data], verifyBase(req)), 'od-preview.pdf');
  }),
);

/** Internal members of confirmed teams: the only people who can get an OD. */
function odEligible(eventId: string) {
  return q
    .all<any>(
      `SELECT tm.id AS member_id, tm.name, tm.register_number, tm.college_name, tm.is_leader,
         COALESCE(NULLIF(tm.department, ''), u.department) AS department,
         COALESCE(NULLIF(tm.year_of_study, ''), u.year_of_study) AS year_of_study,
         r.id AS registration_id, r.code, r.team_name, od.id AS od_id, od.issued_at
       FROM registrations r
       JOIN team_members tm ON tm.registration_id = r.id
       LEFT JOIN users u ON u.id = tm.user_id
       LEFT JOIN od_letters od ON od.member_id = tm.id
       WHERE r.event_id = ? AND r.status = 'approved'
       ORDER BY r.created_at, tm.position`,
      eventId,
    )
    .filter(m => isHostCollege(m.college_name));
}

clubRouter.get(
  '/events/:id/od',
  wrap((req, res) => {
    const event = managedEvent(req);
    const club = q.get<{ od_template_url: string | null }>('SELECT od_template_url FROM clubs WHERE id = ?', event.club_id)!;
    res.json({ has_template: !!club.od_template_url, members: odEligible(event.id) });
  }),
);

clubRouter.post(
  '/events/:id/od',
  wrap((req, res) => {
    const event = managedEvent(req);
    if (event.status === 'cancelled') fail(400, 'This event was cancelled.');
    const club = q.get<{ od_template_url: string | null }>('SELECT od_template_url FROM clubs WHERE id = ?', event.club_id)!;
    if (!club.od_template_url) fail(400, 'Upload your OD template first (OD template page).');
    const only: string[] | null = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : null;
    const pending = odEligible(event.id).filter(m => !m.od_id && (!only || only.includes(m.member_id)));
    if (!pending.length) fail(400, 'Everyone eligible already has an OD letter.');
    const now = nowIso();
    tx(() => {
      for (const m of pending) {
        insert('od_letters', { id: `OD-${randomCode(4)}-${randomCode(4)}`, event_id: event.id, registration_id: m.registration_id, member_id: m.member_id, issued_by: req.user!.id, issued_at: now });
      }
    });
    for (const regId of new Set(pending.map(m => m.registration_id))) {
      notify(registrationAudience(regId), {
        kind: 'approval',
        title: `OD letter ready: ${event.title}`,
        body: `${event.club_name} has issued On-Duty letters for your team. Download them from My Registrations.`,
        link: '/registrations',
        email: true,
      });
    }
    res.json({ issued: pending.length });
  }),
);

clubRouter.get(
  '/events/:id/od.pdf',
  wrap(async (req, res) => {
    const event = managedEvent(req);
    const rows = odRows(`od.event_id = ? AND r.status = 'approved'`, event.id);
    if (!rows.length) fail(404, 'No OD letters have been issued for this event yet.');
    sendPdf(res, await renderOdPdf(rows[0], rows.map(odDataFromRow), verifyBase(req)), `OD_${event.title}.pdf`, false);
  }),
);

/* ---------------------------------------------------------- announcements */

clubRouter.post(
  '/events/:id/announce',
  wrap((req, res) => {
    const event = managedEvent(req);
    const title = str(req.body?.title, 'Title', { max: 120 });
    const message = str(req.body?.message, 'Message', { max: 1000 });
    const regs = q.all<{ id: string }>(`SELECT id FROM registrations WHERE event_id = ? AND status = 'approved'`, event.id);
    const audience = regs.flatMap(r => registrationAudience(r.id));
    notify(audience, { kind: 'announcement', title: `${event.title}: ${title}`, body: message, link: `/events/${event.id}`, email: true });
    res.json({ sent: new Set(audience).size });
  }),
);

/* -------------------------------------------------------------- complaints */

clubRouter.get(
  '/complaints',
  ...clubOnly,
  wrap((req, res) => {
    res.json(
      q.all(
        `SELECT cp.*, u.name AS raised_by_name FROM complaints cp JOIN users u ON u.id = cp.raised_by WHERE cp.club_id = ? ORDER BY cp.updated_at DESC`,
        req.user!.club_id!,
      ),
    );
  }),
);

clubRouter.post(
  '/complaints',
  ...clubOnly,
  wrap((req, res) => {
    const b = req.body ?? {};
    const priority = ['low', 'normal', 'high'].includes(b.priority) ? b.priority : 'normal';
    const id = newId();
    const now = nowIso();
    insert('complaints', {
      id,
      club_id: req.user!.club_id!,
      raised_by: req.user!.id,
      subject: str(b.subject, 'Subject', { max: 120 }),
      category: str(b.category, 'Category', { max: 40 }),
      description: str(b.description, 'Description', { max: 3000 }),
      priority,
      status: 'open',
      created_at: now,
      updated_at: now,
    });
    const club = q.get<{ name: string }>('SELECT name FROM clubs WHERE id = ?', req.user!.club_id!)!;
    notify(adminIds(), {
      kind: 'complaint',
      title: `New ${priority === 'high' ? 'high-priority ' : ''}complaint from ${club.name}`,
      body: String(b.subject).slice(0, 140),
      link: '/admin/complaints',
    });
    res.status(201).json(q.get('SELECT * FROM complaints WHERE id = ?', id));
  }),
);

