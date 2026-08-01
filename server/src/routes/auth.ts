import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';

export const authRouter = Router();

const BCRYPT_COST = 12;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  displayName: z.string().trim().min(1).max(200),
  role: z.enum(['student', 'instructor']),
});

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { email, password, displayName, role } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const { rows } = await pool.query<{ id: string; role: 'student' | 'instructor' }>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, role`,
      [email, passwordHash, displayName, role],
    );
    const user = rows[0];

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: 'could not start session' });
        return;
      }
      req.session.userId = user.id;
      req.session.userRole = user.role;
      res.status(201).json({ id: user.id, role: user.role });
    });
  } catch (err) {
    // 23505 = unique_violation (email already registered)
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'an account with that email already exists' });
      return;
    }
    console.error('signup failed', err);
    res.status(500).json({ error: 'signup failed' });
  }
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid request' });
    return;
  }
  const { email, password } = parsed.data;

  const { rows } = await pool.query<{
    id: string;
    password_hash: string;
    role: 'student' | 'instructor';
  }>(`SELECT id, password_hash, role FROM users WHERE email = $1`, [email]);
  const user = rows[0];

  // Constant-shape response whether the email exists or not, to avoid
  // leaking account existence via response differences.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'invalid email or password' });
    return;
  }

  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: 'could not start session' });
      return;
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    res.json({ id: user.id, role: user.role });
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.sendStatus(204);
  });
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

authRouter.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid request' });
    return;
  }
  const { email } = parsed.data;

  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

  const { rowCount } = await pool.query(
    `UPDATE users 
     SET reset_token = $1, reset_token_expires = $2 
     WHERE email = $3`,
    [token, tokenExpires, email]
  );

  // In a real app, you would send an email here.
  // We're returning the token for local development.
  res.json({ message: 'If that email exists, a reset link has been generated.', devToken: rowCount && rowCount > 0 ? token : null });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

authRouter.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { token, password } = parsed.data;

  const { rows } = await pool.query<{ id: string; reset_token_expires: Date }>(
    `SELECT id, reset_token_expires FROM users WHERE reset_token = $1`,
    [token]
  );
  
  const user = rows[0];

  if (!user || user.reset_token_expires < new Date()) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await pool.query(
    `UPDATE users 
     SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
     WHERE id = $2`,
    [passwordHash, user.id]
  );

  res.json({ message: 'Password has been successfully reset' });
});


authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: 'student' | 'instructor';
    created_at: Date;
  }>(`SELECT id, email, display_name, role, created_at FROM users WHERE id = $1`, [req.session.userId]);
  const user = rows[0];
  if (!user) {
    // Session outlived the user row (e.g. deleted account) — treat as logged out.
    req.session.destroy(() => {});
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    createdAt: user.created_at,
  });
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: 'student' | 'instructor';
    created_at: Date;
  }>(
    `UPDATE users SET display_name = $2 WHERE id = $1
     RETURNING id, email, display_name, role, created_at`,
    [req.session.userId, parsed.data.displayName],
  );
  const user = rows[0];
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    createdAt: user.created_at,
  });
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
}
