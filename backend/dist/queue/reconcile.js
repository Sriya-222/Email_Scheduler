"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcilePendingEmails = reconcilePendingEmails;
const db_1 = require("../config/db");
const emailQueue_1 = require("./emailQueue");
/**
 * Run once on server startup. Re-enqueues any emails marked as scheduled,
 * processing, or rescheduled in the database if their corresponding BullMQ job
 * is missing from Redis.
 */
async function reconcilePendingEmails() {
    console.log('Starting email reconciliation scan...');
    try {
        const pending = await db_1.db.selectFrom('emails').selectAll()
            .where('status', 'in', ['scheduled', 'processing', 'rescheduled'])
            .execute();
        console.log(`Found ${pending.length} pending/processing emails in database.`);
        let reEnqueuedCount = 0;
        for (const email of pending) {
            const existingJob = await emailQueue_1.emailQueue.getJob(email.id);
            if (!existingJob) {
                console.log(`Email ${email.id} lacks a BullMQ job in Redis. Re-scheduling...`);
                await (0, emailQueue_1.scheduleEmailJob)({
                    id: email.id,
                    senderId: email.sender_id,
                    scheduledAt: email.scheduled_at,
                });
                reEnqueuedCount++;
            }
        }
        console.log(`Email reconciliation complete. Re-enqueued ${reEnqueuedCount} missing jobs.`);
    }
    catch (error) {
        console.error('Email reconciliation execution failed:', error);
    }
}
