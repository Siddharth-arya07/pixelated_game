/**
 * Tween
 * -----
 * Minimal property tweener ticked by Game every frame. Used for door swings,
 * viewmodel motions etc.
 *
 *   tweens.to(door.rotation, { y: -1.9 }, 0.45, { ease: 'outBack' })
 *   await tweens.to(obj.position, { y: 1 }, 0.3)   // returns a promise
 *
 * Starting a tween on a target cancels any running tween on the same target
 * for the same keys, so spamming E on a door can't make it fight itself.
 */
const EASE = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  outBack: (t) => {
    const c = 1.4;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
};

export class Tweens {
  constructor() {
    this.active = [];
  }

  to(target, props, duration, { ease = 'inOut', delay = 0 } = {}) {
    // Cancel overlapping tweens on the same target/keys.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tw = this.active[i];
      if (tw.target !== target) continue;
      for (const k of Object.keys(props)) delete tw.to[k];
      // A fully-overridden tween finishes now so nobody awaits it forever.
      if (!Object.keys(tw.to).length) {
        this.active.splice(i, 1);
        tw.resolve();
      }
    }
    return new Promise((resolve) => {
      const from = {};
      for (const k of Object.keys(props)) from[k] = target[k];
      this.active.push({ target, from, to: { ...props }, duration: Math.max(duration, 1e-4), t: -delay, ease: EASE[ease] ?? EASE.inOut, resolve });
    });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tw = this.active[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(tw.t / tw.duration, 1);
      const e = tw.ease(k);
      for (const key of Object.keys(tw.to)) tw.target[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
      if (k >= 1) {
        this.active.splice(i, 1);
        tw.resolve();
      }
    }
  }
}
