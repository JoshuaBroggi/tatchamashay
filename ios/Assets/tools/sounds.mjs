// Synthesizes the game's short sound effects from scratch (no samples) and
// writes them as AAC .m4a files into ios/Assets/Sounds.
//
//   node sounds.mjs
//
// Needs macOS (afconvert ships with the OS).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'Sounds');
const stage = path.join(here, '.build', 'sounds');
const SR = 44100;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const noise = () => rand() * 2 - 1;
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const freq = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);

function render(seconds, fn) {
  const buf = new Float32Array(Math.ceil(seconds * SR));
  fn(buf);
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? 0.89 / peak : 1;
  const fade = Math.floor(SR * 0.01);
  for (let i = 0; i < buf.length; i++) {
    buf[i] *= k;
    if (i > buf.length - fade) buf[i] *= (buf.length - i) / fade;
  }
  return buf;
}

// Adds a sound starting at `start` seconds; `f(t)` returns the sample at local time t.
function add(buf, start, dur, f) {
  const s = Math.floor(start * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n && s + i < buf.length; i++) buf[s + i] += f(i / SR);
}

function lowpass(alpha) {
  let y = 0;
  return (x) => (y += alpha * (x - y));
}

// Three scoops of a spade in soft earth: a gritty swish and a low thud.
const dig = () => render(1.3, (b) => {
  for (const [i, at] of [0, 0.42, 0.84].entries()) {
    const lp = lowpass(0.08 + i * 0.02);
    add(b, at, 0.28, (t) => lp(noise()) * env(t, 0.03, 0.07) * 1.4);
    const lp2 = lowpass(0.25);
    add(b, at + 0.02, 0.2, (t) => lp2(noise()) * env(t, 0.005, 0.03) * 0.5);
    add(b, at + 0.05, 0.25, (t) => Math.sin(2 * Math.PI * (70 - t * 60) * t) * env(t, 0.004, 0.06) * 0.9);
  }
});

// An old lid creaking open: a slow, jittery, rising friction squeak.
const creak = () => render(1.5, (b) => {
  let phase = 0;
  const lp = lowpass(0.3);
  add(b, 0, 1.4, (t) => {
    const f = 140 + 220 * (t / 1.4) + 25 * Math.sin(t * 37) + 12 * noise();
    phase += f / SR;
    const stick = (phase % 1) < 0.18 ? 1 : -0.25; // stick-slip pulses
    const amp = Math.min(1, t * 6) * (0.6 + 0.4 * Math.sin(t * 9)) * (t > 1.2 ? (1.4 - t) / 0.2 : 1);
    return lp(stick) * amp * 0.8;
  });
  add(b, 1.33, 0.15, (t) => Math.sin(2 * Math.PI * 95 * t) * env(t, 0.002, 0.04) * 0.6); // lid settles
});

// Magic sparkle: a rising run of bell tones with a shimmering tail.
const sparkle = () => render(1.6, (b) => {
  const notes = [3, 7, 10, 15, 19, 22, 27];
  notes.forEach((n, i) => {
    const f = freq(n);
    add(b, i * 0.07, 1.0, (t) => (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 8)) * env(t, 0.003, 0.25) * 0.35);
  });
  for (let i = 0; i < 26; i++) {
    const f = freq(24 + Math.floor(rand() * 14)), at = 0.3 + rand() * 1.0;
    add(b, at, 0.3, (t) => Math.sin(2 * Math.PI * f * t) * env(t, 0.002, 0.05) * 0.12);
  }
});

// Finale fanfare: a short brassy "ta-da-da-DAAA" with a warm chord.
const fanfare = () => render(2.4, (b) => {
  const brass = (f, dur) => {
    const lp = lowpass(0.18);
    return (t) => {
      const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3);
      let s = 0;
      for (let h = 1; h <= 8; h++) s += Math.sin(2 * Math.PI * f * h * vib * t) / h;
      const a = Math.min(1, t / 0.03) * (t > dur - 0.08 ? Math.max(0, (dur - t) / 0.08) : 1);
      return lp(s) * a * 0.5;
    };
  };
  const C = -9; // C4, counted in semitones from A4
  const seq = [[C + 7, 0, 0.14], [C + 7, 0.17, 0.14], [C + 7, 0.34, 0.14], [C + 12, 0.52, 0.32], [C + 9, 0.86, 0.16], [C + 12, 1.04, 1.3]];
  for (const [n, at, d] of seq) add(b, at, d, brass(freq(n), d));
  for (const n of [C, C + 4, C + 7]) add(b, 1.04, 1.3, brass(freq(n), 1.3)); // chord under the last note
  const lp = lowpass(0.05);
  add(b, 1.04, 1.2, (t) => lp(noise()) * env(t, 0.002, 0.35) * 0.6); // cymbal-ish swell
});

// The treasures' own sounds, which the child picks in the hide-for-parent flow (TreasureSound in
// the app). Each is short and silly, under a second and a half.

// A spring: a low twang whose pitch wobbles up and down and settles.
const boing = () => render(0.9, (b) => {
  let phase = 0;
  add(b, 0, 0.85, (t) => {
    const f = 110 + 160 * Math.exp(-t * 4) * (1 + 0.5 * Math.sin(2 * Math.PI * 9 * t));
    phase += f / SR;
    const s = Math.sin(2 * Math.PI * phase) + 0.3 * Math.sin(4 * Math.PI * phase);
    return s * env(t, 0.004, 0.3) * 0.8;
  });
});

