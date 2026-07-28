"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
exports.scheduleEmailJob = scheduleEmailJob;
exports.cancelEmailJob = cancelEmailJob;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.emailQueue = new bullmq_1.Queue('email-send', { connection: redis_1.redisConnection });
async function scheduleEmailJob(email) {
    const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
    await exports.emailQueue.add('send-email', { emailId: email.id, senderId: email.senderId }, {
        jobId: email.id, // Idempotency: BullMQ dedupes on jobId
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: false, // Keep failures visible for the dashboard
    });
}
async function cancelEmailJob(emailId) {
    const job = await exports.emailQueue.getJob(emailId);
    if (job) {
        await job.remove();
    }
}
