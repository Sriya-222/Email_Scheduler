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
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const token = req.cookies?.session_token || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No valid session found.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserSession;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}
