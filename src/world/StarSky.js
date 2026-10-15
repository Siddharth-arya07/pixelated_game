import * as THREE from 'three';
import { STARS, LINES, lst, toHorizontal, planets, moon, spectral, galacticToEq } from './StarCatalog.js';

/**
 * StarSky
 * -------
 * The real night sky over the map, for the in-game time on today's date,
 * seen from a New England coast (42.4° N, 70.9° W):
 *   - catalog stars (StarCatalog) coloured by spectral type, sized by
 *     magnitude, twinkling a little near the horizon
 *   - a faint random star field + the Milky Way band along the real galactic
 *     plane (decorative: these aren't catalog stars and can't be picked)
 *   - constellation stick figures (very faint, brighter in the telescope)
 *   - the Moon with its real phase, and Mercury…Saturn where they really are
 * Everything sits on a dome that follows the camera, drawn before the world
 * (terrain covers the stars below the horizon). It fades out by day, in storms
 * and a bit in the fog.
 *
 *   sky.update(game, scene)
 *   sky.pick(ray, maxAngleRad) -> { kind, name, … } | null
 *   sky.zoom = fov factor (telescope: fainter stars appear, lines brighten)
 */
export const SITE = { lat: 42.4, lon: -70.9, utcOffset: -4 };
const R = 20; // dome radius; depth is pinned to the far plane in the shaders

/** Push a material's depth to the far plane so the world always covers it. */
function farify(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(/}\s*$/, '  gl_Position.z = gl_Position.w * 0.99999;\n}');
  };
  return material;
}

export class StarSky {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.renderOrder = -10;
    this.zoom = 1;
    this.visibility = 0;
    this._lastUpdate = -1;
    this.bodies = []; // pickable: { kind, name, ra, dec, mag, …, dir: Vector3 }

