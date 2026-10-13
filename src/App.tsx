import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { homePath, useAuth } from './lib/auth';
import type { Role } from './lib/types';
import { AppLayout } from './components/Layout';
import { EmptyState, LinkButton, PageLoader } from './components/ui';
import { LoginPage, RegisterPage } from './pages/auth/AuthPages';
import { CertificatePage, VerifyPage } from './pages/CertificatePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { StudentHome } from './pages/student/Home';
import { ExplorePage } from './pages/student/Explore';
import { EventDetailPage } from './pages/student/EventDetail';
import { RegisterEventPage } from './pages/student/RegisterEvent';
import { MyRegistrationsPage } from './pages/student/MyRegistrations';
import { CertificatesPage } from './pages/student/Certificates';
import { FeedbackPage } from './pages/student/Feedback';
import { ClubDetailPage, ClubsPage } from './pages/student/Clubs';
import { ClubDashboard } from './pages/club/Dashboard';
import { ClubEventsPage } from './pages/club/Events';
import { EventFormPage } from './pages/club/EventForm';
import { ManageEventPage } from './pages/club/ManageEvent';
import { ScannerPage } from './pages/club/Scanner';
import { SupportPage } from './pages/club/Support';
import { OdTemplatePage } from './pages/club/OdTemplate';
import { OdVerifyPage } from './pages/OdVerifyPage';
import { VerificationPage } from './pages/VerificationPage';
import { AdminVerificationsPage } from './pages/admin/Verifications';
import { AdminOverview } from './pages/admin/Overview';
import { AdminEventsPage } from './pages/admin/Events';
import { AdminClubsPage } from './pages/admin/Clubs';
import { AdminUsersPage } from './pages/admin/Users';
import { AdminComplaintsPage } from './pages/admin/Complaints';
import { AdminSettingsPage } from './pages/admin/Settings';

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  // External students wait on the verification page until the admin approves their ID card.
  if (user.role === 'student' && user.verification && user.verification !== 'verified') return <VerificationPage />;
  return <>{children}</>;
}

function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to={user ? homePath(user.role) : '/login'} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentHome />;
  return <Navigate to={homePath(user!.role)} replace />;
}

function NotFound() {
  return (
    <div className="py-10">
      <EmptyState icon={Compass} title="Page not found" body="The page you're looking for doesn't exist or was moved." action={<LinkButton to="/">Go home</LinkButton>} />
    </div>
  );
}

const student = (el: ReactNode) => <Only roles={['student']}>{el}</Only>;
const club = (el: ReactNode) => <Only roles={['club_admin']}>{el}</Only>;
const clubOrAdmin = (el: ReactNode) => <Only roles={['club_admin', 'admin']}>{el}</Only>;
const admin = (el: ReactNode) => <Only roles={['admin']}>{el}</Only>;

export default function App() {
  const { ready } = useAuth();
  if (!ready) return <PageLoader />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/certificate/:id" element={<CertificatePage />} />
      <Route path="/od/:id" element={<OdVerifyPage />} />

      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="clubs" element={<ClubsPage />} />
        <Route path="clubs/:id" element={<ClubDetailPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="events/:id/register" element={student(<RegisterEventPage />)} />
        <Route path="registrations" element={student(<MyRegistrationsPage />)} />
        <Route path="certificates" element={student(<CertificatesPage />)} />
        <Route path="feedback/:eventId" element={student(<FeedbackPage />)} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />

        <Route path="club" element={club(<ClubDashboard />)} />
        <Route path="club/events" element={club(<ClubEventsPage />)} />
        <Route path="club/events/new" element={club(<EventFormPage />)} />
        <Route path="club/events/:id" element={clubOrAdmin(<ManageEventPage />)} />
        <Route path="club/events/:id/edit" element={clubOrAdmin(<EventFormPage />)} />
        <Route path="club/scan" element={club(<ScannerPage />)} />
        <Route path="club/support" element={club(<SupportPage />)} />
        <Route path="club/od-template" element={club(<OdTemplatePage />)} />

        <Route path="admin" element={admin(<AdminOverview />)} />
        <Route path="admin/events" element={admin(<AdminEventsPage />)} />
        <Route path="admin/clubs" element={admin(<AdminClubsPage />)} />
        <Route path="admin/users" element={admin(<AdminUsersPage />)} />
        <Route path="admin/complaints" element={admin(<AdminComplaintsPage />)} />
        <Route path="admin/verifications" element={admin(<AdminVerificationsPage />)} />
        <Route path="admin/settings" element={admin(<AdminSettingsPage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
