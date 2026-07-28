"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryConsumeSlot = tryConsumeSlot;
exports.nextHourBoundary = nextHourBoundary;
const redis_1 = require("../config/redis");
// key format: rate:{senderId}:{YYYY-MM-DDTHH} -- one bucket per sender per hour
function hourBucketKey(senderId, at) {
    const iso = at.toISOString().slice(0, 13); // e.g. '2026-07-28T14'
    return `rate:${senderId}:${iso}`;
}
/**
 * Atomically increments the counter for this sender's current hour bucket
 * and returns whether the send is allowed.
 */
async function tryConsumeSlot(senderId, maxPerHour) {
    const key = hourBucketKey(senderId, new Date());
    const count = await redis_1.redisConnection.incr(key);
    if (count === 1) {
        await redis_1.redisConnection.expire(key, 3600); // bucket self-cleans after the hour
    }
    if (count > maxPerHour) {
        // Decrement so we don't artificially keep inflating the counter
        await redis_1.redisConnection.decr(key);
        return false;
    }
    return true;
}
function nextHourBoundary() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setSeconds(0, 0);
    d.setHours(d.getHours() + 1);
    return d;
}