    this.#buildStars();
    this.#buildField();
    this.#buildLines();
    this.#buildMoon();
    this.#buildPlanets();
  }

  // ---------------------------------------------------------------------------

  #pointsMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: { uVis: { value: 1 }, uTime: { value: 0 }, uZoom: { value: 1 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aMag;
        attribute vec3 aColor;
        attribute float aSeed;
        uniform float uVis, uTime, uZoom, uPx;
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          // Magnitude limit rises with zoom (a telescope gathers more light).
          float limit = 6.0 + 2.2 * log2(max(uZoom, 1.0));
          float b = clamp((limit - aMag) / 6.0, 0.0, 1.0);
          // altitude (dome is camera-centred, y up): extinction near the horizon
          float alt = normalize(position).y;
          float ext = smoothstep(-0.02, 0.25, alt);
          float tw = 0.85 + 0.15 * sin(uTime * (3.0 + aSeed * 5.0) + aSeed * 40.0) * (1.0 - ext * 0.7);
          vA = b * ext * uVis * tw;
          vColor = aColor;
          // Stars stay points in a telescope: more of them, not bigger ones.
          float bz = clamp((5.5 - aMag) / 7.0, 0.0, 1.0);
          gl_PointSize = uPx * (1.0 + 2.4 * pow(bz, 1.5));
          gl_Position.z = gl_Position.w * 0.99999;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float core = smoothstep(1.0, 0.0, r);
          if (vA * core < 0.01) discard;
          gl_FragColor = vec4(vColor * core * min(1.0, vA * 1.8), 1.0);
        }`,
    });
  }

  #buildStars() {
    const n = STARS.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(STARS.map((s) => s[3])), 1));
    const col = new Float32Array(n * 3);
    STARS.forEach((s, i) => {
      const { rgb } = spectral(s[5]);
      col.set(rgb.map((c) => c / 255), i * 3);
    });
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).map(() => Math.random()), 1));
    this.starMat = this.#pointsMaterial();
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -10;
    this.group.add(this.stars);
    for (const s of STARS) {
      this.bodies.push({ kind: 'star', name: s[0], ra: s[1], dec: s[2], mag: s[3], dist: s[4], sp: s[5], con: s[6], note: s[7], dir: new THREE.Vector3() });
    }
  }

  /** Faint field stars + the Milky Way: fixed RA/Dec, positioned each update like the rest. */
  #buildField() {
    const pts = [];
    const rnd = mulberry(7);
    for (let i = 0; i < 2600; i++) {
      // uniform on the sphere
      const ra = rnd() * 24;
      const dec = (Math.asin(rnd() * 2 - 1) * 180) / Math.PI;
      pts.push([ra, dec, 4.4 + rnd() * 2.6, rnd()]);
    }
    for (let i = 0; i < 5200; i++) {
      // Milky Way: concentrated near galactic latitude 0, brighter toward the centre (l = 0)
      const l = rnd() * 360;
      const b = (rnd() + rnd() + rnd() - 1.5) * 7 * (1 + 0.6 * Math.cos((l * Math.PI) / 180));
      const { ra, dec } = galacticToEq(l, b);
      pts.push([ra, dec, 5.4 + rnd() * 1.4 - 0.5 * Math.max(0, Math.cos((l * Math.PI) / 180)), rnd()]);
    }
    this.fieldEq = pts;
    const n = pts.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(pts.map((p) => p[2])), 1));
    const col = new Float32Array(n * 3);
    pts.forEach((p, i) => col.set([0.78 + p[3] * 0.2, 0.8 + p[3] * 0.12, 0.9], i * 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).map(() => Math.random()), 1));
    this.fieldMat = this.#pointsMaterial();
    this.field = new THREE.Points(geo, this.fieldMat);
    this.field.frustumCulled = false;
    this.field.renderOrder = -10;
    this.group.add(this.field);
  }

  #buildLines() {
    const byName = new Map(STARS.map((s, i) => [s[0], i]));
    this.linePairs = LINES.map(([a, b]) => [byName.get(a), byName.get(b)]).filter(([a, b]) => a !== undefined && b !== undefined);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.linePairs.length * 6), 3));
    this.lineMat = farify(new THREE.LineBasicMaterial({ color: 0x5a7aa8, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lines = new THREE.LineSegments(geo, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = -10;
    this.group.add(this.lines);
  }

  #buildMoon() {
    this.moonCanvas = document.createElement('canvas');
    this.moonCanvas.width = this.moonCanvas.height = 64;
    this.moonTex = new THREE.CanvasTexture(this.moonCanvas);
    this.moonMat = farify(new THREE.SpriteMaterial({ map: this.moonTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.moonSprite = new THREE.Sprite(this.moonMat);
    this.moonSprite.scale.setScalar(R * 0.024); // ~1.4°: bigger than real (0.5°) so it reads at 240p
    this.moonSprite.renderOrder = -9;
    this.group.add(this.moonSprite);
    this.moonBody = { kind: 'moon', name: 'The Moon', dir: new THREE.Vector3() };
    this.bodies.push(this.moonBody);
  }

  #buildPlanets() {
    this.planetSprites = new Map();
    const dot = document.createElement('canvas');
    dot.width = dot.height = 16;
    const ctx = dot.getContext('2d');
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, '#fff');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(dot);
    const tints = { Mercury: 0xd8c8b0, Venus: 0xfff4d8, Mars: 0xff8a5a, Jupiter: 0xf4e4c8, Saturn: 0xead8a0 };
    for (const name of Object.keys(tints)) {
      const s = new THREE.Sprite(farify(new THREE.SpriteMaterial({ map: tex, color: tints[name], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      s.renderOrder = -9;
      this.group.add(s);
      const body = { kind: 'planet', name, dir: new THREE.Vector3() };
      this.bodies.push(body);
      this.planetSprites.set(name, { sprite: s, body });
    }
  }

  // ---------------------------------------------------------------------------

  /** The date/time the sky is drawn for: today's real date, in-game clock time. */
  skyDate() {
    const now = new Date();
    const mins = this.game.dayNight.minutes;
    // in-game local time → UTC
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    return new Date(d.getTime() + (mins - SITE.utcOffset * 60) * 60000);
  }

  static dirFromAltAz(alt, az, out) {
    // az from north (-Z) through east (+X)
    return out.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az));
  }

  #place(raH, decDeg, lstH, out) {
    const { alt, az } = toHorizontal(raH, decDeg, lstH, SITE.lat);
    return StarSky.dirFromAltAz(alt, az, out);
  }

  update(dt, scene) {
    const g = this.game;
    if (!scene.outdoor) {
      if (this.group.parent) this.group.parent.remove(this.group);
      return;
    }
    if (this.group.parent !== scene.root) scene.root.add(this.group);
    this.group.position.copy(g.camera.position);

    // Visibility: night only, killed by storms, softened by the fog.
    const m = g.dayNight.minutes;
    const night = m < 330 ? 1 : m < 400 ? 1 - (m - 330) / 70 : m > 1200 ? 1 : m > 1130 ? (m - 1130) / 70 : 0;
    const storm = g.weather?.storm ?? 0;
    this.visibility = night * (1 - storm * 0.95) * 0.92;
    this.group.visible = this.visibility > 0.01;
    if (!this.group.visible) return;

    const px = Math.max(1, (g.renderer.target?.height ?? 240) / 240);
    for (const mat of [this.starMat, this.fieldMat]) {
      mat.uniforms.uVis.value = this.visibility;
      mat.uniforms.uTime.value = g.time;
      mat.uniforms.uZoom.value = this.zoom;
      mat.uniforms.uPx.value = px;
    }
    this.fieldMat.uniforms.uVis.value = this.visibility * 1.1;
    this.lineMat.opacity = (this.zoom > 1.5 ? 0.18 : 0.045) * this.visibility;

    // Recompute positions a few times per second (the sky turns slowly).
    this._acc = (this._acc ?? 1) + dt;
    if (this._acc < 0.25) return;
    this._acc = 0;
    const date = this.skyDate();
    const L = lst(date, SITE.lon);
    this.lstH = L;
    this.date = date;

    const pos = this.stars.geometry.attributes.position;
    STARS.forEach((s, i) => {
      const b = this.bodies[i];
      this.#place(s[1], s[2], L, b.dir);
      pos.setXYZ(i, b.dir.x * R, b.dir.y * R, b.dir.z * R);
    });
    pos.needsUpdate = true;
    const fp = this.field.geometry.attributes.position;
    this.fieldEq.forEach((p, i) => {
      this.#place(p[0], p[1], L, _v);
      fp.setXYZ(i, _v.x * R, _v.y * R, _v.z * R);
    });
    fp.needsUpdate = true;
    const lp = this.lines.geometry.attributes.position;
    this.linePairs.forEach(([a, b], k) => {
      lp.setXYZ(k * 2, pos.getX(a), pos.getY(a), pos.getZ(a));
      lp.setXYZ(k * 2 + 1, pos.getX(b), pos.getY(b), pos.getZ(b));
    });
    lp.needsUpdate = true;

    // Moon
    const mo = moon(date);
    Object.assign(this.moonBody, mo);
    this.#place(mo.ra, mo.dec, L, this.moonBody.dir);
    this.moonSprite.position.copy(this.moonBody.dir).multiplyScalar(R * 0.98);
    this.moonSprite.material.opacity = this.visibility > 0 ? Math.min(1, 0.4 + this.visibility) * (this.moonBody.dir.y > -0.02 ? 1 : 0) : 0;
    if (Math.abs((this._phase ?? -1) - mo.illum) > 0.01) {
      this._phase = mo.illum;
      drawMoon(this.moonCanvas, mo.illum, mo.waxing);
      this.moonTex.needsUpdate = true;
    }

    // Planets
    for (const p of planets(date)) {
      const e = this.planetSprites.get(p.name);
      Object.assign(e.body, p);
      this.#place(p.ra, p.dec, L, e.body.dir);
      e.sprite.position.copy(e.body.dir).multiplyScalar(R * 0.97);
      const bright = Math.max(0.25, Math.min(1, (3 - p.mag) / 6));
      e.sprite.scale.setScalar(R * 0.006 * (1 + bright * 1.5));
      e.sprite.material.opacity = this.visibility * bright * (e.body.dir.y > 0 ? 1 : 0);
    }
  }

  /**
   * Closest pickable body to a view ray (only above the horizon).
   * maxAngle in radians (scale it with FOV).
   */
  pick(dir, maxAngle) {
    if (!this.group.visible) return null;
    let best = null;
    let bestA = maxAngle;
    for (const b of this.bodies) {
      if (b.dir.y < 0) continue;
      if (b.kind === 'star' && b.mag > 6 + 2.2 * Math.log2(Math.max(this.zoom, 1))) continue;
      const a = b.dir.angleTo(dir);
      // brighter things win ties
      const score = a - (b.kind === 'star' ? 0 : 0.01) + (b.mag ?? 0) * 0.0005;
      if (score < bestA) {
        bestA = score;
        best = b;
      }
    }
    return best;
  }

  /** Alt/az of a body, in degrees + compass word. */
  where(b) {
    const alt = (Math.asin(b.dir.y) * 180) / Math.PI;
    let az = (Math.atan2(b.dir.x, -b.dir.z) * 180) / Math.PI;
    if (az < 0) az += 360;
    const words = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return { alt, az, compass: words[Math.round(az / 45) % 8] };
  }
}

/** Moon disc with the terminator for the real illuminated fraction. */
function drawMoon(c, illum, waxing) {
  const ctx = c.getContext('2d');
  const S = c.width;
  const r = S * 0.42;
  ctx.clearRect(0, 0, S, S);
  // earthshine on the dark part
  ctx.fillStyle = 'rgba(60,64,80,0.55)';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  ctx.fill();
  // lit part: half disc + an ellipse that grows/shrinks with the phase
  ctx.save();
  ctx.translate(S / 2, S / 2);
  if (!waxing) ctx.scale(-1, 1);
  ctx.fillStyle = '#f2eedc';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); // right half lit when waxing
  const k = 1 - 2 * illum; // +1 new … -1 full
  ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k < 0);
  ctx.fill();
  // maria
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(150,150,140,0.45)';
  for (const [x, y, rr] of [[-0.25, -0.2, 0.22], [0.15, -0.3, 0.15], [0.2, 0.1, 0.18], [-0.1, 0.25, 0.12]]) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, rr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _v = new THREE.Vector3();
