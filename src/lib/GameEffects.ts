class GameEffectsService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext() {
    if (this.isMuted) return null;
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
        return null;
      }
    }
    // Resume context if suspended (browser auto-play policy)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  private playTone(frequency: number, type: OscillatorType, duration: number, vol = 0.1) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Envelope to prevent audio popping
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(vol, ctx.currentTime + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // General UI click
  public playClick() {
    this.playTone(600, 'sine', 0.1, 0.05);
    this.vibrate(10);
  }

  // Catch Success
  public playCatchSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;
    
    // Quick ascending arpeggio
    this.playTone(440, 'square', 0.1, 0.08);
    setTimeout(() => this.playTone(554, 'square', 0.1, 0.08), 100);
    setTimeout(() => this.playTone(659, 'square', 0.2, 0.08), 200);
    setTimeout(() => this.playTone(880, 'square', 0.4, 0.1), 300);
    
    this.vibrate([50, 50, 50, 50, 100]);
  }

  // Game over / Captured
  public playCaptured() {
    const ctx = this.getContext();
    if (!ctx) return;
    
    // Descending minor chord
    this.playTone(440, 'sawtooth', 0.2, 0.1);
    setTimeout(() => this.playTone(392, 'sawtooth', 0.2, 0.1), 200);
    setTimeout(() => this.playTone(349, 'sawtooth', 0.2, 0.1), 400);
    setTimeout(() => this.playTone(329, 'sawtooth', 0.6, 0.15), 600);

    this.vibrate([100, 50, 200, 50, 300]);
  }

  // Radar ping (Hiding phase updates)
  public playRadarPing() {
    this.playTone(880, 'sine', 0.1, 0.03);
    setTimeout(() => this.playTone(1760, 'sine', 0.2, 0.02), 100);
  }

  // Bomb deployed
  public playBombDeployed() {
    this.playTone(200, 'triangle', 0.5, 0.2);
    this.vibrate([50, 100, 50]);
  }

  // Wrapper for Haptic feedback
  public vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch(e) {}
    }
  }
}

export const GameEffects = new GameEffectsService();
