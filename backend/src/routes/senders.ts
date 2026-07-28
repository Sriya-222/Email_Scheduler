import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply auth to senders routes
router.use(requireAuth);

/**
 * GET /api/senders
 * List all senders. Auto-populates a default one if empty.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let senders = await db.selectFrom('senders').selectAll().execute();

    if (senders.length === 0) {
      const defaultSender = {
        id: crypto.randomUUID(),
        name: 'Ethereal Test Sender',
        // When user/pass start with 'mock_', mailer.ts falls back to generating
        // an Ethereal test account dynamically.
        smtp_user: 'mock_ethereal_sender@ethereal.email',
        smtp_pass: 'mock_password',
        max_per_hour: 200,
      };
      await db.insertInto('senders').values(defaultSender).execute();
      senders = [
        {
          ...defaultSender,
          created_at: new Date(),
        },
      ];
    }

    return res.json(senders);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/senders
 * Add a new SMTP sender configuration
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, smtp_user, smtp_pass, max_per_hour } = req.body;

    if (!name || !smtp_user || !smtp_pass) {
      return res.status(400).json({ error: 'name, smtp_user, and smtp_pass are required.' });
    }

    const newSender = {
      id: crypto.randomUUID(),
      name,
      smtp_user,
      smtp_pass,
      max_per_hour: max_per_hour ? Number(max_per_hour) : 200,
    };

    await db.insertInto('senders').values(newSender).execute();
    return res.status(201).json(newSender);
  } catch (error) {
    return next(error);
  }
});

export default router;
