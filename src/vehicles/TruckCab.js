import * as THREE from 'three';

/**
 * TruckCab
 * --------
 * The pickup's interior, built in code around the driver's seat (the
 * low-poly model is just a shell). Vehicle space: +Z forward, +X = the
 * driver's side, cab roughly x ±1, z -0.6…0.95, floor ~0.8, roof 1.88.
 *
 *  - dash with a hooded, backlit gauge cluster (speedo needle, fuel, temp,
 *    headlight / handbrake tells) drawn into a live canvas
 *  - 3-spoke wheel with a horn pad on a column, column shifter
 *  - cassette radio: Q on/off, N next track; the LCD shows what's playing
 *  - bench seat, door cards with window sills, A-pillars, headliner,
 *    visors, back window
 *  - rear-view mirror with a pine-tree air freshener that swings with the
 *    truck's acceleration and steering
 *  - in the rain: drops collect on the windshield and two wipers clear them
 */
export function buildTruckCab(v) {
  const r = v.game.renderer;
  const seat = v.cfg.seat; // eye position
  const dx = seat.x; // driver's column x
  const M = (color, extra = {}) => r.material({ color, ...extra });
  const vinyl = M(0x2a2622);
  const plastic = M(0x1c1b1e);
  const trim = M(0x3e3a34);
  const cloth = M(0x4a3a30);
  const cab = new THREE.Group();
  v.object.add(cab);
  const box = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    cab.add(m);
    return m;
  };

  // ---- shell ------------------------------------------------------------------
  box(2.0, 0.04, 1.55, M(0x5a5248), 0, 1.85, 0.18); // headliner
  box(2.0, 0.12, 0.08, trim, 0, 1.79, 0.55); // windshield header
  for (const s of [-1, 1]) {
    // A-pillars, leaning back from the dash to the header
    const len = Math.hypot(0.65, 0.42);
    box(0.07, len, 0.07, trim, s * 0.96, 1.48, 0.76, -Math.atan2(0.42, 0.65));
    // door card + sill + armrest + handle
    box(0.05, 0.5, 1.35, vinyl, s * 1.0, 1.02, 0.12);
    box(0.1, 0.05, 1.35, trim, s * 0.97, 1.29, 0.12);
    box(0.08, 0.05, 0.35, plastic, s * 0.95, 1.12, 0.05);
    box(0.03, 0.03, 0.1, M(0x8a8a90), s * 0.96, 1.2, 0.42);
    // B-pillar
    box(0.08, 0.6, 0.08, trim, s * 0.97, 1.56, -0.55);
    // sun visor
    box(0.55, 0.02, 0.22, cloth, s * 0.45, 1.81, 0.4, -0.12);
  }
  // back wall + rear window frame
  box(2.0, 0.55, 0.05, vinyl, 0, 1.03, -0.62);
  box(2.0, 0.07, 0.06, trim, 0, 1.31, -0.62);
  box(2.0, 0.07, 0.06, trim, 0, 1.82, -0.62);
  for (const s of [-1, 0, 1]) box(0.07, 0.55, 0.06, trim, s * 0.95, 1.57, -0.62);
  // bench seat (cracked vinyl)
  box(1.9, 0.18, 0.6, cloth, 0, 0.98, -0.25);
  box(1.9, 0.62, 0.14, cloth, 0, 1.35, -0.54, -0.12);
  box(1.95, 0.05, 1.3, M(0x161514), 0, 0.82, 0.25); // floor mat

  // ---- dashboard --------------------------------------------------------------
  box(1.96, 0.26, 0.42, plastic, 0, 1.06, 0.8); // main slab
  box(1.96, 0.05, 0.36, vinyl, 0, 1.2, 0.86, -0.25); // top pad, sloping to the glass
  // Binnacle: sits up on the dash so the gauges show over the wheel rim.
  box(0.5, 0.16, 0.22, plastic, dx, 1.24, 0.74); // housing
  box(0.52, 0.03, 0.2, plastic, dx, 1.335, 0.66, 0.3); // hood
  box(0.46, 0.16, 0.02, M(0x0c0c0e), dx, 1.255, 0.632, -0.3); // bezel
  // gauge cluster face (live canvas)
  const gc = document.createElement('canvas');
  gc.width = 256;
  gc.height = 96;
  const gtex = new THREE.CanvasTexture(gc);
  gtex.userData.live = true;
  gtex.magFilter = THREE.LinearFilter;
  gtex.minFilter = THREE.LinearFilter;
  const gauges = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), r.material({ map: gtex, unlit: true, fogScale: 0, affine: 0 }));
  gauges.position.set(dx, 1.255, 0.62);
  gauges.rotation.set(-0.3, Math.PI, 0);
  cab.add(gauges);
  // glovebox + vents
  box(0.5, 0.16, 0.02, trim, -0.5, 1.02, 0.585);
  for (const x of [-0.15, 0.15]) box(0.14, 0.06, 0.02, M(0x0a0a0a), x, 1.15, 0.585);

  // ---- radio (centre stack) ---------------------------------------------------
  box(0.32, 0.12, 0.05, M(0x121214), 0, 0.98, 0.585);
  const rc = document.createElement('canvas');
  rc.width = 128;
  rc.height = 32;
  const rtex = new THREE.CanvasTexture(rc);
  rtex.userData.live = true;
  rtex.magFilter = THREE.NearestFilter;
  rtex.minFilter = THREE.NearestFilter;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), r.material({ map: rtex, unlit: true, fogScale: 0, affine: 0 }));
  lcd.position.set(0, 1.0, 0.558);
  lcd.rotation.y = Math.PI;
  cab.add(lcd);
  box(0.12, 0.015, 0.02, M(0x050505), 0, 0.955, 0.558); // cassette slot
  for (const x of [-0.13, 0.13]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), M(0x6a6a70));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x, 0.98, 0.55);
    cab.add(knob);
  }
  const radioSpeaker = new THREE.Object3D();
  radioSpeaker.position.set(0, 1.0, 0.6);
  cab.add(radioSpeaker);

  // ---- steering column, wheel, shifter -----------------------------------------
  const col = box(0.07, 0.07, 0.42, plastic, dx, 1.04, 0.42, -0.42);
  void col;
  const holder = new THREE.Group();
  holder.position.set(dx, seat.y - 0.42, seat.z + 0.48);
  holder.rotation.x = -1.15; // tilted toward the driver
  cab.add(holder);
  const wheel = new THREE.Group();
  holder.add(wheel);
  const wheelMat = M(0x2a2a2e);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 5, 16), wheelMat));
  for (const a of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 - (Math.PI * 2) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.025, 0.015), wheelMat);
    spoke.position.set(-Math.cos(a) * 0.09, -Math.sin(a) * 0.09, 0);
    spoke.rotation.z = a;
    wheel.add(spoke);
  }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10), M(0x3a3a40));
  pad.rotation.x = Math.PI / 2;
  wheel.add(pad);
  const shifter = box(0.02, 0.02, 0.22, M(0x8a8a90), dx - 0.18, 1.06, 0.5, 0.3, 0.5);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), M(0x101010));
  knob.position.z = -0.11;
  shifter.add(knob);
  v.steeringWheel = wheel;

  // ---- mirror + air freshener ------------------------------------------------------
  box(0.04, 0.08, 0.04, plastic, 0, 1.77, 0.56);
  box(0.26, 0.07, 0.025, plastic, 0, 1.71, 0.55);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.055), M(0x2a3444, { emissive: 0.15 }));
  glass.position.set(0, 1.71, 0.536);
  cab.add(glass);
  const fresh = new THREE.Group();
  fresh.position.set(0.02, 1.67, 0.55);
  cab.add(fresh);
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.08, 0.004), M(0xd0d0c0));
  string.position.y = -0.04;
  fresh.add(string);
  const tree = new THREE.Mesh(treeShape(), M(0x1e6a2c, { doubleSide: true }));
  tree.scale.setScalar(0.6);
  tree.position.y = -0.075;
  fresh.add(tree);

  // ---- wipers + rain on the glass ----------------------------------------------------
  // Windshield plane: bottom edge (y 1.2, z 0.98) up to the header (y 1.78, z 0.6).
  const glassBottom = new THREE.Vector3(0, 1.2, 0.98);
  const glassUp = new THREE.Vector3(0, 0.58, -0.38).normalize();
  const glassLen = 0.69;
  const wipers = [];
  for (const px of [0.45, -0.25]) {
    const pivot = new THREE.Group();
    pivot.position.set(px, glassBottom.y + 0.01, glassBottom.z - 0.01);
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.38, 0.58).normalize()); // glass normal (outward-ish)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.012), M(0x0a0a0a));
    arm.position.y = 0.3;
    const sway = new THREE.Group();
    sway.add(arm);
    pivot.add(sway);
    cab.add(pivot);
    wipers.push({ sway, px });
  }
  const DROPS = 70;
  const dropGeo = new THREE.PlaneGeometry(0.018, 0.026);
  const dropMat = M(0xb8c8d8, { unlit: true, opacity: 0.5, fogScale: 0 });
  const drops = [];
  for (let i = 0; i < DROPS; i++) {
    const d = new THREE.Mesh(dropGeo, dropMat);
    d.visible = false;
    d.quaternion.copy(wipers[0].sway.parent.quaternion);
    cab.add(d);
    drops.push({ mesh: d, u: 0, w: 0, slide: 0 });
  }

  // ---- runtime ------------------------------------------------------------------------
  const g = v.game;
  let gaugeT = 0;
  let wipeA = 0;
  let wipeDir = 1;
  let swing = 0;
  let swingV = 0;
  let lastSpeed = 0;
  let lastSteer = 0;
  let spawn = 0;

  (g.devices ??= new Map()).set('truck:radio', { obj: radioSpeaker });
  v.radioToggle = () => {
    const m = g.music;
    if (m.speakerObject === radioSpeaker && m.playing) {
      m.pause();
      g.hud.toast('Radio off.');
    } else {
      m.useSpeaker(radioSpeaker);
      m.play();
      g.hud.toast(`♪ ${m.current.artist} — ${m.current.title}`);
    }
    g.audio.oneShot('click');
    setTimeout(() => g.mp?.shareMusic('truck:radio'), 300);
  };
  v.radioNext = () => {
    const m = g.music;
    if (m.speakerObject !== radioSpeaker || !m.playing) return v.radioToggle();
    m.next();
    g.hud.toast(`♪ ${m.current.artist} — ${m.current.title}`);
    g.audio.oneShot('click');
  };

  v.cabUpdate = (dt) => {
    const driving = g.vehicle.active === v;
    if (!driving) return;

    // Gauges + radio LCD at ~15 fps.
    gaugeT -= dt;
    if (gaugeT <= 0) {
      gaugeT = 1 / 15;
      drawGauges(gc, v, g);
      gtex.needsUpdate = true;
      const m = g.music;
      const on = m.speakerObject === radioSpeaker && m.playing;
      drawRadio(rc, on ? `${m.current.title}  ` : 'FM 88.1  Q:ON', g.time, on);
      rtex.needsUpdate = true;
    }

    // Air freshener: pendulum pushed by acceleration + turning.
    const acc = (v.speed - lastSpeed) / Math.max(dt, 1e-3);
    lastSpeed = v.speed;
    const turn = (v.steer - lastSteer) / Math.max(dt, 1e-3);
    lastSteer = v.steer;
    swingV += (-swing * 30 - swingV * 1.6 - acc * 0.25) * dt;
    swing += swingV * dt;
    fresh.rotation.x = THREE.MathUtils.clamp(swing, -0.8, 0.8);
    fresh.rotation.z = THREE.MathUtils.damp(fresh.rotation.z, THREE.MathUtils.clamp(-v.steer * Math.abs(v.speed) * 0.08 - turn * 0.02, -0.7, 0.7), 4, dt);

    // Rain on the glass + wipers.
    const rain = g.weather?.rain ?? 0;
    const wiping = rain > 0.12 || wipeA > 0.02;
    if (wiping) {
      wipeA += wipeDir * dt * 1.9;
      if (wipeA > 1.6) wipeDir = -1;
      if (wipeA < 0) {
        wipeA = 0;
        wipeDir = rain > 0.12 ? 1 : 0;
      }
    }
    for (const w of wipers) w.sway.rotation.z = -wipeA;
    spawn += dt * rain * 40;
    while (spawn > 1) {
      spawn -= 1;
      const d = drops.find((x) => !x.mesh.visible) ?? drops[Math.floor(Math.random() * DROPS)];
      d.u = (Math.random() - 0.5) * 1.7; // across
      d.w = 0.05 + Math.random() * 0.6; // up the glass
      d.slide = Math.random() < 0.3 ? 0.03 + Math.random() * 0.05 : 0;
      d.mesh.visible = true;
    }
    for (const d of drops) {
      if (!d.mesh.visible) continue;
      d.w -= d.slide * dt;
      if (d.w < 0) d.mesh.visible = false;
      // Wiped? Angle of the drop around each wiper pivot vs the blade angle.
      for (const w of wipers) {
        const a = Math.atan2(-(d.u - w.px), d.w);
        if (Math.hypot(d.u - w.px, d.w) < 0.62 && Math.abs(a - wipeA) < 0.08) d.mesh.visible = false;
      }
      d.mesh.position.set(d.u, glassBottom.y, glassBottom.z).addScaledVector(glassUp, d.w * (glassLen / 0.69));
      d.mesh.position.z -= 0.012; // just inside the glass
    }
  };
}

