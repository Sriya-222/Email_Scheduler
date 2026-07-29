import Redis from 'ioredis';
import { env } from './env';

// Shared ioredis options — required by BullMQ
const sharedOptions = {
  maxRetriesPerRequest: null,   // Required by BullMQ
  connectTimeout: 10_000,       // 10s connection timeout
  commandTimeout: 8_000,        // 8s per command timeout
  enableOfflineQueue: false,    // Fail fast instead of queuing when Redis is offline
  retryStrategy: (times: number) => {
    if (times > 5) {
      console.error('[Redis] Max connection retries reached. Redis unavailable — app running in degraded mode.');
      return null; // Stop retrying
    }
    return Math.min(times * 500, 3000);
  },
};

function createRedisConnection(): Redis {
  // Prefer REDIS_URL (Upstash-style full connection string: rediss://:password@host:port)
  // MUST start with redis:// or rediss:// — anything else (e.g. https://) is invalid
  const rawUrl = env.REDIS_URL?.trim();
  if (rawUrl && (rawUrl.startsWith('redis://') || rawUrl.startsWith('rediss://'))) {
    console.log('[Redis] Using REDIS_URL for connection.');
    return new Redis(rawUrl, sharedOptions);
  }

  if (rawUrl) {
    console.warn(
      '[Redis] REDIS_URL is set but has an invalid format (must start with redis:// or rediss://). Falling back to REDIS_HOST/PORT/PASSWORD.'
    );
  }

  // Fallback: individual host/port/password vars
  const isLocal =
    env.REDIS_HOST === 'localhost' ||
    env.REDIS_HOST === '127.0.0.1' ||
    env.REDIS_HOST === 'redis';

  console.log(`[Redis] Connecting to ${env.REDIS_HOST}:${env.REDIS_PORT} (TLS: ${!isLocal})`);

  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: isLocal ? undefined : {}, // TLS for cloud hosts (Upstash, etc.)
    ...sharedOptions,
  });
}

export const redisConnection = createRedisConnection();

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully.');
});

redisConnection.on('ready', () => {
  console.log('[Redis] Ready to accept commands.');
});

redisConnection.on('error', (err) => {
  // Log but don't crash — app operates in degraded mode (no email queuing)
  // Scheduled emails remain in DB and will be re-enqueued on next server restart.
  console.error('[Redis] Connection error:', err.message);
});

redisConnection.on('close', () => {
  console.warn('[Redis] Connection closed.');
});
