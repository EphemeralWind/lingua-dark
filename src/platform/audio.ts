// Web Audio (SPEC 8): short chiptune effects for each cue and a quiet ambient loop, all
// synthesised, no files. The context starts on the first key or click (browser autoplay rules).
// Every effect has a visual twin (CUE_VISUAL in src/combat/cues.ts).
import type { Cue } from '../combat/cues';
import { createRng } from '../content/rng';

export type Mood = 'title' | 'explore' | 'rest' | 'fight' | 'boss' | null;

type Wave = OscillatorType;

/** Ambient chord roots (Hz) and pluck scales per mood. Minor and modal, low and slow. */
const MOODS: Record<Exclude<Mood, null>, { drone: number[]; scale: number[]; every: number; cutoff: number }> = {
  title: { drone: [55, 82.4], scale: [220, 261.6, 293.7, 329.6, 392], every: 3.2, cutoff: 500 },
  explore: { drone: [49, 73.4], scale: [196, 220, 246.9, 293.7, 329.6], every: 4.5, cutoff: 420 },
  rest: { drone: [65.4, 98], scale: [261.6, 329.6, 392, 440, 523.3], every: 2.6, cutoff: 700 },
  fight: { drone: [55, 58.3], scale: [220, 233.1, 277.2, 329.6], every: 1.8, cutoff: 380 },
  boss: { drone: [41.2, 43.7], scale: [164.8, 174.6, 207.7, 246.9], every: 1.4, cutoff: 340 },
};

export class Sound {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private drone: { stop(): void } | null = null;
  private mood: Mood = null;
  private nextPluck = 0;
  private readonly rng = createRng(0x5eed);
  sfxOn = true;
  private musicOn = true;

  constructor() {
    const unlock = (): void => this.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.setInterval(() => this.schedule(), 250);
  }

  private unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.35 : 0;
    this.musicBus.connect(master);
    const mood = this.mood;
    this.mood = null;
    this.setMood(mood);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.3);
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.drone?.stop();
    this.drone = null;
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || !mood) return;
    const m = MOODS[mood];
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.18, t + 2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = m.cutoff;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = m.cutoff * 0.4;
    lfo.connect(lfoGain).connect(filter.frequency);
    filter.connect(out).connect(bus);
    const oscs = m.drone.flatMap((f) =>
      [-4, 4].map((cents) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = cents;
        o.connect(filter);
        return o;
      }),
    );
    for (const o of [...oscs, lfo]) o.start(t);
    this.nextPluck = t + 1;
    this.drone = {
      stop: () => {
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setTargetAtTime(0, now, 0.4);
        for (const o of [...oscs, lfo]) o.stop(now + 2);
      },
    };
  }

  /** Lookahead scheduler for the ambient plucks. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.mood || !this.musicBus) return;
    const m = MOODS[this.mood];
    while (this.nextPluck < ctx.currentTime + 0.5) {
      const f = this.rng.pick(m.scale);
      this.tone(f, 1.6, 'triangle', 0.05, { at: this.nextPluck, bus: this.musicBus });
      if (this.rng.next() < 0.3) this.tone(f * 1.5, 1.2, 'sine', 0.03, { at: this.nextPluck + 0.4, bus: this.musicBus });
      this.nextPluck += m.every * (0.6 + this.rng.next() * 0.8);
    }
  }

  private tone(freq: number, dur: number, type: Wave, gain: number, opts: { at?: number; slideTo?: number; bus?: AudioNode } = {}): void {
    const ctx = this.ctx;
    const bus = opts.bus ?? this.sfxBus;
    if (!ctx || !bus) return;
    const t = opts.at ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, filter: BiquadFilterType, freq: number, gain: number, at?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t = at ?? ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = this.rng.next() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
  }

  play(cue: Cue): void {
    if (!this.sfxOn || !this.ctx) return;
    const now = this.ctx.currentTime;
    switch (cue) {
      case 'windup':
        this.tone(110, 0.25, 'triangle', 0.08, { slideTo: 165 });
        break;
      case 'parry':
        this.tone(880, 0.18, 'square', 0.12, { slideTo: 840 });
        this.noise(0.06, 'highpass', 3000, 0.2);
        break;
      case 'perfect':
        this.tone(988, 0.22, 'square', 0.12);
        this.tone(1319, 0.3, 'square', 0.08, { at: now + 0.06 });
        this.tone(1976, 0.35, 'triangle', 0.07, { at: now + 0.12 });
        this.noise(0.06, 'highpass', 4000, 0.2);
        break;
      case 'hit':
        this.tone(150, 0.25, 'sine', 0.35, { slideTo: 50 });
        this.noise(0.15, 'lowpass', 600, 0.4);
        break;
      case 'break':
        for (let i = 0; i < 4; i++) this.tone(1200 - i * 220, 0.12, 'square', 0.07, { at: now + i * 0.05 });
        this.noise(0.25, 'bandpass', 2500, 0.25);
        break;
      case 'riposteHit':
        this.noise(0.18, 'highpass', 1500, 0.35);
        this.tone(330, 0.2, 'sawtooth', 0.08, { slideTo: 660 });
        break;
      case 'riposteMiss':
        this.noise(0.2, 'lowpass', 400, 0.25);
        break;
      case 'won':
        [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.4, 'square', 0.08, { at: now + i * 0.1 }));
        break;
      case 'lost':
        [196, 165, 131, 98].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, { at: now + i * 0.18 }));
        break;
      case 'step':
        this.noise(0.05, 'lowpass', 300, 0.25);
        this.noise(0.05, 'lowpass', 300, 0.2, now + 0.16);
        break;
      case 'blocked':
        this.tone(90, 0.12, 'square', 0.12);
        break;
      case 'bonfire':
        for (let i = 0; i < 6; i++) this.noise(0.04, 'bandpass', 1800 + i * 200, 0.12, now + i * 0.09);
        [262, 330, 392].forEach((f) => this.tone(f, 1.2, 'triangle', 0.05));
        break;
      case 'seal':
        this.tone(784, 0.25, 'triangle', 0.1);
        this.tone(1175, 0.4, 'triangle', 0.08, { at: now + 0.09 });
        break;
      case 'stone':
        this.noise(0.22, 'lowpass', 260, 0.3);
        this.tone(70, 0.2, 'triangle', 0.06, { slideTo: 55 });
        break;
      case 'phase':
        [65.4, 130.8, 196].forEach((f) => this.tone(f, 2.2, 'sine', 0.2));
        this.tone(523, 1.4, 'triangle', 0.06);
        break;
      case 'menu':
        this.tone(660, 0.05, 'square', 0.05);
        break;
    }
  }
}
