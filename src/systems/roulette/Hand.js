import * as THREE from 'three';

/**
 * Hand
 * ----
 * One of the white rigged hands (J-Toastie's "Rigged Hand", CC-BY 3.0;
 * br_hand_l / br_hand_r). `root` is the wrist: in its local space the hand
 * lies palm down with the fingers pointing along -Z, whatever the model's own
 * axes are (worked out from the bones on load).
 *
 * Fingers are posed with five curl values (0 = straight, 1 = fist):
 *   hand.curl.index = 0.5   or   hand.pose('grip')
 * Each knuckle bends about an axis computed once from the rest pose
 * (finger direction × palm normal), so the curl always closes toward the palm.
 */
export const POSES = {
  rest: { thumb: 0.25, index: 0.22, middle: 0.26, ring: 0.3, pinky: 0.34 },
  flat: { thumb: 0.05, index: 0.04, middle: 0.04, ring: 0.05, pinky: 0.06 },
  grip: { thumb: 0.75, index: 0.82, middle: 0.9, ring: 0.92, pinky: 0.95 },
  trigger: { thumb: 0.7, index: 0.45, middle: 0.9, ring: 0.92, pinky: 0.95 },
  cup: { thumb: 0.5, index: 0.55, middle: 0.6, ring: 0.62, pinky: 0.65 },
  pinch: { thumb: 0.55, index: 0.58, middle: 0.75, ring: 0.85, pinky: 0.9 },
  point: { thumb: 0.65, index: 0.0, middle: 0.95, ring: 0.95, pinky: 0.95 },
  claw: { thumb: 0.4, index: 0.45, middle: 0.5, ring: 0.5, pinky: 0.5 },
  limp: { thumb: 0.35, index: 0.4, middle: 0.45, ring: 0.5, pinky: 0.55 },
};
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const CHAINS = {
  thumb: ['ThumbRoot', 'ThumbMiddle', 'ThumbTop'],
  index: ['IndexF_lower', 'IndexF_middle', 'IndexF_tip'],
  middle: ['MiddleF_lower', 'MiddleF_middle', 'MiddleF_tip'],
  ring: ['RingF_lower', 'RingF_middle', 'RingF_tip'],
  pinky: ['PinkyF_lower', 'PinkyF_middle', 'PinkyF_tip'],
};
// how far each joint bends at curl 1 (radians)
const BEND = { thumb: [0.55, 0.7, 0.9], other: [1.45, 1.6, 1.1] };
const LENGTH = 0.19; // wrist to fingertip, metres

export class Hand {
  /** side: 'l' | 'r'; color: tint (white by default) */
  constructor(game, side, { color = 0xf2f0ec, scale = 1 } = {}) {
    this.game = game;
    this.side = side;
    this.root = new THREE.Group();
    this.root.name = `hand_${side}`;
    this.curl = { ...POSES.rest };
    this.joints = [];
    const model = game.assets.model(`br_hand_${side}`);
    if (!model) {
      // procedural stand-in: a pale mitten
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.17), game.renderer.material({ color }));
      m.position.z = -0.08;
      this.root.add(m);
      return;
    }
    this.model = model;
    model.updateMatrixWorld(true);
    const bones = {};
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.frustumCulled = false;
        o.material = game.renderer.cloneMaterial(o.material);
        o.material.uniforms.uColor.value.set(color);
        o.material.uniforms.uUseMap.value = false;
      }
    });
    const wp = (n) => bones[n].getWorldPosition(new THREE.Vector3());
    const wrist = wp('HandMain');
    const knuckle = wp('MiddleF_lower');
    const tip = wp('MiddleF_tip');
    const fwd = knuckle.clone().sub(wrist).normalize();
    // palm side = where the fingertips droop toward
    const palm = tip.clone().sub(knuckle);
    palm.addScaledVector(fwd, -palm.dot(fwd)).normalize();
    // model basis → our basis (fingers -Z, palm -Y)
    const z = fwd.clone().negate();
    const y = palm.clone().negate();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    y.crossVectors(z, x).normalize();
    const basis = new THREE.Matrix4().makeBasis(x, y, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis).invert();
    const len = tip.distanceTo(wrist) * 1.08;
    const s = (LENGTH * scale) / Math.max(len, 1e-4);
    this.pivot = new THREE.Group();
    this.pivot.quaternion.copy(q);
    this.pivot.scale.setScalar(s);
    model.position.copy(wrist).negate();
    this.pivot.add(model);
    this.root.add(this.pivot);
    this.root.updateMatrixWorld(true);

    // knuckle axes, in each bone's parent space
    const palmW = new THREE.Vector3(0, -1, 0); // in root space after the basis change
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    for (const f of FINGERS) {
      CHAINS[f].forEach((name, j) => {
        const b = bones[name];
        if (!b) return;
        const next = bones[CHAINS[f][j + 1]] ?? b.children.find((c) => c.isBone) ?? null;
        const a = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
        const c = next ? next.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot) : a.clone().add(new THREE.Vector3(0, 0, -0.02));
        const dir = c.clone().sub(a).normalize();
        let axis = new THREE.Vector3().crossVectors(dir, palmW).normalize();
        if (f === 'thumb') {
          // the thumb folds across the palm toward the little finger
          const across = new THREE.Vector3(side === 'l' ? -1 : 1, 0, 0);
          axis = new THREE.Vector3().crossVectors(dir, palmW.clone().add(across).normalize()).normalize();
        }
        // root-space axis → parent space of this bone
        const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
        const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
        const axisW = axis.clone().applyQuaternion(rq);
        const local = axisW.applyQuaternion(pq.invert()).normalize();
        // sign: a positive bend must move the next joint toward the palm
        const test = this.#bendTest(b, local, next, palmW, toRoot);
        this.joints.push({ bone: b, axis: test ? local : local.negate(), rest: b.quaternion.clone(), f, j });
      });
    }
    this.apply();
  }

  #bendTest(bone, axis, next, palmW, toRoot) {
    if (!next) return true;
    const before = next.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    const keep = bone.quaternion.clone();
    bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, 0.3));
    bone.updateMatrixWorld(true);
    const after = next.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    bone.quaternion.copy(keep);
    bone.updateMatrixWorld(true);
    return after.sub(before).dot(palmW) > 0;
  }

  /** Snap the curls to a named pose (or tween via the animator). */
  pose(name) {
    Object.assign(this.curl, POSES[name] ?? name);
    this.apply();
  }

  apply() {
    for (const jt of this.joints) {
      const k = this.curl[jt.f] ?? 0;
      const bend = (jt.f === 'thumb' ? BEND.thumb : BEND.other)[jt.j] * k;
      jt.bone.quaternion.copy(jt.rest).premultiply(_q.setFromAxisAngle(jt.axis, bend));
    }
  }

  /** World position of the wrist (for the avatar's arm IK). */
  wrist(out) {
    return this.root.getWorldPosition(out);
  }
}

const _q = new THREE.Quaternion();
