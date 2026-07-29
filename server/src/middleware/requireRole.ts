import type { NextFunction, Request, Response } from 'express';

/**
 * Blocks the request unless the session belongs to a user with the given
 * role. Always compose after requireAuth (assumes req.session.userId is
 * already set) so an unauthenticated request gets 401, not a misleading 403.
 */
export function requireRole(role: 'student' | 'instructor') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.session.userRole !== role) {
      res.status(403).json({ error: `requires role ${role}` });
      return;
    }
    next();
  };
}
