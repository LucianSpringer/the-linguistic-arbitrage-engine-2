import { DialogueTransmissionVector, CircuitBreakerThresholds, NegotiationEntropyMetric, StrategicAnalysisReport } from "../types";

export class GeminiDeepThinkService {
  private apiEndpoint = '/api/negotiate';
  private analysisEndpoint = '/api/analysis';

  /**
   * Executes a deep thinking query via backend proxy.
   * API key is never exposed to the client.
   */
  public async executeDeepThought(
    prompt: string,
    history: DialogueTransmissionVector[]
  ): Promise<string> {

    let attempts = 0;

    while (attempts < CircuitBreakerThresholds.MAX_RETRY_ATTEMPTS) {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, history })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        return data.response || "DATA_CORRUPTION_EMPTY_RESPONSE";

      } catch (error: any) {
        const errorLog = {
          timestamp: new Date().toISOString(),
          attempt: attempts + 1,
          errorType: error.name,
          errorMessage: error.message,
        };
        console.error(`[GEMINI_DEEP_THINK_FAILURE] :: `, JSON.stringify(errorLog, null, 2));

        attempts++;
        if (attempts >= CircuitBreakerThresholds.MAX_RETRY_ATTEMPTS) {
          return "CIRCUIT_BREAKER_ACTIVATED: UNABLE_TO_PROCESS_THOUGHT_PATTERN";
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    return "SYSTEM_FAILURE";
  }

  /**
   * Generates a Post-Mortem Strategic Analysis Report via backend proxy.
   */
  public async generateStrategicAnalysis(
    history: DialogueTransmissionVector[],
    metrics: NegotiationEntropyMetric[]
  ): Promise<StrategicAnalysisReport> {

    try {
      const response = await fetch(this.analysisEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, metrics })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return data.report as StrategicAnalysisReport;

    } catch (error) {
      console.error("[ANALYSIS_GENERATION_FAILED]", error);
      throw new Error("Failed to generate strategic report.");
    }
  }

  /**
   * Measures round-trip latency to the backend API.
   * Returns latency in milliseconds.
   */
  public async measureLatency(): Promise<number> {
    const start = Date.now();
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'ping',
          history: []
        })
      });

      if (response.ok) {
        return Date.now() - start;
      }
      return -1;
    } catch (error) {
      console.warn("[LATENCY_CHECK_FAILED]", error);
      return -1;
    }
  }
}