import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { PDFDocument, PDFName, PDFTextField, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { UPLOAD_DIR, q, COLLEGE_NAME } from './db';

/**
 * On-Duty (OD) letters. A club uploads a PDF template once:
 *  - a fillable PDF form whose text fields are named after OD_FIELDS gets those fields filled, or
 *  - any other PDF is treated as a letterhead and the club's letter text is written onto page 1.
 * Letters are rendered on demand, so fixing the template fixes every OD already issued.
 */
export const OD_FIELDS = [
  'name', 'register_number', 'department', 'year', 'college',
  'event_title', 'event_date', 'start_time', 'end_time', 'venue', 'club_name', 'team_name',
  'od_number', 'issue_date', 'signatory_name', 'signatory_title',
] as const;
export type OdData = Record<(typeof OD_FIELDS)[number], string>;

export const DEFAULT_OD_BODY = `Date: {{issue_date}}

To
The Head of the Department,
Department of {{department}},
{{college}}.

Subject: Request for On Duty - {{event_title}}

Respected Sir/Madam,

This is to certify that {{name}} (Register No. {{register_number}}), {{year}}, Department of {{department}}, is a confirmed participant in "{{event_title}}" organised by {{club_name}} on {{event_date}}, from {{start_time}} to {{end_time}} at {{venue}}.

We kindly request you to grant On Duty to the student for the above date and time.

Thanking you.

Yours sincerely,


{{signatory_name}}
{{signatory_title}}, {{club_name}}`;

export interface OdClub {
  od_template_url: string | null;
  od_body: string | null;
  od_top_mm: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtLongDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};
export const fmt12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Standard PDF fonts only cover WinAnsi; swap typographic punctuation and drop anything else. */
function winAnsi(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');
}

export const fillPlaceholders = (text: string, data: Partial<OdData>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => (data as Record<string, string>)[key] ?? '');

function readTemplate(url: string | null) {
  if (!url?.startsWith('/uploads/')) return null;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

async function drawVerification(page: PDFPage, doc: PDFDocument, data: OdData, verifyUrl: string, font: PDFFont) {
  const png = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 240 });
  const img = await doc.embedPng(png);
  const { width } = page.getSize();
  const size = 62;
  const x = width - 48 - size;
  page.drawImage(img, { x, y: 40, width: size, height: size });
  page.drawText(winAnsi(`OD No. ${data.od_number}`), { x: x - 4, y: 30, size: 7.5, font, color: rgb(0.25, 0.25, 0.28) });
  page.drawText('Scan to verify', { x: x + 6, y: 21, size: 7, font, color: rgb(0.45, 0.45, 0.5) });
}

/** Renders one page per letter into a single PDF (one letter, or all of an event's letters). */
export async function renderOdPdf(club: OdClub, letters: OdData[], verifyBase: string) {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const template = readTemplate(club.od_template_url);

  for (const data of letters) {
    const verifyUrl = `${verifyBase}/od/${data.od_number}`;
    let page: PDFPage;
    if (template) {
      const tpl = await PDFDocument.load(template, { ignoreEncryption: true });
      const form = tpl.getForm();
      const fields = form.getFields().filter(f => f instanceof PDFTextField && (OD_FIELDS as readonly string[]).includes(f.getName())) as PDFTextField[];
      if (fields.length) {
        for (const f of fields) f.setText(winAnsi(data[f.getName() as keyof OdData] ?? ''));
        form.flatten();
        // Flattening leaves dangling widget references in the page's annotation list; drop them before copying.
        tpl.getPage(0).node.delete(PDFName.of('Annots'));
        [page] = await out.copyPages(tpl, [0]);
        out.addPage(page);
        await drawVerification(page, out, data, verifyUrl, font);
        continue;
      }
      [page] = await out.copyPages(tpl, [0]);
      out.addPage(page);
    } else {
      // No template yet (preview only): a plain A4 page with a simple heading.
      page = out.addPage([595.28, 841.89]);
      page.drawText(winAnsi(data.club_name), { x: 56, y: 790, size: 16, font: bold, color: rgb(0.04, 0.32, 0.75) });
      page.drawText(winAnsi(data.college), { x: 56, y: 772, size: 10, font, color: rgb(0.35, 0.35, 0.4) });
      page.drawLine({ start: { x: 56, y: 760 }, end: { x: 539, y: 760 }, thickness: 0.8, color: rgb(0.8, 0.82, 0.86) });
    }

    const { width, height } = page.getSize();
    const left = 56;
    const textWidth = width - left * 2;
    const size = 11;
    const lineHeight = 15.5;
    let y = height - Math.max(20, club.od_top_mm) * 2.8346;
    const body = winAnsi(fillPlaceholders(club.od_body?.trim() || DEFAULT_OD_BODY, data));
    for (const line of wrap(body, font, size, textWidth)) {
      if (y < 110) break; // keep clear of the verification QR and any letterhead footer
      const isHeading = /^(Subject|Sub)\s*:/i.test(line);
      page.drawText(line, { x: left, y, size, font: isHeading ? bold : font, color: rgb(0.08, 0.08, 0.1) });
      y -= lineHeight;
    }
    await drawVerification(page, out, data, verifyUrl, font);
  }
  return out.save();
}

