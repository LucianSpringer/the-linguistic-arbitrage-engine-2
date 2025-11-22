import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PrismaClient } from '@prisma/client';
import { CachedNegotiationService } from '../../../services/cacheService';

const prisma = new PrismaClient();

// Rate limiter: 10 requests per minute per IP
const rateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60,
});

interface NegotiateRequest {
    prompt: string;
    scenarioId?: string;
    sessionId?: string;
    history: Array<{
        id: string;
        origin: 'OPERATOR' | 'SYNTHETIC_AGENT';
        payload: string;
        timestamp: number;
    }>;
}

/**
 * Helper: Get client IP address
 */
function getClientIP(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

/**
 * Helper: Save turn to database (fire-and-forget)
 */
async function saveTurnAsync(
    sessionId: string | undefined,
    prompt: string,
    response: string,
    latencyMs: number,
    cacheHit: boolean
): Promise<void> {
    try {
        // Create session if doesn't exist
        let finalSessionId = sessionId;
        if (!finalSessionId) {
            const session = await prisma.session.create({
                data: { userId: null },
            });
            finalSessionId = session.id;
        }

        // Save turn
        await prisma.negotiationTurn.create({
            data: {
                sessionId: finalSessionId,
                prompt,
                response,
                latencyMs,
                cacheHit,
            },
        });

        console.log(`[DB_SAVE] Turn saved to session: ${finalSessionId}`);
    } catch (error) {
        console.error('[DB_ERROR] Failed to save turn:', error);
        // Don't throw - persistence is optional
    }
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

    try {
        // 1. RATE LIMITING
        try {
            await rateLimiter.consume(clientIP);
        } catch (rateLimiterRes: any) {
            console.log(`[RATE_LIMIT] IP blocked: ${clientIP}`);
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil(rateLimiterRes.msBeforeNext / 1000)),
                    },
                }
            );
        }

        // 2. VALIDATE API KEY
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[API_ERROR] GEMINI_API_KEY not configured');
            return NextResponse.json(
                { error: 'API service not configured' },
                { status: 500 }
            );
        }

        // 3. PARSE REQUEST
        const body: NegotiateRequest = await request.json();
        const { prompt, scenarioId = 'default', sessionId, history } = body;

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        console.log(`[API_INVOKE] IP=${clientIP} Scenario=${scenarioId} Prompt="${prompt.substring(0, 50)}..."`);

        // 4. CHECK CACHE
        const cachedResponse = await CachedNegotiationService.getCachedResponse(
            prompt,
            scenarioId
        );

        if (cachedResponse) {
            const latency = Date.now() - startTime;
            console.log(`[API_INVOKE] IP=${clientIP} Scenario=${scenarioId} Cache=HIT Latency=${latency}ms`);

            // Save to DB asynchronously
            saveTurnAsync(sessionId, prompt, cachedResponse, latency, true).catch(
                console.error
            );

            return NextResponse.json(
                {
                    response: cachedResponse,
                    success: true,
                    cached: true,
                },
                {
                    headers: {
                        'X-Cache': 'HIT',
                    },
                }
            );
        }

        console.log(`[API_INVOKE] IP=${clientIP} Scenario=${scenarioId} Cache=MISS`);

        // 5. INITIALIZE GEMINI AI
        const ai = new GoogleGenAI({ apiKey });

        // 6. CONSTRUCT PROMPT
        const context =
            history?.map((h) => `${h.origin}: ${h.payload}`).join('\n') || '';
        const fullPrompt = `
CONTEXT_HISTORY:
${context}

CURRENT_INPUT:
${prompt}

MISSION:
Analyze the negotiation leverage. Provide a strategic counter-move.
    `.trim();

        // 7. STREAMING RESPONSE
        const encoder = new TextEncoder();
        let fullResponse = '';

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const response = await ai.models.streamGenerateContent({
                        model: 'gemini-2.0-flash-thinking-exp-1219',
                        contents: fullPrompt,
                        config: {
                            thinkingConfig: { thinkingBudget: 32768 },
                        },
                    });

                    // Stream chunks
                    for await (const chunk of response.stream) {
                        const text = chunk.text || '';
                        fullResponse += text;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                    }

                    // Send completion signal
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();

                    const latency = Date.now() - startTime;
                    console.log(`[API_INVOKE] IP=${clientIP} Scenario=${scenarioId} Cache=MISS Latency=${latency}ms`);

                    // Cache response asynchronously
                    CachedNegotiationService.cacheResponse(
                        prompt,
                        scenarioId,
                        fullResponse
                    ).catch(console.error);

                    // Save to DB asynchronously
                    saveTurnAsync(sessionId, prompt, fullResponse, latency, false).catch(
                        console.error
                    );
                } catch (error: any) {
                    console.error('[GEMINI_ERROR]', error);
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ error: error.message })}\n\n`
                        )
                    );
                    controller.close();
                }
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Cache': 'MISS',
            },
        });
    } catch (error: any) {
        const latency = Date.now() - startTime;
        console.error(`[API_ERROR] IP=${clientIP} Latency=${latency}ms Error=${error.message}`);

        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
