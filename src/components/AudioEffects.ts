/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private drawOsc: OscillatorNode | null = null;
  private drawGain: GainNode | null = null;
  private isEnabled: boolean = true;

  constructor() {
    // Lazy initialize when first interaction happens to comply with browser autoplay policies
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopDraw();
    }
  }

  public getIsEnabled() {
    return this.isEnabled;
  }

  // Draw hum sound (like a light theremin)
  public startDraw(yNormalized: number = 0.5) {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      if (!this.drawOsc) {
        this.drawOsc = this.ctx.createOscillator();
        this.drawGain = this.ctx.createGain();
        
        // Sine wave is smooth and pleasant
        this.drawOsc.type = 'sine';
        
        // Map Y coordinate (0-1) to pitch: higher up on screen (smaller Y) = higher pitch
        const freq = 220 + (1 - yNormalized) * 440; // 220Hz to 660Hz
        this.drawOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Very soft volume
        this.drawGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        
        this.drawOsc.connect(this.drawGain);
        this.drawGain.connect(this.ctx.destination);
        this.drawOsc.start();
      } else {
        // Smoothly ramp frequency
        const freq = 220 + (1 - yNormalized) * 440;
        this.drawOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
      }
    } catch (e) {
      console.warn('Web Audio startDraw error:', e);
    }
  }

  public updateDrawPitch(yNormalized: number) {
    if (!this.isEnabled || !this.ctx || !this.drawOsc) return;
    try {
      const freq = 220 + (1 - yNormalized) * 440;
      this.drawOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
    } catch (e) {
      // ignore
    }
  }

  public stopDraw() {
    try {
      if (this.drawOsc && this.drawGain && this.ctx) {
        const osc = this.drawOsc;
        const gain = this.drawGain;
        
        // Quick fadeout to avoid pop clicks
        gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
        
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch (e) {}
        }, 100);
        
        this.drawOsc = null;
        this.drawGain = null;
      }
    } catch (e) {
      console.warn('Web Audio stopDraw error:', e);
    }
  }

  // Eraser swoosh sound (pink noise band)
  public playErase() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.15; // 0.15s duration
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate band-limited or high-frequency hiss
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Simple lowpass filter to make it "softer" like paper rubbing
        data[i] = lastOut = 0.8 * lastOut + 0.2 * white;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start(now);
    } catch (e) {
      console.warn('Web Audio playErase error:', e);
    }
  }

  // Screen clear frequency sweep
  public playClear() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Web Audio playClear error:', e);
    }
  }

  // Play sound when reaching a dot in connect-the-dots mode
  public playDotSuccess(dotNumber: number) {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Pitch goes up slightly for higher numbered dots to sound like a scale!
      const baseFreq = 330; // E4
      const freq = baseFreq * Math.pow(1.05946, (dotNumber % 12)); // Equal temperament semitones
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn('Web Audio playDotSuccess error:', e);
    }
  }

  // Score celebration fanfare!
  public playWin() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
      
      notes.forEach((freq, index) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0.0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.04, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn('Web Audio playWin error:', e);
    }
  }
}

export const audioEffects = new AudioSynthesizer();
