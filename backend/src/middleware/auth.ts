import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserSession } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session cookie found.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserSession;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}
