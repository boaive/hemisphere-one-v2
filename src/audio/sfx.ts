/**
 * Optional sound effects. Synthesised with WebAudio (no files, no licences). OFF by default; only starts after an
 * explicit user gesture. No music, no voice. Cues fire when the playhead crosses them going forward at normal speed.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let hum: { osc: OscillatorNode; g: GainNode } | null = null;

export function enableSound(on: boolean) {
  if (on && !ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  }
  if (ctx) { on ? ctx.resume() : ctx.suspend(); }
}

function noise(dur: number) {
  const b = ctx!.createBuffer(1, Math.ceil(ctx!.sampleRate * dur), ctx!.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx!.createBufferSource(); s.buffer = b; return s;
}
function env(g: GainNode, a: number, peak: number, d: number) {
  const t = ctx!.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
const voices = {
  click(pitch = 2400) {   // pin & wedge / panel clip: bright metallic tick
    const s = noise(0.05), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'bandpass'; f.frequency.value = pitch; f.Q.value = 8; s.connect(f).connect(g).connect(master!); env(g, 0.002, 0.25, 0.05); s.start();
    const o = ctx!.createOscillator(), og = ctx!.createGain(); o.frequency.value = pitch * 1.6; o.connect(og).connect(master!); env(og, 0.001, 0.05, 0.08); o.start(); o.stop(ctx!.currentTime + 0.1);
  },
  thunk() {               // module seating on bearings: soft low impact
    const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, ctx!.currentTime);
    o.frequency.exponentialRampToValueAtTime(52, ctx!.currentTime + 0.25); o.connect(g).connect(master!); env(g, 0.004, 0.35, 0.32); o.start(); o.stop(ctx!.currentTime + 0.4);
  },
  scrape() {              // trowel on mortar / plaster
    const s = noise(0.32), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2; s.connect(f).connect(g).connect(master!); env(g, 0.04, 0.09, 0.26); s.start();
  },
  tap() {                 // light hammer tap
    const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = 'triangle'; o.frequency.value = 820; o.connect(g).connect(master!); env(g, 0.001, 0.18, 0.09); o.start(); o.stop(ctx!.currentTime + 0.12);
  },
  activate() {            // clean, subtle technological activation (not a whoosh)
    const t = ctx!.currentTime;
    [440, 660].forEach((f0, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 1.2);
      o.connect(g).connect(master!); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 / (i + 1), t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.start(); o.stop(t + 1.7);
    });
  },
  complete() {            // soft completion accent
    const t = ctx!.currentTime;
    [261.6, 392, 523.3].forEach((f0) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = 'sine'; o.frequency.value = f0;
      o.connect(g).connect(master!); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.start(); o.stop(t + 2.3);
    });
  },
};

type Cue = { t: number; v: keyof typeof voices; p?: number };
const CUES: Cue[] = [
  ...[0, 1, 2].flatMap((c) => [0.45, 0.47, 0.49, 0.51].map((u) => ({ t: (c + u) * (8 / 3), v: 'click' as const, p: 2200 + c * 120 }))),
  ...Array.from({ length: 6 }, (_, i) => ({ t: 4.6 + i * 0.95, v: 'thunk' as const })), { t: 11.75, v: 'thunk' },
  ...Array.from({ length: 10 }, (_, i) => ({ t: 13.8 + i * 0.4, v: 'click' as const, p: 1500 })),
  ...[24.9, 25.4, 25.8, 26.4].map((t) => ({ t, v: 'tap' as const })),
  ...Array.from({ length: 8 }, (_, i) => ({ t: 28.8 + i * 0.5, v: 'scrape' as const })),
  { t: 37.05, v: 'activate' },
  ...Array.from({ length: 8 }, (_, i) => ({ t: 39.3 + i * 0.25, v: 'click' as const, p: 1900 })),
  ...Array.from({ length: 6 }, (_, i) => ({ t: 46.3 + i * 0.3, v: 'click' as const, p: 1700 })),
  { t: 57.0, v: 'complete' },
];

let prev = 0;
export function updateSound(t: number, on: boolean) {
  const dt = t - prev;
  if (on && ctx && master && dt > 0 && dt < 0.35) {
    for (const c of CUES) if (c.t > prev && c.t <= t) c.v === 'click' ? voices.click(c.p) : (voices[c.v] as () => void)();
    // H1 machine hum while it runs
    const run = t > 42.6 && t < 46.2;
    if (run && !hum) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 58; f.type = 'lowpass'; f.frequency.value = 320;
      o.connect(f).connect(g).connect(master); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.4); o.start();
      hum = { osc: o, g };
    }
    if (!run && hum) { hum.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3); hum.osc.stop(ctx.currentTime + 0.35); hum = null; }
  } else if (hum && ctx) { hum.osc.stop(); hum = null; }
  prev = t;
}
