import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import redis from './redis';
import logger from './logger';

// Rate limiter for API endpoints
const rateLimiterOptions = {
    points: 10, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds if exceeded
};

// Use Redis-based rate limiter in production, memory-based in development
export const rateLimiter = process.env.UPSTASH_REDIS_REST_URL
    ? new RateLimiterRedis({
        storeClient: redis as any,
        keyPrefix: 'rl',
        ...rateLimiterOptions,
    })
    : new RateLimiterMemory(rateLimiterOptions);

/**
 * Rate limit middleware for Next.js API routes
 */
export async function rateLimit(identifier: string): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}> {
    try {
        const rateLimiterRes = await rateLimiter.consume(identifier);

        return {
            success: true,
            limit: rateLimiterOptions.points,
            remaining: rateLimiterRes.remainingPoints,
            reset: new Date(Date.now() + rateLimiterRes.msBeforeNext).getTime(),
        };
    } catch (error: any) {
        if (error.remainingPoints !== undefined) {
            // Rate limit exceeded
            logger.warn(`Rate limit exceeded for: ${identifier}`);

            return {
                success: false,
                limit: rateLimiterOptions.points,
                remaining: 0,
                reset: new Date(Date.now() + error.msBeforeNext).getTime(),
            };
        }

        // Other error
        logger.error('Rate limiter error:', error);
        throw error;
    }
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: Awaited<ReturnType<typeof rateLimit>>) {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
    };
}

export default rateLimiter;
