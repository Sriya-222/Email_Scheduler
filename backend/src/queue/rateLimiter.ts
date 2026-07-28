import { redisConnection } from '../config/redis';

// key format: rate:{senderId}:{YYYY-MM-DDTHH} -- one bucket per sender per hour
function hourBucketKey(senderId: string, at: Date) {
  const iso = at.toISOString().slice(0, 13); // e.g. '2026-07-28T14'
  return `rate:${senderId}:${iso}`;
}

/**
 * Atomically increments the counter for this sender's current hour bucket
 * and returns whether the send is allowed.
 */
export async function tryConsumeSlot(senderId: string, maxPerHour: number): Promise<boolean> {
  const key = hourBucketKey(senderId, new Date());
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, 3600); // bucket self-cleans after the hour
  }
  if (count > maxPerHour) {
    // Decrement so we don't artificially keep inflating the counter
    await redisConnection.decr(key);
    return false;
  }
  return true;
}

export function nextHourBoundary(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
