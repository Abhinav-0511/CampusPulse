# CampusPulse

College event management for three roles: **portal admin**, **club / department admin**, and **students**. Students discover events, register teams, pay the club by UPI, get a QR entry pass and receive certificates. Clubs run events, verify payments, export registrations to Excel and check teams in at the gate. Admins govern the whole portal.

## Run it

Requires **Node.js 22.13+** (Node 24 recommended). The database is SQLite built into Node, so there's nothing else to install.

```bash
npm install
npm run dev          # http://localhost:3000
```

The first start creates `data/campuspulse.db` and seeds demo data. Event dates are relative to today, so the demo always has upcoming, ongoing and past events.

| Role | Login | Password |
|---|---|---|
| Student | `ananya@student.edu` (or ID `CP-ANANYA`) | `Student@123` |
| Club admin (CodeCraft) | `codecraft@campuspulse.edu` | `Club@1234` |
| Club admin (RoboRiders) | `robotics@campuspulse.edu` | `Club@1234` |
| Portal admin | `admin@campuspulse.edu` | `Admin@1234` |

Other useful commands:

```bash
npm run reset-db     # wipe data/ and re-seed on next start
npm run lint         # type-check client + server
npm run build && npm start   # production build served by the same server
```

Optional settings (college name, email via SMTP, QR signing secret) are in `.env.example`. Copy it to `.env`.

## What each role does

**Student**
- Signs up with name, register number, college, department, year, phone and email, plus a captcha. They get a unique **CampusPulse ID** (e.g. `CP-7KQ2MX`) and an **Internal** tag (studies at the host college, `COLLEGE_NAME`) or **External** tag.
- **External students** (other colleges) also upload a photo of their college ID card. Until the portal admin verifies it they only see a status page (no CampusPulse ID, no events). If rejected, they see the reason and can re-upload.
- Signs in with email *or* CampusPulse ID (with captcha).
- Home: today/tomorrow alerts, search, featured events, "happening this week", closing deadlines, clubs.
- Explore with search and filters (category, club, free/paid, open only, past events). Club pages.
- Registers a team: the leader is the logged-in student. Members are added **by CampusPulse ID** (details auto-filled and verified, and their certificate shows up in their own account) or typed manually.
- Paid events: sees the club's UPI QR (or one generated with the exact amount), pays, and submits the transaction ID plus an optional screenshot. Free events are confirmed instantly.
- My Registrations: status tracker, QR entry pass, WhatsApp group link (only after approval), resubmit a rejected payment, cancel.
- **OD letters** (internal students only): once the club verifies payment and issues ODs, each student downloads their On-Duty letter as a PDF from My Registrations. The team leader can download every member's. Each OD carries a number and a QR that HODs scan to verify it at `/od/<number>`.
- After the event: scans the club's **feedback QR**, rates the event (1–5 stars plus a comment). Feedback unlocks their certificates.
- Certificates: the team leader sees every member's certificate. Each one is printable to PDF and verifiable.

**Club / department admin** (accounts are created by the portal admin)
- Creates events (optionally **internal students only**) with poster, description, rules, requirements, schedule, venue, date and time, registration deadline, team size, capacity, fee, payment QR / UPI ID, WhatsApp link and contact. Gets a warning if the venue is already booked at that time.
- Payment verification queue: transaction ID, screenshot and team. Approve, or reject with a reason (the team can resubmit). Approval notifies the team with the WhatsApp link.
- Registrations list with search, **Excel export** (Teams + Participants sheets), cancel a registration.
- **QR check-in scanner** (phone or laptop camera, or a USB scanner or typed code): marks which team members are actually present. Attendance updates live.
- **OD template** page: upload the club's OD template PDF once, either a letterhead (the editable letter text with `{{name}}`, `{{department}}`… fields is written onto it) or a fillable PDF form whose text fields are named after those fields. Set the signatory and preview the result.
- **OD letters tab** on each event: lists internal students of payment-verified teams with department and year, issues ODs in one click (students are notified), and downloads all ODs as one PDF.
- **Feedback tab**: a QR to show on screen (with a full-screen mode), average rating, star breakdown and comments.
- Awards (Winner, Runner-up, …), then **generate certificates** for attended members. Leaders are notified.
- Announcements to confirmed teams, close/reopen registrations, cancel the event (notifies everyone).
- Support: raise complaints or requests to the portal admin and see replies.

**Portal admin**
- Overview: students, live events, registrations, fees, open complaints, per-club table, 14-day registrations chart.
- Approves or requests changes to new events (venue clashes are flagged), features events on the student home page, and can unpublish them. Can open any event's registrations.
- Creates clubs together with their admin login (a temporary password is shown once), adds more admins, deactivates clubs.
- Users: search students, suspend/reactivate (this signs them out), reset passwords, create staff or other admins.
- **Verifications**: review external students' ID cards and approve (issues their CampusPulse ID) or reject with a reason.
- Complaints inbox with status and replies; settings (require approval on/off, broadcast announcements).

## Automations
- **Day-before reminder**: every 15 minutes the server checks for confirmed teams whose event is tomorrow and notifies the leader and linked members once (in-app, plus email if SMTP is set).
- Notifications for registration, approval or rejection, schedule changes, cancellation, certificates, event approval, complaint replies and broadcasts.

## Security notes
- Passwords are hashed with scrypt; sessions are httpOnly cookies; login and sign-up are rate-limited and need a server-checked captcha (single use, 5-minute expiry).
- QR passes are HMAC-signed (`QR_SECRET`), so a forged or edited QR is rejected at the gate.
- A transaction ID can't be reused across registrations; a student can't be in two teams for the same event; capacity is re-checked inside a transaction.
- Club admins can only act on their own club's events.
- **WhatsApp:** the app shares the group link in the approval notification and email. Sending WhatsApp messages automatically would require the paid WhatsApp Business API, which isn't included.
- **Camera scanning** needs HTTPS or `localhost`. On a phone over your LAN, use an HTTPS tunnel (e.g. `npx localtunnel --port 3000`) or the manual entry box.

## Project layout
```
server/            Express API + SQLite
  index.ts         app entry (Vite in dev, ./dist in production)
  db.ts            schema + query helpers
  auth.ts          sessions, password hashing, role guards
  captcha.ts       SVG captcha
  services.ts      uploads, signed QR, notifications/email
  scheduler.ts     day-before reminders
  seed.ts          demo data
  routes/          auth, student, club, admin
src/               React + Tailwind client
  pages/student|club|admin, components/, lib/
data/              database + uploaded images (git-ignored)
```
