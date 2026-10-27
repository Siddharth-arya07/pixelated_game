import * as THREE from 'three';

/**
 * The Golden Gate Bridge, from its two tower bases (world positions).
 * International orange, art-deco towers, a catenary main cable each side,
 * suspenders, the deck with sidewalks. `far` makes a cheap silhouette for
 * seeing it from across the bay (fog barely touches it).
 *
 *   buildGoldenGate(scene, south, north, { deckY, far })  → { group, deck: [{x,z}...] }
 */
const ORANGE = 0xc0362c;

export function buildGoldenGate(scene, south, north, { deckY = 67, towerH = 227, far = false, sideSpan = 343, fog = 1 } = {}) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(north, south).setY(0);
  const span = dir.length();
  dir.normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  g.position.copy(south).setY(0);
  g.rotation.y = yaw;
  scene.root.add(g);
  const fogScale = far ? 0.08 : fog;
  const orange = scene.mat({ color: ORANGE, fogScale });
  const dark = scene.mat({ color: 0x6a1e18, fogScale });
  const road = scene.mat({ map: far ? null : scene.tex('asphalt', 1, 40), color: far ? 0x6a1e18 : 0x5a5a5a, fogScale });
  const L = span + sideSpan * 2;
  const z0 = -sideSpan;
  // deck: box girder with the road on top
  const W = 27;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 7.6, L), orange);
  deck.position.set(0, deckY - 3.8, span / 2);
  g.add(deck);
  if (!far) {
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 4, L), road);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, deckY + 0.02, span / 2);
    g.add(top);
    for (const sx of [-1, 1]) {
      // sidewalks + railings
      const sw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, L), scene.mat({ color: 0xb8b0a0 }));
      sw.position.set(sx * (W / 2 - 1.5), deckY + 0.15, span / 2);
      g.add(sw);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.3, L), orange);
      rail.position.set(sx * (W / 2 - 0.1), deckY + 0.95, span / 2);
      g.add(rail);
      // truss lines along the side
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, L), dark);
      tr.position.set(sx * (W / 2 + 0.2), deckY - 6, span / 2);
      g.add(tr);
    }
  }
  // two towers
  for (const tz of [0, span]) {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(10, towerH, 9), orange);
      leg.position.set(sx * 14, towerH / 2, tz);
      g.add(leg);
      // stepped art-deco setbacks
      for (let k = 1; k <= 3; k++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.2, 9.6), dark);
        st.position.set(sx * 14, (towerH * k) / 4, tz);
        g.add(st);
      }
    }
    // portal struts between the legs (the famous windows)
    for (const y of [deckY + 30, deckY + 75, deckY + 115, towerH - 6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(28, y === towerH - 6 ? 12 : 6, 6), orange);
      strut.position.set(0, y, tz);
      g.add(strut);
    }
    // under-deck X bracing
    const x1 = new THREE.Mesh(new THREE.BoxGeometry(2, 70, 2), orange);
    x1.position.set(0, deckY - 40, tz);
    x1.rotation.z = 0.45;
    const x2 = x1.clone();
    x2.rotation.z = -0.45;
    g.add(x1, x2);
    // pier base
    const base = new THREE.Mesh(new THREE.BoxGeometry(46, 30, 26), scene.mat({ color: 0x9a9890, fogScale }));
    base.position.set(0, -10, tz);
    g.add(base);
  }
  // main cables: catenary-ish between the tower tops, and down to the anchorages
  const cableTop = towerH - 3;
  const sag = cableTop - (deckY + 4);
  const cableY = (t) => cableTop - sag * (1 - (2 * t - 1) ** 2);
  for (const sx of [-1, 1]) {
    const pts = [];
    pts.push(new THREE.Vector3(sx * 14, deckY + 2, z0 - 20));
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push(new THREE.Vector3(sx * 14, cableY(t), t * span));
    }
    pts.push(new THREE.Vector3(sx * 14, deckY + 2, span + sideSpan + 20));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, far ? 1.5 : 0.9, 5, false), orange);
    g.add(tube);
    // suspenders every ~15 m along the main span
    if (!far) {
      const sus = [];
      for (let z = 15; z < span; z += 15) {
        const t = z / span;
        const top = cableY(t);
        const h = top - deckY;
        const geo = new THREE.BoxGeometry(0.18, h, 0.18);
        geo.translate(sx * 14, deckY + h / 2, z);
        sus.push(geo);
      }
      for (const geo of sus) g.add(new THREE.Mesh(geo, orange));
    }
  }
  // aircraft lights on the tower tops
  for (const tz of [0, span]) {
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(far ? 3 : 1, 6, 4), scene.mat({ color: 0xff3020, unlit: true, fogScale: 0 }));
      l.position.set(sx * 14, towerH + 1, tz);
      g.add(l);
    }
  }
  g.traverse((o) => o.isMesh && (o.frustumCulled = false));
  if (!far) {
    // walkable deck (sidewalk height) for the player
    const walk = new THREE.Mesh(new THREE.BoxGeometry(W, 1, L), new THREE.MeshBasicMaterial({ visible: false }));
    walk.position.set(0, deckY - 0.5 + 0.3, span / 2);
    g.add(walk);
    g.updateMatrixWorld(true);
    scene.addColliderMesh(walk, 'terrain');
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, L), new THREE.MeshBasicMaterial({ visible: false }));
      r.position.set(sx * (W / 2), deckY + 1.5, span / 2);
      g.add(r);
      g.updateMatrixWorld(true);
      scene.addColliderMesh(r);
    }
  }
  return { group: g, deckY, span, yaw, dir };
}
