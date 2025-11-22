import { create } from 'zustand';
import {
    NegotiationEntropyMetric,
    DialogueTransmissionVector,
    CognitiveLoadState,
    SimulationScenarioMatrix,
    ApplicationViewMode,
    StrategicAnalysisReport
} from '../types';

interface AppState {
    // Scenario Management
    activeScenario: SimulationScenarioMatrix | null;
    setActiveScenario: (scenario: SimulationScenarioMatrix) => void;

    // Metrics & Dialogue
    entropyMetrics: NegotiationEntropyMetric[];
    addEntropyMetric: (metric: NegotiationEntropyMetric) => void;
    clearEntropyMetrics: () => void;

    transmissionVectors: DialogueTransmissionVector[];
    addTransmissionVector: (vector: DialogueTransmissionVector) => void;
    clearTransmissionVectors: () => void;

    // Cognitive State
    cognitiveState: CognitiveLoadState;
    setCognitiveState: (state: CognitiveLoadState) => void;

    // Audio Controls
    isAcousticCaptureActive: boolean;
    toggleAcousticCapture: () => void;
    setAcousticCaptureActive: (active: boolean) => void;

    currentSpectralFlux: number;
    setCurrentSpectralFlux: (flux: number) => void;

    selectedVoice: string;
    setSelectedVoice: (voice: string) => void;

    networkLatency: number;
    setNetworkLatency: (latency: number) => void;

    // View Mode
    viewMode: ApplicationViewMode;
    setViewMode: (mode: ApplicationViewMode) => void;

    // Analysis Report
    analysisReport: StrategicAnalysisReport | null;
    setAnalysisReport: (report: StrategicAnalysisReport | null) => void;

    // Reset Function
    resetSimulation: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial State
    activeScenario: null,
    entropyMetrics: [],
    transmissionVectors: [],
    cognitiveState: CognitiveLoadState.IDLE,
    isAcousticCaptureActive: true,
    currentSpectralFlux: 0,
    selectedVoice: 'Kore',
    networkLatency: -1,
    viewMode: ApplicationViewMode.SIMULATION,
    analysisReport: null,

    // Actions
    setActiveScenario: (scenario) => set({ activeScenario: scenario }),

    addEntropyMetric: (metric) =>
        set((state) => ({
            entropyMetrics: [...state.entropyMetrics.slice(-19), metric],
        })),

    clearEntropyMetrics: () => set({ entropyMetrics: [] }),

    addTransmissionVector: (vector) =>
        set((state) => ({
            transmissionVectors: [...state.transmissionVectors, vector],
        })),

    clearTransmissionVectors: () => set({ transmissionVectors: [] }),

    setCognitiveState: (cognitiveState) => set({ cognitiveState }),

    toggleAcousticCapture: () =>
        set((state) => ({
            isAcousticCaptureActive: !state.isAcousticCaptureActive,
        })),

    setAcousticCaptureActive: (active) =>
        set({ isAcousticCaptureActive: active }),

    setCurrentSpectralFlux: (flux) => set({ currentSpectralFlux: flux }),

    setSelectedVoice: (voice) => set({ selectedVoice: voice }),

    setNetworkLatency: (latency) => set({ networkLatency: latency }),

    setViewMode: (mode) => set({ viewMode: mode }),

    setAnalysisReport: (report) => set({ analysisReport: report }),

    resetSimulation: () =>
        set({
            entropyMetrics: [],
            transmissionVectors: [],
            cognitiveState: CognitiveLoadState.IDLE,
            currentSpectralFlux: 0,
            viewMode: ApplicationViewMode.SIMULATION,
            analysisReport: null,
        }),
}));
