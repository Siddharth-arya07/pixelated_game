import * as THREE from 'three';

/**
 * Mining
 * ------
 * Pickaxes, ore, the miner's helmet lamp — the parts of the mine that follow
 * you around (the mine itself is scenes/CaveScene.js).
 *
 *  - equip a pickaxe: it hangs in your right hand (first person); LMB swings.
 *    Swinging at an ore node in the mine chips it; enough hits and it breaks,
 *    dropping ore. Better picks break harder rock and swing faster.
 *  - the miner's helmet (once you have it) lights the way underground
 *  - ore sells to Old Pete at the assay office (best price), the Quik Mart
 *    register or the harbor
 *  - multiplayer: a broken node is broken for everyone (event 'ore'); the
 *    host's world snapshot carries which nodes are regrowing
 */
export const ORES = {
  coal: { name: 'Coal', value: 2.5, color: 0x26262a, hits: 3, tier: 0 },
  copper: { name: 'Copper Ore', value: 4, color: 0xd07a3a, hits: 4, tier: 0 },
  iron: { name: 'Iron Ore', value: 6.5, color: 0xa86a52, hits: 5, tier: 0 },
  silver: { name: 'Silver Ore', value: 12, color: 0xe0e4ec, hits: 6, tier: 1 },
  gold: { name: 'Gold Nugget', value: 26, color: 0xffc83a, hits: 7, tier: 1, glow: true },
  amethyst: { name: 'Amethyst', value: 18, color: 0xb070ff, hits: 5, tier: 1, glow: true },
  emerald: { name: 'Emerald', value: 38, color: 0x40f090, hits: 7, tier: 2, glow: true },
  diamond: { name: 'Diamond', value: 90, color: 0xc8fbff, hits: 9, tier: 2, glow: true },
};
export const PICKS = {
  pickaxe: { tier: 0, speed: 1, color: 0x9a9a9a },
  pickaxe_steel: { tier: 1, speed: 1.5, color: 0xd0d8e0 },
  pickaxe_diamond: { tier: 2, speed: 2.2, color: 0x8af0ff },
};
const TIER_NAMES = ['an old pickaxe', 'a steel pickaxe', 'a diamond pickaxe'];

export class Mining {
  constructor(game) {
    this.game = game;
    this.swingT = 0;
    this.cool = 0;
    this.lights = [];
    this.lamp = { position: new THREE.Vector3(), color: new THREE.Color(0xfff0d0), range: 11, intensity: 1.25, enabled: true, priority: 7 };
    this.view = new THREE.Group();
    this.view.visible = false;
    game.camera.add(this.view);
    this.viewKey = null;
    game.mp?.on('ore', (e) => game.scenes.Cave?.built && game.scenes.Cave.netBreak(e.i, e.t));
  }

  get pick() {
    return PICKS[this.game.inventory.equipped] ? this.game.inventory.equipped : null;
  }

