import * as THREE from 'three';

/**
 * Radio — WPHR 3AM, broadcasting from the bottom of the lighthouse
 * ----------------------------------------------------------------
 * Ray's old ham desk has a microphone and an ON AIR lamp. Flip it on and
 * you're live: everything you play on the instruments in the music shed
 * (and your voice, if your mic is on) goes out to everyone in the room
 * who's tuned in — anyone with music playing (Walkman, truck radio, any
 * stereo) or sitting in a vehicle — wherever they are on the map, with a
 * little AM-radio crackle on it. Their music ducks while you're on.
 */
export class Radio {
  constructor(game) {
    this.game = game;
    this.onAir = false;
    this.ctx = game.audio.ctx;
    // the "radio" bus: band-limited, slightly crunchy, plus static
    this.bus = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 280;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0;
    this.bus.connect(hp).connect(lp).connect(shaper).connect(this.out).connect(game.audio.master);
    this.hiss = game.audio.noiseSource(true);
    const hf = this.ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = 3000;
    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = 0;
    this.hiss.connect(hf).connect(this.hissGain).connect(game.audio.master);
    this.hiss.start();
    this.wasLive = new Set();
  }

  /** Are we listening? (music playing anywhere, or in a vehicle) */
  get tuned() {
    const g = this.game;
    return g.music.playing || !!g.vehicle.active || !!g.mp?.ride;
  }

  /** Who in the room is live right now. */
  get live() {
    const out = [];
    for (const r of this.game.mp?.remotes?.values() ?? []) if (r.state?.air) out.push(r);
    return out;
  }

  toggle() {
    const g = this.game;
    this.onAir = !this.onAir;
    g.audio.oneShot('click', { volume: 0.5 });
    g.hud.toast(this.onAir ? 'ON AIR. WPHR 3AM is live. Go play something in the music shed — everyone tuned in will hear it (and you, if your mic is on).' : 'Off air. Goodnight, Pine Hollow.', 6000);
  }

  update(dt) {
    const g = this.game;
    const live = this.live;
    const hear = live.length > 0 && this.tuned;
    this.out.gain.setTargetAtTime(hear ? 0.8 : 0, this.ctx.currentTime, 0.2);
    this.hissGain.gain.setTargetAtTime(hear ? 0.012 : 0, this.ctx.currentTime, 0.3);
    // duck the music while someone's broadcasting
    if (hear && this.ducked == null) {
      this.ducked = g.music.volume;
      g.music.volume = this.ducked * 0.25;
    } else if (!hear && this.ducked != null) {
      g.music.volume = this.ducked;
      this.ducked = null;
    }
    for (const r of live) {
      if (!this.wasLive.has(r.id)) {
        this.wasLive.add(r.id);
        g.hud.toast(`📻 ${r.name} is live on WPHR 3AM. ${this.tuned ? 'You’re tuned in.' : 'Put some music on (or get in a car) to tune in.'}`, 5000);
      }
    }
    for (const id of [...this.wasLive]) if (!live.some((r) => r.id === id)) this.wasLive.delete(id);
    void dt;
  }
}

export const _radioV = new THREE.Vector3();
