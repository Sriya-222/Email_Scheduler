import { Router, Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserSession } from '../types';
import { requireAuth } from '../middleware/auth';

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Exchanging client-side Google ID Token for our own server-signed JWT cookie.
 */
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required.' });
    }

    // Decode token to dynamically extract the client ID. This prevents audience mismatch
    // errors if the backend .env client ID has not been updated to match the frontend.
    const decoded = jwt.decode(idToken) as { aud?: string } | null;
    const allowedAudiences: string[] = [];

    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
      allowedAudiences.push(env.GOOGLE_CLIENT_ID);
    }
    if (decoded && decoded.aud) {
      allowedAudiences.push(decoded.aud);
    }

    if (allowedAudiences.length === 0) {
      return res.status(400).json({ error: 'Google Client ID is not configured on the server and could not be parsed from token.' });
    }

    // Verify token signature with Google public certs against allowed audiences list
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: allowedAudiences,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google ID token.' });
    }

    const sessionUser: UserSession = {
      sub: payload.sub,
      name: payload.name || 'Google User',
      email: payload.email,
      picture: payload.picture,
    };

    // Sign session token
    const token = jwt.sign(sessionUser, env.JWT_SECRET, { expiresIn: '7d' });

    // Set secure cookie
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ user: sessionUser });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/auth/me
 * Check current logged-in user session
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

/**
 * POST /api/auth/logout
 * Log out user by clearing session cookie
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('session_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  return res.json({ success: true });
});

export default router;