  update(dt) {
    const g = this.game;
    const pick = this.pick;
    const show = !!pick && !g.vehicle.driving && !g.focus && g.player.enabled;
    // first-person pickaxe model (rebuilt when you switch picks)
    if (show && this.viewKey !== pick) {
      this.view.clear();
      const m = g.assets.model('pickaxe');
      if (m) {
        m.traverse((o) => {
          if (o.isMesh && pick !== 'pickaxe') o.material = g.renderer.material({ color: PICKS[pick].color });
        });
        m.scale.multiplyScalar(0.55);
        m.rotation.set(-0.35, Math.PI / 2, 0); // handle up and away from you, head pointing forward
        this.view.add(m);
      }
      this.viewKey = pick;
    }
    this.view.visible = show;
    this.cool -= dt;
    if (show) {
      this.swingT = Math.max(0, this.swingT - dt * 3.2 * PICKS[pick].speed);
      const s = Math.sin(Math.min(1, this.swingT) * Math.PI);
      const bob = Math.sin(g.player.headBob ?? 0) * 0.01;
      this.view.position.set(0.3 - s * 0.1, -0.42 + s * 0.08 + bob, -0.5 - s * 0.1);
      this.view.rotation.set(0.35 - s * 1.25, 0.15, -0.25 + s * 0.15);
      this.view.scale.x = THREE.MathUtils.clamp(g.camera.aspect / 1.6, 0.45, 1);
      if (g.input.locked && g.input.mousePressed(0) && !g.uiOpen && this.cool <= 0) {
        g.input.consumeMouse(0);
        this.swingT = 1;
        this.cool = 0.55 / PICKS[pick].speed;
        setTimeout(() => this.#strike(), 140 / PICKS[pick].speed);
      }
    }
    // helmet lamp underground
    this.lights.length = 0;
    if (g.scene?.name === 'Cave' && g.inventory.has('miner_helmet')) {
      g.camera.getWorldDirection(_d);
      this.lamp.position.copy(g.camera.position).addScaledVector(_d, 2.2);
      this.lights.push(this.lamp);
    }
  }

  /** The pick lands: did we hit an ore node? */
  #strike() {
    const g = this.game;
    const scene = g.scene;
    const pick = this.pick;
    if (!pick) return;
    if (scene?.name !== 'Cave' || !scene.nodes) {
      this.#clink(0.4);
      return;
    }
    _r.setFromCamera(_c.set(0, 0), g.camera);
    _r.far = 2.8;
    const hits = _r.intersectObjects(scene.nodeMeshes, true);
    if (!hits.length) {
      // hit the wall?
      if (scene.raycastStatic(_r.ray, 2.6) < 2.6) this.#clink(0.5, true);
      return;
    }
    let o = hits[0].object;
    while (o && o.userData.node == null) o = o.parent;
    const node = scene.nodes[o?.userData.node];
    if (!node || node.broken) return;
    const ore = ORES[node.ore];
    const tier = PICKS[pick].tier;
    if (tier < ore.tier) {
      this.#clink(0.6, true);
      g.hud.toast(`Your pick just bounces off. ${ore.name} needs ${TIER_NAMES[ore.tier]} or better (Old Pete sells them).`, 3500);
      return;
    }
    node.hp -= 1 + tier * 0.5;
    this.#clink(1);
    scene.sparks(hits[0].point, ore.color);
    g.camera.userData.shake = 0.04;
    scene.chip(node);
    if (node.hp <= 0) {
      const n = 1 + Math.floor(Math.random() * (ore.tier >= 2 ? 1.6 : 3)) + (tier >= 2 && Math.random() < 0.4 ? 1 : 0);
      g.inventory.add(`ore_${node.ore}`, n);
      g.hud.toast(`+${n} ${ore.name}${n > 1 ? 's' : ''} (≈ $${(ore.value * n).toFixed(2)})${ore.tier >= 2 ? ' — oh, that’s pretty.' : ''}`, 3000);
      scene.breakNode(node);
      g.net?.online && g.net.event('ore', { i: node.i, t: node.respawn });
    }
  }

  /** Metal on rock, with a little cave echo. */
  #clink(k = 1, dull = false) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.35 * k;
    const echo = ctx.createDelay(1);
    echo.delayTime.value = this.game.scene?.name === 'Cave' ? 0.18 : 0.05;
    const fb = ctx.createGain();
    fb.gain.value = this.game.scene?.name === 'Cave' ? 0.35 : 0.1;
    out.connect(this.game.audio.master);
    out.connect(echo);
    echo.connect(fb).connect(echo);
    echo.connect(this.game.audio.master);
    for (const [f, v] of dull ? [[300, 0.5], [620, 0.2]] : [[1900 + Math.random() * 400, 0.4], [3100, 0.2], [700, 0.35]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(v, t);
      e.gain.exponentialRampToValueAtTime(0.001, t + (dull ? 0.12 : 0.35));
      o.connect(e).connect(out);
      o.start(t);
      o.stop(t + 0.4);
    }
    const n = this.game.audio.noiseSource(false);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.4, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(hp).connect(e).connect(out);
    n.start(t);
    n.stop(t + 0.1);
    setTimeout(() => out.disconnect(), 2500);
  }
}

const _d = new THREE.Vector3();
const _r = new THREE.Raycaster();
const _c = new THREE.Vector2();
