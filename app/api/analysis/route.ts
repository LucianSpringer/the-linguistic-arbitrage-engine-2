import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface AnalysisRequest {
    history: Array<{
        id: string;
        origin: 'OPERATOR' | 'SYNTHETIC_AGENT';
        payload: string;
        timestamp: number;
    }>;
    metrics: Array<{
        timestamp: number;
        verbalVelocity: number;
        hesitationMarkers: number;
        levenshteinDelta: number;
        spectralIntensity: number;
        sentimentValence: number;
        confidenceScore: number;
        logicDensity: number;
        aggressionIndex: number;
        clarityScore: number;
    }>;
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API service not configured' },
                { status: 500 }
            );
        }

        const body: AnalysisRequest = await request.json();
        const { history, metrics } = body;

        if (!history || !metrics) {
            return NextResponse.json(
                { error: 'History and metrics are required' },
                { status: 400 }
            );
        }

        // Calculate metrics summary
        const avgConfidence = metrics.reduce((acc, m) => acc + m.confidenceScore, 0) / (metrics.length || 1);
        const maxVelocity = Math.max(...metrics.map(m => m.verbalVelocity));
        const avgHesitation = metrics.reduce((acc, m) => acc + m.hesitationMarkers, 0) / (metrics.length || 1);

        // Construct context
        const context = history.map(h =>
            `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.origin}: ${h.payload}`
        ).join('\n');

        const prompt = `
      ROLE: Expert Negotiation Psychologist & Linguistics Coach.
      TASK: Analyze the following negotiation transcript and telemetry data. Generate a JSON report.
      
      TELEMETRY SUMMARY:
      - Average Confidence Score: ${(avgConfidence * 100).toFixed(1)}%
      - Peak Verbal Velocity: ${maxVelocity.toFixed(0)} WPM
      - Average Hesitation Markers: ${avgHesitation.toFixed(1)} per segment

      TRANSCRIPT:
      ${context}

      REQUIREMENTS:
      You must output a VALID JSON object matching this structure exactly. Do not include markdown formatting or code blocks. Just the raw JSON string.
      
      Structure:
      {
        "strengths": [{"point": "string", "example": "quote from transcript"}],
        "missedOpportunities": [{"context": "what happened", "betterAlternative": "what they should have said"}],
        "psychologicalTacticsDetected": [{"tacticName": "string", "description": "string"}],
        "confidenceTrajectoryAnalysis": "A narrative paragraph explaining how the user's confidence evolved.",
        "trainingRecommendations": ["string", "string"],
        "overallGrade": "S" | "A" | "B" | "C" | "F"
      }
    `;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
            }
        });

        let cleanJson = response.text || '{}';
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();

        const report = JSON.parse(cleanJson);

        return NextResponse.json({
            report,
            success: true
        });

    } catch (error: any) {
        console.error('[ANALYSIS_ERROR]', error);
        return NextResponse.json(
            { error: 'Failed to generate analysis', details: error.message },
            { status: 500 }
        );
    }
}
