import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** The host college. Students from it are tagged internal; certificates print it. */
export const COLLEGE_NAME = process.env.COLLEGE_NAME || 'SRM Easwari Engineering College';
export const isHostCollege = (college: string | null | undefined) => !!college && college.trim().toLowerCase() === COLLEGE_NAME.trim().toLowerCase();
export const studentTypeFor = (college: string | null | undefined) => (isHostCollege(college) ? 'internal' : 'external');

export const DATA_DIR = path.resolve(process.env.CAMPUSPULSE_DATA_DIR || path.join(process.cwd(), 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'campuspulse.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  short_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'club',
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0A84FF',
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  unique_code TEXT UNIQUE,
  register_number TEXT,
  college_name TEXT,
  department TEXT,
  year_of_study TEXT,
  club_id TEXT REFERENCES clubs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  schedule TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reg_deadline TEXT NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,
  team_min INTEGER NOT NULL DEFAULT 1,
  team_max INTEGER NOT NULL DEFAULT 1,
  max_teams INTEGER NOT NULL DEFAULT 100,
  poster_url TEXT,
  payment_qr_url TEXT,
  upi_id TEXT,
  payee_name TEXT,
  whatsapp_link TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  reg_open INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  certificates_issued_at TEXT
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  leader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL DEFAULT 0,
  transaction_id TEXT,
  payment_proof_url TEXT,
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  checked_in_at TEXT,
  checked_in_by TEXT,
  reminder_sent_at TEXT,
  award TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  register_number TEXT NOT NULL,
  college_name TEXT NOT NULL,
  department TEXT,
  email TEXT,
  phone TEXT,
  is_leader INTEGER NOT NULL DEFAULT 0,
  attended INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  action_url TEXT,
  action_label TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  raised_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  register_number TEXT NOT NULL,
  college_name TEXT NOT NULL,
  team_name TEXT,
  award TEXT,
  issued_at TEXT NOT NULL,
  UNIQUE(member_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS od_letters (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL UNIQUE REFERENCES team_members(id) ON DELETE CASCADE,
  issued_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_club ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_regs_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_regs_leader ON registrations(leader_id);
CREATE INDEX IF NOT EXISTS idx_members_reg ON team_members(registration_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);
`);

/** Adds columns introduced after the first release, so existing databases keep working. */
function addColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
// 'internal' = studies at the host college; only internal students can join internal-only events.
addColumn('users', 'student_type', "TEXT NOT NULL DEFAULT 'external'");
addColumn('events', 'internal_only', 'INTEGER NOT NULL DEFAULT 0');
addColumn('team_members', 'year_of_study', 'TEXT');
// External students upload a college ID card; they stay 'pending' (no CampusPulse ID) until an admin verifies it.
addColumn('users', 'verification', "TEXT NOT NULL DEFAULT 'verified'");
addColumn('users', 'id_card_url', 'TEXT');
addColumn('users', 'verification_note', 'TEXT');
// Per-club On-Duty letter template: an uploaded PDF plus the letter text drawn onto it.
addColumn('clubs', 'od_template_url', 'TEXT');
addColumn('clubs', 'od_body', 'TEXT');
addColumn('clubs', 'od_top_mm', 'INTEGER NOT NULL DEFAULT 55');
addColumn('clubs', 'od_signatory_name', 'TEXT');
addColumn('clubs', 'od_signatory_title', 'TEXT');
db.prepare(`UPDATE users SET student_type = CASE WHEN lower(trim(college_name)) = lower(trim(?)) THEN 'internal' ELSE 'external' END WHERE role = 'student'`).run(COLLEGE_NAME);

type Param = string | number | bigint | null | undefined | boolean;
type Row = Record<string, any>;

const norm = (params: Param[]) =>
  params.map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p)) as (string | number | bigint | null)[];

export const q = {
  get<T = Row>(sql: string, ...params: Param[]): T | undefined {
    const row = db.prepare(sql).get(...norm(params));
    return row ? ({ ...row } as T) : undefined;
  },
  all<T = Row>(sql: string, ...params: Param[]): T[] {
    return db.prepare(sql).all(...norm(params)).map(r => ({ ...r }) as T);
  },
  run(sql: string, ...params: Param[]) {
    return db.prepare(sql).run(...norm(params));
  },
};

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Inserts a row from a plain object. Undefined values are skipped. */
export function insert(table: string, row: Row) {
  const keys = Object.keys(row).filter(k => row[k] !== undefined);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  return q.run(sql, ...keys.map(k => row[k]));
}

export function update(table: string, id: string, row: Row, idCol = 'id') {
  const keys = Object.keys(row).filter(k => row[k] !== undefined);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE ${idCol} = ?`;
  return q.run(sql, ...keys.map(k => row[k]), id);
}

// Crockford-ish alphabet: no 0/O, 1/I/L, so codes survive being read aloud or handwritten.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function randomCode(len: number) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Local-time helpers; event dates/times are entered and compared in campus local time. */
const pad = (n: number) => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localDateTime = (d = new Date()) => `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addDays = (days: number, d = new Date()) => {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
};

export function getSetting(key: string, fallback: string) {
  return q.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value ?? fallback;
}
export function setSetting(key: string, value: string) {
  q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
