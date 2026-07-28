import Redis from 'ioredis';
import { env } from './env';

const isLocal = env.REDIS_HOST === 'localhost' || env.REDIS_HOST === '127.0.0.1' || env.REDIS_HOST === 'redis';

export const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  tls: isLocal ? undefined : {}, // Secure connection for cloud hosts like Upstash
});

redisConnection.on('connect', () => {
  console.log('Redis connected successfully.');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
