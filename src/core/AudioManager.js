import * as THREE from 'three';

/**
 * AudioManager
 * ------------
 * Positional + ambient audio on top of THREE.AudioListener.
 *
 * Every sound has two paths:
 *  1. a real file from /src/assets/audio (loaded by AssetLoader), or
 *  2. a WebAudio synthesis fallback, so the game is never silent.
 *
 *   audio.positional('fluorescent_hum', object3D, { volume, refDistance })
 *   audio.ambient('night_ambience', { volume })   -> handle with .setVolume/.stop
 *   audio.oneShot('microwave_beep', { volume, rate })
 *   audio.engine(object3D)                        -> handle with .setRPM(0..1)
 */
export class AudioManager {
  constructor(camera, assets) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;
    this.assets = assets;
    this.master = this.listener.gain;
    this.master.gain.value = 0.8;
    this._noise = null;
  }

  /** Browsers start audio suspended until a user gesture. */
  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Looping 3D sound attached to an object. Returns a handle. */
  positional(key, object, { volume = 1, refDistance = 2, rolloff = 1.6, maxDistance = 40 } = {}) {
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setRefDistance(refDistance);
    sound.setRolloffFactor(rolloff);
    sound.setMaxDistance(maxDistance);
    sound.setDistanceModel('inverse');
    object.add(sound);
    return this.#attachLoop(key, sound, volume);
  }

  /** Looping non-positional bed (wind, crickets, room tone). */
  ambient(key, { volume = 0.5 } = {}) {
    const sound = new THREE.Audio(this.listener);
    return this.#attachLoop(key, sound, volume);
  }

  /** Fire-and-forget sound. */
  oneShot(key, { volume = 1, rate = 1, object = null } = {}) {
    const buf = this.assets.audio(key);
    const out = this.ctx.createGain();
    out.gain.value = volume;
    let target = this.master;
    let positional = null;
    if (object) {
      positional = new THREE.PositionalAudio(this.listener);
      positional.setRefDistance(2);
      object.add(positional);
      positional.setNodeSource(out);
      target = null;
      setTimeout(() => {
        positional.disconnect();
        object.remove(positional);
      }, 4000);
    }
    if (target) out.connect(target);

    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(out);
      src.start();
      return;
    }
    (SYNTH_ONESHOTS[key] ?? SYNTH_ONESHOTS.click)(this, out, rate);
  }

  /** Truck engine: pitch + volume follow `setRPM(0..1)`. */
  engine(object, { base = 0, range = 1, key = 'truck_engine', volume = 0.55 } = {}) {
    const handle = this.positional(key, object, { volume, refDistance: 3 });
    // base/range give each vehicle its own voice (low truck, whiny bike…).
    handle.setRPM = (x) => {
      const rpm = base + x * range;
      const r = 0.6 + rpm * 1.4;
      if (handle.bufferSource) handle.bufferSource.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.05);
      handle.synth?.setRPM?.(rpm);
    };
    return handle;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  #attachLoop(key, sound, volume) {
    const out = this.ctx.createGain();
    out.gain.value = volume;
    sound.setNodeSource(out);

    const handle = {
      sound,
      gain: out,
      bufferSource: null,
      synth: null,
      setVolume: (v, t = 0.2) => out.gain.setTargetAtTime(v, this.ctx.currentTime, t),
      stop: () => {
        try {
          handle.bufferSource?.stop();
        } catch {}
        handle.synth?.stop?.();
        out.disconnect();
        sound.parent?.remove(sound);
      },
    };

    const buf = this.assets.audio(key);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(out);
      // Random start offset so identical loops don't phase together.
      src.start(0, Math.random() * buf.duration);
      handle.bufferSource = src;
    } else {
      const synth = SYNTH_LOOPS[key];
      if (synth) handle.synth = synth(this, out);
    }
    return handle;
  }

  /** Shared 2-second white noise buffer for the synths. */
  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  noiseSource(loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = loop;
    return src;
  }
}

// -----------------------------------------------------------------------------
// Synth fallbacks — crude but moody. Each returns { stop() } (+ extras).
// -----------------------------------------------------------------------------

