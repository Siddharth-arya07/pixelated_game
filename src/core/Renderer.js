import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSharedUniforms, createPSXMaterial, MAX_LIGHTS, TEXTURES, FILTER, applyFilter } from '../render/PSXMaterial.js';
import { Water } from '../render/Water.js';

/**
 * Renderer
 * --------
 * Our own PS1 pipeline (no three-psx any more):
 *
 *   scene ──► low-res target (240 lines, width follows the window aspect so
 *             pixels stay square) ──► post pass ──► canvas (nearest upscale)
 *
 * Post pass, in order: drunk distortion (screen-space only — it never touches
 * geometry, so nothing "breaks" after a beer) → cheap bloom → vignette →
 * 4×4 Bayer dither → 15-bit colour quantisation.
 *
 * Every surface uses `renderer.material(opts)` (see render/PSXMaterial.js),
 * which links the shared lighting/fog/snapping uniforms owned here.
 */

// The PS1 lit in gamma space and our pipeline does no sRGB re-encode, so hex
// colours are used as-is (with colour management on they'd come out darker).
THREE.ColorManagement.enabled = false;

const POST_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAGMENT = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uLevels;
  uniform float uDither;
  uniform float uDrunk;
  uniform float uHigh;
  uniform float uTime;
  uniform float uBloom;
  uniform float uThreshold;
  uniform float uVignette;
  varying vec2 vUv;

  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  vec3 scene(vec2 uv) { return texture2D(tScene, clamp(uv, vec2(0.001), vec2(0.999))).rgb; }

  void main() {
    float dk = clamp(uDrunk, 0.0, 1.0);
    vec2 uv = vUv;
    if (dk > 0.0) {
      uv.x += sin(vUv.y * 7.0 + uTime * 1.3) * 0.006 * dk;
      uv.y += sin(vUv.x * 5.0 + uTime * 0.9) * 0.004 * dk;
      uv = (uv - 0.5) * (1.0 - 0.02 * dk * (0.5 + 0.5 * sin(uTime * 0.5))) + 0.5;
    }
    float hw = clamp(uHigh, 0.0, 1.0);
    if (hw > 0.0) {
      // slow breathing warp
      vec2 d = vUv - 0.5;
      uv = 0.5 + d * (1.0 - 0.025 * hw * (0.5 + 0.5 * sin(uTime * 0.7)));
      uv.y += sin(vUv.x * 4.0 + uTime * 0.5) * 0.004 * hw;
    }
    vec3 c = scene(uv);

    // Double vision: blend (not max) a drifting ghost image.
    if (dk > 0.0) {
      vec2 off = vec2(sin(uTime * 0.7), cos(uTime * 0.53)) * 0.012 * dk;
      c = mix(c, scene(uv + off), 0.4 * dk);
      c.r = mix(c.r, scene(uv + off * 0.5).r, 0.25 * dk);
    }

    // Cheap low-res bloom: a ring of taps over a brightness threshold.
    if (uBloom > 0.0) {
      vec2 px = 1.0 / uRes;
      vec3 glow = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = 6.2832 * float(i) / 8.0;
        vec3 s = scene(uv + vec2(cos(a), sin(a)) * 2.0 * px);
        float l = dot(s, vec3(0.299, 0.587, 0.114));
        glow += s * max(l - uThreshold, 0.0) / max(1.0 - uThreshold, 0.001);
      }
      c += glow / 8.0 * uBloom;
    }

    // High: colour fringes toward the edges, saturated warm colours that
    // slowly drift in hue, a soft glow, and a vignette that breathes.
    float hk = clamp(uHigh, 0.0, 1.0);
    if (hk > 0.0) {
      vec2 dir = (vUv - 0.5) * 0.03 * hk;
      c.r = mix(c.r, scene(uv + dir).r, 0.8 * hk);
      c.b = mix(c.b, scene(uv - dir).b, 0.8 * hk);
      vec3 soft = (scene(uv + vec2(0.006, 0.0)) + scene(uv - vec2(0.006, 0.0)) + scene(uv + vec2(0.0, 0.008)) + scene(uv - vec2(0.0, 0.008))) * 0.25;
      c = mix(c, max(c, soft * 1.3), 0.7 * hk);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.0 + 1.3 * hk);
      float hue = uTime * 0.15;
      vec3 tint = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + hue);
      c *= mix(vec3(1.0), vec3(1.12, 1.0, 0.86) * (0.8 + 0.4 * tint), hk);
    }

    float v = distance(vUv, vec2(0.5));
    c *= 1.0 - smoothstep(0.45, 0.9, v) * (uVignette + 0.45 * dk + hk * (0.25 + 0.15 * sin(uTime * 0.8)));

    // Ordered dither + 15-bit quantisation.
    float b = bayer4(floor(vUv * uRes));
    c += (b - 0.5) * uDither / uLevels;
    c = floor(clamp(c, 0.0, 1.0) * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export class Renderer {
  constructor(mount) {
    const r = CONFIG.render;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = true;
    this.domElement = this.renderer.domElement;
    mount.appendChild(this.domElement);

    this.shared = createSharedUniforms();
    this.shared.uJitter.value = r.jitter;
    this.shared.uAffine.value = r.affine;
    this.water = new Water(this.shared);

    this.target = new THREE.WebGLRenderTarget(r.width, r.height, {
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      depthBuffer: true,
    });

    this.post = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(r.width, r.height) },
        uLevels: { value: Math.pow(2, r.colorBits) - 1 },
        uDither: { value: r.dither },
        uDrunk: { value: 0 },
        uHigh: { value: 0 },
        uTime: { value: 0 },
        uBloom: { value: r.bloom },
        uThreshold: { value: r.bloomThreshold },
        uVignette: { value: 0.25 },
      },
    });
    this.postScene = new THREE.Scene();
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.lines = r.height; // internal line count (240 = PS1)
    this.baseLines = r.height;
    this.fogMul = 1;
    this.retro = r.jitter;
    this.preset = 'ps1';
    this.fogColor = new THREE.Color(CONFIG.fog.color);
    this._scored = [];
    this._matCache = new WeakMap();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Aspect ratio of the output (and the game camera). */
  get aspect() {
    return this.outW / Math.max(1, this.outH);
  }

  resize() {
    this.outW = window.innerWidth;
    this.outH = window.innerHeight;
    this.renderer.setSize(this.outW, this.outH);
    // Fixed line count, width follows the aspect → square pixels.
    const h = this.lines;
    const w = Math.min(1920, Math.max(160, Math.round((h * this.aspect) / 2) * 2));
    this.target.setSize(w, h);
    this.shared.uResolution.value.set(w, h);
    this.post.uniforms.uRes.value.set(w, h);
    this.onResize?.(this.aspect);
  }

  /** Temporarily change the internal resolution (e.g. 480 to read the laptop). */
  setLines(n) {
    if (n === this.lines) return;
    this.lines = n;
    this.resize();
  }

  /** New PSX material (see render/PSXMaterial.js for options). */
  material(opts = {}) {
    return createPSXMaterial(this.shared, opts);
  }

  /** Clone a PSX material for per-object tweaks, keeping shared uniforms linked. */
  cloneMaterial(m) {
    const c = m.clone();
    for (const k of Object.keys(this.shared)) c.uniforms[k] = this.shared[k];
    c.name = m.name;
    return c;
  }

  /**
   * Replace all materials under a (GLTF) root with PSX materials. Converts
   * glTF's linear colours to the gamma-space values the pipeline expects,
   * keeps material names (scenes look up 'glass', 'lamp', 'Headlights'…),
   * and caches so instances of a model share materials.
   */
  applyPSX(root, opts = {}) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const vcol = !!obj.geometry?.attributes?.color;
      const convert = (src) => {
        if (src && this._matCache.has(src)) return this._matCache.get(src);
        const name = (src?.name ?? '').toLowerCase();
        const color = src?.color?.clone() ?? new THREE.Color(0xffffff);
        color.convertLinearToSRGB();
        const emissive = src?.emissive && src.emissive.getHex() !== 0;
        const glass = name.includes('glass');
        const m = this.material({
          map: src?.map ?? null,
          color,
          unlit: name.includes('unlit'),
          emissive: emissive ? 0.85 : 0,
          noFog: name.includes('nofog'),
          doubleSide: opts.doubleSide || name.includes('cutout') || src?.side === THREE.DoubleSide || src?.side === THREE.BackSide || src?.alphaTest > 0,
          opacity: glass ? 0.35 : src?.transparent ? (src.opacity ?? 1) : 1,
          alphaTest: opts.alphaTest !== undefined ? (src?.alphaTest > 0 ? src.alphaTest : opts.alphaTest) : src?.alphaTest > 0 ? src.alphaTest : src?.map ? 0.3 : 0,
          affine: opts.affine ?? -1,
          vertexColors: vcol && !!src?.vertexColors,
        });
        m.name = src?.name ?? '';
        if (src) this._matCache.set(src, m);
        return m;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(convert) : convert(obj.material);
    });
    return root;
  }

  /** Directional light + ambient (driven by the day/night cycle). */
  setLight(dir, color, ambient) {
    this.shared.uSunDir.value.copy(dir).normalize();
    this.shared.uSunColor.value.set(color);
    this.shared.uAmbient.value.set(ambient);
  }

  setFog(color, near, far) {
    this.fogColor.set(color);
    this.shared.uFogColor.value.set(color);
    this.shared.uFogNear.value = near * this.fogMul;
    this.shared.uFogFar.value = far * this.fogMul;
  }

  /** Extra fog pooling below `y` (valleys, the sea). 0 disables. */
  setGroundFog(amount, y = 0) {
    this.shared.uGroundFog.value = amount;
    this.shared.uGroundFogY.value = y;
  }

  /** Settings slider: 0 = clean, 1 = full PS1 crawl/warp (PS1 preset only). */
  setRetro(v) {
    this.retro = v;
    if (this.preset !== 'ps1') return;
    this.shared.uJitter.value = v;
    this.shared.uAffine.value = Math.min(1, v * 0.9);
  }

  /**
   * Graphics preset.
   *  ps1: 240 lines, vertex snapping + affine warp, nearest textures,
   *       15-bit colour with heavy Bayer dither
   *  ps2: 448 lines, no snapping/warp, bilinear + mipmapped textures,
   *       24-bit colour, light dither, a bit more bloom, fog ~30% further
   */
  setPreset(name) {
    this.preset = name === 'ps2' ? 'ps2' : 'ps1';
    const ps2 = this.preset === 'ps2';
    const u = this.post.uniforms;
    u.uLevels.value = ps2 ? 255 : Math.pow(2, CONFIG.render.colorBits) - 1;
    u.uDither.value = ps2 ? 0.35 : CONFIG.render.dither;
    u.uBloom.value = ps2 ? 0.45 : CONFIG.render.bloom;
    u.uVignette.value = ps2 ? 0.18 : 0.25;
    this.fogMul = ps2 ? 1.3 : 1;
    if (ps2) {
      this.shared.uJitter.value = 0;
      this.shared.uAffine.value = 0;
    } else this.setRetro(this.retro);
    FILTER.smooth = ps2;
    for (const t of TEXTURES) applyFilter(t);
    this.baseLines = ps2 ? 448 : CONFIG.render.height;
    this.setLines(this.baseLines);
  }

  /** 0 = sober, 1 = very high. Screen-space only. */
  setHigh(v) {
    this.post.uniforms.uHigh.value = Math.max(0, Math.min(1, v));
  }

  /** 0 = sober, 1 = very drunk. Screen-space only. */
  setDrunk(v) {
    this.post.uniforms.uDrunk.value = Math.max(0, Math.min(1, v));
  }

  /**
   * Pick the MAX most relevant point lights for this frame. Lights near the
   * cut-off fade by how close their score is to the first light that didn't
   * make it, so lights swapping in/out of the slots never pop.
   * Each light: { position, color, range, intensity, enabled, flicker?, priority? }
   */
  updateLights(lights, cameraPos, time) {
    const scored = this._scored;
    scored.length = 0;
    const far = this.shared.uFogFar.value;
    for (const l of lights) {
      if (!l.enabled) continue;
      const d = l.position.distanceTo(cameraPos);
      if (d > l.range + far) continue;
      scored.push({ l, s: (l.range * (l.priority ?? 1)) / (d + 1) });
    }
    scored.sort((a, b) => b.s - a.s);
    const cutoff = scored[MAX_LIGHTS]?.s ?? 0;
    const { uPointPositions, uPointColors, uPointRanges } = this.shared;
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const entry = scored[i];
      if (!entry) {
        uPointRanges.value[i] = 0;
        continue;
      }
      const l = entry.l;
      let k = l.intensity ?? 1;
      if (l.flicker) k *= flicker(time, l.flickerSeed ?? 0);
      if (cutoff > 0) k *= THREE.MathUtils.clamp((entry.s - cutoff) / (cutoff * 0.35), 0, 1);
      uPointPositions.value[i].copy(l.position);
      uPointColors.value[i].copy(l.color).multiplyScalar(k);
      uPointRanges.value[i] = l.range;
    }
  }

  render(scene, camera, time) {
    this.shared.uTime.value = time;
    this.post.uniforms.uTime.value = time;
    scene.background = this.fogColor;
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCamera);
  }
}

/** Cheap fluorescent-tube flicker: mostly on, occasional stutters. */
export function flicker(t, seed) {
  const x = Math.sin(t * 13.1 + seed * 7.7) * Math.sin(t * 2.3 + seed);
  if (x > 0.93) return 0.15;
  return 0.9 + 0.1 * Math.sin(t * 50 + seed);
}
