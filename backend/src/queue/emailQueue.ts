import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const emailQueue = new Queue('email-send', { connection: redisConnection });

export async function scheduleEmailJob(email: {
  id: string;
  senderId: string;
  scheduledAt: Date;
}) {
  const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
  await emailQueue.add(
    'send-email',
    { emailId: email.id, senderId: email.senderId },
    {
      jobId: email.id,          // Idempotency: BullMQ dedupes on jobId
      delay,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: false,       // Keep failures visible for the dashboard
    }
  );
}

export async function cancelEmailJob(emailId: string) {
  const job = await emailQueue.getJob(emailId);
  if (job) {
    await job.remove();
  }
}
