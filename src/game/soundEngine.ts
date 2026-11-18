import type { FighterId } from '../shared/gameData.ts';

export type SoundKind =
  | 'hit'
  | 'heavy'
  | 'parry'
  | 'evade'
  | 'trap'
  | 'trapTrigger'
  | 'block'
  | 'grab'
  | 'whiff'
  | 'stun'
  | 'clash'
  | 'overdrive'
  | 'comboLink'
  | 'hazard'
  | 'dash'
  | 'jump'
  | 'pickup'
  | 'gunshot'
  | 'whoosh'
  | 'shockwave'
  | 'beam'
  | 'ko'
  | 'tick'
  | 'victory';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  public unlock(): void {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      // AudioContext unavailable
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public playFighterHit(fighterId: FighterId | undefined, isCrit: boolean): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (fighterId === 'damen') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isCrit ? 880 : 680, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
      gain.gain.setValueAtTime(isCrit ? 0.24 : 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    if (fighterId === 'marjohn') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isCrit ? 620 : 480, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(isCrit ? 0.22 : 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

    if (fighterId === 'prime') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isCrit ? 150 : 190, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
      gain.gain.setValueAtTime(isCrit ? 0.32 : 0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (fighterId === 'khen') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isCrit ? 1120 : 860, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.1);
      gain.gain.setValueAtTime(isCrit ? 0.21 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    // JM / default crisp martial strike
    this.play(isCrit ? 'heavy' : 'hit');
  }

  public play(kind: SoundKind): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (kind === 'hit' || kind === 'heavy') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'heavy' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(kind === 'heavy' ? 210 : 300, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + (kind === 'heavy' ? 0.22 : 0.13));
      gain.gain.setValueAtTime(kind === 'heavy' ? 0.28 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'heavy' ? 0.24 : 0.14));
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (kind === 'parry' || kind === 'clash') {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(kind === 'clash' ? 760 : 980, now);
      o1.frequency.exponentialRampToValueAtTime(kind === 'clash' ? 1920 : 1640, now + 0.18);
      o2.frequency.setValueAtTime(1480, now);
      o2.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      o1.connect(gain);
      o2.connect(gain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.29);
      o2.stop(now + 0.29);
      return;
    }

    if (kind === 'evade') {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(640, now);
      o1.frequency.exponentialRampToValueAtTime(1480, now + 0.15);
      o2.frequency.setValueAtTime(1120, now);
      o2.frequency.exponentialRampToValueAtTime(1880, now + 0.14);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o1.connect(gain);
      o2.connect(gain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.21);
      o2.stop(now + 0.21);
      return;
    }

    if (kind === 'trap' || kind === 'trapTrigger') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'trap' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(kind === 'trap' ? 280 : 720, now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'trap' ? 460 : 140, now + 0.16);
      gain.gain.setValueAtTime(kind === 'trap' ? 0.14 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.19);
      return;
    }

    if (kind === 'grab') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.17);
      return;
    }

    if (kind === 'whiff') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.14);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.16);
      return;
    }

    if (kind === 'stun' || kind === 'overdrive' || kind === 'comboLink') {
      const freqs = kind === 'overdrive' ? [330, 495, 660, 990] : kind === 'comboLink' ? [520, 780] : [440, 310];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);
        g.gain.setValueAtTime(0.16, now + idx * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.24);
      });
      return;
    }

    if (kind === 'block') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.11);
      return;
    }

    if (kind === 'jump') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (kind === 'pickup') {
      [587.33, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        g.gain.setValueAtTime(0.14, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.19);
      });
      return;
    }

    if (kind === 'dash' || kind === 'whoosh') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

    if (kind === 'gunshot') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.11);
      return;
    }

    if (kind === 'shockwave' || kind === 'beam' || kind === 'hazard') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'beam' || kind === 'hazard' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(kind === 'beam' ? 320 : kind === 'hazard' ? 240 : 140, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + (kind === 'beam' ? 0.55 : 0.34));
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'beam' ? 0.56 : 0.35));
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.58);
      return;
    }

    if (kind === 'ko') {
      [220, 165, 110].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        osc.frequency.exponentialRampToValueAtTime(45, now + idx * 0.07 + 0.35);
        g.gain.setValueAtTime(0.18, now + idx * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.36);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.38);
      });
      return;
    }

    if (kind === 'tick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }

    if (kind === 'victory') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        g.gain.setValueAtTime(0.16, now + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.48);
      });
    }
  }
}

export const soundEngine = new SoundEngine();
