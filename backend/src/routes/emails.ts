import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { db } from '../config/db';
import { createCampaign } from '../services/emailService';
import { requireAuth } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply auth to all campaign/email routes
router.use(requireAuth);

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
 * Accepts a CSV or TXT file and parses email addresses from it.
 */
router.post('/leads/parse', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const content = req.file.buffer.toString('utf8');
    const emails: string[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Check if the file resembles a CSV
    if (req.file.mimetype === 'text/csv' || content.includes(',')) {
      try {
        const records = parse(content, { skip_empty_lines: true });
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
      } catch (parseErr) {
        // Fallback to simple regex parsing if CSV parsing fails
        const matches = content.match(emailRegex);
        if (matches) emails.push(...matches);
      }
    } else {
      // Direct regex extraction for plain text files
      const matches = content.match(emailRegex);
      if (matches) emails.push(...matches);
    }

    // Deduplicate
    const uniqueEmails = Array.from(new Set(emails.map(e => e.toLowerCase())));
    return res.json({ count: uniqueEmails.length, emails: uniqueEmails });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/campaigns
 * Compose campaign and schedule staggered emails
 */
router.post('/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = campaignInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
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
 * Paginated list of emails, supporting status and campaign filtering.
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

    // Filters
    if (status) {
      const statuses = String(status).split(',') as any[];
      query = query.where('emails.status', 'in', statuses);
      countQuery = countQuery.where('emails.status', 'in', statuses);
    }

    if (campaignId) {
      query = query.where('emails.campaign_id', '=', String(campaignId));
      countQuery = countQuery.where('emails.campaign_id', '=', String(campaignId));
    }

    // Pagination
    const limitNum = parseInt(String(limit), 10);
    const offsetNum = parseInt(String(offset), 10);

    const [emails, totalResult] = await Promise.all([
      query.orderBy('emails.scheduled_at', 'desc')
        .limit(limitNum)
        .offset(offsetNum)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const totalCount = Number(totalResult?.count ?? 0);

    return res.json({
      emails,
      totalCount,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/stats
 * Aggregated counters for dashboard widgets
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.selectFrom('emails')
      .select([
        'status',
        db.fn.count<number>('id').as('count')
      ])
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
