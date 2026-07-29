import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from '../db/pool';

const PgSession = connectPgSimple(session);

/**
 * Cookie sessions stored in Postgres (the "session" table, created by a
 * migration — see server/src/migrations/1700000000002_session.js).
 * createTableIfMissing is false on purpose: the schema is tracked in
 * migrations, not created implicitly at runtime by this middleware.
 */
export const sessionMiddleware = session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET ?? 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
  },
});