// Toot toot: two short reedy horn notes.
const toot = () => render(0.9, (b) => {
  const horn = (f, dur) => {
    const lp = lowpass(0.25);
    return (t) => {
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * t) * (h % 2 ? 1 : 0.5) / h;
      const a = Math.min(1, t / 0.02) * (t > dur - 0.05 ? Math.max(0, (dur - t) / 0.05) : 1);
      return lp(s) * a * 0.6;
    };
  };
  add(b, 0, 0.26, horn(freq(-2), 0.26));
  add(b, 0.36, 0.42, horn(freq(-2), 0.42));
});

// A giggle: quick bubbly chirps that bounce down in pitch, like "hee hee hee".
const giggle = () => render(1.0, (b) => {
  for (let i = 0; i < 6; i++) {
    const f0 = freq(15 - i * 1.5);
    add(b, i * 0.14, 0.12, (t) => {
      const f = f0 * (1 + 0.25 * Math.sin(2 * Math.PI * 30 * t));
      return Math.sin(2 * Math.PI * f * t) * Math.sin(Math.PI * t / 0.12) * 0.5;
    });
  }
});

// A splash: a bright burst of filtered noise with a few falling droplet blips.
const splash = () => render(1.1, (b) => {
  const lp = lowpass(0.35);
  add(b, 0, 0.9, (t) => lp(noise()) * env(t, 0.01, 0.18) * 1.2);
  for (let i = 0; i < 8; i++) {
    const at = 0.15 + rand() * 0.6, f0 = 900 + rand() * 900;
    add(b, at, 0.08, (t) => Math.sin(2 * Math.PI * (f0 + t * 6000) * t) * env(t, 0.002, 0.02) * 0.3);
  }
});

// Ding: one clear bell.
const ding = () => render(1.4, (b) => {
  const f = freq(12);
  add(b, 0, 1.4, (t) => (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6)
    + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 12)) * env(t, 0.002, 0.45) * 0.5);
});

// A snore: a slow rumbly breath in, then a whistly breath out.
const snore = () => render(1.5, (b) => {
  const lp = lowpass(0.04);
  add(b, 0, 0.75, (t) => {
    const buzz = Math.sign(Math.sin(2 * Math.PI * 38 * t)) * 0.5 + lp(noise()) * 2;
    return buzz * Math.sin(Math.PI * t / 0.75) * 0.7;
  });
  add(b, 0.85, 0.6, (t) => Math.sin(2 * Math.PI * (900 - t * 500) * t) * Math.sin(Math.PI * t / 0.6) * 0.25);
});

// A chime: three soft rising bell tones.
const chime = () => render(1.3, (b) => {
  [7, 11, 14].forEach((n, i) => {
    const f = freq(n);
    add(b, i * 0.12, 1.0, (t) => Math.sin(2 * Math.PI * f * t) * env(t, 0.003, 0.3) * 0.4);
  });
});

// A tiny fanfare: "ta-daa!"
const tada = () => render(1.1, (b) => {
  const brass = (f, dur) => {
    const lp = lowpass(0.2);
    return (t) => {
      let s = 0;
      for (let h = 1; h <= 7; h++) s += Math.sin(2 * Math.PI * f * h * t) / h;
      const a = Math.min(1, t / 0.02) * (t > dur - 0.06 ? Math.max(0, (dur - t) / 0.06) : 1);
      return lp(s) * a * 0.5;
    };
  };
  add(b, 0, 0.14, brass(freq(-2), 0.14));
  add(b, 0.18, 0.85, brass(freq(3), 0.85));
  add(b, 0.18, 0.85, brass(freq(-2), 0.85));
});

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const SOUNDS = {
  dig: [dig, 'Each tap of Dig!'],
  chest_creak: [creak, 'The chest lid opening'],
  reveal_sparkle: [sparkle, 'The treasure rising out of the chest'],
  finale_fanfare: [fanfare, 'The last treasure of an adventure is found'],
  // Treasure sounds, after the effects so the effects' random noise stays the same.
  boing: [boing, 'Treasure sound: Boing!'],
  toot: [toot, 'Treasure sound: Toot toot!'],
  giggle: [giggle, 'Treasure sound: Hee hee hee!'],
  splash: [splash, 'Treasure sound: Splash!'],
  ding: [ding, 'Treasure sound: Ding!'],
  snore: [snore, 'Treasure sound: Zzzzz!'],
  chime: [chime, 'Treasure sound: a soft chime'],
  fanfare: [tada, 'Treasure sound: ta-daa!'],
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(stage, { recursive: true });
const sounds = [];
for (const [name, [make, use]] of Object.entries(SOUNDS)) {
  const w = path.join(stage, `${name}.wav`), m = path.join(outDir, `${name}.m4a`);
  fs.writeFileSync(w, wav(make()));
  fs.rmSync(m, { force: true });
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', w, m]);
  console.log(`${name.padEnd(15)} ${(fs.statSync(m).size / 1024).toFixed(0)} KB`);
  sounds.push({ id: name, file: `Sounds/${name}.m4a`, use });
}

// Record the sounds in manifest.json next to the models (build.mjs keeps them).
const manifestPath = path.resolve(here, '..', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, models: [] };
fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, sounds }, null, 2) + '\n');
