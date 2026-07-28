"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const isLocal = env_1.env.REDIS_HOST === 'localhost' || env_1.env.REDIS_HOST === '127.0.0.1' || env_1.env.REDIS_HOST === 'redis';
exports.redisConnection = new ioredis_1.default({
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
    password: env_1.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    tls: isLocal ? undefined : {}, // Secure connection for cloud hosts like Upstash
});
exports.redisConnection.on('connect', () => {
    console.log('Redis connected successfully.');
});
exports.redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});
