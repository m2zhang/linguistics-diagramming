// Must be imported before any routes are registered — patches Express so a
// rejected promise inside an async route handler is forwarded to the error
// middleware below instead of becoming an unhandled rejection. Node 15+
// terminates the whole process on an unhandled rejection, so without this,
// any single bad request (a bug, a bad migration state, a transient DB
// hiccup) takes the entire API down for every user until someone manually
// restarts it — that's exactly what happened during development here.
import 'express-async-errors';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { sessionMiddleware } from './middleware/session';
import { authRouter } from './routes/auth';
import { coursesRouter } from './routes/courses';
import { lecturesRouter } from './routes/lectures';
import { materialsRouter } from './routes/materials';
import { assignmentsRouter } from './routes/assignments';
import { submissionsRouter } from './routes/submissions';

export function createApp() {
  const app = express();

  // Vite proxies /api to this server in dev, so requests already arrive
  // same-origin; CORS is a no-op there. Kept enabled (credentials: true,
  // reflecting the request origin) so the API also works if the frontend
  // is ever served from a different origin during development.
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(sessionMiddleware);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/courses', coursesRouter);
  // lecturesRouter/materialsRouter declare their own full sub-paths
  // (e.g. '/courses/:courseId/lectures', '/lectures/:id/trees',
  // '/materials/:id/download') since they mix routes nested under courses
  // and lectures with standalone ones — mount at the bare /api prefix.
  app.use('/api', lecturesRouter);
  app.use('/api', materialsRouter);
  app.use('/api', assignmentsRouter);
  app.use('/api', submissionsRouter);

  // Catch-all error handler — must be registered last, and must take 4
  // params (Express identifies error middleware by arity, not by any
  // annotation). Every thrown/rejected error from any route above lands
  // here instead of crashing the process.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled route error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
