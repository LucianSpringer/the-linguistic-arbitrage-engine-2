// audio-processor.worklet.js
// AudioWorklet processor for real-time audio analysis and streaming

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    // Calculate RMS (Root Mean Square) for amplitude
    calculateRMS(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        return Math.sqrt(sum / data.length);
    }

    // Convert Float32Array to Int16Array for PCM encoding
    floatTo16BitPCM(float32Array) {
        const int16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16;
    }

    // Encode to base64
    encodeBase64(int16Array) {
        const uint8 = new Uint8Array(int16Array.buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return btoa(binary);
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input && input.length > 0) {
            const inputChannel = input[0];

            // Calculate RMS and send to main thread
            const rms = this.calculateRMS(inputChannel);
            this.port.postMessage({
                type: 'rms',
                value: rms
            });

            // Buffer audio data
            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                // When buffer is full, send it
                if (this.bufferIndex >= this.bufferSize) {
                    const int16Data = this.floatTo16BitPCM(this.buffer);
                    const base64Data = this.encodeBase64(int16Data);

                    this.port.postMessage({
                        type: 'audio',
                        data: base64Data,
                        mimeType: 'audio/pcm;rate=16000'
                    });

                    this.bufferIndex = 0;
                }
            }
        }

        // Keep processor alive
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
