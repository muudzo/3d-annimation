/**
 * Generative Audio System
 * Uses Web Audio API to create ambient drones and interaction-based modulation.
 */
export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.oscillators = [];
        this.filters = [];
        this.isStarted = false;

        // Configuration
        this.baseFreq = 65.41; // C2 (Deep Drone)
        this.droneCount = 3;
    }

    async init() {
        if (this.isStarted) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Master Chain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Safe initial volume
        this.masterGain.connect(this.ctx.destination);

        // Create Drone Oscillators
        for (let i = 0; i < this.droneCount; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            // Setup Oscillator
            osc.type = i === 0 ? 'sine' : 'triangle';
            // Detune slightly for chorus effect
            const detune = (Math.random() - 0.5) * 10;
            osc.frequency.value = this.baseFreq * (i + 1); // Harmonics
            osc.detune.value = detune;

            // Setup Filter (Lowpass for warm sound)
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 1;

            // Setup Gain
            gain.gain.value = 0.5 / (i + 1);

            // Connect: Osc -> Filter -> Gain -> Master
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start();

            this.oscillators.push({ osc, gain, filter });
        }

        this.isStarted = true;
        console.log("Audio System Initialized");
    }

    /**
     * Update audio parameters based on interaction state
     * @param {number} intensity - 0 to 1 based on hand movement/particle speed
     * @param {string} shapeType - Current shape for timbre changes
     */
    update(intensity, shapeType) {
        if (!this.isStarted) return;

        const time = this.ctx.currentTime;

        this.oscillators.forEach((o, i) => {
            // Modulate filter cutoff based on intensity (hand movement)
            // More movement = Brighter sound
            const targetFreq = 400 + (intensity * 2000);
            o.filter.frequency.setTargetAtTime(targetFreq, time, 0.1);

            // Modulate Volume/Tremolo
            // Add subtle LFO effect
            const lfo = Math.sin(time * (1 + i)) * 0.1;
            o.gain.gain.setTargetAtTime((0.5 / (i + 1)) + lfo, time, 0.1);
        });
    }

    /**
     * Trigger a "Whoosh" sound for shape modulation
     */
    triggerWhoosh() {
        if (!this.isStarted) return;
        const time = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(800, time + 0.5);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, time);
        filter.frequency.linearRampToValueAtTime(2000, time + 0.4);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.0);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + 1.2);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
}
