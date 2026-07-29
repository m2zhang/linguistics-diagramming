import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import './styles/theme.css';
import './styles/app.css';
import './styles/auth.css';
import './styles/tailwind.css';
import App from './App';
import { AuthGate } from './auth/AuthGate';
import { LoginScreen } from './auth/LoginScreen';
import { SignupScreen } from './auth/SignupScreen';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { CourseShell } from './pages/course/CourseShell';
import { CourseLectures } from './pages/course/CourseLectures';
import { LectureDetail } from './pages/course/LectureDetail';
import { CourseAssignments } from './pages/course/CourseAssignments';
import { CourseParticipants } from './pages/course/CourseParticipants';
import { AssignmentDetail } from './pages/course/AssignmentDetail';
import { SubmissionReview } from './pages/course/SubmissionReview';

document.documentElement.setAttribute('data-theme', 'light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route
          path="/dashboard"
          element={
            <AuthGate>
              <Dashboard />
            </AuthGate>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGate>
              <Profile />
            </AuthGate>
          }
        />
        <Route
          path="/courses/:courseId"
          element={
            <AuthGate>
              <CourseShell />
            </AuthGate>
          }
        >
          <Route index element={<Navigate to="lectures" replace />} />
          <Route path="lectures" element={<CourseLectures />} />
          <Route path="lectures/:lectureId" element={<LectureDetail />} />
          <Route path="assignments" element={<CourseAssignments />} />
          <Route path="assignments/:assignmentId" element={<AssignmentDetail />} />
          <Route path="assignments/:assignmentId/submissions" element={<SubmissionReview />} />
          <Route path="participants" element={<CourseParticipants />} />
        </Route>
        <Route
          path="/editor"
          element={
            <AuthGate>
              <App />
            </AuthGate>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
