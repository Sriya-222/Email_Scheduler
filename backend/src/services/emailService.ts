import { db } from '../config/db';
import { scheduleEmailJob } from '../queue/emailQueue';
import crypto from 'crypto';

interface CreateCampaignInput {
  userId: string;
  subject: string;
  body: string;
  leads: string[];
  senderId: string;
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
}

export async function createCampaign(data: CreateCampaignInput) {
  const campaignId = crypto.randomUUID();

  // Execute database insertions inside a transaction
  const emailsToSchedule = await db.transaction().execute(async (trx) => {
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
      const emailId = crypto.randomUUID();
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
        status: 'scheduled' as const,
      };
    });

    if (emailInserts.length > 0) {
      await trx.insertInto('emails').values(emailInserts).execute();
    }

    return emailInserts;
  });

  // 3. Enqueue jobs in BullMQ (only done if DB transaction successfully commits)
  // If Redis is unavailable, we log and continue — emails remain in DB with
  // status='scheduled' and will be re-enqueued by reconcilePendingEmails() on next startup.
  let enqueuedCount = 0;
  for (const email of emailsToSchedule) {
    try {
      await scheduleEmailJob({
        id: email.id,
        senderId: email.sender_id,
        scheduledAt: email.scheduled_at,
      });
      enqueuedCount++;
    } catch (err) {
      console.error(
        `[emailService] Failed to enqueue BullMQ job for email ${email.id} — Redis may be unavailable. Email saved in DB and will be reconciled on restart.`,
        err
      );
    }
  }

  if (enqueuedCount < emailsToSchedule.length) {
    console.warn(
      `[emailService] Only ${enqueuedCount}/${emailsToSchedule.length} jobs enqueued in BullMQ. Check Redis connection.`
    );
  }

  return {
    campaignId,
    scheduledCount: emailsToSchedule.length,
  };
}
