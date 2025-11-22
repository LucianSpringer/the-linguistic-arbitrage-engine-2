import { Redis } from '@upstash/redis';

// Initialize Redis client with graceful degradation
let redis: Redis | null = null;

try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
        redis = new Redis({ url, token });
        console.log('[REDIS] Client initialized successfully');
    } else {
        console.warn('[REDIS] Credentials missing - running without cache');
    }
} catch (error) {
    console.error('[REDIS] Initialization failed:', error);
}

export default redis;
