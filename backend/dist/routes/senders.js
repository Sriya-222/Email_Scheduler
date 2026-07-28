"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Apply auth to senders routes
router.use(auth_1.requireAuth);
/**
 * GET /api/senders
 * List all senders. Auto-populates a default one if empty.
 */
router.get('/', async (req, res, next) => {
    try {
        let senders = await db_1.db.selectFrom('senders').selectAll().execute();
        if (senders.length === 0) {
            const defaultSender = {
                id: crypto_1.default.randomUUID(),
                name: 'Ethereal Test Sender',
                // When user/pass start with 'mock_', mailer.ts falls back to generating
                // an Ethereal test account dynamically.
                smtp_user: 'mock_ethereal_sender@ethereal.email',
                smtp_pass: 'mock_password',
                max_per_hour: 200,
            };
            await db_1.db.insertInto('senders').values(defaultSender).execute();
            senders = [
                {
                    ...defaultSender,
                    created_at: new Date(),
                },
            ];
        }
        return res.json(senders);
    }
    catch (error) {
        return next(error);
    }
});
/**
 * POST /api/senders
 * Add a new SMTP sender configuration
 */
router.post('/', async (req, res, next) => {
    try {
        const { name, smtp_user, smtp_pass, max_per_hour } = req.body;
        if (!name || !smtp_user || !smtp_pass) {
            return res.status(400).json({ error: 'name, smtp_user, and smtp_pass are required.' });
        }
        const newSender = {
            id: crypto_1.default.randomUUID(),
            name,
            smtp_user,
            smtp_pass,
            max_per_hour: max_per_hour ? Number(max_per_hour) : 200,
        };
        await db_1.db.insertInto('senders').values(newSender).execute();
        return res.status(201).json(newSender);
    }
    catch (error) {
        return next(error);
    }
});
exports.default = router;
