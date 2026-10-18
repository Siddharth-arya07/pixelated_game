import * as THREE from 'three';

/**
 * WishingWell
 * -----------
 * An old stone well at the edge of Pine Hollow Park. Toss in a quarter and
 * make a wish: one per night. Something small and nice happens:
 *
 *   a shooting star · a swirl of fireflies out of the well · a heart in the
 *   sky · a music box from nowhere · $5 you didn't know you had · a quiet
 *   message · a burst of meteors, if it's a shower night
 */
export function buildWishingWell(scene, x, z) {
  const g = scene.game;
  const y = scene.groundHeight(x, z);
  const stone = scene.mat({ color: 0x8a8a90 });
  const stone2 = scene.mat({ color: 0x6e6e76 });
  const wood = scene.mat({ map: scene.tex('planks', 1, 1), color: 0x8a6a48 });
  // ring of stones
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    for (let row = 0; row < 3; row++) {
      const aa = a + (row % 2 ? Math.PI / 14 : 0);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), row % 2 ? stone2 : stone);
      b.position.set(x + Math.cos(aa) * 0.95, y + 0.14 + row * 0.28, z + Math.sin(aa) * 0.95);
      b.rotation.y = -aa + Math.PI / 2;
      scene.root.add(b);
    }
  }
  scene.addColliderBox(x, y + 0.45, z, 2.2, 0.9, 2.2);
  // dark water down inside
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), scene.mat({ color: 0x0a1424, unlit: true }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y + 0.45, z);
  scene.root.add(water);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), scene.mat({ color: 0xc8d8ff, unlit: true }));
  glint.rotation.x = -Math.PI / 2;
  glint.position.set(x + 0.2, y + 0.46, z - 0.15);
  scene.root.add(glint);
  // posts, roof, crank, bucket
  for (const dx of [-0.95, 0.95]) scene.box(0.12, 1.9, 0.12, wood, x + dx, y + 0.95, z, { collide: false });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), scene.mat({ color: 0x5a2a24 }));
  roof.position.set(x, y + 2.25, z);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.6;
  scene.root.add(roof);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), wood);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(x, y + 1.55, z);
  scene.root.add(axle);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 8), wood);
  bucket.position.set(x, y + 1.1, z);
  scene.root.add(bucket);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 3), scene.mat({ color: 0xc8b890 }));
  rope.position.set(x, y + 1.35, z);
  scene.root.add(rope);
  scene.addLight({ position: [x, y + 0.7, z], color: 0x8ab0ff, range: 3, intensity: 0.5 });

  let lastNight = -1;
  const vol = scene.interactVolume(x, y + 0.7, z, 2.2, 1.4, 2.2, {
    prompt: () => (lastNight === g.dayNight.day ? 'Look down the well' : 'Toss a quarter & make a wish'),
    action: () => {
      if (lastNight === g.dayNight.day) {
        g.hud.toast(pick(['Your quarter is down there somewhere, glinting.', 'One wish a night. That’s the rule. Nobody made the rule, it just is.', 'You hear a tiny echo of your own breathing.']), 3500);
        return;
      }
      if (!g.inventory.spend(0.25)) {
        g.hud.toast('Not even a quarter. Wish anyway: it’s free in your head.', 3500);
        return;
      }
      lastNight = g.dayNight.day;
      g.audio.oneShot('click', { volume: 0.4, rate: 2.2 });
      setTimeout(() => plink(g), 900);
      setTimeout(() => grant(g, new THREE.Vector3(x, y, z)), 1700);
    },
  });
  void vol;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function plink(g) {
  const ctx = g.audio.ctx;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.15);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0.15, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(gn).connect(g.audio.master);
  o.start(t);
  o.stop(t + 0.7);
}

function grant(g, at) {
  const night = g.meteors.dark;
  const options = [
    night && (() => {
      g.meteors.spawn(true);
      g.hud.toast('A shooting star, right on cue. Your wish is on its way.', 4500);
    }),
    night && (() => {
      const F = g.fireflies;
      const c = at.clone().add(new THREE.Vector3(0, 0.6, 0));
      for (let i = 0; i < 40; i++) F.released.push({ p: c.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 1.5), t: 0 });
      if (F.points.parent !== g.scene.root) g.scene.root.add(F.points);
      g.hud.toast('Fireflies spill up out of the well like it was full of them.', 4500);
    }),
    () => {
      g.fireworks.light('fw_heart', at.clone().add(new THREE.Vector3(3, 0, -3)), 1);
      g.hud.toast('Something fizzes in the grass behind the well…', 3500);
    },
    () => {
      g.inventory.earn(5);
      g.hud.toast('You reach into your pocket and find a crumpled $5 you don’t remember. Thanks, well.', 4500);
    },
    () => {
      musicBox(g);
      g.hud.toast('From somewhere down in the well: a music box, playing just for a moment.', 4500);
    },
    () => g.hud.toast(pick(['The well says nothing. That’s how you know it’s listening.', 'You don’t say the wish out loud. That’s important.', 'Somewhere, someone you love just smiled for no reason.', 'It’s going to be okay. The well is pretty sure.']), 5000),
    night && g.meteors.shower && (() => {
      for (let i = 0; i < 6; i++) setTimeout(() => g.meteors.spawn(i === 5), i * 350);
      g.hud.toast('Six shooting stars at once. That has to count for something.', 4500);
    }),
  ].filter(Boolean);
  pick(options)();
}

function musicBox(g) {
  const ctx = g.audio.ctx;
  const notes = [0, 4, 7, 12, 11, 7, 9, 5, 4, 2, 0];
  notes.forEach((n, i) => {
    const t = ctx.currentTime + i * 0.38;
    const o = ctx.createOscillator();
    o.frequency.value = 783.99 * Math.pow(2, n / 12);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.06, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(gn).connect(g.audio.master);
    o.start(t);
    o.stop(t + 1.5);
  });
}
