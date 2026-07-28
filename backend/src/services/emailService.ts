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
  for (const email of emailsToSchedule) {
    await scheduleEmailJob({
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
