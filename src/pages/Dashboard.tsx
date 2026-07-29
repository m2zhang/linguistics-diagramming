import { useAuthStore } from '../store/authStore';
import { InstructorDashboard } from './InstructorDashboard';
import { StudentDashboard } from './StudentDashboard';

/** AuthGate guarantees a user is present by the time this renders. */
export function Dashboard() {
  const role = useAuthStore((s) => s.user?.role);
  return role === 'instructor' ? <InstructorDashboard /> : <StudentDashboard />;
}
