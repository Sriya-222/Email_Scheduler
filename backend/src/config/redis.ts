import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

/** Parse the Upstash REDIS_URL and merge with extra ioredis options */
function createClient(extra: Partial<RedisOptions>): Redis {
  const rawUrl = env.REDIS_URL?.trim();

  if (rawUrl && (rawUrl.startsWith('redis://') || rawUrl.startsWith('rediss://'))) {
    // ioredis accepts the URL as the first argument and options as the second
    return new Redis(rawUrl, extra);
  }

  if (rawUrl) {
    console.warn('[Redis] REDIS_URL is invalid (must start with redis:// or rediss://). Falling back to host/port/password.');
  }

  const isLocal =
    env.REDIS_HOST === 'localhost' ||
    env.REDIS_HOST === '127.0.0.1' ||
    env.REDIS_HOST === 'redis';

  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: isLocal ? undefined : {},
    ...extra,
  });
}

// ─── Queue connection (used by BullMQ Queue / rate limiter) ───────────────────
// enableOfflineQueue: false → fail fast if Redis is down (no silent hangs)
export const redisConnection = createClient({
  maxRetriesPerRequest: null,    // Required by BullMQ
  enableOfflineQueue: false,
  connectTimeout: 10_000,
  commandTimeout: 8_000,
  retryStrategy: (times) => {
    if (times > 5) {
      console.error('[Redis:Queue] Max retries reached — running without queue.');
      return null;
    }
    return Math.min(times * 500, 3000);
  },
});

// ─── Worker connection (used by BullMQ Worker) ────────────────────────────────
// enableOfflineQueue MUST be true (default) — Worker uses long-polling (bzpopmin)
// and needs to transparently reconnect without throwing on every brief disconnect.
export const redisWorkerConnection = createClient({
  maxRetriesPerRequest: null,    // Required by BullMQ
  enableOfflineQueue: true,
  connectTimeout: 15_000,
  retryStrategy: (times) => {
    // Worker always retries indefinitely
    const delay = Math.min(times * 1000, 30_000);
    console.warn(`[Redis:Worker] Retry #${times}, next attempt in ${delay}ms`);
    return delay;
  },
});

// ─── Event logging ────────────────────────────────────────────────────────────
function attach(client: Redis, label: string) {
  client.on('connect',     () => console.log(`[Redis:${label}] Connected.`));
  client.on('ready',       () => console.log(`[Redis:${label}] Ready.`));
  client.on('reconnecting',() => console.log(`[Redis:${label}] Reconnecting…`));
  client.on('close',       () => console.warn(`[Redis:${label}] Connection closed.`));
  client.on('error',       (e) => console.error(`[Redis:${label}] Error:`, e?.message || String(e)));
}

attach(redisConnection,       'Queue');
attach(redisWorkerConnection, 'Worker');
