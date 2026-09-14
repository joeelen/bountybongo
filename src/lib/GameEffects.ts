/**
 * src/lib/GameEffects.ts
 * Synthesized Web Audio API & Haptic Feedback Engine for Bountyrunner.
 * 
 * Provides procedural audio synthesis with envelope shaping (0 pops/clicks)
 * and synchronized mobile haptic vibration cues for match telemetry, party
 * game modes, tactical power-ups, and post-match debriefs.
 */

export type PowerUpSoundType = 'sprint' | 'decoy' | 'shield' | 'freeze_trap';

class GameEffectsService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        this.isMuted = window.localStorage.getItem('bounty_audio_muted') === 'true';
      } catch (e) {
        this.isMuted = false;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.audioCtx) {
      try {
        if (typeof window !== 'undefined') {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            this.audioCtx = new AudioCtxClass();
          }
        }
      } catch (e) {
        console.warn('Web Audio API not supported');
        return null;
      }
    }
    // Resume context if suspended (browser auto-play policy)
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('bounty_audio_muted', muted ? 'true' : 'false');
      } catch (e) {}
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private playTone(frequency: number, type: OscillatorType, duration: number, vol = 0.1): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
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

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Error playing tone', e);
    }
  }

  // --- EXISTING BASELINE METHODS (100% INTACT & PRESERVED) ---

  // General UI click
  public playClick(): void {
    this.playTone(600, 'sine', 0.1, 0.05);
    this.vibrate(10);
  }

  // Catch Success
  public playCatchSuccess(): void {
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
  public playCaptured(): void {
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
  public playRadarPing(): void {
    this.playTone(880, 'sine', 0.1, 0.03);
    setTimeout(() => this.playTone(1760, 'sine', 0.2, 0.02), 100);
  }

  // Bomb deployed
  public playBombDeployed(): void {
    this.playTone(200, 'triangle', 0.5, 0.2);
    this.vibrate([50, 100, 50]);
  }

  // --- FEATURE F3: NEW SYNTHESIZED CUES & HAPTICS ---

  /**
   * 1. Countdown Chime: 880Hz ticks + 1760Hz final chime
   * @param secondsRemaining Number of seconds remaining on countdown clock
   */
  public playCountdownChime(secondsRemaining: number): void {
    if (secondsRemaining > 0) {
      this.playTone(880, 'sine', 0.12, 0.08);
      this.vibrate(30);
    } else {
      this.playTone(1320, 'sine', 0.15, 0.1);
      setTimeout(() => this.playTone(1760, 'sine', 0.25, 0.12), 120);
      this.vibrate([40, 20, 80]);
    }
  }

  /**
   * 2. Match Start: Sawtooth sweep + major triad surge
   */
  public playMatchStart(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Sawtooth sweep from 220Hz to 880Hz over 450ms
      const sweepOsc = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweepOsc.type = 'sawtooth';
      sweepOsc.frequency.setValueAtTime(220, ctx.currentTime);
      sweepOsc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.45);

      sweepGain.gain.setValueAtTime(0, ctx.currentTime);
      sweepGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.08);
      sweepGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.45);
      sweepGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.50);

      sweepOsc.connect(sweepGain);
      sweepGain.connect(ctx.destination);

      sweepOsc.start(ctx.currentTime);
      sweepOsc.stop(ctx.currentTime + 0.50);

      // Major Triad Surge (C5 523.25Hz, E5 659.25Hz, G5 783.99Hz)
      const triadStart = ctx.currentTime + 0.42;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, triadStart);

        gain.gain.setValueAtTime(0, triadStart);
        gain.gain.linearRampToValueAtTime(0.09, triadStart + 0.06);
        gain.gain.setValueAtTime(0.09, triadStart + 0.35);
        gain.gain.linearRampToValueAtTime(0, triadStart + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(triadStart);
        osc.stop(triadStart + 0.45);
      });

      this.vibrate([80, 40, 150]);
    } catch (e) {
      console.warn('Error in playMatchStart', e);
    }
  }

  /**
   * 3. Tactical Power-Ups: Distinct harmonic frequencies for each
   * @param type Power-up type ('sprint' | 'decoy' | 'shield' | 'freeze_trap')
   */
  public playPowerUp(type: PowerUpSoundType): void {
    switch (type) {
      case 'sprint':
        // Ascending kinetic triplet sweep (400 -> 700 -> 1200 Hz)
        this.playTone(400, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(700, 'triangle', 0.1, 0.1), 80);
        setTimeout(() => this.playTone(1200, 'triangle', 0.25, 0.12), 160);
        this.vibrate([40, 30, 80]);
        break;
      case 'decoy':
        // Cyber flutter dual-tone modulation (600 -> 550 Hz)
        this.playTone(600, 'sine', 0.15, 0.08);
        setTimeout(() => this.playTone(550, 'sine', 0.2, 0.08), 120);
        this.vibrate([30, 20, 30, 20]);
        break;
      case 'shield':
        // Resonant crystalline bell (C5 523Hz + C6 1046Hz)
        this.playTone(523.25, 'sine', 0.35, 0.1);
        setTimeout(() => this.playTone(1046.5, 'sine', 0.6, 0.08), 50);
        this.vibrate([60, 40, 100]);
        break;
      case 'freeze_trap':
        // Mechanical click snap + glassy frost chill (150Hz triangle + 1200->800Hz sine)
        this.playTone(150, 'triangle', 0.12, 0.15);
        setTimeout(() => this.playTone(1200, 'sine', 0.25, 0.1), 90);
        setTimeout(() => this.playTone(800, 'sine', 0.35, 0.08), 190);
        this.vibrate([80, 40, 80]);
        break;
    }
  }

  /**
   * 4. Freeze Tag: playFreeze (Sub-zero descending sweep with cold harmonic)
   */
  public playFreeze(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Sub-zero descending sawtooth sweep (960Hz -> 180Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(960, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.42);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.38);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);

      // Glassy frost overtone (1440Hz -> 720Hz)
      const frostOsc = ctx.createOscillator();
      const frostGain = ctx.createGain();
      frostOsc.type = 'sine';
      frostOsc.frequency.setValueAtTime(1440, ctx.currentTime);
      frostOsc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.3);

      frostGain.gain.setValueAtTime(0.08, ctx.currentTime);
      frostGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);

      frostOsc.connect(frostGain);
      frostGain.connect(ctx.destination);

      frostOsc.start(ctx.currentTime);
      frostOsc.stop(ctx.currentTime + 0.35);

      this.vibrate([150, 50, 150]);
    } catch (e) {
      console.warn('Error in playFreeze', e);
    }
  }

  /**
   * 5. Freeze Tag: playUnfreeze (Ascending uplifting chime)
   */
  public playUnfreeze(): void {
    // Four ascending bright bell tones (C5, E5, G5, C6)
    this.playTone(523.25, 'sine', 0.12, 0.08);
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.08), 80);
    setTimeout(() => this.playTone(783.99, 'sine', 0.16, 0.1), 160);
    setTimeout(() => this.playTone(1046.50, 'sine', 0.38, 0.12), 240);
    this.vibrate([50, 30, 90]);
  }

  /**
   * 6. Post-Match: playVictoryFanfare (Multi-tone celebration arpeggio)
   */
  public playVictoryFanfare(): void {
    // Heroic arpeggio: G4 -> C5 -> E5 -> G5 -> C6
    this.playTone(392.00, 'triangle', 0.16, 0.12);
    setTimeout(() => this.playTone(523.25, 'triangle', 0.16, 0.12), 140);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.16, 0.12), 280);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.24, 0.12), 420);
    setTimeout(() => this.playTone(1046.50, 'triangle', 0.70, 0.15), 600);
    this.vibrate([100, 50, 100, 50, 250]);
  }

  /**
   * 7. Post-Match: playDefeatSound (Tactical minor chord debrief)
   */
  public playDefeatSound(): void {
    // Tactical descending minor progression: F4 -> D4 -> B3 -> A3
    this.playTone(349.23, 'sawtooth', 0.25, 0.1);
    setTimeout(() => this.playTone(293.66, 'sawtooth', 0.25, 0.1), 220);
    setTimeout(() => this.playTone(246.94, 'sawtooth', 0.28, 0.1), 440);
    setTimeout(() => this.playTone(220.00, 'sawtooth', 0.55, 0.12), 660);
    this.vibrate([150, 80, 300]);
  }

  public playVictory(): void {
    this.playVictoryFanfare();
  }

  public playDefeat(): void {
    this.playDefeatSound();
  }

  /**
   * 8. Infection Tag: playInfection (Dark menacing synthesized drop with dissonant tritone)
   */
  public playInfection(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Dissonant descending sawtooth drop (587Hz D5 -> 415Hz G#4 tritone -> 220Hz A3)
      this.playTone(587.33, 'sawtooth', 0.2, 0.12);
      setTimeout(() => this.playTone(415.30, 'sawtooth', 0.25, 0.12), 120);
      setTimeout(() => this.playTone(220.00, 'sawtooth', 0.50, 0.15), 260);

      // Low ominous rumble
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumbleOsc.type = 'sawtooth';
      rumbleOsc.frequency.setValueAtTime(110, ctx.currentTime);
      rumbleGain.gain.setValueAtTime(0.1, ctx.currentTime);
      rumbleGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(ctx.destination);
      rumbleOsc.start(ctx.currentTime);
      rumbleOsc.stop(ctx.currentTime + 0.6);

      this.vibrate([100, 50, 200, 50, 300]);
    } catch (e) {
      console.warn('Error in playInfection', e);
    }
  }

  /**
   * 9. Geo-Bounty Skattejakt: playPickup (Crystalline arpeggio for Bounty Crystal, bright harmonic sweep for Energy Cube)
   */
  public playPickup(type: 'energy_cube' | 'bounty_crystal' = 'energy_cube'): void {
    if (type === 'bounty_crystal') {
      // Shimmering 4-note crystalline chord arpeggio (E5 -> G#5 -> B5 -> E6)
      this.playTone(659.25, 'triangle', 0.12, 0.1);
      setTimeout(() => this.playTone(830.61, 'sine', 0.12, 0.1), 75);
      setTimeout(() => this.playTone(987.77, 'sine', 0.15, 0.1), 150);
      setTimeout(() => this.playTone(1318.51, 'sine', 0.35, 0.12), 225);
      this.vibrate([50, 30, 90]);
    } else {
      // Energetic harmonic pickup sweep (A5 -> E6)
      this.playTone(880.00, 'triangle', 0.1, 0.1);
      setTimeout(() => this.playTone(1318.51, 'sine', 0.25, 0.12), 70);
      this.vibrate([35, 35]);
    }
  }

  /**
   * Safe wrapper for haptic vibration feedback
   * @param pattern Milliseconds duration or pulse/pause array
   */
  public vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch(e) {}
    }
  }
}

export const GameEffects = new GameEffectsService();