const SYNTH_LOOPS = {
  /** Frying pan: crackly high noise with random pops. */
  sizzle(am, out) {
    const ctx = am.ctx;
    const n = am.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    n.connect(hp).connect(g).connect(out);
    n.start();
    const id = setInterval(() => noiseBurst(am, out, { freq: 2500, type: 'bandpass', attack: 0.001, decay: 0.04, peak: 0.3 * Math.random() }), 90);
    return { stop: () => (clearInterval(id), n.stop()) };
  },

  /** Skateboard: urethane wheels on asphalt (setRPM = speed 0..1). */
  skate_roll(am, out) {
    const ctx = am.ctx;
    const n = am.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0;
    n.connect(bp).connect(g).connect(out);
    n.start();
    return {
      stop: () => n.stop(),
      setRPM: (x) => {
        g.gain.setTargetAtTime(Math.min(0.6, x * 0.7), ctx.currentTime, 0.08);
        bp.frequency.setTargetAtTime(350 + x * 1400, ctx.currentTime, 0.08);
      },
    };
  },

  /** Train: deep rumble + wheel clatter (two quick clicks per rail joint). */
  train_rumble(am, out) {
    const ctx = am.ctx;
    const n = am.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    n.connect(lp).connect(g).connect(out);
    n.start();
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 46;
    const hg = ctx.createGain();
    hg.gain.value = 0.08;
    hum.connect(hg).connect(out);
    hum.start();
    const id = setInterval(() => {
      for (const dt of [0, 0.09]) {
        const t = ctx.currentTime + dt;
        const c = ctx.createBufferSource();
        c.buffer = am.noiseBuffer();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.5, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        c.connect(bp).connect(cg).connect(out);
        c.start(t);
        c.stop(t + 0.08);
      }
    }, 520);
    return { stop: () => (clearInterval(id), n.stop(), hum.stop()) };
  },

  /** Rain: hiss on top, a softer wash under it, both from the noise buffer. */
  rain(am, out) {
    const ctx = am.ctx;
    const a = am.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const ga = ctx.createGain();
    ga.gain.value = 0.35;
    a.connect(hp).connect(ga).connect(out);
    const b = am.noiseSource();
    b.playbackRate.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const gb = ctx.createGain();
    gb.gain.value = 0.5;
    b.connect(lp).connect(gb).connect(out);
    a.start();
    b.start(0, 0.7);
    return {
      stop: () => [a, b].forEach((x) => x.stop()),
      // Indoors: muffle it (roof drumming instead of open-air hiss).
      setMuffled: (m) => {
        hp.frequency.setTargetAtTime(m ? 6000 : 2500, ctx.currentTime, 0.3);
        lp.frequency.setTargetAtTime(m ? 400 : 900, ctx.currentTime, 0.3);
      },
    };
  },

  /** 120 Hz mains buzz with a bit of hiss — the gas-station-at-3am sound. */
  fluorescent_hum(am, out) {
    const ctx = am.ctx;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 120;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 240.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const hiss = am.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const hg = ctx.createGain();
    hg.gain.value = 0.012;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(out);
    hiss.connect(hp).connect(hg).connect(out);
    o1.start();
    o2.start();
    hiss.start();
    return { stop: () => [o1, o2, hiss].forEach((n) => n.stop()) };
  },

  microwave_hum(am, out) {
    const ctx = am.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 60;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0.15;
    o.connect(lp).connect(g).connect(out);
    o.start();
    return { stop: () => o.stop() };
  },

  /** Filtered noise with a slow swell — water against a dock. */
  water_lapping(am, out) {
    const ctx = am.ctx;
    const n = am.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    const bias = ctx.createConstantSource();
    bias.offset.value = 0.2;
    lfo.connect(lfoGain).connect(g.gain);
    bias.connect(g.gain);
    n.connect(bp).connect(g).connect(out);
    n.start();
    lfo.start();
    bias.start();
    return { stop: () => [n, lfo, bias].forEach((x) => x.stop()) };
  },

  /** Low wind + randomly chirping "crickets". */
  night_ambience(am, out) {
    const ctx = am.ctx;
    const n = am.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    n.connect(lp).connect(g).connect(out);
    n.start();
    let alive = true;
    const chirp = () => {
      if (!alive) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.value = 4200 + Math.random() * 600;
      const cg = ctx.createGain();
      cg.gain.value = 0;
      for (let i = 0; i < 3; i++) {
        cg.gain.setValueAtTime(0.02, t + i * 0.06);
        cg.gain.setValueAtTime(0, t + i * 0.06 + 0.03);
      }
      o.connect(cg).connect(out);
      o.start(t);
      o.stop(t + 0.25);
      setTimeout(chirp, 400 + Math.random() * 2200);
    };
    chirp();
    return {
      stop: () => {
        alive = false;
        n.stop();
      },
    };
  },

  /** Two detuned saws through a lowpass whose cutoff tracks RPM. */
  truck_engine(am, out) {
    const ctx = am.ctx;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(out);
    o1.start();
    o2.start();
    const setRPM = (rpm) => {
      const t = ctx.currentTime;
      const f = 32 + rpm * 70;
      o1.frequency.setTargetAtTime(f, t, 0.08);
      o2.frequency.setTargetAtTime(f * 0.502, t, 0.08);
      lp.frequency.setTargetAtTime(220 + rpm * 900, t, 0.08);
    };
    setRPM(0);
    return { stop: () => [o1, o2].forEach((o) => o.stop()), setRPM };
  },

  /** Crackling fire: brown-ish noise bed + random pops. */
  campfire(am, out) {
    const ctx = am.ctx;
    const n = am.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    n.connect(lp).connect(g).connect(out);
    n.start();
    let alive = true;
    const pop = () => {
      if (!alive) return;
      noiseBurst(am, out, { freq: 1500 + Math.random() * 3000, type: 'highpass', attack: 0.001, decay: 0.03 + Math.random() * 0.05, peak: 0.2 + Math.random() * 0.3 });
      setTimeout(pop, 60 + Math.random() * 500);
    };
    pop();
    return {
      stop: () => {
        alive = false;
        n.stop();
      },
    };
  },

  /** Lo-fi stereo: slow detuned chord drifting through a lowpass. */
  radio(am, out) {
    const ctx = am.ctx;
    const notes = [110, 138.6, 164.8, 207.7];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const oscs = notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      o.connect(lp);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 300;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    const hiss = am.noiseSource();
    const hg = ctx.createGain();
    hg.gain.value = 0.01;
    hiss.connect(hg).connect(out);
    hiss.start();
    lp.connect(g).connect(out);
    return { stop: () => [...oscs, lfo, hiss].forEach((o) => o.stop()) };
  },
};

