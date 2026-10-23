import * as THREE from 'three';
import { Hand, POSES } from './Hand.js';
import { Animator } from './Animator.js';
import { ROUNDS, SLOTS } from './Rules.js';

/**
 * Table
 * -----
 * Everything you can see on the roulette table, and the choreography that
 * moves it: the shotgun (body / sliding forend / saw-able barrel), shells,
 * the nine items, the two players' white hands, the dealer's white hands
 * (just hands, floating at the end of the table: nobody attached), the
 * charge displays, blood.
 *
 * Coordinates: `T` sits at the table centre on the floor. Each seat group is
 * a child of T turned so the player sits at +Z looking down -Z; every pose
 * below is written in that "seat space", so one choreography works for both
 * chairs and looks right from both sides of the table.
 *
 * Both clients play the same effect records (see Rules.apply), so what one
 * player sees the other sees too, just from the other chair.
 */
const PI = Math.PI;
export const TOP = 0.78; // table surface
export const EYE = new THREE.Vector3(0, 1.2, 1.0); // seated eye, seat space (leaning in)
const K = 1.4; // hands are chunky, like the old games
const MOUTH = [0.0, 1.03, 0.8]; // just under your chin, where you can see it
const HAND_REST = {
  r: { p: [0.19, TOP + 0.04, 0.6], r: [-0.08, 0.3, 0] },
  l: { p: [-0.19, TOP + 0.04, 0.6], r: [-0.08, -0.3, 0] },
};
const DEALER_REST = {
  r: { p: [0.2, TOP + 0.18, 0.04], r: [-0.25, 0.2, 0] },
  l: { p: [-0.2, TOP + 0.18, 0.04], r: [-0.25, -0.2, 0] },
};
const GUN_HOLD = { p: [0.03, 0.99, 0.45], r: [-0.06, 0, 0] };
const GUN_AIM_OPP = { p: [0.02, 1.08, 0.42], r: [0.07, 0, 0] };
const GUN_AIM_SELF = { p: [0, 0.98, 0.27], r: [0.3, PI, 0] };
const DISPLAY = [0, TOP, 0.3];

/** The eight item slots (seat space): four left of you, four right. */
export function slotPos(i) {
  const k = i % 4;
  const x = (k % 2 === 0 ? 0.53 : 0.39) * (i < 4 ? -1 : 1);
  return new THREE.Vector3(x, TOP, k < 2 ? 0.5 : 0.3);
}

