import * as THREE from 'three';

/**
 * Avatar
 * ------
 * How another player looks: their character model, posed from their
 * networked state, with a name tag above their head.
 *
 *  - girl: rigged (Unreal-style bones). Her IDLE clip plays underneath and we
 *    layer procedural poses on top: walk/run cycles, sitting (couches, cars,
 *    swings), lying on the roof, skating, waving, pointing, and the jaw moving
 *    while they talk.
 *  - guy: the lumberjack model isn't rigged, so he gets whole-body motion
 *    (bob, lean, sit/lie height). Drop in a rigged version later and he gets
 *    the full treatment for free.
 *  - props: shotgun in hand, a glowing cigarette ember, a flashlight cone
 */
const BONES = {
  pelvis: /pelvis/,
  spine: /spine_02/,
  chest: /spine_03/,
  neck: /neck_01/,
  head: /head_0/,
  jaw: /jaw_/,
  thighL: /thigh_l_0\d+$/,
  thighR: /thigh_r_0\d+$/,
  calfL: /calf_l_0\d+$/,
  calfR: /calf_r_0\d+$/,
  upperL: /upperarm_l_0\d+$/,
  upperR: /upperarm_r_0\d+$/,
  lowerL: /lowerarm_l_0\d+$/,
  lowerR: /lowerarm_r_0\d+$/,
};

