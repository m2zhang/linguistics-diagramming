import type { NextFunction, Request, Response } from 'express';

/** Blocks the request unless a login session is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  next();
}
