import * as THREE from 'three';
import { StarSky } from '../world/StarSky.js';
import { spectral } from '../world/StarCatalog.js';

/**
 * Stargazing
 * ----------
 * Owns the StarSky and two ways of using it:
 *   - naked eye, anywhere outside at night: click a star / planet / the Moon
 *     under the crosshair to identify it
 *   - telescopes (house roof, mountain lookout): sit at the eyepiece, look
 *     around, scroll / Q to zoom (3 levels), click to identify
 * Details show as plain white text, top left, and fade after a while.
 */
const ZOOMS = [26, 9, 3.2]; // telescope field of view, degrees

export class Stargazing {
  constructor(game) {
    this.game = game;
    this.sky = new StarSky(game);
    this.scope = null; // active telescope
    this.zoomIndex = 0;
    this.info = document.createElement('div');
    this.info.id = 'star-info';
    document.getElementById('ui').appendChild(this.info);
    this.lens = document.createElement('div');
    this.lens.id = 'scope';
    this.lens.className = 'hidden';
    this.lens.innerHTML = '<i></i><b></b>';
    document.getElementById('ui').appendChild(this.lens);
    this.infoT = 0;
  }

  /** Sit at a telescope. def = { eye: Vector3, yaw, standAt: Vector3 } */
  useTelescope(def) {
    const g = this.game;
    this.scope = def;
    this.zoomIndex = 0;
    g.player.sit({ eye: def.eye, yaw: def.yaw, pitch: 0.5, yawLimit: Math.PI, standAt: def.standAt, onStand: () => this.#leave() });
    this.lens.classList.remove('hidden');
    g.hud.toast(g.dayNight.isDaylight ? 'Not much to see in daylight. Come back at night.' : 'Scroll or Q to zoom · click a star · E to step back', 4000);
  }

  #leave() {
    const g = this.game;
    this.scope = null;
    g.fovOverride = null;
    g.lookScale = 1;
    this.sky.zoom = 1;
    this.lens.classList.add('hidden');
  }

  update(dt) {
    const g = this.game;
    const scene = g.scene;
    if (!scene) return;
    this.sky.update(dt, scene);

    if (this.scope && g.player.seated) {
      const wheel = g.input.consumeWheel();
      let step = 0;
      if (g.input.pressed('KeyQ')) {
        g.input.consume('KeyQ');
        step = this.zoomIndex === ZOOMS.length - 1 ? -this.zoomIndex : 1; // Q cycles
      } else if (wheel) step = wheel < 0 ? 1 : -1; // scroll up = zoom in
      const next = Math.max(0, Math.min(ZOOMS.length - 1, this.zoomIndex + step));
      if (next !== this.zoomIndex) {
        this.zoomIndex = next;
        g.audio.oneShot('click', { volume: 0.4 });
      }
      const fov = ZOOMS[this.zoomIndex];
      g.fovOverride = fov;
      g.lookScale = fov / 70;
      this.sky.zoom = 70 / fov;
      this.lens.querySelector('b').textContent = `${Math.round(70 / fov)}×`;
    } else if (this.scope) this.#leave();

    // Click to identify (anything outside at night; telescopes too).
    const busy = g.uiOpen || g.focus || g.fishing.active || g.vehicle.active || g.hunting.equipped || g.viewModel.smoking || g.inventory.equipped === 'polaroid' || g.inventory.equipped === 'jar';
    if (!busy && scene.outdoor && g.input.locked && g.input.mousePressed(0) && !g.interaction.focus) {
      const dir = g.camera.getWorldDirection(_dir);
      const fovRad = (g.camera.fov * Math.PI) / 180;
      const hit = this.sky.pick(dir, Math.max(0.006, fovRad * 0.045));
      if (hit) this.#show(hit);
      else if (this.sky.visibility > 0.1 && dir.y > 0.05) this.#text('');
    }
    if (this.infoT > 0) {
      this.infoT -= dt;
      if (this.infoT <= 0) this.info.classList.remove('on');
    }
  }

  #text(t) {
    this.info.textContent = t;
    this.info.classList.toggle('on', !!t);
    this.infoT = t ? 14 : 0;
  }

  #show(b) {
    const w = this.sky.where(b);
    const pos = `altitude ${w.alt.toFixed(0)}°  ·  azimuth ${w.az.toFixed(0)}° ${w.compass}`;
    let lines;
    if (b.kind === 'star') {
      const sp = spectral(b.sp);
      const dist = b.dist < 100 ? b.dist.toFixed(1) : Math.round(b.dist).toLocaleString();
      lines = [b.name, b.con, `magnitude ${b.mag.toFixed(2)}  ·  ${dist} light-years`, `${sp.words} (${b.sp})`, pos];
      if (b.note) lines.push('', b.note);
    } else if (b.kind === 'planet') {
      const minutes = (b.distAU * 499) / 60;
      lines = [b.name, 'planet', `magnitude ${b.mag.toFixed(1)}  ·  ${b.distAU.toFixed(2)} AU away`, `its light left ${minutes < 60 ? `${minutes.toFixed(0)} minutes` : `${(minutes / 60).toFixed(1)} hours`} ago`, pos, '', b.note];
    } else {
      const pct = Math.round(b.illum * 100);
      lines = ['The Moon', `${phaseName(b.illum, b.waxing)}  ·  ${pct}% lit`, `${Math.round(b.distKm).toLocaleString()} km away  ·  light takes 1.3 seconds`, pos];
    }
    this.#text(lines.join('\n'));
    this.game.audio.oneShot('blip', { volume: 0.25, rate: 0.7 });
  }
}

function phaseName(illum, waxing) {
  if (illum < 0.03) return 'new moon';
  if (illum > 0.97) return 'full moon';
  if (Math.abs(illum - 0.5) < 0.05) return waxing ? 'first quarter' : 'last quarter';
  if (illum < 0.5) return waxing ? 'waxing crescent' : 'waning crescent';
  return waxing ? 'waxing gibbous' : 'waning gibbous';
}

const _dir = new THREE.Vector3();
