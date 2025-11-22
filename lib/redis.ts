import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Cache utilities
export const cache = {
    /**
     * Get cached data
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(key);
            return data as T | null;
        } catch (error) {
            console.error(`[CACHE_ERROR] Failed to get key: ${key}`, error);
            return null;
        }
    },

    /**
     * Set cached data with TTL (in seconds)
     */
    async set(key: string, value: any, ttl: number = 3600): Promise<void> {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error(`[CACHE_ERROR] Failed to set key: ${key}`, error);
        }
    },

    /**
     * Delete cached data
     */
    async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (error) {
            console.error(`[CACHE_ERROR] Failed to delete key: ${key}`, error);
        }
    },

    /**
     * Increment counter (for rate limiting)
     */
    async incr(key: string): Promise<number> {
        try {
            return await redis.incr(key);
        } catch (error) {
            console.error(`[CACHE_ERROR] Failed to increment key: ${key}`, error);
            return 0;
        }
    },

    /**
     * Set expiry on existing key
     */
    async expire(key: string, seconds: number): Promise<void> {
        try {
            await redis.expire(key, seconds);
        } catch (error) {
            console.error(`[CACHE_ERROR] Failed to set expiry on key: ${key}`, error);
        }
    },
};

export default redis;
