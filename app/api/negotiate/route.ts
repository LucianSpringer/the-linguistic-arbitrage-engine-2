import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

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
    try {
        // Validate API key exists
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[API_ERROR] GEMINI_API_KEY not configured');
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
                { status: 400 }
            );
        }

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
                    model: 'gemini-3-pro-preview',
                    contents: fullPrompt,
                    config: {
                        thinkingConfig: { thinkingBudget: 32768 },
                    }
                });

                const responseText = response.text || 'NO_RESPONSE';

                return NextResponse.json({
                    response: responseText,
                    success: true
                });

            } catch (error: any) {
                attempts++;
                console.error(`[GEMINI_ERROR] Attempt ${attempts}:`, error.message);

                if (attempts >= MAX_RETRIES) {
                    return NextResponse.json(
                        { error: 'AI service temporarily unavailable', details: error.message },
                        { status: 503 }
                    );
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            }
        }

        return NextResponse.json(
            { error: 'Maximum retries exceeded' },
            { status: 503 }
        );

    } catch (error: any) {
        console.error('[API_ERROR]', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