export class Table {
  constructor(scene, center, { ui }) {
    this.scene = scene;
    this.game = scene.game;
    this.ui = ui; // { msg, priv, hurt(dmg), shake(k), mine(p), name(p) }
    this.anim = new Animator();
    this.T = new THREE.Group();
    this.T.position.copy(center);
    scene.root.add(this.T);
    this.seats = [0, 1].map((p) => {
      const g = new THREE.Group();
      g.rotation.y = p === 0 ? 0 : PI;
      this.T.add(g);
      return g;
    });
    this.dealer = new THREE.Group();
    this.dealer.position.set(1.0, 0, 0);
    this.dealer.rotation.y = PI / 2;
    this.T.add(this.dealer);
    this.items = [Array(SLOTS).fill(null), Array(SLOTS).fill(null)];
    this.debris = [];
    this.blood = [];
    this.bloodDecals = [];
    this.loose = []; // shells shown on the table
    this.held = -1; // seat whose player is holding the gun, choosing
    this.slump = [0, 0];
    this.cuffed = [false, false];
    this.#furniture();
    this.#gun();
    this.#hands();
    this.#displays();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  #furniture() {
    const s = this.scene;
    const felt = s.mat({ map: feltTexture(), color: 0xffffff });
    const wood = s.mat({ map: s.tex('planks', 1, 1), color: 0x4a3222 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 1.5), felt);
    top.position.y = TOP - 0.025;
    this.T.add(top);
    const rim = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), wood);
      m.position.set(x, TOP - 0.02, z);
      this.T.add(m);
    };
    rim(1.38, 0.05, 0, 0.77);
    rim(1.38, 0.05, 0, -0.77);
    rim(0.05, 1.5, 0.67, 0);
    rim(0.05, 1.5, -0.67, 0);
    for (const [x, z] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.7], [0.6, 0.7]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, TOP - 0.05, 0.07), wood);
      leg.position.set(x, (TOP - 0.05) / 2, z);
      this.T.add(leg);
    }
    const wp = this.T.position;
    s.addColliderBox(wp.x, wp.y + TOP / 2, wp.z, 1.38, TOP, 1.6);
    // chairs
    for (const p of [0, 1]) {
      const seat = this.seats[p];
      const ch = s.place('chair', { parent: seat, x: 0, z: 1.12, rotY: PI });
      if (!ch) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), wood);
        m.position.set(0, 0.22, 1.12);
        seat.add(m);
      }
    }
    // dealer's side: an item crate and the round lamps on a little stand
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.22), s.mat({ color: 0x2a2420 }));
    crate.position.set(0, TOP + 0.04, 0.12);
    this.dealer.add(crate);
    this.roundCanvas = document.createElement('canvas');
    this.roundCanvas.width = 128;
    this.roundCanvas.height = 40;
    this.roundTex = new THREE.CanvasTexture(this.roundCanvas);
    this.roundTex.userData.live = true;
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), s.mat({ map: this.roundTex, unlit: true, affine: 0 }));
    lamp.position.set(0, TOP + 0.55, 0.3);
    lamp.rotation.y = PI;
    this.dealer.add(lamp);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.17, 0.03), s.mat({ color: 0x18161a }));
    back.position.set(0, TOP + 0.55, 0.32);
    this.dealer.add(back);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.03, TOP + 0.47, 0.03), s.mat({ color: 0x18161a }));
    pole.position.set(0, (TOP + 0.47) / 2, 0.34);
    this.dealer.add(pole);
    this.setRound(-1, [0, 0]);
    // the ashtray
    s.place('br_ashtray', { parent: this.T, x: -0.42, y: TOP, z: 0.02 });
  }

  setRound(round, wins) {
    const c = this.roundCanvas.getContext('2d');
    c.fillStyle = '#0a0808';
    c.fillRect(0, 0, 128, 40);
    for (let i = 0; i < 3; i++) {
      const on = i === round;
      const won = i < round;
      c.fillStyle = on ? '#ff3a2a' : won ? '#6a2a20' : '#2a1a18';
      c.beginPath();
      c.arc(26 + i * 38, 20, 11, 0, PI * 2);
      c.fill();
      c.fillStyle = on ? '#fff0e0' : '#5a4a40';
      c.font = 'bold 12px monospace';
      c.textAlign = 'center';
      c.fillText(['I', 'II', 'III'][i], 26 + i * 38, 24);
    }
    void wins;
    this.roundTex.needsUpdate = true;
  }

  #gun() {
    const g = new THREE.Group();
    g.name = 'br_gun';
    const m = this.game.assets.model('br_gun');
    this.gun = g;
    if (!m) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.9), this.scene.mat({ color: 0x2a2a2a }));
      b.position.z = -0.2;
      g.add(b);
      this.parts = { muzzleZ: -0.62, foreZ: -0.3, frontZ: -0.05, port: new THREE.Vector3(0, -0.035, 0.02), eject: new THREE.Vector3(0.035, 0.015, 0) };
      this.forend = new THREE.Group();
      g.add(this.forend);
      this.#restGun();
      return;
    }
    g.add(m);
    g.updateMatrixWorld(true);
    const box = (o) => new THREE.Box3().setFromObject(o);
    const body = m.getObjectByName('Body');
    const barrel = m.getObjectByName('Barrel');
    const forend = m.getObjectByName('Forend');
    // muzzle toward -Z
    if (box(barrel).getCenter(new THREE.Vector3()).z > box(body).getCenter(new THREE.Vector3()).z) m.rotation.y = PI;
    g.updateMatrixWorld(true);
    const bb = box(body);
    const brl = box(barrel);
    const frontZ = bb.min.z; // receiver front
    const len = bb.max.z - brl.min.z;
    // the grip / trigger becomes the gun's origin
    const grip = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y + (bb.max.y - bb.min.y) * 0.42, frontZ + len * 0.14);
    m.position.sub(grip);
    g.updateMatrixWorld(true);
    const bb2 = box(body);
    const brl2 = box(barrel);
    const fb = forend ? box(forend) : null;
    const recvTop = bb2.max.y;
    this.parts = {
      muzzleZ: brl2.min.z,
      frontZ: bb2.min.z,
      foreZ: fb ? (fb.min.z + fb.max.z) / 2 : bb2.min.z - 0.2,
      barrelY: (brl2.min.y + brl2.max.y) / 2,
      port: new THREE.Vector3(0, bb2.min.y + 0.02, bb2.min.z + 0.07),
      eject: new THREE.Vector3(0.03, recvTop - 0.03, bb2.min.z + 0.06),
    };
    // forend slides along Z inside its own group
    this.forend = new THREE.Group();
    g.add(this.forend);
    if (forend) this.forend.attach(forend);
    // sawn-off barrel: a second geometry with everything past the cut pulled
    // back to the cut, plus the cut-off tip as its own mesh
    if (barrel?.isMesh) {
      const cut = this.parts.muzzleZ + (this.parts.frontZ - this.parts.muzzleZ) * 0.42;
      this.parts.cutZ = cut;
      const M = new THREE.Matrix4().copy(g.matrixWorld).invert().multiply(barrel.matrixWorld);
      const Mi = M.clone().invert();
      const clampGeo = (keepFront) => {
        const geo = barrel.geometry.clone();
        const pos = geo.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(M);
          if (keepFront ? v.z > cut : v.z < cut) v.z = cut;
          v.applyMatrix4(Mi);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        geo.computeVertexNormals();
        return geo;
      };
      this.barrel = barrel;
      this.barrelFull = barrel.geometry;
      this.barrelSawn = clampGeo(false);
      this.tip = new THREE.Mesh(clampGeo(true), barrel.material);
      this.tip.visible = false;
      barrel.parent.add(this.tip);
      this.tip.position.copy(barrel.position);
      this.tip.quaternion.copy(barrel.quaternion);
      this.tip.scale.copy(barrel.scale);
      this.tipHome = { parent: barrel.parent, p: barrel.position.clone(), q: barrel.quaternion.clone(), s: barrel.scale.clone() };
    }
    g.traverse((o) => o.isMesh && (o.frustumCulled = false));
    // muzzle flash
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), this.scene.mat({ map: flashTexture(), unlit: true, additive: true, doubleSide: true }));
    this.flash.position.set(0, this.parts.barrelY ?? 0.02, this.parts.muzzleZ - 0.12);
    this.flash.visible = false;
    g.add(this.flash);
    this.flash2 = this.flash.clone();
    this.flash2.rotation.y = PI / 2;
    this.flash.add(this.flash2);
    this.flashLight = this.scene.addLight({ position: new THREE.Vector3(), color: 0xffc070, range: 7, intensity: 0, enabled: false });
    this.#restGun();
  }

  #restGun() {
    this.T.add(this.gun);
    this.gun.position.set(-0.12, TOP + 0.035, 0);
    this.gun.quaternion.setFromEuler(new THREE.Euler(0, -PI / 2, PI / 2, 'YXZ'));
  }

  #hands() {
    const g = this.game;
    this.H = [0, 1].map((p) => {
      const h = { l: new Hand(g, 'l', { color: 0xece6dc, scale: K }), r: new Hand(g, 'r', { color: 0xece6dc, scale: K }) };
      for (const side of ['l', 'r']) {
        this.seats[p].add(h[side].root);
        this.#place(h[side].root, HAND_REST[side]);
        h[side].pose('rest');
      }
      return h;
    });
    this.D = { l: new Hand(g, 'l', { color: 0xffffff, scale: K * 1.12 }), r: new Hand(g, 'r', { color: 0xffffff, scale: K * 1.12 }) };
    for (const side of ['l', 'r']) {
      this.dealer.add(this.D[side].root);
      this.#place(this.D[side].root, DEALER_REST[side]);
      this.D[side].pose('limp');
    }
  }

  #place(obj, { p, r }) {
    obj.position.set(...p);
    obj.quaternion.setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ'));
  }

  #displays() {
    this.disp = [0, 1].map((p) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 56;
      const tex = new THREE.CanvasTexture(c);
      tex.userData.live = true;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), this.scene.mat({ color: 0x3a3a34 }));
      box.position.set(DISPLAY[0], DISPLAY[1] + 0.03, DISPLAY[2]);
      this.seats[p].add(box);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.075), this.scene.mat({ map: tex, unlit: true, affine: 0 }));
      scr.position.set(0, 0.035, 0.012);
      scr.rotation.x = -1.05;
      box.add(scr);
      // little paddles either side
      for (const sx of [-1, 1]) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.06), this.scene.mat({ color: 0xc0b8a0 }));
        pad.position.set(sx * 0.13, 0.0, 0);
        box.add(pad);
      }
      return { c, tex, hp: 0, max: 0, cut: false, name: '' };
    });
  }

  drawDisplay(p, { hp, max, name, cut } = {}) {
    const d = this.disp[p];
    if (hp !== undefined) d.hp = hp;
    if (max !== undefined) d.max = max;
    if (name !== undefined) d.name = name;
    if (cut !== undefined) d.cut = cut;
    const c = d.c.getContext('2d');
    c.fillStyle = '#0a1a0c';
    c.fillRect(0, 0, 128, 56);
    c.fillStyle = '#5aff7a';
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    c.fillText((d.name || '').toUpperCase().slice(0, 12), 6, 16);
    for (let i = 0; i < d.max; i++) {
      const on = i < d.hp;
      c.fillStyle = on ? (d.cut ? '#ffd040' : '#5aff7a') : '#1a3a20';
      const x = 8 + i * 19;
      c.beginPath();
      c.moveTo(x + 9, 22);
      c.lineTo(x + 3, 36);
      c.lineTo(x + 8, 36);
      c.lineTo(x + 5, 50);
      c.lineTo(x + 14, 32);
      c.lineTo(x + 9, 32);
      c.lineTo(x + 13, 22);
      c.fill();
    }
    if (d.cut) {
      c.fillStyle = '#ff4040';
      c.font = 'bold 10px monospace';
      c.fillText('NO DEFIB', 72, 16);
    }
    d.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Items and shells
  // ---------------------------------------------------------------------------

  makeItem(item) {
    const s = this.scene;
    const g = new THREE.Group();
    g.userData.item = item;
    const add = (key, fit, rot = [0, 0, 0], y = 0) => {
      const m = s.assets.model(key);
      if (!m) return false;
      m.rotation.set(...rot);
      g.add(m);
      m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m);
      const sz = b.getSize(new THREE.Vector3());
      const k = fit / Math.max(sz.x, sz.y, sz.z, 1e-4);
      m.scale.multiplyScalar(k);
      m.updateMatrixWorld(true);
      b.setFromObject(m);
      const c = b.getCenter(new THREE.Vector3());
      m.position.x -= c.x;
      m.position.z -= c.z;
      m.position.y -= b.min.y - y;
      return true;
    };
    const metal = s.mat({ color: 0xa8acb0 });
    switch (item) {
      case 'magnifier':
        add('br_magnifier', 0.17, [0, 0, PI / 2]);
        break;
      case 'beer':
        add('br_beer', 0.12);
        break;
      case 'cigarettes':
        add('br_cigs', 0.09);
        break;
      case 'saw':
        add('br_saw', 0.36, [0, 0, PI / 2]);
        break;
      case 'phone':
        add('br_phone', 0.1, [-PI / 2, 0, 0]);
        break;
      case 'meds':
        add('br_pills', 0.09);
        break;
      case 'adrenaline':
        add('br_syringe', 0.14, [0, 0, PI / 2]);
        break;
      case 'handcuffs': {
        for (const sx of [-1, 1]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 5, 12), metal);
          ring.rotation.x = PI / 2;
          ring.position.set(sx * 0.045, 0.007, 0);
          g.add(ring);
        }
        for (let i = 0; i < 3; i++) {
          const link = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.002, 3, 6), metal);
          link.position.set(-0.012 + i * 0.012, 0.006, 0);
          link.rotation.y = i % 2 ? PI / 2 : 0;
          g.add(link);
        }
        break;
      }
      case 'inverter': {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), s.mat({ color: 0x1a1a1e }));
        b.position.y = 0.015;
        g.add(b);
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 8), s.mat({ color: 0xd02020, unlit: true }));
        btn.position.set(0.015, 0.033, 0);
        g.add(btn);
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.02), s.mat({ map: labelTexture('+/−'), unlit: true }));
        lbl.rotation.x = -PI / 2;
        lbl.position.set(-0.015, 0.031, 0);
        g.add(lbl);
        g.userData.button = btn;
        break;
      }
      default:
        break;
    }
    if (!g.children.length) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), s.mat({ color: 0x8a8a8a }));
      b.position.y = 0.03;
      g.add(b);
    }
    g.traverse((o) => o.isMesh && (o.frustumCulled = false));
    return g;
  }

  makeShell(live) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.056, 8), this.scene.mat({ color: live ? 0xb81818 : 0x2a50c0 }));
    hull.position.y = 0.035;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0112, 0.0112, 0.014, 8), this.scene.mat({ color: 0xc8a040 }));
    base.position.y = 0.007;
    g.add(hull, base);
    g.userData.live = live;
    return g;
  }

  /** Put the table straight into a state (late join / resync): no animation. */
  layout(rules, names) {
    this.anim.flush();
    this.#clearItems();
    this.#clearShells(true);
    this.#restGun();
    this.#restoreBarrel();
    for (const p of [0, 1]) {
      for (const side of ['l', 'r']) {
        this.seats[p].add(this.H[p][side].root);
        this.#place(this.H[p][side].root, HAND_REST[side]);
        this.H[p][side].pose('rest');
      }
      rules.items[p].forEach((it, i) => it && this.#putItem(p, i, it));
      this.drawDisplay(p, { hp: rules.hp[p], max: rules.max, name: names[p], cut: rules.wiresCut(p) });
      this.slump[p] = rules.hp[p] <= 0 ? 1 : 0;
    }
    this.cuffed = [rules.cuffs[0] > 0, rules.cuffs[1] > 0];
    this.#cuffsLayout();
    this.setRound(rules.round, rules.wins);
  }

  #putItem(p, i, item) {
    const o = this.makeItem(item);
    o.position.copy(slotPos(i));
    o.rotation.y = (i * 1.7) % 0.6 - 0.3;
    this.seats[p].add(o);
    this.items[p][i] = o;
    return o;
  }

  #clearItems() {
    for (const p of [0, 1]) {
      for (const o of this.items[p]) o?.removeFromParent();
      this.items[p] = Array(SLOTS).fill(null);
    }
  }

  #clearShells(all) {
    for (const s of this.loose) s.removeFromParent();
    this.loose = [];
    if (all) {
      for (const d of this.debris) d.obj.removeFromParent();
      this.debris = [];
    }
  }

  reset() {
    this.anim.flush();
    this.#clearItems();
    this.#clearShells(true);
    this.#restGun();
    this.#restoreBarrel();
    this.clearBlood();
    for (const p of [0, 1]) {
      this.drawDisplay(p, { hp: 0, max: 0, name: '', cut: false });
      this.slump[p] = 0;
      for (const side of ['l', 'r']) {
        this.seats[p].add(this.H[p][side].root);
        this.#place(this.H[p][side].root, HAND_REST[side]);
        this.H[p][side].pose('rest');
      }
    }
    this.cuffed = [false, false];
    this.#cuffsLayout();
    this.setRound(-1, [0, 0]);
  }

  // ---------------------------------------------------------------------------
  // Small motion helpers
  // ---------------------------------------------------------------------------

  /** World → local of an object's parent. */
  #local(parent, v) {
    return parent.worldToLocal(v.clone());
  }

  #wpos(o, local = null) {
    return local ? o.localToWorld(local.clone()) : o.getWorldPosition(new THREE.Vector3());
  }

  #sfx(key, opts = {}) {
    this.game.audio.oneShot(key, { object: this.T, ...opts });
  }

  /**
   * Move a (seat-parented) hand so its fingertips reach a world point.
   * Fingers point down-forward; `lift` raises the wrist above the target.
   */
  #reachTo(hand, world, dur, { lift = 0.06, back = 0.11, pitch = -0.55, yaw = 0, ease = 'inOut' } = {}) {
    back *= K;
    lift *= K;
    const parent = hand.root.parent;
    const t = this.#local(parent, world);
    // "back" is toward the hand's owner: +Z in seat space (dealer space too)
    return this.anim.to(hand.root, { p: [t.x, t.y + lift, t.z + back], r: [pitch, yaw, 0] }, dur, ease);
  }

  /** Hold an object at the fingertips. */
  #grab(hand, obj, at = [0, -0.035 * K, -0.135 * K]) {
    hand.root.attach(obj);
    return this.anim.to(obj, { p: at }, 0.12);
  }

  async #handHome(p, side, dur = 0.35) {
    const h = this.H[p][side];
    if (h.root.parent !== this.seats[p]) this.seats[p].attach(h.root);
    if (this.cuffed[p]) return this.#cuffPose(p, dur);
    this.anim.curl(h, 'rest', dur, POSES);
    await this.anim.to(h.root, HAND_REST[side], dur);
  }

  async #dealerHome(side, dur = 0.4) {
    const h = this.D[side];
    if (h.root.parent !== this.dealer) this.dealer.attach(h.root);
    this.anim.curl(h, 'limp', dur, POSES);
    await this.anim.to(h.root, DEALER_REST[side], dur);
  }

  /** Fade an object out and remove it. */
  async #vanish(obj, dur = 0.35) {
    await this.anim.to(obj, { s: 0.001 }, dur, 'in');
    obj.removeFromParent();
  }

  #gunPose(parent, pose, dur, ease = 'inOut') {
    if (this.gun.parent !== parent) parent.attach(this.gun);
    return this.anim.to(this.gun, pose, dur, ease);
  }

  // ---------------------------------------------------------------------------
  // Choreography
  // ---------------------------------------------------------------------------

  /** Pick the gun up off the table with both hands. */
  async #pickUp(p, holders = this.H[p], parent = this.seats[p], pose = GUN_HOLD) {
    const { l, r } = holders;
    const grip = this.#wpos(this.gun, new THREE.Vector3(0, 0, 0.1));
    const fore = this.#wpos(this.gun, new THREE.Vector3(0, 0, this.parts.foreZ));
    this.anim.curl(r, 'claw', 0.25, POSES);
    this.anim.curl(l, 'claw', 0.25, POSES);
    await Promise.all([this.#reachTo(r, grip, 0.38, { lift: 0.05 }), this.#reachTo(l, fore, 0.42, { lift: 0.05 })]);
    // lock onto the gun, then the gun (and hands) come up
    this.gun.attach(r.root);
    this.gun.attach(l.root);
    this.anim.to(r.root, gripR(), 0.18);
    this.anim.to(l.root, foreL(this.parts), 0.18);
    this.anim.curl(r, 'trigger', 0.18, POSES);
    await this.anim.curl(l, 'grip', 0.18, POSES);
    this.#sfx('door', { volume: 0.12, rate: 2.4 });
    await this.#gunPose(parent, pose, 0.5);
  }

  /** Put the gun back down on the table centre; hands go home. */
  async #putDown(p, holders = this.H[p], dealer = false) {
    const pose = { p: [-0.12, TOP + 0.035, 0], r: [0, -PI / 2, PI / 2] };
    await this.#gunPose(this.T, pose, 0.5);
    this.#sfx('thud', { volume: 0.25 });
    this.#restoreBarrel();
    if (dealer) await Promise.all([this.#dealerHome('l'), this.#dealerHome('r')]);
    else await Promise.all([this.#handHome(p, 'l'), this.#handHome(p, 'r')]);
  }

  /** Work the pump; optionally throw a shell out of the ejection port. */
  async #rack(holders, shell = null) {
    const l = holders.l;
    const back = 0.075;
    const fz = this.forend.position.z;
    const lz = l.root.position.z;
    this.#sfx('rack', { volume: 0.7 });
    await Promise.all([this.anim.to(this.forend, { p: [0, 0, fz + back] }, 0.13, 'out'), this.anim.to(l.root, { p: [l.root.position.x, l.root.position.y, lz + back] }, 0.13, 'out')]);
    if (shell !== null) this.#eject(shell);
    await Promise.all([this.anim.to(this.forend, { p: [0, 0, fz] }, 0.13, 'out'), this.anim.to(l.root, { p: [l.root.position.x, l.root.position.y, lz] }, 0.13, 'out')]);
  }

  /** A spent/ejected shell spins out of the port and rattles onto the table. */
  #eject(live) {
    const s = this.makeShell(live);
    const from = this.#wpos(this.gun, this.parts.eject);
    this.T.add(s);
    s.position.copy(this.#local(this.T, from));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.gun.getWorldQuaternion(new THREE.Quaternion()));
    const v = right.multiplyScalar(1.1).add(new THREE.Vector3(0, 1.4, 0));
    // into table space
    const tq = this.T.getWorldQuaternion(new THREE.Quaternion()).invert();
    v.applyQuaternion(tq);
    s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.debris.push({ obj: s, v, w: new THREE.Vector3(9 + Math.random() * 6, 4, 7), rest: false, sound: true, r: 0.012 });
  }

  /** Dealer: show the shells, load them, rack, deal the items. */
  async load(fx, rules) {
    const D = this.D;
    this.ui.msg(`${fx.live} LIVE · ${fx.blank} BLANK`, 3200, 'load');
    // dealer takes the gun to the end of the table, upside down
    await this.#pickUp(-1, D, this.dealer, { p: [0, TOP + 0.22, -0.18], r: [0.15, PI, PI] });
    // the shells stand up in a row in the middle of the table
    const shells = [];
    const n = fx.total;
    for (let i = 0; i < n; i++) {
      const s = this.makeShell(i < fx.live);
      s.position.set(-0.06 * (n - 1) / 2 + i * 0.06, TOP, 0);
      s.scale.setScalar(0.001);
      this.T.add(s);
      shells.push(s);
      this.loose.push(s);
      this.anim.to(s, { s: 1 }, 0.18, 'outBack');
      this.#sfx('shell_drop', { volume: 0.35, rate: 0.9 + Math.random() * 0.3 });
      await this.anim.wait(0.09);
    }
    await this.anim.wait(1.9);
    // shuffle them behind the dealer's hand (we never learn the order)
    D.l.root.parent !== this.dealer && this.dealer.attach(D.l.root);
    this.#sfx('rattle', { volume: 0.3 });
    await Promise.all(shells.map((s, i) => this.anim.to(s, { p: [((i * 7) % n) * 0.012 - 0.04, TOP, 0.02 * ((i * 3) % 3) - 0.02] }, 0.35)));
    // the left hand feeds them into the loading port one by one
    this.gun.attach(D.r.root);
    for (const s of shells) {
      const l = D.l;
      if (l.root.parent !== this.dealer) this.dealer.attach(l.root);
      this.anim.curl(l, 'pinch', 0.12, POSES);
      await this.#reachTo(l, this.#wpos(s), 0.2, { lift: 0.05, back: 0.1 });
      this.#grab(l, s, [0, -0.03 * K, -0.12 * K]);
      const port = this.#wpos(this.gun, this.parts.port);
      await this.#reachTo(l, port, 0.2, { lift: 0.09, back: 0.08, pitch: -0.9 });
      this.#sfx('shell_in', { volume: 0.6, rate: 0.9 + Math.random() * 0.2 });
      await this.anim.to(s, { p: [0, -0.06, -0.14], s: 0.6 }, 0.08);
      s.removeFromParent();
      this.loose = this.loose.filter((x) => x !== s);
    }
    // grip the forend and rack it
    this.gun.attach(D.l.root);
    this.anim.to(D.l.root, foreL(this.parts), 0.2);
    await this.anim.curl(D.l, 'grip', 0.2, POSES);
    await this.#rack(D);
    // the gun goes back to the centre of the table
    await this.anim.to(this.gun, { p: [0, TOP + 0.2, -0.3], r: [0, PI, 0] }, 0.35);
    await this.#putDown(-1, D, true);
    // deal the items: right hand serves the far chair, left hand the near one
    if (fx.deal[0].length || fx.deal[1].length) {
      this.ui.msg('ITEMS', 1400);
      await Promise.all([this.#deal(1, fx.deal[1], D.r, 'r'), this.#deal(0, fx.deal[0], D.l, 'l')]);
    }
    void rules;
  }

  async #deal(p, list, hand, side) {
    for (const { slot, item } of list) {
      const o = this.makeItem(item);
      // out of the crate
      this.dealer.add(o);
      o.position.set(side === 'r' ? 0.08 : -0.08, TOP + 0.02, 0.12);
      this.anim.curl(hand, 'pinch', 0.15, POSES);
      await this.#reachTo(hand, this.#wpos(o), 0.22, { back: 0.09 });
      this.#grab(hand, o);
      this.#sfx('click', { volume: 0.3 });
      const dst = this.#wpos(this.seats[p], slotPos(slot));
      await this.#reachTo(hand, dst.clone().add(new THREE.Vector3(0, 0.12, 0)), 0.3, { back: 0.09 });
      await this.#reachTo(hand, dst, 0.14, { back: 0.09, lift: 0.04 });
      this.seats[p].attach(o);
      this.anim.to(o, { p: slotPos(slot), r: [0, (slot * 1.7) % 0.6 - 0.3, 0] }, 0.1);
      this.items[p][slot] = o;
      this.#sfx('thud', { volume: 0.08, rate: 1.8 });
      this.anim.curl(hand, 'limp', 0.12, POSES);
      await this.anim.to(hand.root, { p: [hand.root.position.x, hand.root.position.y + 0.08, hand.root.position.z + 0.05] }, 0.12);
    }
    await this.#dealerHome(side, 0.35);
  }

  /** Our own player picked the gun up and is choosing a target (local only). */
  async hold(p) {
    this.held = p;
    await this.#pickUp(p);
  }

  async release(p) {
    await this.#putDown(p);
    this.held = -1;
  }

  /** While choosing: the barrel drifts toward who we're looking at. */
  aimPreview(p, at) {
    if (this.held !== p || this.aimAt === at) return;
    this.aimAt = at;
    this.#gunPose(this.seats[p], at === 'self' ? { p: [0.05, 1.08, 0.36], r: [-0.3, PI / 2, 0.45] } : GUN_HOLD, 0.35);
  }

  /** A shot: pick up, aim, fire, rack, put down. */
  async shoot(fx) {
    const p = fx.p;
    const H = this.H[p];
    if (this.held !== p) await this.#pickUp(p);
    this.held = -1;
    this.aimAt = null;
    const self = fx.at === 'self';
    if (self) {
      // lift and turn it round to face yourself; your eyes follow the barrel
      this.ui.look?.(p, -0.08, 0.9);
      await this.#gunPose(this.seats[p], { p: [0.05, 1.12, 0.3], r: [-0.4, PI / 2, 0.4] }, 0.45);
      await this.#gunPose(this.seats[p], GUN_AIM_SELF, 0.45);
    } else {
      this.ui.look?.(p, -0.12, 0.5);
      await this.#gunPose(this.seats[p], GUN_AIM_OPP, 0.4);
    }
    // the wait
    const shake = this.anim.run(1.1, (k) => {
      this.gun.position.x += Math.sin(this.anim.time * 31) * 0.0007 * (1 - k * 0.5);
    });
    await shake;
    this.anim.curl(H.r, { index: 0.75 }, 0.06, POSES);
    if (fx.live) await this.#fire(fx);
    else {
      this.#sfx('dryfire', { volume: 0.8 });
      await this.anim.to(this.gun, { p: [this.gun.position.x, this.gun.position.y + 0.008, this.gun.position.z] }, 0.06, 'out');
      this.ui.msg('*click*', 1100);
    }
    this.anim.curl(H.r, 'trigger', 0.1, POSES);
    if (!(self && fx.live)) this.ui.look?.(p, -0.42, 0.8);
    if (self && fx.live) {
      // you're out cold: the gun falls to the table and the dealer racks it
      for (const side of ['l', 'r']) {
        const h = H[side];
        this.seats[p].attach(h.root);
        this.anim.curl(h, 'limp', 0.2, POSES);
        this.anim.to(h.root, { p: [side === 'l' ? -0.24 : 0.24, TOP + 0.02, 0.68], r: [0.1, side === 'l' ? -0.6 : 0.6, side === 'l' ? 0.5 : -0.5] }, 0.3, 'in');
      }
      await this.#gunPose(this.T, { p: [-0.05, TOP + 0.035, 0.05], r: [0, -PI / 2 + 0.4, PI / 2] }, 0.3, 'in');
      this.#sfx('thud', { volume: 0.6 });
      await this.anim.wait(0.6);
      await this.#pickUp(-1, this.D, this.dealer, { p: [0, TOP + 0.22, -0.18], r: [0.15, PI, PI] });
      await this.#rack(this.D, true);
      await this.anim.to(this.gun, { p: [0, TOP + 0.2, -0.3], r: [0, PI, 0] }, 0.35);
      await this.#putDown(-1, this.D, true);
      await this.pendingRevive;
      return;
    }
    await this.anim.wait(fx.live ? 0.45 : 0.5);
    if (self) await this.#gunPose(this.seats[p], GUN_HOLD, 0.45);
    else await this.#gunPose(this.seats[p], GUN_HOLD, 0.3);
    await this.#rack(H, fx.live);
    await this.#putDown(p);
    // whoever got hit is back up before anyone moves again
    await this.pendingRevive;
    this.pendingRevive = null;
  }

  async #fire(fx) {
    const g = this.gun;
    // flash, light, sound, kick
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * PI;
    this.flashLight.enabled = true;
    this.flashLight.position.copy(this.#wpos(this.flash));
    this.flashLight.intensity = 3.5;
    this.#sfx('shotgun', { volume: 1 });
    setTimeout(() => (this.flash.visible = false), 70);
    this.anim.num(this.flashLight, 'intensity', 0, 0.25).then(() => (this.flashLight.enabled = false));
    const kickP = g.position.clone().add(new THREE.Vector3(0, 0.04, 0.09).applyQuaternion(g.quaternion));
    const e = new THREE.Euler().setFromQuaternion(g.quaternion, 'YXZ');
    const kick = this.anim.to(g, { p: kickP, r: [e.x + 0.45, e.y, e.z] }, 0.06, 'out');
    this.#smoke(this.#wpos(this.flash), 8);
    // blood
    const tgt = fx.target;
    const head = this.#wpos(this.seats[tgt], new THREE.Vector3(0, 1.2, 1.0));
    const from = this.#wpos(g);
    this.#bloodBurst(head, head.clone().sub(from).normalize(), fx.dmg);
    this.ui.hurt?.(tgt, fx.dmg, fx.hp);
    this.slump[tgt] = 1;
    // the target's hands go limp onto the table
    for (const side of ['l', 'r']) {
      const h = this.H[tgt][side];
      if (h.root.parent !== this.seats[tgt]) continue;
      this.anim.curl(h, 'limp', 0.2, POSES);
      this.anim.to(h.root, { p: [h.root.position.x * 1.3, TOP + 0.02, h.root.position.z + 0.12], r: [0.1, side === 'l' ? -0.6 : 0.6, side === 'l' ? 0.5 : -0.5] }, 0.25, 'in');
    }
    this.drawDisplay(tgt, { hp: fx.hp });
    await kick;
    await this.anim.to(g, { p: g.position.clone().add(new THREE.Vector3(0, -0.04, -0.07).applyQuaternion(g.quaternion)), r: [e.x, e.y, e.z] }, 0.3);
    this.pendingRevive = fx.hp > 0 ? this.#revive(tgt) : null;
  }

  /** Back up after a hit: defibrillator beeps, sit up. */
  async #revive(p, wait = 1.8) {
    await this.anim.wait(wait);
    this.#sfx('defib_charge', { volume: 0.5 });
    await this.anim.wait(0.95);
    this.ui.shock?.(p);
    this.slump[p] = 0;
    await Promise.all(['l', 'r'].filter((s) => this.H[p][s].root.parent === this.seats[p]).map((s) => this.#handHome(p, s, 0.5)));
  }

  async skip(fx) {
    this.ui.msg(`${this.ui.name(fx.p)} is cuffed. Turn skipped.`, 2200);
    const H = this.H[fx.p];
    // they tug at the cuffs
    for (let i = 0; i < 2; i++) {
      this.#sfx('cuffs', { volume: 0.25 });
      await Promise.all(['l', 'r'].map((s) => this.anim.to(H[s].root, { p: [H[s].root.position.x * 1.6, H[s].root.position.y, H[s].root.position.z] }, 0.12, 'out')));
      await this.#cuffPose(fx.p, 0.15);
    }
  }

  async uncuff(fx) {
    this.cuffed[fx.p] = false;
    this.#sfx('cuffs_break', { volume: 0.5 });
    const c = this.cuffObj?.[fx.p];
    if (c) {
      this.T.attach(c);
      this.debris.push({ obj: c, v: new THREE.Vector3(0, 0.6, 0), w: new THREE.Vector3(2, 1, 0), rest: false, r: 0.005, fade: 2 });
      this.cuffObj[fx.p] = null;
    }
    await Promise.all([this.#handHome(fx.p, 'l'), this.#handHome(fx.p, 'r')]);
  }

  #cuffPose(p, dur = 0.3) {
    const H = this.H[p];
    this.anim.curl(H.l, 'limp', dur, POSES);
    this.anim.curl(H.r, 'limp', dur, POSES);
    return Promise.all([
      this.anim.to(H.l.root, { p: [-0.05, TOP + 0.045, 0.5], r: [-0.1, -1.2, 0.3] }, dur),
      this.anim.to(H.r.root, { p: [0.05, TOP + 0.045, 0.5], r: [-0.1, 1.2, -0.3] }, dur),
    ]);
  }

  #cuffsLayout() {
    this.cuffObj ??= [null, null];
    for (const p of [0, 1]) {
      if (this.cuffed[p] && !this.cuffObj[p]) {
        const c = this.makeItem('handcuffs');
        this.seats[p].add(c);
        c.position.set(0, TOP + 0.03, 0.47);
        this.cuffObj[p] = c;
        this.#cuffPose(p, 0.01);
      } else if (!this.cuffed[p] && this.cuffObj[p]) {
        this.cuffObj[p].removeFromParent();
        this.cuffObj[p] = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  /** One item record from Rules (also handles adrenaline → steal → use). */
  async item(fx) {
    const p = fx.p;
    const obj = this.items[p][fx.slot];
    this.items[p][fx.slot] = null;
    await this.#use(p, fx.item, obj, fx);
    if (fx.item === 'adrenaline') {
      const o = 1 - p;
      const st = fx.steal;
      const sobj = this.items[o][st.slot];
      this.items[o][st.slot] = null;
      this.ui.msg(`${this.ui.name(p)} steals the ${label(st.item)}`, 1800);
      await this.#use(p, st.item, sobj, st.fx);
    }
  }

  async #pick(p, obj, hand) {
    if (!obj) return null;
    this.anim.curl(hand, 'pinch', 0.18, POSES);
    await this.#reachTo(hand, this.#wpos(obj), 0.35);
    this.#grab(hand, obj);
    this.#sfx('click', { volume: 0.2 });
    return obj;
  }

  async #use(p, item, obj, r) {
    const H = this.H[p];
    const seat = this.seats[p];
    const me = this.ui.mine(p);
    obj ??= this.makeItem(item);
    if (!obj.parent) seat.add(obj);
    switch (item) {
      case 'magnifier': {
        await this.#pick(p, obj, H.r);
        // hold it over the receiver while the left hand cracks the action open
        const port = this.#wpos(this.gun, this.parts.eject);
        const lp = this.#wpos(this.gun, new THREE.Vector3(0, 0, this.parts.foreZ));
        this.anim.curl(H.l, 'claw', 0.2, POSES);
        await Promise.all([this.#reachTo(H.r, port, 0.45, { lift: 0.16, back: 0.2, pitch: -0.2 }), this.#reachTo(H.l, lp, 0.45, { lift: 0.05 })]);
        this.#sfx('rack', { volume: 0.2, rate: 1.4 });
        let peek = null;
        if (me) {
          peek = this.makeShell(r.shell);
          this.gun.add(peek);
          peek.position.copy(this.parts.eject).add(new THREE.Vector3(-0.02, 0.0, 0));
          peek.rotation.set(0, 0, PI / 2);
          peek.scale.setScalar(1.15);
          this.ui.priv(r.shell ? 'The shell in the chamber is LIVE.' : 'The shell in the chamber is BLANK.', 2600, r.shell ? 'live' : 'blank');
        } else this.ui.msg(`${this.ui.name(p)} checks the chamber…`, 1800);
        await this.anim.run(1.5, () => (obj.rotation.z = Math.sin(this.anim.time * 3) * 0.08));
        peek?.removeFromParent();
        this.#sfx('click', { volume: 0.25 });
        await this.#vanish(obj);
        break;
      }
      case 'beer': {
        await this.#pick(p, obj, H.r);
        await this.anim.to(H.r.root, { p: [0.16, TOP + 0.16, 0.6], r: [0, 0.4, 0] }, 0.3);
        this.#sfx('can_open', { volume: 0.6 });
        await this.anim.wait(0.25);
        this.ui.look?.(p, -0.18, 0.5);
        await this.anim.to(H.r.root, { p: [MOUTH[0] + 0.05, MOUTH[1] - 0.04, MOUTH[2] - 0.12], r: [1.1, 0.3, -0.3] }, 0.45);
        this.#sfx('gulp', { volume: 0.5 });
        await this.anim.to(H.r.root, { p: [MOUTH[0] + 0.05, MOUTH[1], MOUTH[2] - 0.1], r: [1.5, 0.3, -0.3] }, 1.0, 'linear');
        // crush and slam
        await this.anim.to(H.r.root, { p: [0.3, TOP + 0.1, 0.6], r: [-0.2, 0.4, 0] }, 0.3);
        this.anim.curl(H.r, 'grip', 0.12, POSES);
        await this.anim.to(obj, { s: [1.05, 0.5, 1.05] }, 0.12);
        this.#sfx('thud', { volume: 0.35 });
        this.ui.look?.(p, -0.42, 0.4);
        seat.attach(obj);
        this.anim.to(obj, { p: [0.62, TOP, 0.62] }, 0.25).then(() => this.#vanish(obj, 0.6));
        // rack the shotgun: the shell flies out for everyone to see
        await this.#pickUp(p);
        await this.#rack(H, r.shell);
        this.ui.msg(r.shell ? 'Ejected: a LIVE round.' : 'Ejected: a BLANK.', 2200, r.shell ? 'live' : 'blank');
        await this.anim.wait(0.3);
        await this.#putDown(p);
        break;
      }
      case 'cigarettes': {
        await this.#pick(p, obj, H.r);
        await this.anim.to(H.r.root, { p: [0.1, TOP + 0.22, 0.65], r: [0.3, 0.2, 0.3] }, 0.3);
        // tap one out
        for (let i = 0; i < 2; i++) {
          await this.anim.to(H.r.root, { p: [0.1, TOP + 0.19, 0.65] }, 0.07, 'out');
          await this.anim.to(H.r.root, { p: [0.1, TOP + 0.22, 0.65] }, 0.09);
        }
        const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 5), this.scene.mat({ color: 0xf0ece0 }));
        cig.geometry.rotateX(PI / 2);
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 4, 3), this.scene.mat({ color: 0xff6a20, unlit: true }));
        ember.position.z = -0.036;
        ember.visible = false;
        cig.add(ember);
        H.r.root.add(cig);
        cig.position.set(-0.01, -0.02, -0.15);
        seat.attach(obj);
        this.anim.to(obj, { p: [0.5, TOP, 0.62] }, 0.3).then(() => this.#vanish(obj, 0.5));
        // to the lips, and the lighter
        this.anim.curl(H.r, 'pinch', 0.2, POSES);
        await this.anim.to(H.r.root, { p: [MOUTH[0] + 0.03, MOUTH[1] - 0.01, MOUTH[2] - 0.02], r: [0, 0.6, 0] }, 0.45);
        this.anim.curl(H.l, 'grip', 0.2, POSES);
        await this.anim.to(H.l.root, { p: [-0.02, MOUTH[1] - 0.06, MOUTH[2] - 0.16], r: [0.5, -0.5, 0] }, 0.4);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 5), this.scene.mat({ color: 0xffb040, unlit: true, additive: true }));
        H.l.root.add(flame);
        flame.position.set(0.02, 0.03, -0.05);
        const lt = this.scene.addLight({ position: this.#wpos(flame), color: 0xffa040, range: 2.2, intensity: 0.9, flicker: 0.3 });
        this.#sfx('lighter', { volume: 0.5 });
        await this.anim.wait(0.5);
        ember.visible = true;
        this.#sfx('inhale', { volume: 0.5 });
        flame.removeFromParent();
        lt.enabled = false;
        this.#handHome(p, 'l');
        await this.anim.wait(0.7);
        await this.anim.to(H.r.root, { p: [0.12, MOUTH[1] - 0.12, MOUTH[2] - 0.2], r: [0.2, 0.4, 0] }, 0.35);
        this.#sfx('exhale', { volume: 0.5 });
        this.#smoke(this.#wpos(seat, new THREE.Vector3(...MOUTH)).add(new THREE.Vector3(0, 0, 0)), 10, 0x9a9aa0);
        if (r.heal) {
          this.#sfx('defib_beep', { volume: 0.5, rate: 1.2 });
          this.drawDisplay(p, { hp: r.hp });
        } else if (r.cut) this.ui.msg('The wires are cut. Nothing helps now.', 2200);
        await this.anim.wait(0.6);
        // into the ashtray
        const ash = this.#wpos(this.T, new THREE.Vector3(-0.42, TOP + 0.02, 0.02));
        await this.#reachTo(H.r, ash, 0.45, { lift: 0.04 });
        this.T.attach(cig);
        this.anim.to(cig, { p: this.#local(this.T, ash) }, 0.1);
        setTimeout(() => cig.removeFromParent(), 6000);
        await this.#handHome(p, 'r');
        break;
      }
      case 'saw': {
        await this.#pick(p, obj, H.r);
        // left hand pins the gun down; the saw goes across the barrel
        const cut = this.#wpos(this.gun, new THREE.Vector3(0, this.parts.barrelY ?? 0, this.parts.cutZ ?? -0.35));
        const pin = this.#wpos(this.gun, new THREE.Vector3(0, 0, (this.parts.foreZ ?? -0.3) + 0.05));
        this.anim.curl(H.l, 'flat', 0.2, POSES);
        await Promise.all([this.#reachTo(H.l, pin, 0.4, { lift: 0.025, back: 0.09, pitch: -0.2 }), this.#reachTo(H.r, cut, 0.45, { lift: 0.08, back: 0.17, pitch: 0.1, yaw: 0.0 })]);
        const base = H.r.root.position.clone();
        // the blade runs along the player's x axis across the barrel
        for (let i = 0; i < 6; i++) {
          this.#sfx('saw_stroke', { volume: 0.45, rate: 0.9 + (i % 2) * 0.2 });
          await this.anim.to(H.r.root, { p: [base.x + (i % 2 ? -0.07 : 0.07), base.y - i * 0.003, base.z] }, 0.15, 'inOut');
        }
        if (this.barrel) {
          this.barrel.geometry = this.barrelSawn;
          this.tip.visible = true;
          this.T.attach(this.tip);
          this.debris.push({ obj: this.tip, v: new THREE.Vector3(0, 0.3, 0), w: new THREE.Vector3(0, 0, 3), rest: false, r: 0.02, keep: true });
          this.#sfx('thud', { volume: 0.4, rate: 1.3 });
        }
        this.ui.msg('Sawn off. The next shot does double damage.', 2200);
        await this.anim.wait(0.3);
        seat.attach(obj);
        this.anim.to(obj, { p: [0.55, TOP, 0.65] }, 0.3).then(() => this.#vanish(obj, 0.5));
        await Promise.all([this.#handHome(p, 'l'), this.#handHome(p, 'r')]);
        break;
      }
      case 'handcuffs': {
        const o = 1 - p;
        await this.#pick(p, obj, H.r);
        // their hands come together in front of them
        await this.#cuffPose(o, 0.35);
        const there = this.#wpos(this.seats[o], new THREE.Vector3(0, TOP + 0.03, 0.47));
        await this.#reachTo(H.r, there, 0.7, { lift: 0.08, back: 0.12 });
        this.#sfx('cuffs', { volume: 0.6 });
        this.seats[o].attach(obj);
        this.anim.to(obj, { p: [0, TOP + 0.03, 0.47], r: [0, 0, 0] }, 0.15);
        this.cuffObj ??= [null, null];
        this.cuffObj[o] = obj;
        this.cuffed[o] = true;
        this.ui.msg(`${this.ui.name(o)} is cuffed.`, 1800);
        await this.#handHome(p, 'r');
        break;
      }
      case 'phone': {
        await this.#pick(p, obj, H.r);
        this.#sfx('phone_flip', { volume: 0.5 });
        await this.anim.to(obj, { r: [PI / 2, 0, 0] }, 0.2);
        await this.anim.to(H.r.root, { p: [0.13, 1.18, 0.98], r: [0.2, 1.4, -0.3] }, 0.5);
        this.#sfx('phone_voice', { volume: 0.6 });
        if (me) {
          const ord = ['', '', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
          if (r.idx < 0) this.ui.priv('“How unfortunate…”', 2600);
          else this.ui.priv(`“${ord[r.idx + 1]} shell… ${r.shell ? 'live' : 'blank'} round.”`, 3000, r.shell ? 'live' : 'blank');
        } else this.ui.msg(`${this.ui.name(p)} listens to the phone…`, 1800);
        await this.anim.wait(1.6);
        this.#sfx('phone_flip', { volume: 0.4 });
        await this.anim.to(H.r.root, { p: [0.25, TOP + 0.12, 0.6], r: [-0.3, 0.3, 0] }, 0.4);
        seat.attach(obj);
        this.#vanish(obj, 0.4);
        await this.#handHome(p, 'r');
        break;
      }
      case 'inverter': {
        await this.#pick(p, obj, H.r);
        const over = this.#wpos(this.gun, new THREE.Vector3(0, 0, this.parts.frontZ ?? 0));
        await this.#reachTo(H.r, over, 0.4, { lift: 0.14, back: 0.12, pitch: -0.1 });
        await this.anim.curl(H.r, { thumb: 1 }, 0.12, POSES);
        this.#sfx('zap', { volume: 0.5 });
        const btn = obj.userData.button;
        if (btn) btn.material = this.scene.mat({ color: 0x20d040, unlit: true });
        this.#spark(this.#wpos(this.gun, this.parts.eject));
        await this.anim.curl(H.r, 'pinch', 0.12, POSES);
        await this.anim.wait(0.35);
        seat.attach(obj);
        this.#vanish(obj, 0.4);
        await this.#handHome(p, 'r');
        break;
      }
      case 'meds': {
        await this.#pick(p, obj, H.r);
        await this.anim.to(H.r.root, { p: [0.1, TOP + 0.2, 0.62], r: [0, 0.3, 0] }, 0.3);
        this.#sfx('rattle', { volume: 0.5 });
        for (let i = 0; i < 4; i++) await this.anim.to(H.r.root, { r: [0, 0.3, i % 2 ? 0.5 : -0.5] }, 0.08);
        this.ui.look?.(p, -0.2, 0.4);
        await this.anim.to(H.r.root, { p: [MOUTH[0] + 0.04, MOUTH[1], MOUTH[2] - 0.1], r: [1.4, 0.3, 0] }, 0.4);
        this.#sfx('gulp', { volume: 0.4 });
        this.ui.look?.(p, -0.42, 0.8);
        await this.anim.wait(0.6);
        seat.attach(obj);
        this.anim.to(obj, { p: [0.55, TOP, 0.65] }, 0.3).then(() => this.#vanish(obj, 0.4));
        this.#handHome(p, 'r');
        if (r.good) {
          this.#sfx('heartbeat', { volume: 0.7 });
          this.drawDisplay(p, { hp: r.hp });
          this.ui.msg('The pills worked.', 1800);
        } else {
          this.#sfx('cough', { volume: 0.7 });
          this.ui.hurt?.(p, 1, r.hp, true);
          this.drawDisplay(p, { hp: r.hp });
          if (r.hp <= 0) this.slump[p] = 1;
          this.ui.msg('Expired. Very expired.', 1800);
        }
        await this.anim.wait(0.6);
        break;
      }
      case 'adrenaline': {
        await this.#pick(p, obj, H.r);
        // left wrist up, needle in, plunger down
        this.anim.curl(H.l, 'flat', 0.2, POSES);
        await this.anim.to(H.l.root, { p: [-0.05, TOP + 0.14, 0.5], r: [0.3, -0.4, PI * 0.9] }, 0.35);
        const wrist = this.#wpos(H.l.root);
        await this.#reachTo(H.r, wrist, 0.35, { lift: 0.07, back: 0.12, pitch: -0.4 });
        this.#sfx('stab', { volume: 0.6 });
        const plunger = obj.getObjectByName('Plunger_Cube.001') ?? obj.getObjectByName('Plunger');
        await this.anim.to(H.r.root, { p: [H.r.root.position.x, H.r.root.position.y - 0.025, H.r.root.position.z] }, 0.08, 'out');
        if (plunger) await this.anim.to(plunger, { p: plunger.position.clone().multiplyScalar(0.5) }, 0.35);
        else await this.anim.wait(0.35);
        if (this.ui.mine(p)) this.ui.shake?.(0.6);
        seat.attach(obj);
        this.anim.to(obj, { p: [0.55, TOP, 0.62] }, 0.3).then(() => this.#vanish(obj, 0.4));
        await this.#handHome(p, 'l', 0.25);
        // and reach over the table for their item
        const o = 1 - p;
        const target = this.items[o][r.steal?.slot ?? -1];
        if (target) {
          this.anim.curl(H.r, 'pinch', 0.15, POSES);
          await this.#reachTo(H.r, this.#wpos(target), 0.45, { lift: 0.06 });
          this.#grab(H.r, target);
          this.#sfx('click', { volume: 0.3 });
          await this.anim.to(H.r.root, { p: [0.12, TOP + 0.12, 0.45], r: [-0.3, 0.2, 0] }, 0.45);
        }
        break;
      }
      default:
        await this.#vanish(obj);
    }
  }

  // ---------------------------------------------------------------------------
  // Round transitions
  // ---------------------------------------------------------------------------

  async roundStart(fx, names) {
    this.setRound(fx.round, null);
    this.#clearShells(true);
    this.#restoreBarrel();
    for (const p of [0, 1]) {
      this.drawDisplay(p, { hp: fx.hp, max: fx.hp, name: names[p], cut: false });
      this.#sfx('defib_beep', { volume: 0.4, rate: 0.9 + p * 0.1 });
    }
    // anyone still down gets shocked back
    for (const p of [0, 1]) {
      if (this.slump[p]) {
        this.#sfx('defib_charge', { volume: 0.5 });
        await this.anim.wait(0.95);
        this.ui.shock?.(p);
        this.slump[p] = 0;
      }
      if (this.cuffed[p]) {
        this.cuffed[p] = false;
        this.cuffObj?.[p]?.removeFromParent();
        if (this.cuffObj) this.cuffObj[p] = null;
      }
    }
    await Promise.all([0, 1].flatMap((p) => [this.#handHome(p, 'l'), this.#handHome(p, 'r')]));
    this.ui.msg(`ROUND ${['ONE', 'TWO', 'THREE'][fx.round]}`, 2200, 'round');
    await this.anim.wait(1.2);
  }

  async roundEnd(fx) {
    await this.anim.wait(1.2);
    this.ui.msg(`${this.ui.name(fx.winner)} takes round ${fx.round + 1}  (${fx.wins[0]}–${fx.wins[1]})`, 3000, 'round');
    await this.anim.wait(2.4);
    // the dealer sweeps the table: leftover items off
    for (const p of [0, 1]) for (let i = 0; i < SLOTS; i++) if (this.items[p][i]) this.#vanish(this.items[p][i], 0.4);
    this.items = [Array(SLOTS).fill(null), Array(SLOTS).fill(null)];
    await this.anim.wait(0.5);
  }

  updateCut(rules) {
    for (const p of [0, 1]) {
      const cut = rules.wiresCut(p) && rules.round === ROUNDS.length - 1;
      if (cut !== this.disp[p].cut) this.drawDisplay(p, { cut, hp: rules.hp[p] });
    }
  }

  #restoreBarrel() {
    if (!this.barrel) return;
    this.barrel.geometry = this.barrelFull;
    const t = this.tipHome;
    t.parent.add(this.tip);
    this.tip.position.copy(t.p);
    this.tip.quaternion.copy(t.q);
    this.tip.scale.copy(t.s);
    this.tip.visible = false;
    this.debris = this.debris.filter((d) => d.obj !== this.tip);
  }

  // ---------------------------------------------------------------------------
  // Particles: smoke, sparks, blood
  // ---------------------------------------------------------------------------

  #smoke(at, n, color = 0xc8c8c8) {
    const mat = this.scene.mat({ color, opacity: 0.35, unlit: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), mat);
      this.T.add(m);
      m.position.copy(this.#local(this.T, at));
      this.blood.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.2 + Math.random() * 0.25, (Math.random() - 0.5) * 0.3), life: 1.2 + Math.random(), smoke: true, g: 0 });
    }
  }

  #spark(at) {
    const mat = this.scene.mat({ color: 0x9ad8ff, unlit: true, additive: true });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.012), mat);
      this.T.add(m);
      m.position.copy(this.#local(this.T, at));
      this.blood.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.4, (Math.random() - 0.5) * 1.6), life: 0.4 + Math.random() * 0.3, g: 6, spark: true });
    }
  }

  /** Spray from a head shot: droplets fly, land, and leave stains. */
  #bloodBurst(at, dir, dmg) {
    const mats = [0x6a0808, 0x8a0a0a, 0x4a0404].map((c) => this.scene.mat({ color: c }));
    const n = 70 * dmg;
    const tq = this.T.getWorldQuaternion(new THREE.Quaternion()).invert();
    const d = dir.clone().applyQuaternion(tq);
    for (let i = 0; i < n; i++) {
      const s = 0.012 + Math.random() * 0.025;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mats[i % 3]);
      this.T.add(m);
      m.position.copy(this.#local(this.T, at));
      const back = Math.random() < 0.75;
      const v = d.clone().multiplyScalar(back ? 2 + Math.random() * 3.5 : -0.8 - Math.random());
      v.x += (Math.random() - 0.5) * 2.2;
      v.y += (Math.random() - 0.2) * 2.2;
      v.z += (Math.random() - 0.5) * 2.2;
      this.blood.push({ m, v, life: 3, g: 9.8, drop: true });
    }
    // a mist
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), this.scene.mat({ color: 0x7a0a0a, opacity: 0.45 }));
      this.T.add(m);
      m.position.copy(this.#local(this.T, at));
      const v = d.clone().multiplyScalar(0.5 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6));
      this.blood.push({ m, v, life: 0.7 + Math.random() * 0.4, g: 0.5, smoke: true });
    }
    this.#sfx('splat', { volume: 0.6 });
  }

  #stain(pos, normal, size) {
    const geo = new THREE.CircleGeometry(size, 7);
    const m = new THREE.Mesh(geo, this.stainMat ??= this.scene.mat({ color: 0x4a0606, depthWrite: false }));
    m.position.copy(pos).addScaledVector(normal, 0.002 + Math.random() * 0.002);
    m.lookAt(pos.clone().add(normal));
    m.rotation.z = Math.random() * PI;
    m.scale.set(1, 0.6 + Math.random() * 0.8, 1);
    this.T.add(m);
    this.bloodDecals.push(m);
    if (this.bloodDecals.length > 260) this.bloodDecals.shift().removeFromParent();
  }

  clearBlood() {
    for (const b of this.blood) b.m.removeFromParent();
    for (const d of this.bloodDecals) d.removeFromParent();
    this.blood = [];
    this.bloodDecals = [];
  }

  /** room: half-extents of the shed interior relative to the table (x, z) and its height */
  setRoom(room) {
    this.room = room;
  }

  // ---------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------

  update(dt, camera) {
    this.anim.update(dt);
    // dealer hands breathe while idle
    const t = this.anim.time;
    for (const [i, side] of [[0, 'l'], [1, 'r']]) {
      const h = this.D[side];
      if (h.root.parent === this.dealer && !this.anim.tracks.some((tr) => tr.obj === h.root)) {
        h.root.position.y = DEALER_REST[side].p[1] + Math.sin(t * 1.3 + i * 1.7) * 0.012;
      }
    }
    // spent shells, cut-off barrel, broken cuffs
    for (const d of this.debris) {
      if (d.rest) continue;
      d.v.y -= 9.8 * dt;
      d.obj.position.addScaledVector(d.v, dt);
      d.obj.rotation.x += d.w.x * dt;
      d.obj.rotation.y += d.w.y * dt;
      d.obj.rotation.z += d.w.z * dt;
      const p = d.obj.position;
      const onTable = Math.abs(p.x) < 0.64 && Math.abs(p.z) < 0.74;
      const floor = onTable ? TOP + d.r : 0.01 + d.r;
      if (p.y < floor) {
        p.y = floor;
        if (d.sound) this.#sfx('shell_drop', { volume: 0.25, rate: 0.8 + Math.random() * 0.4 });
        if (Math.abs(d.v.y) < 0.6) {
          d.rest = true;
          d.obj.rotation.x = PI / 2;
          d.obj.rotation.z = 0;
        } else {
          d.v.y *= -0.35;
          d.v.x *= 0.6;
          d.v.z *= 0.6;
          d.w.multiplyScalar(0.5);
        }
      }
      if (this.room) {
        p.x = THREE.MathUtils.clamp(p.x, -this.room.x + 0.05, this.room.x - 0.05);
        p.z = THREE.MathUtils.clamp(p.z, -this.room.z + 0.05, this.room.z - 0.05);
      }
      if (d.fade && (d.fade -= dt) <= 0) {
        d.obj.removeFromParent();
        d.rest = true;
      }
    }
    // blood, smoke, sparks
    const cq = camera?.quaternion;
    for (let i = this.blood.length - 1; i >= 0; i--) {
      const b = this.blood[i];
      b.life -= dt;
      b.v.y -= b.g * dt;
      if (b.smoke) b.v.multiplyScalar(1 - dt * 1.5);
      b.m.position.addScaledVector(b.v, dt);
      if (cq) b.m.quaternion.copy(this.T.getWorldQuaternion(_q).invert().multiply(cq));
      if (b.smoke) b.m.scale.setScalar(1 + (1.6 - b.life) * 1.5);
      let hit = false;
      if (b.drop) {
        const p = b.m.position;
        const onTable = Math.abs(p.x) < 0.65 && Math.abs(p.z) < 0.75;
        if (onTable && p.y < TOP + 0.003 && b.v.y < 0) {
          this.#stain(new THREE.Vector3(p.x, TOP, p.z), _up, 0.008 + Math.random() * 0.02);
          hit = true;
        } else if (p.y < 0.003) {
          this.#stain(new THREE.Vector3(p.x, 0, p.z), _up, 0.01 + Math.random() * 0.03);
          hit = true;
        } else if (this.room) {
          for (const [ax, lim] of [['x', this.room.x], ['z', this.room.z]]) {
            if (Math.abs(p[ax]) > lim - 0.01) {
              const n = new THREE.Vector3();
              n[ax] = -Math.sign(p[ax]);
              const q = p.clone();
              q[ax] = Math.sign(p[ax]) * (lim - 0.005);
              this.#stain(q, n, 0.01 + Math.random() * 0.035);
              hit = true;
            }
          }
          if (p.y > this.room.h - 0.01) {
            this.#stain(new THREE.Vector3(p.x, this.room.h, p.z), new THREE.Vector3(0, -1, 0), 0.01 + Math.random() * 0.02);
            hit = true;
          }
        }
      }
      if (hit || b.life <= 0) {
        b.m.removeFromParent();
        this.blood.splice(i, 1);
      }
    }
  }

  /** Where the avatar of seat p should reach (world wrist positions), or null when hands are elsewhere. */
  reach(p) {
    return { l: this.H[p].l.root.getWorldPosition(new THREE.Vector3()), r: this.H[p].r.root.getWorldPosition(new THREE.Vector3()) };
  }

  /** World pose for a player sitting in seat p. */
  seatEye(p) {
    return this.#wpos(this.seats[p], EYE);
  }

  seatYaw(p) {
    return this.T.rotation.y + (p === 0 ? 0 : PI);
  }

  /** World position of the floor in front of seat p (where you stand up). */
  standAt(p) {
    return this.#wpos(this.seats[p], new THREE.Vector3(0.75, 0, 1.25));
  }

  /** Is the camera looking at one of p's items (returns slot) / the gun? */
  pickables(p) {
    const out = [];
    this.items[p].forEach((o, i) => o && out.push({ obj: o, slot: i }));
    return out;
  }
}

/** Right hand around the pistol grip (gun space). */
function gripR() {
  return { p: [0.055, -0.045, 0.13], r: [0, 0, -PI / 2] };
}

/** Left hand under the forend (gun space). */
function foreL(parts) {
  return { p: [-0.055, -0.04, (parts.foreZ ?? -0.3) + 0.1], r: [0, 0, PI / 2] };
}

export function label(item) {
  return (
    {
      magnifier: 'magnifying glass',
      beer: 'beer',
      cigarettes: 'cigarettes',
      saw: 'handsaw',
      handcuffs: 'handcuffs',
      phone: 'burner phone',
      inverter: 'inverter',
      meds: 'expired medicine',
      adrenaline: 'adrenaline',
    }[item] ?? item
  );
}

function feltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1e4a2a';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    x.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  // worn spots and old stains
  for (let i = 0; i < 6; i++) {
    x.fillStyle = `rgba(30,10,8,${0.08 + Math.random() * 0.1})`;
    x.beginPath();
    x.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 10, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.3, 'rgba(255,200,90,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  x.fillStyle = g;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    x.beginPath();
    x.moveTo(32, 32);
    x.lineTo(32 + Math.cos(a - 0.2) * 30, 32 + Math.sin(a - 0.2) * 30);
    x.lineTo(32 + Math.cos(a + 0.2) * 30, 32 + Math.sin(a + 0.2) * 30);
    x.fill();
  }
  x.beginPath();
  x.arc(32, 32, 14, 0, Math.PI * 2);
  x.fill();
  return new THREE.CanvasTexture(c);
}

function labelTexture(t) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 20;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1a1e';
  x.fillRect(0, 0, 32, 20);
  x.fillStyle = '#e0e0e0';
  x.font = 'bold 13px monospace';
  x.textAlign = 'center';
  x.fillText(t, 16, 15);
  return new THREE.CanvasTexture(c);
}

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
