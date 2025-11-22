import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { CircuitBreakerThresholds } from '../types';

interface VoiceStreamProcessorConfig {
  apiKey?: string;
  voiceName: string;
  isAcousticCaptureActive: boolean;
  onTranscriptUpdate: (text: string, isFinal: boolean) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
  onSpectralFluxAnalysis: (amplitude: number) => void;
}

export const useVoiceStreamProcessor = ({
  apiKey,
  voiceName,
  isAcousticCaptureActive,
  onTranscriptUpdate,
  onAudioData,
  onSpectralFluxAnalysis
}: VoiceStreamProcessorConfig) => {
  const [isConnectionActive, setIsConnectionActive] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const sessionRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null); // REPLACED ScriptProcessor

  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Audio Processing Helpers
  const decodeAudioData = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const initiateNeuralLink = useCallback(async () => {
    // AUTO-DETECT KEY: Use prop OR Environment Variable
    const effectiveKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!effectiveKey) {
      setConnectionError("CRITICAL: API_KEY_MISSING (Check .env.local with NEXT_PUBLIC_GEMINI_API_KEY)");
      return;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: effectiveKey });

      // Initialize Audio Contexts
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      // Load AudioWorklet Module
      try {
        await inputAudioContextRef.current.audioWorklet.addModule('/audio-processor.worklet.js');
      } catch (e) {
        console.error("Failed to load audio worklet:", e);
        throw new Error("AUDIO_WORKLET_LOAD_FAILED");
      }

      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });
      }

      console.log(`[NEURAL_LINK] Connecting... | Voice: ${voiceName}`);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("[NEURAL_LINK] Established.");
            setIsConnectionActive(true);
            setConnectionError(null);
            setRetryAttempt(0);

            if (!inputAudioContextRef.current || !streamRef.current) return;

            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const workletNode = new AudioWorkletNode(inputAudioContextRef.current, 'audio-processor');

            workletNode.port.onmessage = (event) => {
              const { type, value, data } = event.data;

              if (type === 'rms') {
                onSpectralFluxAnalysis(value);
              }

              if (type === 'audio' && isAcousticCaptureActive) {
                // 'data' is base64 from the worklet
                sessionPromise.then(session => {
                  session.sendRealtimeInput({
                    mimeType: "audio/pcm;rate=16000",
                    data: data
                  });
                });
              }
            };

            source.connect(workletNode);
            workletNode.connect(inputAudioContextRef.current.destination);
            workletNodeRef.current = workletNode;
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription?.text) {
              onTranscriptUpdate(msg.serverContent.inputTranscription.text, false);
            }

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              const buffer = await decodeAudioData(audioData, outputAudioContextRef.current);

              // SYNC FIX: Ensure absolute time scheduling
              const currentTime = outputAudioContextRef.current.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }

              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContextRef.current.destination);

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;

              sourcesRef.current.add(source);

              onAudioData(buffer);
            }
          },
          onclose: (_e) => {
            console.log("[NEURAL_LINK] Connection Closed.");
            setIsConnectionActive(false);
          },
          onerror: (e: any) => {
            console.error("[NEURAL_LINK] Error:", e);
            setIsConnectionActive(false);
            setConnectionError(`CONNECTION_ERROR: ${e.message}`);
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      setConnectionError(`INITIALIZATION_FAILURE :: ${err.message}`);
      setIsConnectionActive(false);
    }
  }, [apiKey, voiceName, isAcousticCaptureActive, onTranscriptUpdate, onAudioData, onSpectralFluxAnalysis]);

  const severNeuralLink = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    // Clean up audio sources
    sourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    sourcesRef.current.clear();

    setIsConnectionActive(false);
  }, []);

  return {
    isConnectionActive,
    connectionError,
    initiateNeuralLink,
    severNeuralLink
  };
};
