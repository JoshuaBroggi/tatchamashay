import type { DemogorgonAnimation } from './animations';

/**
 * Procedural Demogorgon voice, synthesised with the Web Audio API (no sample files).
 *
 * The creature is built from four layers, the same ingredients as the show's sound design:
 *   - a low throat growl: a saw wave through vowel-like formant filters, distorted and
 *     amplitude-modulated at ~30 Hz so it rattles;
 *   - a scream: a screeching, wobbling, heavily distorted upper voice;
 *   - wet breath: band-passed noise that swells like air dragged over a wet throat;
 *   - clicks: trains of tiny noise ticks, like teeth and petals chattering.
 * Everything runs through a short cave-like reverb. Timings match the baked animation clips,
 * so the strike lands on the attack's lunge and the roar peaks with the petals fully open.
 */

export interface DemogorgonAudio {
    /** Starts the sound for an animation, replacing whatever was playing. */
    play: (animation: DemogorgonAnimation) => void;
    /** Fades out and cancels everything. */
    stop: () => void;
    setVolume: (volume: number) => void;
    dispose: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const makeNoise = (ctx: AudioContext, seconds: number): AudioBuffer => {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
};

const makeDistortion = (amount: number): Float32Array => {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    return curve;
};

/** A procedurally generated stereo room impulse: dense noise decaying exponentially. */
const makeImpulse = (ctx: AudioContext, seconds: number, decay: number): AudioBuffer => {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
};

export const createDemogorgonAudio = (initialVolume = 0.8): DemogorgonAudio => {
    let ctx: AudioContext | null = null;
    let master: GainNode;
    let dry: GainNode;
    let noise: AudioBuffer;
    let heavyCurve: Float32Array;
    let volume = initialVolume;
    let buses: GainNode[] = [];
    let timers: number[] = [];

    const ensure = (): AudioContext | null => {
        if (ctx) {
            if (ctx.state === 'suspended') void ctx.resume();
            return ctx;
        }
        const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor() as AudioContext;
        noise = makeNoise(ctx, 2);

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 6;
        master = ctx.createGain();
        master.gain.value = volume;
        dry = ctx.createGain();
        const reverb = ctx.createConvolver();
        reverb.buffer = makeImpulse(ctx, 2.4, 3);
        const wet = ctx.createGain();
        wet.gain.value = 0.32;

        dry.connect(compressor);
        dry.connect(reverb);
        reverb.connect(wet);
        wet.connect(compressor);
        compressor.connect(master);
        master.connect(ctx.destination);

        heavyCurve = makeDistortion(60);
        void ctx.resume();
        return ctx;
    };

    const newBus = (c: AudioContext): GainNode => {
        const bus = c.createGain();
        bus.connect(dry);
        buses.push(bus);
        return bus;
    };

    // ----------------------------------------------------------------
    // Voice layers. Each schedules itself on `bus` starting at absolute time `t0`.
    // ----------------------------------------------------------------

    const noiseSource = (c: AudioContext, t0: number, dur: number) => {
        const src = c.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        src.start(t0, Math.random() * 1.5);
        src.stop(t0 + dur + 0.1);
        return src;
    };

    /** Low throat growl: formant-filtered, distorted saw with a rattling 30 Hz amplitude flutter. */
    const growl = (c: AudioContext, bus: GainNode, t0: number, dur: number, f0: number, f1: number, level: number) => {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.linearRampToValueAtTime(f1, t0 + dur * 0.5);
        osc.frequency.linearRampToValueAtTime(f0 * 0.85, t0 + dur);
        const sub = c.createOscillator();
        sub.type = 'square';
        sub.frequency.setValueAtTime(f0 / 2, t0);
        sub.frequency.linearRampToValueAtTime(f1 / 2, t0 + dur * 0.5);
        sub.frequency.linearRampToValueAtTime((f0 * 0.85) / 2, t0 + dur);

        // Slow pitch wobble plus fast chest rattle.
        const vibrato = c.createOscillator();
        vibrato.frequency.value = rand(4.5, 6.5);
        const vibratoDepth = c.createGain();
        vibratoDepth.gain.value = f0 * 0.05;
        vibrato.connect(vibratoDepth).connect(osc.frequency);
        const rattle = c.createOscillator();
        rattle.frequency.value = rand(24, 34);
        const rattleDepth = c.createGain();
        rattleDepth.gain.value = 0.45;
        const rattleGain = c.createGain();
        rattleGain.gain.value = 0.55;
        rattle.connect(rattleDepth).connect(rattleGain.gain);

        const shaper = c.createWaveShaper();
        shaper.curve = makeDistortion(25);
        const mix = c.createGain();
        const subGain = c.createGain();
        subGain.gain.value = 0.5;
        osc.connect(mix);
        sub.connect(subGain).connect(mix);
        mix.connect(shaper);

        // Two moving formants make it sound like a vowel dragged from "ah" to "oh".
        const out = c.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(level, t0 + Math.min(0.12, dur * 0.3));
        out.gain.setValueAtTime(level, t0 + dur * 0.7);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        [
            { f: [650, 420], q: 5, g: 1 },
            { f: [1150, 800], q: 6, g: 0.6 },
            { f: [2400, 1900], q: 5, g: 0.2 },
        ].forEach(formant => {
            const bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = formant.q;
            bp.frequency.setValueAtTime(formant.f[0], t0);
            bp.frequency.linearRampToValueAtTime(formant.f[1], t0 + dur);
            const g = c.createGain();
            g.gain.value = formant.g;
            shaper.connect(bp).connect(g).connect(rattleGain);
        });
        rattleGain.connect(out).connect(bus);

        [osc, sub, vibrato, rattle].forEach(o => {
            o.start(t0);
            o.stop(t0 + dur + 0.1);
        });
    };

    /** Screech: a wobbling, jittery saw pushed through heavy distortion and bright formants. */
    const scream = (c: AudioContext, bus: GainNode, t0: number, dur: number, f0: number, peak: number, level: number) => {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        const osc2 = c.createOscillator();
        osc2.type = 'square';
        // Irregular pitch contour: climb, shaky hold, fall. Jitter every ~35 ms keeps it organic.
        osc.frequency.setValueAtTime(f0, t0);
        osc2.frequency.setValueAtTime(f0 * 1.51, t0);
        for (let t = 0.035; t < dur; t += 0.035) {
            const phase = t / dur;
            const contour = phase < 0.25 ? phase / 0.25 : phase < 0.7 ? 1 : 1 - (phase - 0.7) / 0.3 * 0.6;
            const f = (f0 + (peak - f0) * contour) * rand(0.94, 1.06);
            osc.frequency.linearRampToValueAtTime(f, t0 + t);
            osc2.frequency.linearRampToValueAtTime(f * 1.51, t0 + t);
        }
        const rattle = c.createOscillator();
        rattle.frequency.value = rand(48, 62);
        const rattleDepth = c.createGain();
        rattleDepth.gain.value = 0.35;
        const rattleGain = c.createGain();
        rattleGain.gain.value = 0.65;
        rattle.connect(rattleDepth).connect(rattleGain.gain);

        const mix = c.createGain();
        osc.connect(mix);
        const g2 = c.createGain();
        g2.gain.value = 0.35;
        osc2.connect(g2).connect(mix);
        const distort = c.createWaveShaper();
        distort.curve = heavyCurve;
        distort.oversample = '2x';
        mix.connect(distort);

        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 350;
        const bright = c.createBiquadFilter();
        bright.type = 'peaking';
        bright.frequency.value = 2600;
        bright.gain.value = 8;
        bright.Q.value = 1.2;
        const out = c.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(level, t0 + 0.06);
        out.gain.setValueAtTime(level, t0 + dur * 0.65);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        distort.connect(hp);
        hp.connect(bright).connect(rattleGain).connect(out).connect(bus);

        // Airy rasp riding on top of the pitch.
        const rasp = noiseSource(c, t0, dur);
        const raspBp = c.createBiquadFilter();
        raspBp.type = 'bandpass';
        raspBp.frequency.value = 3200;
        raspBp.Q.value = 0.9;
        const raspGain = c.createGain();
        raspGain.gain.setValueAtTime(0.0001, t0);
        raspGain.gain.exponentialRampToValueAtTime(level * 0.55, t0 + 0.08);
        raspGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        rasp.connect(raspBp).connect(raspGain).connect(bus);

        [osc, osc2, rattle].forEach(o => {
            o.start(t0);
            o.stop(t0 + dur + 0.1);
        });
    };

    /** Wet breath: a noise swell sweeping through a bandpass, with a gurgling flutter. */
    const breath = (c: AudioContext, bus: GainNode, t0: number, dur: number, level: number, fStart = 500, fEnd = 900) => {
        const src = noiseSource(c, t0, dur);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(fStart, t0);
        bp.frequency.linearRampToValueAtTime(fEnd, t0 + dur);
        const gurgle = c.createOscillator();
        gurgle.frequency.value = rand(11, 17);
        const gurgleDepth = c.createGain();
        gurgleDepth.gain.value = 0.3;
        const flutter = c.createGain();
        flutter.gain.value = 0.7;
        gurgle.connect(gurgleDepth).connect(flutter.gain);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(level, t0 + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(bp).connect(flutter).connect(g).connect(bus);
        gurgle.start(t0);
        gurgle.stop(t0 + dur + 0.1);
    };

    /** A train of sharp noise ticks, like teeth or petals clattering. */
    const clicks = (c: AudioContext, bus: GainNode, t0: number, count: number, interval: number, level: number) => {
        for (let i = 0; i < count; i++) {
            const t = t0 + i * interval * rand(0.6, 1.4);
            const src = c.createBufferSource();
            src.buffer = noise;
            const bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = rand(1800, 4200);
            bp.Q.value = rand(5, 10);
            const g = c.createGain();
            g.gain.setValueAtTime(level * rand(0.5, 1), t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.012, 0.03));
            src.connect(bp).connect(g).connect(bus);
            src.start(t, Math.random());
            src.stop(t + 0.05);
            const tone = c.createOscillator();
            tone.frequency.value = rand(500, 1100);
            const tg = c.createGain();
            tg.gain.setValueAtTime(level * 0.35, t);
            tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
            tone.connect(tg).connect(bus);
            tone.start(t);
            tone.stop(t + 0.04);
        }
    };

    /** A heavy, wet footfall: sub thump plus a squelch of noise. */
    const footstep = (c: AudioContext, bus: GainNode, t: number, level: number) => {
        const thump = c.createOscillator();
        thump.frequency.setValueAtTime(95, t);
        thump.frequency.exponentialRampToValueAtTime(38, t + 0.16);
        const tg = c.createGain();
        tg.gain.setValueAtTime(level, t);
        tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        thump.connect(tg).connect(bus);
        thump.start(t);
        thump.stop(t + 0.25);
        const src = noiseSource(c, t, 0.2);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1400, t);
        lp.frequency.exponentialRampToValueAtTime(250, t + 0.15);
        const ng = c.createGain();
        ng.gain.setValueAtTime(level * 0.5, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        src.connect(lp).connect(ng).connect(bus);
    };

    /** A sudden crunch as the petals snap shut. */
    const snap = (c: AudioContext, bus: GainNode, t: number, level: number) => {
        const src = noiseSource(c, t, 0.25);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3000, t);
        bp.frequency.exponentialRampToValueAtTime(900, t + 0.18);
        bp.Q.value = 1.2;
        const g = c.createGain();
        g.gain.setValueAtTime(level, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        src.connect(bp).connect(g).connect(bus);
        const boom = c.createOscillator();
        boom.frequency.setValueAtTime(140, t);
        boom.frequency.exponentialRampToValueAtTime(45, t + 0.25);
        const bg = c.createGain();
        bg.gain.setValueAtTime(level * 0.8, t);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        boom.connect(bg).connect(bus);
        boom.start(t);
        boom.stop(t + 0.35);
        clicks(c, bus, t, 6, 0.02, level * 0.6);
    };

    // ----------------------------------------------------------------
    // Per-animation soundscapes
    // ----------------------------------------------------------------

    const clearTimers = () => {
        timers.forEach(id => window.clearTimeout(id));
        timers = [];
    };

    const loop = (periodSeconds: number, tick: () => void) => {
        tick();
        timers.push(window.setTimeout(() => loop(periodSeconds, tick), periodSeconds * 1000));
    };

    const idleCycle = (c: AudioContext, bus: GainNode) => {
        const t = c.currentTime + 0.05;
        // Two slow, ragged breaths per 4 s cycle, matching the idle clip.
        breath(c, bus, t + 0.2, 0.9, 0.22, 420, 800);
        breath(c, bus, t + 1.2, 1.1, 0.18, 800, 450);
        breath(c, bus, t + 2.3, 0.8, 0.2, 450, 850);
        breath(c, bus, t + 3.2, 0.8, 0.16, 850, 480);
        growl(c, bus, t + rand(0, 1.5), rand(1.2, 2), 52, 66, 0.2);
        if (Math.random() < 0.7) clicks(c, bus, t + rand(0.3, 3.2), Math.floor(rand(3, 9)), 0.07, 0.12);
        if (Math.random() < 0.25) growl(c, bus, t + rand(2, 3), 1.2, 70, 95, 0.22);
    };

    const walkCycle = (c: AudioContext, bus: GainNode) => {
        const t = c.currentTime + 0.05;
        // The walk clip is 1.3 s long with a footfall every half cycle.
        footstep(c, bus, t + 0.05, 0.5);
        footstep(c, bus, t + 0.7, 0.5);
        growl(c, bus, t, 1.3, 58, 72, 0.14);
        breath(c, bus, t + 0.1, 0.5, 0.07, 500, 900);
        breath(c, bus, t + 0.75, 0.5, 0.07, 900, 500);
        if (Math.random() < 0.6) clicks(c, bus, t + rand(0.1, 1), Math.floor(rand(4, 10)), 0.05, 0.07);
    };

    const attackOnce = (c: AudioContext, bus: GainNode) => {
        const t = c.currentTime + 0.03;
        breath(c, bus, t, 0.4, 0.14, 500, 1400); // sharp intake while the body coils
        growl(c, bus, t + 0.1, 0.5, 70, 110, 0.18);
        scream(c, bus, t + 0.42, 0.85, 520, 1500, 0.2); // the lunge lands at 0.58 s
        growl(c, bus, t + 0.45, 1.0, 62, 98, 0.32);
        footstep(c, bus, t + 0.6, 0.7);
        snap(c, bus, t + 0.98, 0.35); // petals clap shut
        growl(c, bus, t + 1.1, 0.7, 75, 55, 0.14);
        breath(c, bus, t + 1.2, 0.5, 0.08, 900, 500);
    };

    const roarOnce = (c: AudioContext, bus: GainNode) => {
        const t = c.currentTime + 0.03;
        breath(c, bus, t, 0.8, 0.16, 400, 1200); // huge inhale while the head tips back
        growl(c, bus, t + 0.3, 0.6, 48, 70, 0.12);
        // Peak of the roar between 1.0 s and 2.3 s, with the petals blown wide open.
        growl(c, bus, t + 0.85, 1.6, 58, 92, 0.42);
        scream(c, bus, t + 0.9, 1.4, 620, 1700, 0.24);
        scream(c, bus, t + 0.95, 1.3, 430, 1100, 0.14);
        growl(c, bus, t + 1.0, 1.2, 150, 210, 0.1);
        clicks(c, bus, t + 1.0, 28, 0.045, 0.1); // petals rattling out of sync
        footstep(c, bus, t + 0.9, 0.45);
        growl(c, bus, t + 2.2, 0.9, 80, 52, 0.14);
        breath(c, bus, t + 2.4, 0.7, 0.08, 800, 450);
    };

    const stopAll = () => {
        clearTimers();
        const c = ctx;
        if (!c) return;
        buses.forEach(bus => {
            bus.gain.cancelScheduledValues(c.currentTime);
            bus.gain.setValueAtTime(bus.gain.value, c.currentTime);
            bus.gain.linearRampToValueAtTime(0, c.currentTime + 0.15);
            window.setTimeout(() => bus.disconnect(), 400);
        });
        buses = [];
    };

    return {
        play(animation) {
            const c = ensure();
            if (!c) return;
            stopAll();
            const bus = newBus(c);
            switch (animation) {
                case 'idle':
                    loop(4, () => idleCycle(c, bus));
                    break;
                case 'walk':
                    loop(1.3, () => walkCycle(c, bus));
                    break;
                case 'attack':
                    attackOnce(c, bus);
                    break;
                case 'roar':
                    roarOnce(c, bus);
                    break;
            }
        },
        stop: stopAll,
        setVolume(next) {
            volume = next;
            if (ctx) master.gain.setTargetAtTime(next, ctx.currentTime, 0.05);
        },
        dispose() {
            stopAll();
            if (ctx) void ctx.close();
            ctx = null;
        },
    };
};
