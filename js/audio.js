/* ==========================================================================
   Audio & Haptic Feedback Engine (Web Audio API Synthesizer)
   ========================================================================== */

class SoundEngine {
    constructor() {
        this.audioCtx = null;
        this.soundEnabled = true;
        this.vibrateEnabled = true;
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
    }

    playSuccessBeep() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.audioCtx) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        // High frequency clean scanner success chime (1800Hz -> 2400Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(2450, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    playErrorBeep() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.audioCtx) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(200, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    triggerVibration() {
        if (!this.vibrateEnabled) return;
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(100);
            } catch (e) {
                // Vibration blocked or not supported on device
            }
        }
    }
}

window.soundEngine = new SoundEngine();
