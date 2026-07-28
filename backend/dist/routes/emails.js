"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const sync_1 = require("csv-parse/sync");
const zod_1 = require("zod");
const db_1 = require("../config/db");
const emailService_1 = require("../services/emailService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Apply auth to all campaign/email routes
router.use(auth_1.requireAuth);
const emailSchema = zod_1.z.string().email();
const campaignInputSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1, 'Subject is required.'),
    body: zod_1.z.string().min(1, 'Email body is required.'),
    leads: zod_1.z.array(zod_1.z.string().email()).min(1, 'At least one lead is required.'),
    senderId: zod_1.z.string().min(1, 'Sender ID is required.'),
    startTime: zod_1.z.string().transform(str => new Date(str)),
    delayMs: zod_1.z.number().int().min(0).default(2000),
    hourlyLimit: zod_1.z.number().int().min(1).default(200),
});
/**
 * POST /api/leads/parse
 * Accepts a CSV or TXT file and parses email addresses from it.
 */
router.post('/leads/parse', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const content = req.file.buffer.toString('utf8');
        const emails = [];
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        // Check if the file resembles a CSV
        if (req.file.mimetype === 'text/csv' || content.includes(',')) {
            try {
                const records = (0, sync_1.parse)(content, { skip_empty_lines: true });
                for (const row of records) {
                    for (const cell of row) {
                        const val = String(cell).trim();
                        if (emailSchema.safeParse(val).success) {
                            emails.push(val);
                        }
                        else {
                            const matches = val.match(emailRegex);
                            if (matches)
                                emails.push(...matches);
                        }
                    }
                }
            }
            catch (parseErr) {
                // Fallback to simple regex parsing if CSV parsing fails
                const matches = content.match(emailRegex);
                if (matches)
                    emails.push(...matches);
            }
        }
        else {
            // Direct regex extraction for plain text files
            const matches = content.match(emailRegex);
            if (matches)
                emails.push(...matches);
        }
        // Deduplicate
        const uniqueEmails = Array.from(new Set(emails.map(e => e.toLowerCase())));
        return res.json({ count: uniqueEmails.length, emails: uniqueEmails });
    }
    catch (error) {
        return next(error);
    }
});
/**
 * POST /api/campaigns
 * Compose campaign and schedule staggered emails
 */
router.post('/campaigns', async (req, res, next) => {
    try {
        const parseResult = campaignInputSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: parseResult.error.errors[0].message });
        }
        const result = await (0, emailService_1.createCampaign)({
            userId: req.user.sub,
            ...parseResult.data,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        return next(error);
    }
});
/**
 * GET /api/emails
 * Paginated list of emails, supporting status and campaign filtering.
 */
router.get('/emails', async (req, res, next) => {
    try {
        const { status, campaignId, limit = '20', offset = '0' } = req.query;
        let query = db_1.db.selectFrom('emails')
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
        let countQuery = db_1.db.selectFrom('emails')
            .select(db_1.db.fn.count('emails.id').as('count'));
        // Filters
        if (status) {
            const statuses = String(status).split(',');
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
    }
    catch (error) {
        return next(error);
    }
});
/**
 * GET /api/stats
 * Aggregated counters for dashboard widgets
 */
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await db_1.db.selectFrom('emails')
            .select([
            'status',
            db_1.db.fn.count('id').as('count')
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
                counts[row.status] = Number(row.count);
            }
        }
        const totalRes = await db_1.db.selectFrom('emails')
            .select(db_1.db.fn.count('id').as('count'))
            .executeTakeFirst();
        counts.total = Number(totalRes?.count ?? 0);
        return res.json(counts);
    }
    catch (error) {
        return next(error);
    }
});
exports.default = router;