/** Short envelope helper for one-shots. */
function envelope(ctx, gainNode, attack, decay, peak = 1) {
  const t = ctx.currentTime;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return t + attack + decay;
}

function noiseBurst(am, out, { freq = 800, type = 'lowpass', attack = 0.005, decay = 0.12, peak = 0.6, rate = 1 }) {
  const ctx = am.ctx;
  const n = am.noiseSource(false);
  n.playbackRate.value = rate;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  n.connect(f).connect(g).connect(out);
  const end = envelope(ctx, g, attack, decay, peak);
  n.start();
  n.stop(end + 0.05);
}

function tone(am, out, { freq = 1000, type = 'square', start = 0, dur = 0.12, peak = 0.15 }) {
  const ctx = am.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.setValueAtTime(peak, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.01);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const footstep = (am, out, rate) => noiseBurst(am, out, { freq: 380 * rate, decay: 0.09, peak: 0.35 });

const SYNTH_ONESHOTS = {
  footstep_1: footstep,
  footstep_2: footstep,
  footstep_3: footstep,
  footstep_4: footstep,
  click: (am, out) => tone(am, out, { freq: 1800, dur: 0.02, peak: 0.08 }),
  microwave_beep: (am, out) => {
    for (let i = 0; i < 3; i++) tone(am, out, { freq: 2100, start: i * 0.35, dur: 0.18, peak: 0.12 });
  },
  register: (am, out) => {
    tone(am, out, { freq: 2600, dur: 0.06, peak: 0.1, type: 'triangle' });
    noiseBurst(am, out, { freq: 3000, type: 'highpass', decay: 0.25, peak: 0.2 });
  },
  door: (am, out) => noiseBurst(am, out, { freq: 220, decay: 0.35, peak: 0.8 }),
  splash: (am, out) => noiseBurst(am, out, { freq: 1400, decay: 0.5, peak: 0.6 }),
  reel: (am, out) => {
    for (let i = 0; i < 6; i++) tone(am, out, { freq: 3200, start: i * 0.03, dur: 0.01, peak: 0.05 });
  },
  line_snap: (am, out) => {
    tone(am, out, { freq: 900, type: 'sawtooth', dur: 0.05, peak: 0.25 });
    noiseBurst(am, out, { freq: 4000, type: 'highpass', decay: 0.15, peak: 0.5 });
  },
  can_open: (am, out) => {
    noiseBurst(am, out, { freq: 5000, type: 'highpass', attack: 0.001, decay: 0.08, peak: 0.6 });
    noiseBurst(am, out, { freq: 2500, type: 'bandpass', attack: 0.05, decay: 0.4, peak: 0.25 });
  },
  fridge_open: (am, out) => {
    noiseBurst(am, out, { freq: 160, decay: 0.25, peak: 0.7 }); // thunk
    noiseBurst(am, out, { freq: 2500, type: 'bandpass', attack: 0.05, decay: 0.35, peak: 0.12 }); // seal
  },
  fridge_close: (am, out) => noiseBurst(am, out, { freq: 120, decay: 0.2, peak: 0.9 }),
  gulp: (am, out) => {
    for (let i = 0; i < 3; i++) tone(am, out, { freq: 140 + i * 15, type: 'sine', start: i * 0.38, dur: 0.12, peak: 0.25 });
  },
  lighter: (am, out) => {
    tone(am, out, { freq: 3800, dur: 0.01, peak: 0.2 });
    noiseBurst(am, out, { freq: 4000, type: 'highpass', attack: 0.02, decay: 0.5, peak: 0.12 });
  },
  inhale: (am, out) => noiseBurst(am, out, { freq: 1200, type: 'bandpass', attack: 0.6, decay: 0.5, peak: 0.1 }),
  exhale: (am, out) => noiseBurst(am, out, { freq: 700, type: 'bandpass', attack: 0.1, decay: 1.1, peak: 0.12 }),
  /** Two-tone diaphone: long, low, swelling. */
  foghorn: (am, out) => {
    const ctx = am.ctx;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.5);
    g.gain.setValueAtTime(0.5, t + 2.2);
    g.gain.linearRampToValueAtTime(0, t + 3.4);
    lp.connect(g).connect(out);
    for (const [f, type] of [[88, 'sawtooth'], [132, 'square'], [44, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * 1.04, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.6);
      o.connect(lp);
      o.start(t);
      o.stop(t + 3.5);
    }
  },
  /** 12-gauge: sharp crack + low thump, then a valley echo. */
  shotgun: (am, out) => {
    noiseBurst(am, out, { freq: 2600, attack: 0.001, decay: 0.12, peak: 1.0 });
    noiseBurst(am, out, { freq: 380, attack: 0.002, decay: 0.55, peak: 0.9 });
    tone(am, out, { freq: 55, type: 'sine', dur: 0.18, peak: 0.6 });
    setTimeout(() => noiseBurst(am, out, { freq: 500, attack: 0.05, decay: 0.9, peak: 0.25 }), 420);
    setTimeout(() => noiseBurst(am, out, { freq: 380, attack: 0.08, decay: 1.2, peak: 0.12 }), 1100);
  },
  snort: (am, out) => {
    noiseBurst(am, out, { freq: 700, type: 'bandpass', attack: 0.02, decay: 0.25, peak: 0.5 });
    setTimeout(() => noiseBurst(am, out, { freq: 600, type: 'bandpass', attack: 0.02, decay: 0.2, peak: 0.35 }), 260);
  },
  /** Empty stomach: a low gurgling sweep. */
  growl: (am, out, rate = 1) => {
    const ctx = am.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 * rate, t);
    o.frequency.linearRampToValueAtTime(140 * rate, t + 0.4);
    o.frequency.linearRampToValueAtTime(55 * rate, t + 1.1);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.15);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lfo.connect(lg).connect(g.gain);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.3);
    lfo.stop(t + 1.3);
  },
  /** Train horn: a loud, slightly sour two-note chord. */
  horn: (am, out) => {
    const ctx = am.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.08);
    g.gain.setValueAtTime(0.5, t + 1.2);
    g.gain.linearRampToValueAtTime(0, t + 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.connect(g).connect(out);
    for (const f of [311, 370, 466]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.55);
    }
  },
  /** Level crossing bell. */
  bell: (am, out) => {
    tone(am, out, { freq: 1480, type: 'triangle', dur: 0.06, peak: 0.25 });
    tone(am, out, { freq: 2960, type: 'sine', dur: 0.12, peak: 0.08 });
  },
  /** Skateboard: a push off the ground, and the ollie pop. */
  kick: (am, out) => noiseBurst(am, out, { freq: 600, type: 'bandpass', attack: 0.01, decay: 0.12, peak: 0.35 }),
  ollie: (am, out) => {
    noiseBurst(am, out, { freq: 1800, type: 'bandpass', attack: 0.001, decay: 0.08, peak: 0.8 });
    tone(am, out, { freq: 140, type: 'sine', dur: 0.05, peak: 0.3 });
  },
  land: (am, out) => noiseBurst(am, out, { freq: 400, attack: 0.002, decay: 0.15, peak: 0.7 }),
  /** Bong water: a couple of seconds of random low bubbles. */
  bubble: (am, out) => {
    for (let i = 0; i < 26; i++) {
      tone(am, out, { freq: 180 + Math.random() * 320, type: 'sine', start: i * 0.085 + Math.random() * 0.03, dur: 0.03, peak: 0.12 + Math.random() * 0.08 });
    }
    noiseBurst(am, out, { freq: 400, attack: 0.3, decay: 2.0, peak: 0.08 });
  },
  /** Three rough coughs. */
  cough: (am, out) => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        noiseBurst(am, out, { freq: 700, type: 'bandpass', attack: 0.005, decay: 0.18, peak: 0.7 });
        noiseBurst(am, out, { freq: 260, attack: 0.005, decay: 0.12, peak: 0.4 });
      }, i * 280 + Math.random() * 80);
    }
  },
  /** Spade into sand: a soft gritty scrape. */
  sand: (am, out, rate) => {
    noiseBurst(am, out, { freq: 2200 * rate, type: 'bandpass', attack: 0.03, decay: 0.22, peak: 0.5 });
    noiseBurst(am, out, { freq: 500 * rate, attack: 0.01, decay: 0.12, peak: 0.25 });
  },
  /** Swing chain: a rusty two-note squeak. */
  creak: (am, out) => {
    const ctx = am.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.18);
    o.frequency.linearRampToValueAtTime(610, t + 0.32);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.04);
    g.gain.linearRampToValueAtTime(0, t + 0.36);
    o.connect(bp).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
  },
  /**
   * Thunder. rate ~ closeness: > 1.2 adds the sharp crack of a near strike,
   * every strike rolls on for a few seconds of low rumble.
   */
  thunder: (am, out, rate = 1) => {
    if (rate > 1.2) {
      noiseBurst(am, out, { freq: 3500, type: 'highpass', attack: 0.001, decay: 0.25, peak: 0.9 });
      noiseBurst(am, out, { freq: 600, attack: 0.002, decay: 0.6, peak: 1.0 });
    }
    noiseBurst(am, out, { freq: 140, attack: 0.15, decay: 2.8, peak: 1.0, rate: 0.5 });
    noiseBurst(am, out, { freq: 260, attack: 0.4, decay: 2.0, peak: 0.5, rate: 0.6 });
    setTimeout(() => noiseBurst(am, out, { freq: 110, attack: 0.3, decay: 3.2, peak: 0.7, rate: 0.4 }), 900);
  },
  blip: (am, out, rate) => tone(am, out, { freq: 880 * rate, dur: 0.05, peak: 0.08 }),
  bite: (am, out) => {
    noiseBurst(am, out, { freq: 900, decay: 0.15, peak: 0.5 });
    tone(am, out, { freq: 660, dur: 0.08, peak: 0.08 });
  },
  // ---- buckshot roulette ----
  /** Pump back… and forward: two metallic clacks. */
  rack: (am, out) => {
    noiseBurst(am, out, { freq: 1800, type: 'bandpass', attack: 0.002, decay: 0.09, peak: 0.8 });
    tone(am, out, { freq: 420, type: 'square', dur: 0.02, peak: 0.12 });
    setTimeout(() => {
      noiseBurst(am, out, { freq: 1300, type: 'bandpass', attack: 0.002, decay: 0.12, peak: 0.95 });
      tone(am, out, { freq: 300, type: 'square', dur: 0.025, peak: 0.15 });
    }, 170);
  },
  /** Dry hammer fall on a blank. */
  dryfire: (am, out) => {
    noiseBurst(am, out, { freq: 3200, type: 'bandpass', attack: 0.001, decay: 0.05, peak: 0.7 });
    tone(am, out, { freq: 900, type: 'square', dur: 0.012, peak: 0.1 });
  },
  shell_in: (am, out, rate = 1) => {
    noiseBurst(am, out, { freq: 2200 * rate, type: 'bandpass', attack: 0.002, decay: 0.06, peak: 0.45 });
    setTimeout(() => tone(am, out, { freq: 700 * rate, type: 'triangle', dur: 0.03, peak: 0.08 }), 60);
  },
  shell_drop: (am, out, rate = 1) => {
    tone(am, out, { freq: 1500 * rate, type: 'triangle', dur: 0.02, peak: 0.07 });
    setTimeout(() => tone(am, out, { freq: 1250 * rate, type: 'triangle', dur: 0.015, peak: 0.04 }), 90);
  },
  saw_stroke: (am, out, rate = 1) => noiseBurst(am, out, { freq: 3400 * rate, type: 'bandpass', attack: 0.06, decay: 0.16, peak: 0.35 }),
  cuffs: (am, out) => {
    for (let i = 0; i < 5; i++) tone(am, out, { freq: 2600 + (i % 2) * 500, type: 'square', start: i * 0.035, dur: 0.008, peak: 0.08 });
    noiseBurst(am, out, { freq: 4200, type: 'highpass', decay: 0.2, peak: 0.25 });
  },
  cuffs_break: (am, out) => {
    noiseBurst(am, out, { freq: 3000, type: 'bandpass', attack: 0.001, decay: 0.15, peak: 0.6 });
    tone(am, out, { freq: 1900, type: 'triangle', dur: 0.06, peak: 0.1 });
  },
  defib_beep: (am, out, rate = 1) => tone(am, out, { freq: 1046 * rate, type: 'square', dur: 0.09, peak: 0.07 }),
  defib_charge: (am, out) => {
    const ctx = am.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(3800, t + 0.9);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    g.gain.linearRampToValueAtTime(0.0, t + 0.95);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 1);
    setTimeout(() => noiseBurst(am, out, { freq: 900, attack: 0.002, decay: 0.25, peak: 0.9 }), 950);
  },
  /** Ears ringing after a point-blank shot. */
  tinnitus: (am, out) => {
    const ctx = am.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 3600;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 4.5);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 4.6);
  },
  heartbeat: (am, out) => {
    tone(am, out, { freq: 52, type: 'sine', dur: 0.09, peak: 0.6 });
    tone(am, out, { freq: 46, type: 'sine', start: 0.22, dur: 0.11, peak: 0.45 });
  },
  zap: (am, out) => {
    for (let i = 0; i < 6; i++) tone(am, out, { freq: 160 + Math.random() * 900, type: 'sawtooth', start: i * 0.03, dur: 0.025, peak: 0.08 });
    noiseBurst(am, out, { freq: 5000, type: 'highpass', attack: 0.002, decay: 0.15, peak: 0.25 });
  },
  rattle: (am, out) => {
    for (let i = 0; i < 7; i++) noiseBurst(am, out, { freq: 3500 + Math.random() * 1500, type: 'bandpass', attack: 0.001, decay: 0.03, peak: 0.25 + Math.random() * 0.15 });
  },
  phone_flip: (am, out) => {
    tone(am, out, { freq: 2400, type: 'triangle', dur: 0.015, peak: 0.12 });
    setTimeout(() => tone(am, out, { freq: 1600, type: 'square', dur: 0.03, peak: 0.04 }), 120);
  },
  phone_voice: (am, out) => {
    // a garbled, muffled voice through the earpiece
    for (let i = 0; i < 9; i++) tone(am, out, { freq: 180 + Math.random() * 160, type: 'sawtooth', start: i * 0.11, dur: 0.07 + Math.random() * 0.05, peak: 0.025 });
  },
  stab: (am, out) => {
    noiseBurst(am, out, { freq: 1200, type: 'bandpass', attack: 0.001, decay: 0.05, peak: 0.4 });
    tone(am, out, { freq: 120, type: 'sine', dur: 0.12, peak: 0.25 });
  },
  splat: (am, out) => {
    noiseBurst(am, out, { freq: 500, type: 'lowpass', attack: 0.002, decay: 0.25, peak: 0.6 });
    setTimeout(() => noiseBurst(am, out, { freq: 900, type: 'bandpass', attack: 0.002, decay: 0.12, peak: 0.25 }), 80);
  },
  thud: (am, out) => {
    noiseBurst(am, out, { freq: 180, attack: 0.002, decay: 0.3, peak: 0.9 });
    tone(am, out, { freq: 60, type: 'sine', dur: 0.1, peak: 0.4 });
  },
};

export { SYNTH_LOOPS };
