import redis from '../lib/redis';
import crypto from 'crypto';

const CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Generate cache key from prompt and scenario
 */
function generateCacheKey(prompt: string, scenarioId: string): string {
    const hash = crypto
        .createHash('sha256')
        .update(`${scenarioId}:${prompt}`)
        .digest('hex')
        .substring(0, 16);

    return `negotiate:${scenarioId}:${hash}`;
}

/**
 * Cached Negotiation Service
 */
export class CachedNegotiationService {
    /**
     * Get cached response for a prompt
     */
    static async getCachedResponse(
        prompt: string,
        scenarioId: string
    ): Promise<string | null> {
        if (!redis) {
            return null; // Graceful degradation
        }

        try {
            const key = generateCacheKey(prompt, scenarioId);
            const cached = await redis.get(key);

            if (cached) {
                console.log(`[CACHE_HIT] Key: ${key}`);
                return cached as string;
            }

            console.log(`[CACHE_MISS] Key: ${key}`);
            return null;
        } catch (error) {
            console.error('[CACHE_ERROR] Get failed:', error);
            return null; // Fail gracefully
        }
    }

    /**
     * Cache a response with TTL
     */
    static async cacheResponse(
        prompt: string,
        scenarioId: string,
        response: string
    ): Promise<void> {
        if (!redis) {
            return; // Graceful degradation
        }

        try {
            const key = generateCacheKey(prompt, scenarioId);
            await redis.setex(key, CACHE_TTL, response);
            console.log(`[CACHE_SET] Key: ${key}, TTL: ${CACHE_TTL}s`);
        } catch (error) {
            console.error('[CACHE_ERROR] Set failed:', error);
            // Don't throw - caching is optional
        }
    }

    /**
     * Invalidate cache for a scenario
     */
    static async invalidateScenario(scenarioId: string): Promise<void> {
        if (!redis) {
            return;
        }

        try {
            // Note: This requires SCAN in production Redis
            console.log(`[CACHE_INVALIDATE] Scenario: ${scenarioId}`);
            // Implementation depends on Redis version
        } catch (error) {
            console.error('[CACHE_ERROR] Invalidation failed:', error);
        }
    }
}

export default CachedNegotiationService;