/** Flat little pine tree for the air freshener. */
function treeShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  const pts = [[0.03, -0.025], [0.012, -0.025], [0.04, -0.055], [0.015, -0.055], [0.05, -0.09], [0.006, -0.09], [0.006, -0.105]];
  for (const [x, y] of pts) s.lineTo(x, y);
  for (const [x, y] of pts.slice().reverse()) s.lineTo(-x, y);
  s.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(s);
  return geo;
}

function drawGauges(c, v, g) {
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.fillStyle = '#060504';
  ctx.fillRect(0, 0, W, H);
  const amber = '#ffb347';
  const glow = (on) => {
    ctx.shadowColor = on ? amber : 'transparent';
    ctx.shadowBlur = on ? 6 : 0;
  };
  // Speedometer (centre): 0–60 mph over 240°.
  const cx = W / 2;
  const cy = 58;
  const R = 40;
  const mph = Math.abs(v.speed) * 2.237;
  ctx.strokeStyle = amber;
  ctx.fillStyle = amber;
  ctx.lineWidth = 2;
  glow(true);
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.83, Math.PI * 2.17);
  ctx.stroke();
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  for (let s = 0; s <= 60; s += 10) {
    const a = Math.PI * 0.83 + (s / 60) * Math.PI * 1.34;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
    ctx.fillText(String(s), cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14) + 3);
  }
  const a = Math.PI * 0.83 + (Math.min(mph, 62) / 60) * Math.PI * 1.34;
  ctx.strokeStyle = '#ff3a20';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
  ctx.stroke();
  ctx.fillStyle = amber;
  ctx.font = '8px monospace';
  ctx.fillText('MPH', cx, cy + 22);

  // Fuel (left) and temp (right): small arcs.
  const small = (x, label, k) => {
    ctx.strokeStyle = amber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, 60, 20, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    const aa = Math.PI * 1.15 + k * Math.PI * 0.7;
    ctx.strokeStyle = '#ff3a20';
    ctx.beginPath();
    ctx.moveTo(x, 60);
    ctx.lineTo(x + Math.cos(aa) * 18, 60 + Math.sin(aa) * 18);
    ctx.stroke();
    ctx.fillStyle = amber;
    ctx.fillText(label, x, 76);
  };
  small(36, 'FUEL', 0.38);
  small(W - 36, 'TEMP', 0.45 + Math.min(0.2, Math.abs(v.speed) * 0.01));
  glow(false);
  // Tell-tales: high beams (blue), brake (red).
  ctx.fillStyle = v.headlightsOn ? '#4a8aff' : '#101820';
  ctx.fillRect(18, 8, 14, 6);
  ctx.fillStyle = g.input.down('Space') || Math.abs(v.speed) < 0.1 ? '#ff2a1a' : '#201010';
  ctx.fillRect(W - 32, 8, 14, 6);
  ctx.fillStyle = '#806040';
  ctx.font = '7px monospace';
  ctx.fillText(`${String(Math.floor(g.dayNight.minutes / 60) % 12 || 12).padStart(2, ' ')}:${String(Math.floor(g.dayNight.minutes % 60)).padStart(2, '0')}`, cx, 12);
}

function drawRadio(c, text, t, on) {
  const ctx = c.getContext('2d');
  ctx.fillStyle = on ? '#0e2a14' : '#081008';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = on ? '#7dff9a' : '#2a6a3a';
  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'middle';
  // Marquee scroll for long titles.
  const w = ctx.measureText(text).width;
  const x = w > c.width - 8 ? 4 - ((t * 30) % (w + 20)) : 4;
  ctx.fillText(text, x, c.height / 2);
  if (w > c.width - 8) ctx.fillText(text, x + w + 20, c.height / 2);
}