const OD_SELECT = `
  SELECT od.id, od.issued_at, od.event_id, od.registration_id, od.member_id,
    tm.name, tm.register_number, tm.college_name, tm.user_id,
    COALESCE(NULLIF(tm.department, ''), u.department, '') AS department,
    COALESCE(NULLIF(tm.year_of_study, ''), u.year_of_study, '') AS year_of_study,
    r.team_name, r.leader_id, r.status AS reg_status,
    e.title, e.event_date, e.start_time, e.end_time, e.venue, e.status AS event_status, e.club_id,
    c.name AS club_name, c.od_template_url, c.od_body, c.od_top_mm, c.od_signatory_name, c.od_signatory_title
  FROM od_letters od
  JOIN team_members tm ON tm.id = od.member_id
  LEFT JOIN users u ON u.id = tm.user_id
  JOIN registrations r ON r.id = od.registration_id
  JOIN events e ON e.id = od.event_id
  JOIN clubs c ON c.id = e.club_id`;

export function odRows(where: string, ...params: (string | number)[]) {
  return q.all<any>(`${OD_SELECT} WHERE ${where} ORDER BY r.created_at, tm.position`, ...params);
}

export function odDataFromRow(row: any): OdData {
  return {
    name: row.name,
    register_number: row.register_number,
    department: row.department || '-',
    year: row.year_of_study || '-',
    college: row.college_name || COLLEGE_NAME,
    event_title: row.title,
    event_date: fmtLongDate(row.event_date),
    start_time: fmt12h(row.start_time),
    end_time: fmt12h(row.end_time),
    venue: row.venue,
    club_name: row.club_name,
    team_name: row.team_name ?? '',
    od_number: row.id,
    issue_date: fmtLongDate(String(row.issued_at).slice(0, 10)),
    signatory_name: row.od_signatory_name || 'Event Coordinator',
    signatory_title: row.od_signatory_title || 'Faculty Coordinator',
  };
}

export const SAMPLE_OD: OdData = {
  name: 'Ananya Iyer',
  register_number: '21CS045',
  department: 'Computer Science',
  year: '3rd Year',
  college: COLLEGE_NAME,
  event_title: 'Sample Event',
  event_date: fmtLongDate(new Date().toISOString().slice(0, 10)),
  start_time: '9:00 AM',
  end_time: '5:00 PM',
  venue: 'Main Auditorium',
  club_name: 'Your Club',
  team_name: 'Team Sample',
  od_number: 'OD-SAMPLE-0000',
  issue_date: fmtLongDate(new Date().toISOString().slice(0, 10)),
  signatory_name: 'Event Coordinator',
  signatory_title: 'Faculty Coordinator',
};

/** Builds a simple club letterhead PDF (used for the demo seed). */
export async function makeLetterheadPdf(clubName: string, color: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const hex = color.replace('#', '');
  const c = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  page.drawRectangle({ x: 0, y: 812, width: 595.28, height: 30, color: c });
  const sealFile = path.resolve(process.cwd(), 'public', 'college-seal-print.png');
  let textX = 56;
  if (fs.existsSync(sealFile)) {
    const seal = await doc.embedPng(fs.readFileSync(sealFile));
    const h = 64;
    page.drawImage(seal, { x: 56, y: 738, width: (seal.width / seal.height) * h, height: h });
    textX = 56 + (seal.width / seal.height) * h + 14;
  }
  page.drawText(winAnsi(COLLEGE_NAME.toUpperCase()), { x: textX, y: 776, size: 15, font: bold, color: rgb(0.08, 0.08, 0.1) });
  page.drawText(winAnsi(clubName), { x: textX, y: 758, size: 11, font, color: c });
  page.drawLine({ start: { x: 56, y: 732 }, end: { x: 539, y: 732 }, thickness: 1, color: c });
  page.drawLine({ start: { x: 56, y: 118 }, end: { x: 539, y: 118 }, thickness: 0.6, color: rgb(0.8, 0.82, 0.86) });
  return doc.save();
}
