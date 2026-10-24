export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.chompFlip = false;
    this.lastChomp = 0;
  }

  ensureStarted() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.18;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    return true;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.18, this.context.currentTime, 0.015);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({ frequency = 440, endFrequency = frequency, duration = 0.08, volume = 0.3, type = 'square', delay = 0 }) {
    if (this.muted || !this.ensureStarted()) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  sequence(notes) {
    let delay = 0;
    for (const note of notes) {
      this.tone({ ...note, delay });
      delay += note.duration * 0.82;
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case 'start':
        this.sequence([
          { frequency: 220, endFrequency: 330, duration: 0.12, volume: 0.2, type: 'square' },
          { frequency: 330, endFrequency: 494, duration: 0.12, volume: 0.2, type: 'square' },
          { frequency: 494, endFrequency: 740, duration: 0.2, volume: 0.24, type: 'square' },
        ]);
        break;
      case 'pellet': {
        const now = performance.now();
        if (now - this.lastChomp < 42) break;
        this.lastChomp = now;
        this.chompFlip = !this.chompFlip;
        this.tone({
          frequency: this.chompFlip ? 245 : 196,
          endFrequency: this.chompFlip ? 170 : 255,
          duration: 0.045,
          volume: 0.095,
          type: 'square',
        });
        break;
      }
      case 'power':
        this.sequence([
          { frequency: 125, endFrequency: 250, duration: 0.13, volume: 0.28, type: 'sawtooth' },
          { frequency: 250, endFrequency: 520, duration: 0.18, volume: 0.25, type: 'sawtooth' },
        ]);
        break;
      case 'ghostEaten':
        this.sequence([
          { frequency: 520, endFrequency: 900, duration: 0.09, volume: 0.27, type: 'square' },
          { frequency: 740, endFrequency: 1250, duration: 0.13, volume: 0.22, type: 'square' },
        ]);
        break;
      case 'fruitSpawn':
        this.tone({ frequency: 700, endFrequency: 980, duration: 0.16, volume: 0.18, type: 'sine' });
        break;
      case 'fruit':
        this.sequence([
          { frequency: 660, endFrequency: 880, duration: 0.09, volume: 0.22, type: 'triangle' },
          { frequency: 880, endFrequency: 1320, duration: 0.14, volume: 0.24, type: 'triangle' },
        ]);
        break;
      case 'death':
        this.tone({ frequency: 460, endFrequency: 55, duration: 0.72, volume: 0.35, type: 'sawtooth' });
        break;
      case 'levelClear':
        this.sequence([
          { frequency: 392, endFrequency: 523, duration: 0.12, volume: 0.22, type: 'square' },
          { frequency: 523, endFrequency: 659, duration: 0.12, volume: 0.22, type: 'square' },
          { frequency: 659, endFrequency: 1046, duration: 0.25, volume: 0.26, type: 'square' },
        ]);
        break;
      case 'pause':
        this.tone({ frequency: 300, endFrequency: 190, duration: 0.1, volume: 0.12, type: 'triangle' });
        break;
      case 'resume':
        this.tone({ frequency: 190, endFrequency: 320, duration: 0.1, volume: 0.12, type: 'triangle' });
        break;
      default:
        break;
    }
  }
}
