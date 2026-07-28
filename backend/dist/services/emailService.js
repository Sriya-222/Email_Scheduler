"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCampaign = createCampaign;
const db_1 = require("../config/db");
const emailQueue_1 = require("../queue/emailQueue");
const crypto_1 = __importDefault(require("crypto"));
async function createCampaign(data) {
    const campaignId = crypto_1.default.randomUUID();
    // Execute database insertions inside a transaction
    const emailsToSchedule = await db_1.db.transaction().execute(async (trx) => {
        // 1. Create the campaign
        await trx.insertInto('campaigns')
            .values({
            id: campaignId,
            user_id: data.userId,
            subject: data.subject,
            body: data.body,
            delay_ms: data.delayMs,
            hourly_limit: data.hourlyLimit,
        })
            .execute();
        // 2. Map and stagger lead emails
        const emailInserts = data.leads.map((recipient, index) => {
            const emailId = crypto_1.default.randomUUID();
            // Stagger each subsequent email by delayMs * index from the start time
            const scheduledAt = new Date(data.startTime.getTime() + index * data.delayMs);
            return {
                id: emailId,
                campaign_id: campaignId,
                sender_id: data.senderId,
                recipient,
                subject: data.subject,
                body: data.body,
                scheduled_at: scheduledAt,
                status: 'scheduled',
            };
        });
        if (emailInserts.length > 0) {
            await trx.insertInto('emails').values(emailInserts).execute();
        }
        return emailInserts;
    });
    // 3. Enqueue jobs in BullMQ (only done if DB transaction successfully commits)
    for (const email of emailsToSchedule) {
        await (0, emailQueue_1.scheduleEmailJob)({
            id: email.id,
            senderId: email.sender_id,
            scheduledAt: email.scheduled_at,
        });
    }
    return {
        campaignId,
        scheduledCount: emailsToSchedule.length,
    };
}
