"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const db_1 = require("../config/db");
const rateLimiter_1 = require("./rateLimiter");
const mailer_1 = require("../services/mailer");
const env_1 = require("../config/env");
exports.emailWorker = new bullmq_1.Worker('email-send', async (job, token) => {
    const { emailId, senderId } = job.data;
    // Fetch email state from database (source of truth)
    const email = await db_1.db.selectFrom('emails').selectAll()
        .where('id', '=', emailId).executeTakeFirst();
    if (!email) {
        console.log(`Job ${job.id} skipped: Email record deleted from DB.`);
        return;
    }
    // Idempotency check 1: if already sent, we are done
    if (email.status === 'sent') {
        console.log(`Job ${job.id} skipped: Email already sent according to DB.`);
        return;
    }
    const sender = await db_1.db.selectFrom('senders').selectAll()
        .where('id', '=', senderId).executeTakeFirst();
    if (!sender) {
        throw new Error(`Sender with ID ${senderId} not found in DB.`);
    }
    // Rate Limit Check
    const allowed = await (0, rateLimiter_1.tryConsumeSlot)(senderId, sender.max_per_hour);
    if (!allowed) {
        console.log(`Rate limit reached for sender ${sender.name} (${senderId}). Rescheduling to next hour window.`);
        const nextRun = (0, rateLimiter_1.nextHourBoundary)();
        // Update DB state
        await db_1.db.updateTable('emails')
            .set({ status: 'rescheduled' })
            .where('id', '=', emailId)
            .execute();
        // Move BullMQ job to delayed
        await job.moveToDelayed(nextRun.getTime(), token);
        throw new bullmq_1.DelayedError();
    }
    // Update state to processing and increment attempt count
    await db_1.db.updateTable('emails')
        .set({
        status: 'processing',
        attempts: email.attempts + 1
    })
        .where('id', '=', emailId)
        .execute();
    // Minimum delay between sends per worker slot to pace cadence
    if (env_1.env.MIN_DELAY_BETWEEN_EMAILS_MS > 0) {
        await new Promise(r => setTimeout(r, env_1.env.MIN_DELAY_BETWEEN_EMAILS_MS));
    }
    try {
        // Send mail
        await (0, mailer_1.sendViaEthereal)(sender, {
            to: email.recipient,
            subject: email.subject,
            html: email.body
        });
        // Update state to sent
        await db_1.db.updateTable('emails')
            .set({
            status: 'sent',
            sent_at: new Date(),
            error: null
        })
            .where('id', '=', emailId)
            .execute();
        console.log(`Successfully sent email ${emailId} to ${email.recipient}`);
    }
    catch (err) {
        const errorMsg = String(err.message ?? err);
        console.error(`Failed to send email ${emailId} to ${email.recipient}:`, errorMsg);
        // Update state to failed
        await db_1.db.updateTable('emails')
            .set({
            status: 'failed',
            error: errorMsg
        })
            .where('id', '=', emailId)
            .execute();
        // Propagate error to trigger BullMQ's automatic retry backoff
        throw err;
    }
}, {
    connection: redis_1.redisConnection,
    concurrency: env_1.env.WORKER_CONCURRENCY,
});
exports.emailWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully.`);
});
exports.emailWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error:`, err);
});
