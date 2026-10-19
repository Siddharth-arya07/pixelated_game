import * as THREE from 'three';

/**
 * Camping — pitch a tent anywhere outside
 * ---------------------------------------
 * Buy a tent at the Quik Mart (outdoor aisle) and use it from the inventory
 * anywhere in the World: it goes up a few metres ahead of you with a little
 * campfire. Sleep in it for a different dream (stars and giant fireflies),
 * and wake up at the tent at dawn — mist on the ground, birds going off.
 * "Pack up the tent" puts it back in your bag. Friends see your camp.
 */
export class Camping {
  constructor(game) {
    this.game = game;
    this.camp = null;
    this.remote = new Map();
    game.mp?.on('tent', (e, id) => this.#remote(e, id));
  }

  pitch() {
    const g = this.game;
    const W = g.scenes.World;
    if (g.scene !== W) return g.hud.toast('Tents go outside. Somewhere with stars.');
    if (g.vehicle.driving) return;
    if (this.camp) this.#pack(true);
    const fwd = g.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const p = g.player.feet.clone().addScaledVector(fwd, 3.5);
    p.y = W.groundHeight(p.x, p.z);
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    this.camp = this.#build(W, p, yaw, true);
    g.inventory.remove('tent');
    g.closeUI();
    g.hud.toast('Tent up. A little fire going. Sleep in it whenever you like.', 4000);
    g.net?.online && g.net.event('tent', { on: 1, p: p.toArray(), yaw });
  }

  #build(W, p, yaw, mine) {
    const g = this.game;
    const grp = new THREE.Group();
    const tent = g.assets.model('tent');
    if (tent) grp.add(tent);
    else {
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.5, 4), W.mat({ color: 0xd06a2a }));
      t.position.y = 0.75;
      t.rotation.y = Math.PI / 4;
      grp.add(t);
    }
    const fire = g.assets.model('campfire');
    if (fire) {
      fire.position.set(0, 0, 2.2);
      grp.add(fire);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), W.mat({ color: 0xff8a2a, unlit: true, opacity: 0.85, additive: true }));
    flame.position.set(0, 0.35, 2.2);
    grp.add(flame);
    grp.position.copy(p);
    grp.rotation.y = yaw + Math.PI;
    W.root.add(grp);
    const firePos = new THREE.Vector3(0, 0.5, 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw + Math.PI).add(p);
    const light = W.addLight({ position: firePos.toArray(), color: 0xff9040, range: 9, intensity: 1.3, flicker: 0.3 });
    const c = { grp, light, flame, p: p.clone(), yaw };
    if (mine) {
      W.addSpawn('tent', [firePos.x, p.y, firePos.z], yaw);
      W.addInteractable(grp, {
        prompt: 'Sleep in the tent',
        range: 3,
        action: () => this.#sleep(),
        secondary: () => ({ label: 'Pack up the tent', action: () => this.#pack() }),
      });
    }
    return c;
  }

  #pack(silent = false) {
    const g = this.game;
    const W = g.scenes.World;
    const c = this.camp;
    if (!c) return;
    c.grp.removeFromParent();
    W.lights = W.lights.filter((l) => l !== c.light);
    W.interactables = W.interactables.filter((o) => o !== c.grp);
    this.camp = null;
    g.inventory.add('tent');
    if (!silent) g.hud.toast('Packed up. Leave no trace.', 2000);
    g.net?.online && g.net.event('tent', { on: 0 });
  }

  async #sleep() {
    const g = this.game;
    g.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 1400));
    g.dreamWake = 'tent';
    await g.changeScene('Dream', 'default');
    g.fade.classList.remove('on');
  }

  /** Waking up at the tent: mist and birdsong. */
  morning() {
    const g = this.game;
    g.hud.toast('You crawl out of the tent. Dawn. Mist lying on the grass, and every bird in the county is awake.', 6000);
    this.mistT = 90;
    this.#birds();
  }

  #birds() {
    const ctx = this.game.audio.ctx;
    const t0 = ctx.currentTime;
    for (let k = 0; k < 40; k++) {
      const t = t0 + Math.random() * 20;
      const o = ctx.createOscillator();
      const f = 2200 + Math.random() * 2400;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.4 : 0.7), t + 0.12);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.03, t + 0.02);
      e.gain.exponentialRampToValueAtTime(0.0005, t + 0.15);
      o.connect(e).connect(this.game.audio.master);
      o.start(t);
      o.stop(t + 0.2);
    }
  }

  #remote(e, id) {
    const W = this.game.scenes.World;
    if (!W?.built) return;
    this.remote.get(id)?.grp.removeFromParent();
    this.remote.delete(id);
    if (e.on) this.remote.set(id, this.#build(W, new THREE.Vector3(...e.p), e.yaw, false));
  }

  update(dt) {
    const g = this.game;
    const t = g.time;
    for (const c of [this.camp, ...this.remote.values()]) if (c) c.flame.scale.set(1 + Math.sin(t * 11) * 0.15, 1 + Math.sin(t * 14) * 0.25, 1);
    if (this.mistT > 0) {
      this.mistT -= dt;
      // morning mist lying on the ground for a while
      g.scenes.World.groundFog = this.mistT > 0 ? 0.3 + Math.min(1, this.mistT / 20) * 1.1 : undefined;
    }
  }
}
