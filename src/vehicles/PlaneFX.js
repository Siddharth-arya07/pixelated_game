import * as THREE from 'three';

/**
 * PlaneFX — the fun bits for the biplane
 * --------------------------------------
 *  B  tow a banner (type your own message first; friends see it trailing behind you)
 *  R  skywriting smoke on/off — white puffs that hang in the air for a while
 *  G  drop a care package: it floats down on a little parachute, and whoever
 *     gets to it first opens it (snacks, a drink, fireworks, sometimes cash)
 *
 * Banner text + smoke ride in the vehicle state; drops are events ('drop',
 * 'dropTaken'), so everything shows up for the whole room.
 */
const PUFFS = 900;
const LOOT = [
  ['chips', 1], ['candy', 2], ['soda', 1], ['beer', 2], ['energy_drink', 1], ['hot_pizza', 1], ['fw_rocket', 2], ['fw_sparkler', 3], ['milkshake', 1], ['popcorn', 1],
];

export class PlaneFX {
  constructor(game) {
    this.game = game;
    this.drops = new Map(); // id → { grp, vel, landed }
    this.#puffs();
    this.#ui();
    game.mp?.on('drop', (e) => this.#spawnDrop(e.id, new THREE.Vector3(...e.p), new THREE.Vector3(...e.v), e.sc));
    game.mp?.on('dropTaken', (e) => this.#remove(e.id));
  }

  // ---- smoke --------------------------------------------------------------------------

  #puffs() {
    const geo = new THREE.BufferGeometry();
    this.pp = new Float32Array(PUFFS * 3);
    this.pa = new Float32Array(PUFFS);
    this.pt = new Float32Array(PUFFS).fill(1e9);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pp, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('age', new THREE.BufferAttribute(this.pa, 1).setUsage(THREE.DynamicDrawUsage));
    this.smoke = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uScale: { value: 400 } },
        vertexShader: `attribute float age; varying float vA; uniform float uScale;
          void main(){ vA = age; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = clamp((2.5 + age * 0.12) * uScale / -mv.z, 1.0, 220.0); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, r) * clamp(1.0 - vA / 45.0, 0.0, 1.0) * 0.55;
          if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.97), a); }`,
      }),
    );
    this.smoke.frustumCulled = false;
    this.next = 0;
  }

  puff(p) {
    const i = this.next++ % PUFFS;
    this.pp[i * 3] = p.x + (Math.random() - 0.5) * 0.6;
    this.pp[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.6;
    this.pp[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.6;
    this.pt[i] = 0;
  }

  /** Called every frame for each plane (yours or a friend's). */
  planeTick(veh, dt) {
    if (!veh.smokeOn || veh.onGround) return;
    veh._puffT = (veh._puffT ?? 0) - dt;
    if (veh._puffT > 0) return;
    veh._puffT = 0.06;
    veh.object.updateMatrixWorld();
    this.puff(_v.set(0, 1.6, -4.4).applyMatrix4(veh.object.matrixWorld));
  }

  // ---- banner ------------------------------------------------------------------------------

  #ui() {
    this.el = document.createElement('div');
    this.el.id = 'banner-ui';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="pn-card"><div class="pn-t">What should the banner say?</div><input maxlength="28" placeholder="HAPPY BIRTHDAY MIA"><button>Paint it</button></div>`;
    document.getElementById('ui').appendChild(this.el);
    this.input = this.el.querySelector('input');
    const done = () => {
      const v = this.input.value.trim().toUpperCase().slice(0, 28);
      this.el.classList.add('hidden');
      this.visible = false;
      this.game.closeUI();
      if (v) {
        this.text = v;
        this.pending?.(v);
      }
      this.pending = null;
    };
    this.el.querySelector('button').addEventListener('click', done);
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') done();
    });
  }

  hide() {
    if (this.visible) {
      this.el.classList.add('hidden');
      this.visible = false;
    }
  }

  askBanner(then) {
    this.pending = then;
    this.input.value = this.text ?? '';
    this.game.openUI(() => {
      this.visible = true;
      this.el.classList.remove('hidden');
    });
    setTimeout(() => this.input.focus(), 50);
  }

  /** Attach / update / remove the towed banner on a plane. */
  setBanner(veh, text) {
    if ((veh.bannerText ?? null) === (text ?? null)) return;
    veh.bannerText = text ?? null;
    veh.banner?.removeFromParent();
    veh.banner = null;
    if (!text) return;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = '#fbf6e8';
    x.fillRect(0, 0, 512, 96);
    x.fillStyle = '#c0202a';
    x.font = `bold ${Math.min(64, Math.floor(900 / Math.max(6, text.length)))}px Impact, "Arial Black", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 256, 52);
    const grp = new THREE.Group();
    const mat = this.game.renderer.material({ map: new THREE.CanvasTexture(c), doubleSide: true });
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7, 8, 1), mat);
    cloth.rotation.y = Math.PI / 2;
    cloth.position.z = -9.5;
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 5), this.game.renderer.material({ color: 0x3a3a3a }));
    rope.position.z = -2.5;
    grp.add(cloth, rope);
    grp.position.set(0, 1.5, -4.2);
    veh.object.add(grp);
    veh.banner = grp;
    veh.bannerCloth = cloth;
  }

  // ---- care packages ----------------------------------------------------------------------------

  dropFrom(veh) {
    const g = this.game;
    if ((this.dropCool ?? 0) > g.time) return g.hud.toast('Reloading the cargo hatch…', 1500);
    this.dropCool = g.time + 6;
    veh.object.updateMatrixWorld();
    const p = new THREE.Vector3(0, 0.6, -1.5).applyMatrix4(veh.object.matrixWorld);
    const v = new THREE.Vector3(Math.sin(veh.heading), 0, Math.cos(veh.heading)).multiplyScalar(veh.speed * 0.8);
    const id = `${g.net?.id ?? 'me'}-${Math.floor(g.time * 1000)}`;
    this.#spawnDrop(id, p, v, g.scene.name);
    g.net?.online && g.net.event('drop', { id, p: p.toArray(), v: v.toArray(), sc: g.scene.name });
    g.hud.toast('Package away!', 1500);
  }

  #spawnDrop(id, p, v, sceneName) {
    const g = this.game;
    const scene = g.scenes[sceneName];
    if (!scene?.built) return;
    const grp = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), scene.mat({ map: scene.tex('planks', 1, 1), color: 0xc09a60 }));
    crate.position.y = 0.28;
    const chute = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), scene.mat({ color: Math.random() < 0.5 ? 0xff6a4a : 0x4a8aff, doubleSide: true }));
    chute.position.y = 3.2;
    chute.scale.y = 0.6;
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.01, 2.8, 0.01), scene.mat({ color: 0xdddddd }));
      s.position.set(dx * 2.5, 1.9, dz * 2.5);
      s.rotation.set(dz * 0.5, 0, -dx * 0.5);
      grp.add(s);
    }
    grp.add(crate, chute);
    grp.position.copy(p);
    scene.root.add(grp);
    const d = { id, grp, vel: v.clone(), landed: false, scene, chute };
    this.drops.set(id, d);
    scene.addInteractable(crate, {
      prompt: 'Open the care package',
      range: 3,
      enabled: () => d.landed,
      action: () => this.#open(d),
    });
    d.crate = crate;
  }

  #open(d) {
    const g = this.game;
    const n = 2 + Math.floor(Math.random() * 2);
    const got = [];
    for (let k = 0; k < n; k++) {
      const [item, c] = LOOT[Math.floor(Math.random() * LOOT.length)];
      g.inventory.add(item, c);
      got.push(`${c > 1 ? c + '× ' : ''}${g.inventory.def(item).name}`);
    }
    if (Math.random() < 0.35) {
      const cash = 5 + Math.floor(Math.random() * 16);
      g.inventory.earn(cash);
      got.push(`$${cash}`);
    }
    g.hud.toast(`Care package: ${got.join(', ')}.`, 5000);
    g.audio.oneShot('door', { volume: 0.4, rate: 1.4 });
    this.#remove(d.id);
    g.net?.online && g.net.event('dropTaken', { id: d.id });
  }

  #remove(id) {
    const d = this.drops.get(id);
    if (!d) return;
    d.grp.removeFromParent();
    d.scene.interactables = d.scene.interactables.filter((o) => o !== d.crate);
    this.drops.delete(id);
  }

  // ---------------------------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const scene = g.scene;
    // smoke lives in the World
    if (scene?.name === 'World' && this.smoke.parent !== scene.root) scene.root.add(this.smoke);
    for (let i = 0; i < PUFFS; i++) {
      if (this.pt[i] > 60) {
        this.pa[i] = 1e3;
        this.pp[i * 3 + 1] = -9999;
        continue;
      }
      this.pt[i] += dt;
      this.pa[i] = this.pt[i];
      this.pp[i * 3 + 1] += dt * 0.15;
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;
    this.smoke.geometry.attributes.age.needsUpdate = true;
    this.smoke.material.uniforms.uScale.value = window.innerHeight * 0.5;
    for (const v of g.vehicles.vehicles) {
      if (!v.cfg.fly) continue;
      if (v.remoteDriver || v === g.vehicles.active) this.planeTick(v, dt);
      if (v.bannerCloth) {
        const t = g.time;
        v.banner.rotation.y = Math.sin(t * 2.3) * 0.05;
        v.bannerCloth.rotation.z = Math.sin(t * 7) * 0.04;
        v.banner.visible = !v.onGround || v.remoteDriver;
      }
    }
    // falling packages
    for (const d of this.drops.values()) {
      if (d.landed) continue;
      d.vel.multiplyScalar(Math.exp(-1.2 * dt));
      d.vel.y = Math.max(-4, d.vel.y - 9.8 * dt);
      d.grp.position.addScaledVector(d.vel, dt);
      d.grp.rotation.z = Math.sin(g.time * 1.3) * 0.08;
      const sc = d.scene;
      const gy = sc.groundHeight(d.grp.position.x, d.grp.position.z);
      const wy = sc.waterHeight?.(d.grp.position.x, d.grp.position.z);
      const floor = Math.max(gy, wy ?? -1e9);
      if (d.grp.position.y <= floor) {
        d.grp.position.y = floor;
        d.landed = true;
        d.grp.rotation.z = 0;
        d.chute.visible = false;
        d.grp.children.forEach((o) => o !== d.crate && (o.visible = false));
      }
    }
  }
}

const _v = new THREE.Vector3();
