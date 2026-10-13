export type Role = 'admin' | 'club_admin' | 'student';

export interface User {
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
  student_type?: 'internal' | 'external';
  verification?: 'verified' | 'pending' | 'rejected';
  verification_note?: string | null;
  id_card_url?: string | null;
  club_id: string | null;
  status: string;
}

export interface ClubSummary {
  id: string;
  name: string;
  short_name: string;
  color: string;
  kind: 'club' | 'department';
  status?: string;
  description?: string;
  upcoming_count?: number;
  event_count?: number;
  contact_email?: string | null;
}

export type EventStatus = 'pending' | 'published' | 'rejected' | 'completed' | 'cancelled';

export interface CampusEvent {
  id: string;
  club_id: string;
  club_name: string;
  club_short_name: string;
  club_color: string;
  club_kind: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  rules: string;
  requirements: string;
  schedule: string;
  venue: string;
  event_date: string;
  start_time: string;
  end_time: string;
  reg_deadline: string;
  fee: number;
  team_min: number;
  team_max: number;
  max_teams: number;
  poster_url: string | null;
  payment_qr_url: string | null;
  upi_id: string | null;
  payee_name: string | null;
  whatsapp_link?: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: EventStatus;
  admin_note: string | null;
  featured: number;
  internal_only: number;
  reg_open: number;
  created_at: string;
  certificates_issued_at: string | null;
  teams_count: number;
  approved_count: number;
  pending_count: number;
  checked_in_count: number;
  spots_left: number;
  is_past: boolean;
  registration_open: boolean;
  closed_reason: string | null;
}

export type RegStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TeamMember {
  id: string;
  user_id: string | null;
  name: string;
  register_number: string;
  college_name: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  is_leader: number;
  attended: number;
}

export interface Registration {
  id: string;
  code: string;
  event_id: string;
  leader_id: string;
  team_name: string | null;
  status: RegStatus;
  amount: number;
  transaction_id: string | null;
  payment_proof_url: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  checked_in_at: string | null;
  award: string | null;
  created_at: string;
  members: TeamMember[];
}

export interface MyRegistration extends Registration {
  event_title: string;
  poster_url: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  fee: number;
  category: string;
  whatsapp_link: string | null;
  event_status: EventStatus;
  payment_qr_url: string | null;
  upi_id: string | null;
  payee_name: string | null;
  certificates_issued_at: string | null;
  club_name: string;
  club_color: string;
  leader_name: string;
  is_leader: boolean;
  qr_payload: string | null;
  feedback_given: number;
}

export interface ClubRegistration extends Registration {
  leader_name: string;
  leader_email: string;
  leader_phone: string | null;
  leader_code: string | null;
  reviewed_by_name: string | null;
}

export interface Certificate {
  /** null while locked: the student hasn't given feedback for this event yet. */
  id: string | null;
  locked?: boolean;
  registration_id: string;
  event_id: string;
  recipient_name: string;
  register_number: string;
  college_name: string;
  team_name: string | null;
  award: string | null;
  issued_at: string;
  event_title: string;
  event_date: string;
  category: string;
  venue: string;
  club_name: string;
  club_color: string;
  registration_code: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  action_url: string | null;
  action_label: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Complaint {
  id: string;
  club_id: string;
  subject: string;
  category: string;
  description: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
  raised_by_name: string;
  club_name?: string;
  club_color?: string;
  raised_by_email?: string;
}

export const CATEGORIES = ['Hackathon', 'Workshop', 'Technical', 'Cultural', 'Sports', 'Symposium', 'Seminar', 'Competition', 'Gaming', 'Other'];
