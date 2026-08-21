import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, School } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { Role } from '../data/authClient';
import { AuthLayout } from '../components/layout/AuthLayout';
import { TreeLogo } from '../components/icons';

const MIN_PASSWORD = 8;

/** Two-step wizard every new account passes through exactly once.
 *
 *  Role lives here rather than on the signup form because Google sign-up
 *  redirects away before we could ask — putting the question after the account
 *  exists is the only point both signup paths share. AuthGate sends anyone
 *  with onboarded=false here and won't let them past until it's done. */
export function Onboarding() {
  const user = useAuthStore((s) => s.user);
  const finishOnboarding = useAuthStore((s) => s.finishOnboarding);
  const setInitialPassword = useAuthStore((s) => s.setInitialPassword);
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  // Google gives us a name already; email signup collected one too.
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');

  /* Only a Google signup reaches here without one: the email form sets its own
     password and calls finishOnboarding directly. Collecting it now is what
     makes "disconnect Google" safe later — see the Security tab. */
  const needsPassword = user?.hasPassword === false;
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickRole = (picked: Role) => {
    setRole(picked);
    setStep(2);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setSubmitting(true);
    try {
      if (needsPassword) {
        if (password.length < MIN_PASSWORD) {
          setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
          setSubmitting(false);
          return;
        }
        // Before finishOnboarding, so a failure here does not leave the
        // account marked onboarded but still password-less.
        await setInitialPassword(password);
      }

      await finishOnboarding({
        role,
        displayName: displayName.trim(),
        institution: institution.trim() || null,
        program: program.trim() || null,
        department: department.trim() || null,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-title">
          <TreeLogo style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
          {step === 1 ? 'Welcome to SyntaxTree' : 'A few details'}
        </div>
        <p className="auth-subtitle">
          {step === 1
            ? 'How will you be using SyntaxTree?'
            : role === 'instructor'
              ? "You'll be able to create courses, share lesson trees, and grade submissions."
              : "You'll be able to join courses, work on assignments, and hand them in."}
        </p>

        {error && <div className="auth-error">{error}</div>}

        {step === 1 ? (
          <div className="onboard-roles">
            <button type="button" className="onboard-role" onClick={() => pickRole('student')}>
              <GraduationCap size={26} />
              <span className="onboard-role-title">I'm a student</span>
              <span className="onboard-role-desc">
                Join a course with a code, diagram assignments, and submit them.
              </span>
            </button>

            <button type="button" className="onboard-role" onClick={() => pickRole('instructor')}>
              <School size={26} />
              <span className="onboard-role-title">I'm a teacher</span>
              <span className="onboard-role-desc">
                Create courses, share lesson trees, set assignments, and grade.
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="auth-field">
              <label htmlFor="onboard-name">Your name</label>
              <input
                id="onboard-name"
                type="text"
                autoComplete="name"
                required
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="onboard-institution">School or university</label>
              <input
                id="onboard-institution"
                type="text"
                autoComplete="organization"
                placeholder="University of Toronto"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>

            {role === 'student' ? (
              <div className="auth-field">
                <label htmlFor="onboard-program">Programme or major</label>
                <input
                  id="onboard-program"
                  type="text"
                  placeholder="Linguistics"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                />
              </div>
            ) : (
              <div className="auth-field">
                <label htmlFor="onboard-department">Department</label>
                <input
                  id="onboard-department"
                  type="text"
                  placeholder="Department of Linguistics"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            )}

            {needsPassword && (
              <div className="auth-field">
                <label htmlFor="onboard-password">Create a password</label>
                <input
                  id="onboard-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="auth-hint">
                  You signed up with Google. A password lets you sign in without it, and is
                  required before you can disconnect Google later.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="btn primary auth-submit"
              disabled={submitting || !displayName.trim() || (needsPassword && !password)}
            >
              {submitting ? 'Setting up…' : 'Finish setup'}
            </button>

            <div className="auth-switch">
              <button type="button" onClick={() => setStep(1)}>
                ← Not a {role === 'student' ? 'student' : 'teacher'}?
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
