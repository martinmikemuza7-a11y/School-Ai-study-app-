import { NextFunction, Request, Response } from 'express';
import { getUser, getUsers } from './db.js';
import { User } from './types.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Support header 'x-user-id' or query 'userId' or default to primary demo user
  const userIdHeader = (req.headers['x-user-id'] as string) || (req.query.userId as string) || 'user_alex';

  const user = getUser(userIdHeader);
  if (!user) {
    const all = getUsers();
    const fallbackUser = all[0];
    if (fallbackUser) {
      req.user = fallbackUser;
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: User does not exist' });
  }

  req.user = user;
  next();
}
