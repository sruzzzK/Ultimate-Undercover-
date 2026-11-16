class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playTone(freq, type = 'sine', duration = 0.12, gainVal = 0.12, delay = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  click() {
    this.playTone(520, 'triangle', 0.06, 0.08);
  }

  reveal() {
    this.playTone(440, 'sine', 0.12, 0.1, 0);
    this.playTone(660, 'sine', 0.18, 0.12, 0.08);
  }

  eliminate() {
    this.playTone(220, 'sawtooth', 0.22, 0.12, 0);
    this.playTone(155, 'sawtooth', 0.35, 0.14, 0.14);
  }

  victory() {
    this.playTone(523.25, 'triangle', 0.15, 0.12, 0);
    this.playTone(659.25, 'triangle', 0.15, 0.12, 0.12);
    this.playTone(783.99, 'triangle', 0.15, 0.12, 0.24);
    this.playTone(1046.5, 'triangle', 0.35, 0.15, 0.36);
  }

  tick() {
    this.playTone(880, 'sine', 0.04, 0.05);
  }
}

export const AudioFX = new SoundEngine();
