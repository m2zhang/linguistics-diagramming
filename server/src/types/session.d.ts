import 'express-session';

// Augment express-session's SessionData with the fields this app stores on
// login/signup, so req.session.userId / req.session.userRole are typed
// everywhere instead of requiring `any` casts in every route.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: 'student' | 'instructor';
  }
}
