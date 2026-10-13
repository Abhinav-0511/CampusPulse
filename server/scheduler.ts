import { q, nowIso, localDate, addDays } from './db';
import { notify, registrationAudience } from './services';

const INTERVAL_MS = 15 * 60 * 1000;

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Sends the "event is tomorrow" alert once per confirmed team. Safe to run repeatedly. */
export function sendDayBeforeReminders() {
  const tomorrow = localDate(addDays(1));
  const due = q.all<any>(
    `SELECT r.id, r.code, r.team_name, e.id AS event_id, e.title, e.start_time, e.venue, e.whatsapp_link
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.status = 'approved' AND r.reminder_sent_at IS NULL AND e.status = 'published' AND e.event_date = ?`,
    tomorrow,
  );
  for (const r of due) {
    notify(registrationAudience(r.id), {
      kind: 'reminder',
      title: `Tomorrow: ${r.title}`,
      body: `${r.team_name ? `Team ${r.team_name}, see` : 'See'} you at ${r.venue}, ${fmtTime(r.start_time)}. Keep your entry QR (${r.code}) ready at the gate.`,
      link: '/registrations',
      actionUrl: r.whatsapp_link ?? undefined,
      actionLabel: r.whatsapp_link ? 'Open WhatsApp group' : undefined,
      email: true,
    });
    q.run('UPDATE registrations SET reminder_sent_at = ? WHERE id = ?', nowIso(), r.id);
  }
  if (due.length) console.log(`[scheduler] sent ${due.length} day-before reminder(s)`);
}

function purgeExpiredSessions() {
  q.run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
}

export function startScheduler() {
  const tick = () => {
    try {
      sendDayBeforeReminders();
      purgeExpiredSessions();
    } catch (err) {
      console.error('[scheduler]', err);
    }
  };
  tick();
  setInterval(tick, INTERVAL_MS).unref();
}
