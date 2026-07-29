import Redis from 'ioredis';
import { env } from './env';

/**
 * Builds a Redis connection config object or URL for ioredis.
 * BullMQ requires maxRetriesPerRequest: null on ALL connections.
 */
function buildConnectionOptions(opts: {
  enableOfflineQueue: boolean;
  retryStrategy?: (times: number) => number | null;
}) {
  const rawUrl = env.REDIS_URL?.trim();

  // Use REDIS_URL if it is a valid Redis connection string
  if (rawUrl && (rawUrl.startsWith('redis://') || rawUrl.startsWith('rediss://'))) {
    return { url: rawUrl, ...opts };
  }

  if (rawUrl) {
    console.warn('[Redis] REDIS_URL is set but invalid (must start with redis:// or rediss://). Using REDIS_HOST/PORT/PASSWORD.');
  }

  const isLocal =
    env.REDIS_HOST === 'localhost' ||
    env.REDIS_HOST === '127.0.0.1' ||
    env.REDIS_HOST === 'redis';

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: isLocal ? undefined : {},
    ...opts,
  };
}

/**
 * Connection used by BullMQ Queue (adding / scheduling jobs).
 * enableOfflineQueue: false → fail immediately if Redis is down
 * instead of silently queuing commands and hanging forever.
 */
export const redisConnection = new Redis({
  ...buildConnectionOptions({
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 5) {
        console.error('[Redis:Queue] Max retries reached — email enqueue will degrade gracefully.');
        return null;
      }
      return Math.min(times * 500, 3000);
    },
  }),
  maxRetriesPerRequest: null, // Required by BullMQ
  connectTimeout: 10_000,
  commandTimeout: 8_000,
} as any);

/**
 * Separate connection used by BullMQ Worker.
 * enableOfflineQueue MUST be true (default) so the worker can
 * transparently reconnect after a brief Redis blip without crashing.
 * maxRetriesPerRequest: null is required by BullMQ.
 */
export const redisWorkerConnection = new Redis({
  ...buildConnectionOptions({
    enableOfflineQueue: true, // Worker NEEDS this to reconnect seamlessly
    retryStrategy: (times) => {
      // Worker always retries — it is a long-running process
      const delay = Math.min(times * 1000, 30_000); // max 30s between retries
      console.warn(`[Redis:Worker] Retry #${times}, next attempt in ${delay}ms`);
      return delay;
    },
  }),
  maxRetriesPerRequest: null,
  connectTimeout: 15_000,
} as any);

// Shared event logging
function attachEvents(client: Redis, label: string) {
  client.on('connect', () => console.log(`[Redis:${label}] Connected.`));
  client.on('ready', () => console.log(`[Redis:${label}] Ready.`));
  client.on('error', (err) => console.error(`[Redis:${label}] Error:`, err?.message || String(err)));
  client.on('close', () => console.warn(`[Redis:${label}] Connection closed.`));
  client.on('reconnecting', () => console.log(`[Redis:${label}] Reconnecting...`));
}

attachEvents(redisConnection, 'Queue');
attachEvents(redisWorkerConnection, 'Worker');
