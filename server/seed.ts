import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { q, insert, newId, randomCode, tx, localDate, addDays, setSetting, COLLEGE_NAME, studentTypeFor } from './db';
import { hashPassword } from './auth';
import { saveImage, savePdf } from './services';
import { makeLetterheadPdf } from './od';

export { COLLEGE_NAME };

const img = (id: string) => `https://images.unsplash.com/${id}?w=1200&auto=format&fit=crop&q=75`;
const day = (offset: number) => localDate(addDays(offset));
const deadline = (offset: number, time = '23:59') => `${day(offset)}T${time}`;
const ago = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();

export async function seedIfEmpty() {
  const existing = q.get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n;
  if (existing > 0) return false;

  const qr = async (upi: string, name: string) =>
    saveImage(await QRCode.toDataURL(`upi://pay?pa=${upi}&pn=${encodeURIComponent(name)}&cu=INR`, { margin: 1, width: 480 }), 'qr');
  const qrCodeCraft = await qr('codecraft.mce@okaxis', 'CodeCraft Club');
  const qrRobo = await qr('roboriders@oksbi', 'RoboRiders');
  const qrKala = await qr('kalakriti.mce@okicici', 'Kalakriti Cultural Club');

  tx(() => {
    setSetting('require_event_approval', 'true');
    const created = ago(24 * 40);

    /* ------------------------------------------------------------- clubs */
    const clubs = {
      code: { id: newId(), name: 'CodeCraft Coding Club', short_name: 'CodeCraft', kind: 'club', color: '#0A84FF', description: 'Competitive programming, hackathons and developer workshops for every skill level.', contact_email: 'codecraft@campuspulse.edu' },
      robo: { id: newId(), name: 'RoboRiders Robotics Club', short_name: 'RoboRiders', kind: 'club', color: '#FF9F0A', description: 'We build line followers, drones and combat bots, and teach you how to build yours.', contact_email: 'robotics@campuspulse.edu' },
      ece: { id: newId(), name: 'Department of ECE', short_name: 'ECE Dept', kind: 'department', color: '#30D158', description: 'Electronics & Communication Engineering association: technical contests, guest lectures and lab days.', contact_email: 'ece@campuspulse.edu' },
      kala: { id: newId(), name: 'Kalakriti Cultural Club', short_name: 'Kalakriti', kind: 'club', color: '#BF5AF2', description: 'Dance, music, theatre and fine arts. Home of the annual cultural fest.', contact_email: 'culturals@campuspulse.edu' },
      sports: { id: newId(), name: 'Sports Council', short_name: 'Sports', kind: 'club', color: '#FF453A', description: 'Inter-department tournaments, fitness drives and college team trials.', contact_email: 'sports@campuspulse.edu' },
      ecell: { id: newId(), name: 'Entrepreneurship Cell', short_name: 'E-Cell', kind: 'club', color: '#64D2FF', description: 'Startup talks, pitch nights and founder office hours.', contact_email: 'ecell@campuspulse.edu' },
    };
    for (const c of Object.values(clubs)) insert('clubs', { ...c, status: 'active', created_at: created });

    /* ------------------------------------------------------------- users */
    const staffPw = hashPassword('Club@1234');
    const admin = newId();
    insert('users', { id: admin, role: 'admin', name: 'Dr. Lakshmi Narayanan', email: 'admin@campuspulse.edu', phone: '+91 98400 10001', password_hash: hashPassword('Admin@1234'), status: 'active', created_at: created });

    const clubAdmins: Record<keyof typeof clubs, string> = {} as any;
    const staff: [keyof typeof clubs, string, string][] = [
      ['code', 'Vikram Sen', 'codecraft@campuspulse.edu'],
      ['robo', 'Priya Raghavan', 'robotics@campuspulse.edu'],
      ['ece', 'Prof. S. Mohan', 'ece@campuspulse.edu'],
      ['kala', 'Meera Joshi', 'culturals@campuspulse.edu'],
      ['sports', 'Coach Daniel Thomas', 'sports@campuspulse.edu'],
      ['ecell', 'Farhan Ali', 'ecell@campuspulse.edu'],
    ];
    for (const [key, name, email] of staff) {
      const id = newId();
      clubAdmins[key] = id;
      insert('users', { id, role: 'club_admin', name, email, phone: '+91 98400 2' + String(1000 + Object.keys(clubAdmins).length).slice(-4), password_hash: staffPw, club_id: clubs[key].id, status: 'active', created_at: created });
    }

    const studentPw = hashPassword('Student@123');
    type Student = { id: string; name: string; register_number: string; college_name: string; department: string; email: string; phone: string; unique_code: string };
    const mkStudent = (name: string, reg: string, dept: string, year: string, email: string, code: string, college = COLLEGE_NAME): Student => {
      const s = { id: newId(), name, register_number: reg, college_name: college, department: dept, email, phone: `+91 9${String(Math.abs(hash(email))).padStart(9, '0').slice(0, 9)}`, unique_code: code };
      insert('users', { ...s, role: 'student', student_type: studentTypeFor(college), year_of_study: year, password_hash: studentPw, status: 'active', created_at: ago(24 * (20 + (hash(code) % 15))) });
      return s;
    };
    const ananya = mkStudent('Ananya Iyer', '21CS045', 'Computer Science and Engineering', '3rd Year', 'ananya@student.edu', 'CP-ANANYA');
    const rahul = mkStudent('Rahul Verma', '21CS078', 'Computer Science and Engineering', '3rd Year', 'rahul@student.edu', 'CP-R4HUL7');
    const karthik = mkStudent('Karthik Raja', '22EC012', 'Electronics and Communication Engineering', '2nd Year', 'karthik@student.edu', 'CP-K4RTHK');
    const sneha = mkStudent('Sneha Pillai', '21IT033', 'Information Technology', '3rd Year', 'sneha@student.edu', 'CP-SN3HAP');
    const arjun = mkStudent('Arjun Mehta', '22ME019', 'Mechanical Engineering', '2nd Year', 'arjun@student.edu', 'CP-ARJ8NM');

    const extraNames = ['Divya Krishnan', 'Mohammed Irfan', 'Harini Suresh', 'Aditya Rao', 'Nithya Ramesh', 'Siddharth Nair', 'Pooja Desai', 'Vignesh Kumar', 'Kavya Menon', 'Rohan Gupta', 'Aishwarya Bala', 'Naveen Prakash'];
    const depts = ['Computer Science and Engineering', 'Information Technology', 'Electronics and Communication Engineering', 'Mechanical Engineering', 'Electrical and Electronics Engineering'];
    const extras = extraNames.map((n, i) =>
      mkStudent(n, `2${1 + (i % 3)}${['CS', 'IT', 'EC', 'ME', 'EE'][i % 5]}${String(100 + i * 7).padStart(3, '0')}`, depts[i % 5], `${2 + (i % 3)}${['nd', 'rd', 'th'][i % 3]} Year`, `${n.split(' ')[0].toLowerCase()}${i}@student.edu`, `CP-${randomCode(6)}`, i % 4 === 3 ? 'Riverside Institute of Technology' : COLLEGE_NAME),
    );

    /* ------------------------------------------------------------ events */
    const ev = (club: keyof typeof clubs, e: Record<string, unknown>) => {
      const id = newId();
      insert('events', {
        id,
        club_id: clubs[club].id,
        status: 'published',
        featured: 0,
        reg_open: 1,
        created_by: clubAdmins[club],
        created_at: ago(24 * 12),
        updated_at: ago(24 * 2),
        contact_name: staff.find(s => s[0] === club)![1],
        contact_phone: '+91 98400 3' + String(1000 + Object.keys(clubs).indexOf(club)).slice(-4),
        ...e,
      });
      return id;
    };

    const hack = ev('code', {
      title: 'HackSprint 2026',
      category: 'Hackathon',
      tagline: '24 hours. One problem statement. Build something that ships.',
      description: 'HackSprint is our flagship 24-hour hackathon. Teams pick one of three tracks (campus utilities, sustainability, or open innovation), build a working prototype overnight, and demo it to a jury of alumni engineers.\n\nMentors are on the floor all night, meals and snacks are covered, and the top three teams take home ₹50,000 in prizes plus internship interviews with our sponsors.',
      rules: 'Teams of 2 to 4 members; cross-department teams are encouraged.\nAll code must be written during the event. Boilerplate and open-source libraries are allowed.\nEach team gets a 5-minute demo and 2 minutes of Q&A.\nJudging: impact 30%, technical depth 30%, design 20%, presentation 20%.\nJudges’ decisions are final.',
      requirements: 'College ID card\nLaptop and charger\nExtension box (one per team)\nGitHub account',
      schedule: '09:00 | Check-in & breakfast\n10:00 | Opening ceremony & problem statements\n10:30 | Hacking begins\n14:00 | Mentor round 1\n22:00 | Mid-point review\n10:00 | Code freeze (Day 2)\n10:30 | Demos & judging\n13:00 | Results & prize distribution',
      venue: 'Main Auditorium & Lab Block A',
      event_date: day(9),
      start_time: '09:00',
      end_time: '18:00',
      reg_deadline: deadline(6),
      fee: 200,
      team_min: 2,
      team_max: 4,
      max_teams: 60,
      poster_url: img('photo-1504384308090-c894fdcc538d'),
      payment_qr_url: qrCodeCraft,
      upi_id: 'codecraft.mce@okaxis',
      payee_name: 'CodeCraft Club',
      whatsapp_link: 'https://chat.whatsapp.com/HackSprint2026Demo',
      featured: 1,
    });

    const lineFollower = ev('robo', {
      title: 'Line Follower Showdown',
      category: 'Competition',
      tagline: 'Fastest bot on the black line wins.',
      description: 'Bring your autonomous line-following robot and race it on a track with sharp turns, intersections and a surprise section revealed on the day. Best of three runs counts.',
      rules: 'Bot must fit within a 25 × 25 cm box.\nMaximum battery voltage 12 V.\nNo wireless control during runs.\nThree attempts per team; fastest valid run counts.',
      requirements: 'Your robot, fully charged\nSpare batteries\nCollege ID card',
      schedule: '09:30 | Bot inspection\n10:30 | Qualifier runs\n13:30 | Final runs\n15:30 | Prize distribution',
      venue: 'Robotics Lab, Block C',
      event_date: day(1),
      start_time: '09:30',
      end_time: '16:00',
      reg_deadline: deadline(0, '12:00'),
      fee: 150,
      team_min: 2,
      team_max: 3,
      max_teams: 30,
      poster_url: img('photo-1485827404703-89b55fcc595e'),
      payment_qr_url: qrRobo,
      upi_id: 'roboriders@oksbi',
      payee_name: 'RoboRiders',
      whatsapp_link: 'https://chat.whatsapp.com/LineFollowerDemo',
    });

    ev('code', {
      title: 'Figma for Developers',
      category: 'Workshop',
      tagline: 'Turn wireframes into interfaces people enjoy using.',
      description: 'A hands-on, 3-hour workshop on layout, auto-layout, components and handing designs to developers. You will redesign a real campus app screen by the end of the session.',
      rules: 'Individual participation.\nSeats are first come, first served.',
      requirements: 'Laptop with a free Figma account',
      schedule: '14:00 | Design fundamentals\n15:00 | Auto-layout & components\n16:15 | Build-along project',
      venue: 'Seminar Hall 2',
      event_date: day(4),
      start_time: '14:00',
      end_time: '17:00',
      reg_deadline: deadline(3),
      fee: 0,
      team_min: 1,
      team_max: 1,
      max_teams: 80,
      poster_url: img('photo-1561070791-2526d30994b5'),
      whatsapp_link: 'https://chat.whatsapp.com/FigmaWorkshopDemo',
    });

    const rhythm = ev('kala', {
      title: "Rhythm '26: Inter-College Dance",
      category: 'Cultural',
      tagline: 'Group dance, any style. The stage is yours.',
      description: 'The biggest dance night of the semester. Crews from colleges across the city compete in a 6-minute group performance judged on choreography, sync, expression and costume.',
      rules: 'Crew size 4 to 10.\nPerformance time 5–6 minutes including setup.\nSubmit your track on a pen drive at registration desk.\nNo fire, water or confetti props.',
      requirements: 'Audio track (MP3) on a pen drive\nCollege ID for every member',
      schedule: '17:00 | Reporting\n18:00 | Performances begin\n21:30 | Results',
      venue: 'Open Air Theatre',
      event_date: day(15),
      start_time: '17:00',
      end_time: '22:00',
      reg_deadline: deadline(12),
      fee: 300,
      team_min: 4,
      team_max: 10,
      max_teams: 20,
      poster_url: img('photo-1514525253161-7a46d19cd819'),
      payment_qr_url: qrKala,
      upi_id: 'kalakriti.mce@okicici',
      payee_name: 'Kalakriti Cultural Club',
      whatsapp_link: 'https://chat.whatsapp.com/Rhythm26Demo',
      featured: 1,
    });

    ev('ece', {
      title: 'Circuit Debugging Challenge',
      category: 'Technical',
      tagline: 'Find the fault before the clock runs out.',
      description: 'Teams get faulty analog and digital circuits and must diagnose and fix them in timed rounds. Great practice for lab exams and core-company interviews.',
      rules: 'Teams of 1 or 2.\nMultimeters and oscilloscopes provided.\nNo phones during rounds.',
      requirements: 'College ID card\nBasic stationery',
      schedule: '10:00 | Round 1: analog\n11:30 | Round 2: digital\n13:00 | Finals',
      venue: 'Electronics Lab 2',
      event_date: day(6),
      start_time: '10:00',
      end_time: '14:00',
      reg_deadline: deadline(5),
      fee: 100,
      team_min: 1,
      team_max: 2,
      max_teams: 40,
      poster_url: img('photo-1518770660439-4636190af475'),
      upi_id: 'ece.association@okhdfcbank',
      payee_name: 'ECE Association',
      whatsapp_link: 'https://chat.whatsapp.com/CircuitDebugDemo',
    });

    const pitch = ev('ecell', {
      title: 'Pitch Night: Startup Edition',
      category: 'Competition',
      tagline: 'Five minutes to convince the room.',
      description: 'Pitch your startup idea to a panel of founders and angel investors. Top three ideas get mentorship and incubation support from the college incubator.',
      rules: 'Teams of 1 to 3.\n5-minute pitch + 3 minutes of questions.\nSlides must be submitted by 12 PM on the event day.',
      requirements: 'Pitch deck (PDF)',
      schedule: '17:30 | Networking\n18:00 | Pitches\n20:30 | Results',
      venue: 'Innovation Centre',
      event_date: day(11),
      start_time: '17:30',
      end_time: '21:00',
      reg_deadline: deadline(9),
      fee: 0,
      team_min: 1,
      team_max: 3,
      max_teams: 25,
      poster_url: img('photo-1559136555-9303baea8ebd'),
      whatsapp_link: 'https://chat.whatsapp.com/PitchNightDemo',
    });

    ev('sports', {
      title: 'Inter-Department Football Cup',
      internal_only: 1,
      category: 'Sports',
      tagline: 'Seven-a-side. Knockouts. Bragging rights.',
      description: 'Department teams battle it out in a two-day seven-a-side knockout tournament. Matches are 20 minutes each way with rolling substitutions.',
      rules: 'Squad of 7 to 11 players.\nAll players must be from the same department.\nStuds allowed; shin guards mandatory.',
      requirements: 'Team jersey\nShin guards\nCollege ID card',
      schedule: '07:00 | Reporting\n07:30 | Group matches\n15:00 | Knockouts',
      venue: 'College Football Ground',
      event_date: day(20),
      start_time: '07:00',
      end_time: '17:00',
      reg_deadline: deadline(16),
      fee: 500,
      team_min: 7,
      team_max: 11,
      max_teams: 16,
      poster_url: img('photo-1546519638-68e109498ffc'),
      upi_id: 'sportscouncil.mce@okaxis',
      payee_name: 'Sports Council',
      whatsapp_link: 'https://chat.whatsapp.com/FootballCupDemo',
    });

    ev('kala', {
      title: 'Campus Photo Walk',
      internal_only: 1,
      category: 'Cultural',
      tagline: 'Golden hour, good company, one camera.',
      description: 'A guided photo walk around campus at golden hour, followed by a short editing session. Phone cameras are welcome.',
      rules: 'Individual participation.\nBest three shots will be featured on the club page.',
      requirements: 'Any camera or phone',
      schedule: '16:30 | Meet at the main gate\n17:00 | Walk\n18:30 | Editing session',
      venue: 'Main Gate',
      event_date: day(7),
      start_time: '16:30',
      end_time: '19:00',
      reg_deadline: deadline(6),
      fee: 0,
      team_min: 1,
      team_max: 1,
      max_teams: 40,
      poster_url: img('photo-1452587925148-ce544e77e70d'),
    });

    ev('robo', {
      title: 'Drone Building Bootcamp',
      category: 'Workshop',
      tagline: 'Assemble, calibrate and fly your first quadcopter.',
      description: 'A two-day bootcamp where teams assemble a quadcopter from a kit, learn flight controller tuning and fly it on day two. Kits are shared per team.',
      rules: 'Teams of 2 or 3.\nSafety briefing attendance is mandatory before flying.',
      requirements: 'Laptop\nCollege ID card',
      schedule: '09:00 | Assembly\n13:00 | Flight controller setup\n15:00 | Test flights',
      venue: 'Robotics Lab, Block C',
      event_date: day(18),
      start_time: '09:00',
      end_time: '17:00',
      reg_deadline: deadline(14),
      fee: 400,
      team_min: 2,
      team_max: 3,
      max_teams: 15,
      poster_url: img('photo-1473968512647-3e447244af8f'),
      payment_qr_url: qrRobo,
      upi_id: 'roboriders@oksbi',
      payee_name: 'RoboRiders',
      whatsapp_link: 'https://chat.whatsapp.com/DroneBootcampDemo',
      status: 'pending',
      created_at: ago(20),
    });

    const golf = ev('code', {
      title: 'Code Golf Classic',
      category: 'Technical',
      tagline: 'Fewest characters wins.',
      description: 'Solve five puzzles in the shortest code possible, in any language. A relaxed evening contest with pizza.',
      rules: 'Teams of 1 or 2.\nAny language available on the judge.',
      requirements: 'Laptop',
      schedule: '16:00 | Contest\n18:00 | Results',
      venue: 'Lab Block A, Room 204',
      event_date: day(-5),
      start_time: '16:00',
      end_time: '18:30',
      reg_deadline: deadline(-6),
      fee: 50,
      team_min: 1,
      team_max: 2,
      max_teams: 50,
      poster_url: img('photo-1517694712202-14dd9538aa97'),
      payment_qr_url: qrCodeCraft,
      upi_id: 'codecraft.mce@okaxis',
      payee_name: 'CodeCraft Club',
      status: 'completed',
      reg_open: 0,
      certificates_issued_at: ago(24 * 3),
    });

    /* ----------------------------------------------------- registrations */
    const reg = (eventId: string, leader: Student, members: (Student | Omit<Student, 'id' | 'unique_code' | 'email' | 'phone'>)[], o: Record<string, unknown>) => {
      const id = newId();
      const code = `REG-${randomCode(6)}`;
      const { attended, ...fields } = o;
      const createdAt = (fields.created_at as string) ?? ago(48);
      insert('registrations', { id, code, event_id: eventId, leader_id: leader.id, status: 'approved', amount: 0, created_at: createdAt, updated_at: createdAt, ...fields });
      [leader, ...members].forEach((m, i) =>
        insert('team_members', {
          id: newId(),
          registration_id: id,
          user_id: 'id' in m ? m.id : null,
          name: m.name,
          register_number: m.register_number,
          college_name: m.college_name,
          department: m.department,
          email: 'email' in m ? m.email : null,
          phone: 'phone' in m ? m.phone : null,
          is_leader: i === 0 ? 1 : 0,
          attended: attended ? 1 : 0,
          position: i,
        }),
      );
      return id;
    };
    const txn = () => `T${Date.now().toString().slice(-6)}${randomCode(6)}`;

    // HackSprint: a healthy mix of approved and pending teams.
    reg(hack, ananya, [rahul, sneha], { team_name: 'Null Pointers', amount: 200, transaction_id: txn(), reviewed_by: clubAdmins.code, reviewed_at: ago(30), created_at: ago(40) });
    reg(hack, karthik, [extras[2]], { team_name: 'Bit Bandits', status: 'pending', amount: 200, transaction_id: txn(), created_at: ago(5) });
    reg(hack, extras[0], [extras[1], extras[3]], { team_name: 'Stack Smashers', amount: 200, transaction_id: txn(), reviewed_by: clubAdmins.code, reviewed_at: ago(50), created_at: ago(60) });
    reg(hack, extras[4], [extras[5]], { team_name: 'Async Avengers', status: 'pending', amount: 200, transaction_id: txn(), created_at: ago(2) });
    reg(hack, extras[6], [extras[7], extras[8], extras[9]], { team_name: 'Kernel Panic', amount: 200, transaction_id: txn(), reviewed_by: clubAdmins.code, reviewed_at: ago(20), created_at: ago(26) });
    reg(hack, extras[10], [extras[11]], { team_name: 'Ctrl Alt Elite', status: 'rejected', amount: 200, transaction_id: txn(), review_note: 'Transaction ID not found in our UPI statement.', reviewed_by: clubAdmins.code, reviewed_at: ago(8), created_at: ago(12) });

    // Line Follower is tomorrow, so the scheduler sends reminders on first start.
    reg(lineFollower, ananya, [arjun, { name: 'Ravi Shankar', register_number: '21ME204', college_name: 'Riverside Institute of Technology', department: 'Mechanical' }], { team_name: 'Speed Demons', amount: 150, transaction_id: txn(), reviewed_by: clubAdmins.robo, reviewed_at: ago(70), created_at: ago(80) });
    reg(lineFollower, extras[3], [extras[6]], { team_name: 'Track Masters', amount: 150, transaction_id: txn(), reviewed_by: clubAdmins.robo, reviewed_at: ago(60), created_at: ago(72) });
    reg(lineFollower, extras[9], [extras[1]], { team_name: 'Photon', status: 'pending', amount: 150, transaction_id: txn(), created_at: ago(3) });

    reg(rhythm, sneha, [ananya, extras[0], extras[4]], { team_name: 'Nritya Collective', status: 'pending', amount: 300, transaction_id: txn(), created_at: ago(1) });
    reg(pitch, rahul, [], { team_name: 'FarmLink', created_at: ago(15) });

    // Completed event with attendance, awards and certificates already issued.
    const golfA = reg(golf, ananya, [rahul], { team_name: 'One-Liners', amount: 50, transaction_id: txn(), reviewed_by: clubAdmins.code, reviewed_at: ago(24 * 8), checked_in_at: ago(24 * 5 + 2), checked_in_by: clubAdmins.code, award: 'Winner', attended: true, created_at: ago(24 * 9) });
    const golfB = reg(golf, karthik, [], { team_name: 'Semicolon', amount: 50, transaction_id: txn(), reviewed_by: clubAdmins.code, reviewed_at: ago(24 * 8), checked_in_at: ago(24 * 5 + 1), checked_in_by: clubAdmins.code, attended: true, created_at: ago(24 * 9) });
    for (const regId of [golfA, golfB]) {
      const r = q.get<any>('SELECT * FROM registrations WHERE id = ?', regId)!;
      for (const m of q.all<any>('SELECT * FROM team_members WHERE registration_id = ?', regId)) {
        insert('certificates', { id: `CERT-${randomCode(4)}-${randomCode(4)}`, registration_id: regId, member_id: m.id, event_id: golf, recipient_name: m.name, register_number: m.register_number, college_name: m.college_name, team_name: r.team_name, award: r.award, issued_at: ago(24 * 3) });
      }
    }

    // Two of the three Code Golf participants have rated it; Karthik's certificate stays locked until he does.
    insert('feedback', { id: newId(), event_id: golf, user_id: ananya.id, rating: 5, comment: 'Loved the puzzles. Please make it a monthly thing!', created_at: ago(24 * 4) });
    insert('feedback', { id: newId(), event_id: golf, user_id: rahul.id, rating: 4, comment: 'Great fun. The judge was a bit slow near the end.', created_at: ago(24 * 4 - 3) });

    /* ------------------------------------------------------- complaints */
    insert('complaints', { id: newId(), club_id: clubs.robo.id, raised_by: clubAdmins.robo, subject: 'Robotics Lab power sockets not working', category: 'Venue / Infrastructure', description: 'Half the bench sockets in Robotics Lab, Block C have no power. We need them fixed before the Line Follower Showdown tomorrow.', priority: 'high', status: 'open', created_at: ago(6), updated_at: ago(6) });
    insert('complaints', { id: newId(), club_id: clubs.code.id, raised_by: clubAdmins.code, subject: 'Need auditorium booking extended to 24 hours', category: 'Venue / Infrastructure', description: 'HackSprint runs overnight. Please approve the auditorium and Lab Block A for the full 24 hours, with security on duty.', priority: 'normal', status: 'in_progress', admin_reply: 'Forwarded to the estate office. Security is confirmed; waiting on the lab in-charge.', created_at: ago(72), updated_at: ago(20) });
    insert('complaints', { id: newId(), club_id: clubs.kala.id, raised_by: clubAdmins.kala, subject: 'Sound system budget approval', category: 'Finance', description: 'Requesting approval for ₹18,000 for sound and lights rental for Rhythm 26.', priority: 'normal', status: 'resolved', admin_reply: 'Approved. Raise the invoice through the student affairs office.', created_at: ago(24 * 6), updated_at: ago(24 * 4) });

    /* ---------------------------------------------------- notifications */
    const note = (user: string, kind: string, title: string, body: string, link: string | null, hoursAgo: number, extra: Record<string, unknown> = {}) =>
      insert('notifications', { id: newId(), user_id: user, kind, title, body, link, created_at: ago(hoursAgo), ...extra });
    note(ananya.id, 'approval', 'Payment verified: HackSprint 2026', 'Team Null Pointers is confirmed. Your entry QR is ready in My Registrations. Join the WhatsApp group for updates.', '/registrations', 30, { action_url: 'https://chat.whatsapp.com/HackSprint2026Demo', action_label: 'Join WhatsApp group' });
    note(ananya.id, 'certificate', 'Certificates ready: Code Golf Classic', 'Certificates for your team are available to view, download and print.', '/certificates', 72);
    note(admin, 'event', 'Event awaiting approval', 'RoboRiders Robotics Club submitted "Drone Building Bootcamp".', '/admin/events?status=pending', 20);
    note(clubAdmins.code, 'payment', 'New registration to verify', 'Karthik Raja (Team Bit Bandits) registered for HackSprint 2026.', `/club/events/${hack}?tab=pending`, 5);
  });

  // Every demo club gets a letterhead OD template; tomorrow's Line Follower team already has its ODs.
  const signatories: Record<string, [string, string]> = {
    CodeCraft: ['Dr. R. Senthil Kumar', 'Faculty Coordinator'],
    RoboRiders: ['Dr. K. Anitha', 'Faculty Coordinator'],
  };
  for (const c of q.all<{ id: string; name: string; short_name: string; color: string }>('SELECT id, name, short_name, color FROM clubs')) {
    const pdf = await makeLetterheadPdf(c.name, c.color);
    const url = savePdf(`data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}`, 'od-template');
    const [name, title] = signatories[c.short_name] ?? ['Club Coordinator', 'Faculty Coordinator'];
    q.run('UPDATE clubs SET od_template_url = ?, od_signatory_name = ?, od_signatory_title = ? WHERE id = ?', url, name, title, c.id);
  }
  // An external student whose ID card is waiting for the admin (shows the verification flow).
  const card = path.resolve(process.cwd(), 'server', 'seed-assets', 'sample-id-card.png');
  if (fs.existsSync(card)) {
    const idUrl = saveImage(`data:image/png;base64,${fs.readFileSync(card).toString('base64')}`, 'idcard');
    const pendingId = newId();
    insert('users', {
      id: pendingId, role: 'student', name: 'Meera Thomas', email: 'meera@student.edu', phone: '+91 9840011223',
      password_hash: hashPassword('Student@123'), register_number: 'RIT22CS117', college_name: 'Riverside Institute of Technology',
      student_type: 'external', verification: 'pending', id_card_url: idUrl, department: 'Computer Science and Engineering',
      year_of_study: '3rd Year', status: 'active', created_at: ago(3),
    });
    const admin = q.get<{ id: string }>(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)!;
    insert('notifications', { id: newId(), user_id: admin.id, kind: 'announcement', title: 'External student to verify', body: 'Meera Thomas (Riverside Institute of Technology) signed up and uploaded an ID card for verification.', link: '/admin/verifications', created_at: ago(3) });
  }

  const speed = q.all<{ member_id: string; registration_id: string; event_id: string; college_name: string }>(
    `SELECT tm.id AS member_id, r.id AS registration_id, r.event_id, tm.college_name FROM registrations r JOIN team_members tm ON tm.registration_id = r.id WHERE r.team_name = 'Speed Demons'`,
  );
  for (const m of speed.filter(m => m.college_name === COLLEGE_NAME)) {
    insert('od_letters', { id: `OD-${randomCode(4)}-${randomCode(4)}`, event_id: m.event_id, registration_id: m.registration_id, member_id: m.member_id, issued_at: ago(30) });
  }
  return true;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

