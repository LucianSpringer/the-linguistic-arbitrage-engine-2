import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { rateLimit, getRateLimitHeaders } from '../../../lib/rateLimiter';
import logger from '../../../lib/logger';

interface NegotiateRequest {
    prompt: string;
    history: Array<{
        id: string;
        origin: 'OPERATOR' | 'SYNTHETIC_AGENT';
        payload: string;
        timestamp: number;
    }>;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    try {
        // Rate limiting
        const rateLimitResult = await rateLimit(ipAddress);
        const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

        if (!rateLimitResult.success) {
            logger.warn('Rate limit exceeded', { ipAddress, endpoint: '/api/negotiate' });
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: rateLimitHeaders
                }
            );
        }

        // Validate API key exists
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logger.error('GEMINI_API_KEY not configured');
            return NextResponse.json(
                { error: 'API service not configured' },
                { status: 500 }
            );
        }

        // Parse request body
        const body: NegotiateRequest = await request.json();
        const { prompt, history } = body;

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400, headers: rateLimitHeaders }
            );
        }

        logger.info('Negotiate request received', {
            promptLength: prompt.length,
            historyLength: history?.length || 0,
            ipAddress
        });

        // Initialize Gemini AI
        const ai = new GoogleGenAI({ apiKey });

        // Construct context from history
        const context = history?.map(h => `${h.origin}: ${h.payload}`).join('\n') || '';
        const fullPrompt = `
      CONTEXT_HISTORY:
      ${context}

      CURRENT_INPUT:
      ${prompt}

      MISSION:
      Analyze the negotiation leverage. Provide a strategic counter-move.
    `;

        // Execute Deep Think with retry logic
        let attempts = 0;
        const MAX_RETRIES = 3;

        while (attempts < MAX_RETRIES) {
            try {
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-2.0-flash-thinking-exp-1219',
                    contents: fullPrompt,
                    config: {
                        thinkingConfig: { thinkingBudget: 32768 },
                    }
                });

                const responseText = response.text || 'NO_RESPONSE';
                const duration = Date.now() - startTime;

                logger.info('Negotiate request successful', {
                    duration,
                    responseLength: responseText.length,
                    attempts: attempts + 1
                });

                return NextResponse.json({
                    response: responseText,
                    success: true
                }, {
                    headers: rateLimitHeaders
                });

            } catch (error: any) {
                attempts++;
                logger.error('Gemini API error', {
                    attempt: attempts,
                    error: error.message,
                    ipAddress
                });

                if (attempts >= MAX_RETRIES) {
                    return NextResponse.json(
                        { error: 'AI service temporarily unavailable', details: error.message },
                        { status: 503, headers: rateLimitHeaders }
                    );
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            }
        }

        return NextResponse.json(
            { error: 'Maximum retries exceeded' },
            { status: 503, headers: rateLimitHeaders }
        );

    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('API error', {
            error: error.message,
            stack: error.stack,
            duration,
            ipAddress
        });

        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
