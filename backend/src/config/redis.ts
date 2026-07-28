import Redis from 'ioredis';
import { env } from './env';

export const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
});

redisConnection.on('connect', () => {
  console.log('Redis connected successfully.');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
