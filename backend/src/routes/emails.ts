import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { db } from '../config/db';
import { createCampaign } from '../services/emailService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Multer middleware — memory storage, 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const emailSchema = z.string().email();

const campaignInputSchema = z.object({
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Email body is required.'),
  leads: z.array(z.string().email()).min(1, 'At least one lead is required.'),
  senderId: z.string().min(1, 'Sender ID is required.'),
  startTime: z.string().transform(str => new Date(str)),
  delayMs: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().min(1).default(200),
});

/**
 * POST /api/leads/parse
 * Parses email addresses from uploaded CSV or TXT file.
 * NOTE: requireAuth is applied INDIVIDUALLY so multer processes the body FIRST
 * (multer must handle multipart before auth can read headers on some proxies).
 */
router.post('/leads/parse', requireAuth, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded. Please attach a CSV or TXT file.' });
    }

    const content = req.file.buffer.toString('utf8');
    if (!content.trim()) {
      return res.status(400).json({ error: 'The uploaded file appears to be empty.' });
    }

    const emails: string[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Try CSV parse first, fallback to regex
    const looksLikeCsv = req.file.mimetype === 'text/csv'
      || req.file.originalname.endsWith('.csv')
      || content.includes(',');

    if (looksLikeCsv) {
      try {
        const records = parse(content, { skip_empty_lines: true, relax_column_count: true });
        for (const row of records) {
          for (const cell of row) {
            const val = String(cell).trim();
            if (emailSchema.safeParse(val).success) {
              emails.push(val);
            } else {
              const matches = val.match(emailRegex);
              if (matches) emails.push(...matches);
            }
          }
        }
      } catch {
        // Fallback: plain regex on raw content
        const matches = content.match(emailRegex);
        if (matches) emails.push(...matches);
      }
    } else {
      // Plain text — one per line or comma separated
      const matches = content.match(emailRegex);
      if (matches) emails.push(...matches);
    }

    const uniqueEmails = Array.from(new Set(emails.map(e => e.toLowerCase())));
    return res.json({ count: uniqueEmails.length, emails: uniqueEmails });
  } catch (error) {
    return next(error);
  }
});

// Apply auth middleware to all remaining routes
router.use(requireAuth);

/**
 * POST /api/campaigns
 * Creates campaign and schedules staggered emails.
 */
router.post('/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = campaignInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    // Validate startTime is in the future (with 30s grace period)
    const startTime = parseResult.data.startTime;
    if (startTime.getTime() < Date.now() - 30_000) {
      return res.status(400).json({ error: 'Start time must be in the future.' });
    }

    const result = await createCampaign({
      userId: req.user!.sub,
      ...parseResult.data,
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/emails
 * Paginated list of emails with optional status/campaign filters.
 */
router.get('/emails', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, campaignId, limit = '20', offset = '0' } = req.query;

    let query = db.selectFrom('emails')
      .innerJoin('campaigns', 'campaigns.id', 'emails.campaign_id')
      .select([
        'emails.id',
        'emails.recipient',
        'emails.subject',
        'emails.scheduled_at',
        'emails.sent_at',
        'emails.status',
        'emails.attempts',
        'emails.error',
        'campaigns.id as campaign_id',
      ]);

    let countQuery = db.selectFrom('emails')
      .select(db.fn.count<number>('emails.id').as('count'));

    if (status) {
      const statuses = String(status).split(',') as any[];
      query = query.where('emails.status', 'in', statuses);
      countQuery = countQuery.where('emails.status', 'in', statuses);
    }

    if (campaignId) {
      query = query.where('emails.campaign_id', '=', String(campaignId));
      countQuery = countQuery.where('emails.campaign_id', '=', String(campaignId));
    }

    const limitNum = Math.min(parseInt(String(limit), 10) || 20, 100);
    const offsetNum = Math.max(parseInt(String(offset), 10) || 0, 0);

    const [emails, totalResult] = await Promise.all([
      query.orderBy('emails.scheduled_at', 'desc').limit(limitNum).offset(offsetNum).execute(),
      countQuery.executeTakeFirst(),
    ]);

    return res.json({
      emails,
      totalCount: Number(totalResult?.count ?? 0),
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/stats
 * Aggregated status counters for the dashboard widgets.
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.selectFrom('emails')
      .select(['status', db.fn.count<number>('id').as('count')])
      .groupBy('status')
      .execute();

    const counts = {
      scheduled: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      rescheduled: 0,
      total: 0,
    };

    for (const row of stats) {
      if (row.status in counts) {
        (counts as any)[row.status] = Number(row.count);
      }
    }

    const totalRes = await db.selectFrom('emails')
      .select(db.fn.count<number>('id').as('count'))
      .executeTakeFirst();

    counts.total = Number(totalRes?.count ?? 0);

    return res.json(counts);
  } catch (error) {
    return next(error);
  }
});

export default router;
