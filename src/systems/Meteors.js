import * as THREE from 'three';

/**
 * Meteors
 * -------
 * Shooting stars over any outdoor scene at night. Most nights one drifts by
 * every minute or so; on meteor shower nights (about one in three, decided
 * by the date so everyone in a room shares it) they come every few seconds,
 * all radiating from the same patch of sky.
 *
 * Lie on the truck roof (Q at the truck) to watch: the camera tips up at
 * the sky and the hint counts the ones you see.
 */
const SKY_R = 260;

export class Meteors {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 5;
    this.counted = 0;
    this.watching = null;
    this.announced = -1;
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0.5, 0, 0); // head at x = 1, tail at x = 0
    this.geo = g;
  }

  /** Shower night? Seeded by the real date + in-game day. */
  get shower() {
    const d = new Date();
    const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate() + this.game.dayNight.day * 7;
    const r = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
    return r < 0.34 || !!this.forceShower;
  }

  get dark() {
    const m = this.game.dayNight.minutes;
    return m < 330 || m > 1230;
  }

  /** Spawn one shooting star somewhere in the sky above the camera. */
  spawn(bright = false) {
    const scene = this.game.scene;
    if (!scene) return;
    const cam = this.game.camera.position;
    // showers radiate from one point (NE, high); sporadics come from anywhere
    const rad = this.shower ? new THREE.Vector3(0.5, 0.75, -0.45).normalize() : new THREE.Vector3(Math.random() - 0.5, 0.6 + Math.random() * 0.4, Math.random() - 0.5).normalize();
    // lying on the roof: aim them into the patch of sky you're looking at
    if (this.watching && Math.random() < 0.85) rad.copy(this.game.camera.getWorldDirection(new THREE.Vector3())).add(new THREE.Vector3(0.25, 0.1, 0)).normalize();
    const spread = this.watching ? 0.6 : 1.4;
    const off = new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * spread);
    const start = rad.clone().add(off).normalize();
    if (start.y < 0.25) start.y = 0.25 + Math.random() * 0.3;
    start.normalize();
    const dir = start.clone().sub(rad).normalize();
    if (dir.lengthSq() < 0.01) dir.set(1, -0.3, 0).normalize();
    dir.y = Math.min(dir.y, -0.15);
    dir.normalize();
    const col = bright ? 0xfff2c0 : [0xffffff, 0xd8e8ff, 0xfff0d0, 0xc8ffd8][Math.floor(Math.random() * 4)];
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 9;
    scene.root.add(m);
    const len = bright ? 46 : 18 + Math.random() * 22;
    this.list.push({ m, pos: start.multiplyScalar(SKY_R).add(cam), dir, speed: bright ? 120 : 140 + Math.random() * 120, len, width: bright ? 1.6 : 0.5 + Math.random() * 0.5, life: 0, max: bright ? 1.6 : 0.6 + Math.random() * 0.7, seen: false });
  }

  update(dt) {
    const g = this.game;
    const scene = g.scene;
    if (scene?.outdoor && this.dark) {
      this.t -= dt;
      if (this.t <= 0) {
        this.spawn();
        this.t = this.shower ? 1.5 + Math.random() * 4 : 35 + Math.random() * 60;
        if (this.shower && Math.random() < 0.15) this.after = 0.25; // pairs
      }
      if (this.after !== undefined && (this.after -= dt) <= 0) {
        this.after = undefined;
        this.spawn();
      }
      if (this.shower && this.announced !== g.dayNight.day && scene.name === 'World') {
        this.announced = g.dayNight.day;
        setTimeout(() => g.hud.toast('Meteor shower tonight. Find somewhere dark and look up (Q at the truck: lie on the roof).', 6000), 2500);
      }
    }
    const cam = g.camera;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.life += dt;
      const k = s.life / s.max;
      if (k >= 1 || s.m.parent !== scene?.root) {
        s.m.removeFromParent();
        s.m.material.dispose();
        this.list.splice(i, 1);
        continue;
      }
      s.pos.addScaledVector(s.dir, s.speed * dt);
      s.m.position.copy(s.pos);
      // billboard the streak along its direction, facing the camera
      const toCam = cam.position.clone().sub(s.pos).normalize();
      const side = new THREE.Vector3().crossVectors(s.dir, toCam).normalize();
      const n = new THREE.Vector3().crossVectors(s.dir, side);
      s.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s.dir.clone().negate(), side, n));
      s.m.scale.set(s.len * Math.min(1, k * 4), s.width, 1);
      s.m.material.opacity = Math.sin(Math.PI * k) * 0.95;
      if (this.watching && !s.seen && k > 0.3) {
        const v = s.pos.clone().project(cam);
        if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) {
          s.seen = true;
          this.counted++;
        }
      }
    }
    if (this.watching && g.focus) g.focus.hint = (`${this.counted} shooting star${this.counted === 1 ? '' : 's'} counted${this.shower ? ' · meteor shower tonight' : ''} · E sit up`);
  }

  /** Lie back on the truck's roof and look up. */
  lieOnRoof(v) {
    const g = this.game;
    const o = v.object;
    o.updateMatrixWorld();
    const pos = new THREE.Vector3(0, 2.35, -0.3).applyMatrix4(o.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld);
    const target = pos.clone().addScaledVector(fwd, 3).add(new THREE.Vector3(0, 9, 0));
    this.counted = 0;
    this.watching = true;
    if (!this.dark) g.hud.toast('Too bright for stars. Come back at night.', 3500);
    else if (!this.shower) g.hud.toast('No shower tonight, but one drifts by now and then. Be patient.', 4000);
    g.enterFocus({
      position: pos,
      target,
      fov: 88,
      hint: 'E sit up',
      onExit: () => {
        this.watching = null;
        if (this.counted) g.hud.toast(`You counted ${this.counted}. Make a wish on the last one.`, 4000);
      },
    });
  }
}