export class Avatar {
  constructor(game, { name, char }) {
    this.game = game;
    this.char = char;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const key = 'char_girl'; // the only character
    const model = game.assets.model(key);
    this.model = model ?? fallbackFigure(game);
    this.body.add(this.model);
    // Some character files ship with a flat base disc: hide anything that flat.
    this.model.updateMatrixWorld(true);
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const bb = new THREE.Box3().setFromObject(o);
      const sz = bb.getSize(new THREE.Vector3());
      if (sz.y < 0.04 && Math.max(sz.x, sz.z) > 0.4) o.visible = false;
    });
    this.phase = 0;
    this.talk = 0;
    this.bones = {};
    this.height = 1.65;

    // Rig: find our bones, and let the idle clip breathe underneath.
    this.model.traverse((o) => {
      if (!o.isBone) return;
      for (const [k, re] of Object.entries(BONES)) if (!this.bones[k] && re.test(o.name)) this.bones[k] = o;
    });
    this.rigged = !!(this.bones.thighL && this.bones.upperL);
    // Rest pose: restored every frame so procedural offsets never accumulate
    // on bones the idle clip doesn't animate.
    this.rest = new Map(Object.values(this.bones).map((b) => [b, b.quaternion.clone()]));
    const clips = this.model.userData.animations ?? [];
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(this.model);
      this.mixer.clipAction(clips[0]).play();
    }

    // Name tag
    this.tagCanvas = document.createElement('canvas');
    this.tagCanvas.width = 256;
    this.tagCanvas.height = 48;
    this.tagTex = new THREE.CanvasTexture(this.tagCanvas);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, transparent: true, depthWrite: false }));
    this.tag.scale.set(1.2, 0.225, 1);
    this.tag.position.y = this.height + 0.35;
    this.tag.renderOrder = 20;
    this.group.add(this.tag);
    this.setName(name);

    // Props
    this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.0), game.renderer.material({ color: 0x2a3a2a }));
    this.gun.visible = false;
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), game.renderer.material({ color: 0xff6a20, unlit: true }));
    this.ember.visible = false;
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 10, 1, true), game.renderer.material({ color: 0xfff2c0, unlit: true, opacity: 0.12, additive: true, doubleSide: true }));
    this.beam.geometry.translate(0, -1.5, 0);
    this.beam.geometry.rotateX(-Math.PI / 2);
    this.beam.visible = false;
    this.group.add(this.gun, this.ember, this.beam);

    // Something to aim at (giving items).
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, this.height, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = this.height / 2;
    this.group.add(this.hit);
  }

  setName(name, speaking = false) {
    if (this._tagKey === `${name}|${speaking}`) return;
    this._tagKey = `${name}|${speaking}`;
    this.name = name;
    const c = this.tagCanvas.getContext('2d');
    c.clearRect(0, 0, 256, 48);
    c.font = '28px VT323, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(name, 128, 24);
    c.fillStyle = speaking ? '#ffe070' : '#f0ece0';
    c.fillText(name, 128, 24);
    if (speaking) {
      c.fillStyle = '#ffe070';
      c.fillText('♪', 128 + c.measureText(name).width / 2 + 16, 24);
    }
    this.tagTex.needsUpdate = true;
  }

  /**
   * Pose from a state snapshot: { a: anim, sp: speed, it: item, sm: smoking,
   * fl: flashlight, pitch } — the group is already placed/rotated by the caller.
   */
  update(dt, s, camPos) {
    const anim = s.a ?? 'idle';
    const speed = s.sp ?? 0;
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.mixer?.update(dt);
    this.phase += dt * (anim === 'run' ? 11 : 7) * Math.min(1.4, 0.4 + speed / 3);
    const walk = anim === 'walk' || anim === 'run' ? Math.min(1, speed / (anim === 'run' ? 5 : 2)) : 0;
    const amp = anim === 'run' ? 0.85 : 0.5;
    const sw = Math.sin(this.phase);

    // whole-body motion (both characters)
    let lift = 0;
    let lean = 0;
    let lieX = 0;
    if (walk) lift = Math.abs(Math.cos(this.phase)) * 0.04 * walk;
    if (anim === 'run') lean = 0.18;
    if (anim === 'sit' || anim === 'drive' || anim === 'ride') lift = -0.45;
    if (anim === 'lie') {
      lieX = -Math.PI / 2;
      lift = 0.25;
    }
    if (anim === 'sitground') lift = -0.7;
    this.body.position.y = lift;
    this.body.rotation.x = lieX + lean;
    if (!this.rigged) {
      this.body.rotation.z = walk ? sw * 0.04 : 0;
      if (anim === 'wave') this.body.rotation.z = Math.sin(dt + performance.now() / 150) * 0.05;
    }

    if (this.rigged) {
      const b = this.bones;
      const legs = anim === 'sit' || anim === 'drive' || anim === 'ride' ? 1 : anim === 'sitground' ? 1.15 : 0;
      this.#rot(b.spine, 'x', lean * 0.5);
      this.#rot(b.thighL, 'x', -sw * amp * walk - legs * 1.5);
      this.#rot(b.thighR, 'x', sw * amp * walk - legs * 1.5);
      this.#rot(b.calfL, 'x', Math.max(0, Math.sin(this.phase + 1.2)) * 0.9 * walk + legs * 1.5);
      this.#rot(b.calfR, 'x', Math.max(0, Math.sin(this.phase + 1.2 + Math.PI)) * 0.9 * walk + legs * 1.5);
      this.#rot(b.upperL, 'x', sw * amp * 0.8 * walk);
      this.#rot(b.upperR, 'x', -sw * amp * 0.8 * walk);
      if (anim === 'drive') {
        this.#rot(b.upperL, 'x', -0.9);
        this.#rot(b.upperR, 'x', -0.9);
      }
      if (anim === 'skate') {
        this.#rot(b.thighL, 'x', -0.25);
        this.#rot(b.calfL, 'x', 0.4);
        this.#rot(b.pelvis, 'y', 0.9);
      }
      if (anim === 'wave') {
        this.#rot(b.upperR, 'z', 2.4);
        this.#rot(b.lowerR, 'z', 0.4 + Math.sin(performance.now() / 140) * 0.45);
      }
      if (anim === 'point') this.#rot(b.upperR, 'x', -1.45);
      if (s.it === 'shotgun') {
        this.#rot(b.upperR, 'x', -0.7);
        this.#rot(b.lowerR, 'x', -0.6);
        this.#rot(b.upperL, 'x', -1.0);
      }
      if (s.sm) {
        // cigarette near the mouth now and then
        const drag = Math.max(0, Math.sin(performance.now() / 1800)) ** 6;
        this.#rot(b.upperR, 'x', -0.6 - drag * 0.9);
        this.#rot(b.lowerR, 'x', -1.2 - drag * 0.8);
      }
      // look up/down with the head
      this.#rot(b.neck, 'x', THREE.MathUtils.clamp(-(s.pitch ?? 0) * 0.6, -0.6, 0.6));
      // talking
      this.talk = THREE.MathUtils.damp(this.talk, s.talkLevel ?? 0, 18, dt);
      this.#rot(b.jaw, 'x', this.talk * 0.35);
    }

    // props
    const h = this.height;
    this.gun.visible = s.it === 'shotgun';
    if (this.gun.visible) this.gun.position.set(-0.18, h * 0.62, 0.35);
    this.ember.visible = !!s.sm;
    if (this.ember.visible) {
      const drag = Math.max(0, Math.sin(performance.now() / 1800)) ** 6;
      this.ember.position.set(-0.12 + drag * 0.08, h * (0.55 + drag * 0.3), 0.28 - drag * 0.15);
      this.ember.material.uniforms.uColor.value.setHSL(0.06, 1, 0.45 + drag * 0.3);
    }
    this.beam.visible = !!s.fl;
    if (this.beam.visible) {
      this.beam.position.set(-0.15, h * 0.7, 0.3);
      this.beam.rotation.x = -(s.pitch ?? 0);
    }
    // name tag: fades with distance, hidden past 70 m
    const d = camPos ? camPos.distanceTo(this.group.position) : 0;
    this.tag.visible = d < 70;
    this.tag.material.opacity = THREE.MathUtils.clamp(1.3 - d / 60, 0.25, 1);
  }

  /** Rotate a bone about one of the CHARACTER's axes, on top of its current pose. */
  #rot(bone, axis, angle) {
    if (!bone || !angle) return;
    const parent = bone.parent;
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(_pq);
    this.body.getWorldQuaternion(_bq);
    // character axis in world, then into the parent's space
    _ax.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0).applyQuaternion(_bq).applyQuaternion(_pq.invert());
    _dq.setFromAxisAngle(_ax.normalize(), angle);
    bone.quaternion.premultiply(_dq);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.tagTex.dispose();
  }
}

/** If a character file is missing: a simple blocky figure. */
function fallbackFigure(game) {
  const g = new THREE.Group();
  const m = game.renderer.material({ color: 0x8a7a6a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.25), m);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.25), m);
  head.position.y = 1.65;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.22), game.renderer.material({ color: 0x2a2a3a }));
  legs.position.y = 0.4;
  g.add(body, head, legs);
  return g;
}

const _pq = new THREE.Quaternion();
const _bq = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _ax = new THREE.Vector3();
