import * as THREE from 'three';

/**
 * PSXMaterial
 * -----------
 * Our own PlayStation-style surface shader (replaces three-psx's). Everything
 * that makes the look is per-vertex, like the real hardware:
 *
 *  - vertex snapping to the low-res pixel grid (GTE had no sub-pixel precision).
 *    Snapping fades out for vertices very close to the camera, where it used
 *    to make near polygons tear and jump.
 *  - affine texture mapping blended with perspective-correct UVs. The affine
 *    amount also fades out near the camera, where big polygons swam the worst.
 *  - Gouraud lighting: ambient + one directional + MAX point lights
 *  - per-vertex distance fog + optional ground fog that pools in low areas
 *  - WATER mode: sums of directional sine waves displace the surface. The
 *    same function runs on the CPU (render/Water.js) for buoyancy.
 *  - skinning (animated clerk/fish) and instancing (trees, grass) supported
 *
 * Shared uniforms (lights, fog, sun, snapping strength…) are owned by the
 * Renderer and linked by reference, so updating them once updates every
 * material.
 */

export const MAX_LIGHTS = 8;

/** Every texture handed to a PSX material, so a graphics preset can refilter them. */
export const TEXTURES = new Set();
export const FILTER = { smooth: false }; // PS1 = nearest, PS2 = bilinear + mipmaps

export function applyFilter(tex) {
  if (FILTER.smooth) {
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
  } else {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  }
  tex.needsUpdate = true;
}
export const WAVE_COUNT = 4;

/** Uniform objects shared by every PSX material. */
export function createSharedUniforms() {
  return {
    uResolution: { value: new THREE.Vector2(320, 240) },
    uJitter: { value: 0.6 },
    uAffine: { value: 0.55 },
    uTime: { value: 0 },
    uAmbient: { value: new THREE.Color(0x202030) },
    uSunColor: { value: new THREE.Color(0x303850) },
    uSunDir: { value: new THREE.Vector3(0.4, -0.8, 0.45).normalize() },
    uPointPositions: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
    uPointColors: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0)) },
    uPointRanges: { value: new Array(MAX_LIGHTS).fill(0) },
    uFogColor: { value: new THREE.Color(0x101018) },
    uFogNear: { value: 4 },
    uFogFar: { value: 30 },
    uGroundFog: { value: 0 }, // 0..1 extra density near uGroundFogY
    uGroundFogY: { value: 0 },
    uWaveDir: { value: Array.from({ length: WAVE_COUNT }, () => new THREE.Vector2(1, 0)) },
    uWaveAmp: { value: new Array(WAVE_COUNT).fill(0) },
    uWaveK: { value: new Array(WAVE_COUNT).fill(0) },
    uWaveSpeed: { value: new Array(WAVE_COUNT).fill(0) },
  };
}

const VERTEX = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>

  #define MAX_LIGHTS ${MAX_LIGHTS}
  #define WAVES ${WAVE_COUNT}

  uniform vec2 uResolution;
  uniform float uJitter;
  uniform float uAffine;
  uniform float uMatAffine;   // < 0: use global, otherwise override
  uniform float uTime;
  uniform vec3 uAmbient;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uPointPositions[MAX_LIGHTS];
  uniform vec3 uPointColors[MAX_LIGHTS];
  uniform float uPointRanges[MAX_LIGHTS];
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uGroundFog;
  uniform float uGroundFogY;
  uniform float uFogScale;    // per-material: 0 = ignore fog, 1 = normal
  uniform bool uUnlit;
  uniform float uEmissive;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform vec2 uScroll;
  uniform vec2 uWaveDir[WAVES];
  uniform float uWaveAmp[WAVES];
  uniform float uWaveK[WAVES];
  uniform float uWaveSpeed[WAVES];

  varying vec3 vAffineUv;   // xy = uv * w, z = w
  varying vec2 vPerspUv;
  varying float vAffineAmt;
  varying vec3 vLight;
  varying float vFog;
  varying vec3 vVertColor;
  varying float vFoam;

  void main() {
    vec3 transformed = position;
    vec3 objectNormal = normal;

    #ifdef USE_SKINNING
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <skinning_vertex>
    #endif
    #ifdef USE_INSTANCING
      transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
      objectNormal = mat3(instanceMatrix) * objectNormal;
    #endif

    vec4 world = modelMatrix * vec4(transformed, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * objectNormal);
    vFoam = 0.0;

    #ifdef WATER
      // Sum of directional sines in world space; analytic normal.
      float h = 0.0;
      vec2 grad = vec2(0.0);
      for (int i = 0; i < WAVES; i++) {
        float ph = dot(uWaveDir[i], world.xz) * uWaveK[i] + uTime * uWaveSpeed[i];
        h += uWaveAmp[i] * sin(ph);
        grad += uWaveAmp[i] * uWaveK[i] * cos(ph) * uWaveDir[i];
      }
      world.y += h;
      n = normalize(vec3(-grad.x, 1.0, -grad.y));
      vFoam = smoothstep(0.35, 0.9, h);
    #endif

    vec4 view = viewMatrix * world;
    vec4 clip = projectionMatrix * view;

    // --- vertex snapping (fades out right in front of the camera) ---------
    if (uJitter > 0.0 && clip.w > 0.0) {
      vec2 grid = uResolution * 0.5;
      vec2 ndc = clip.xy / clip.w;
      vec2 snapped = floor(ndc * grid + 0.5) / grid;
      float k = uJitter * smoothstep(0.25, 1.2, clip.w);
      clip.xy = mix(ndc, snapped, k) * clip.w;
    }
    gl_Position = clip;

    // --- UVs: affine + perspective, blended -------------------------------
    vec2 uvT = uv * uRepeat + uOffset + uScroll * uTime;
    vPerspUv = uvT;
    vAffineUv = vec3(uvT * clip.w, clip.w);
    float aff = uMatAffine >= 0.0 ? uMatAffine : uAffine;
    vAffineAmt = aff * smoothstep(0.8, 5.0, clip.w);

    // --- Gouraud lighting --------------------------------------------------
    if (uUnlit) {
      vLight = vec3(1.0);
    } else {
      float diff = max(dot(n, -uSunDir), 0.0);
      vec3 light = uAmbient + uSunColor * diff;
      for (int i = 0; i < MAX_LIGHTS; i++) {
        if (uPointRanges[i] <= 0.0) continue;
        vec3 toL = uPointPositions[i] - world.xyz;
        float d = length(toL);
        float att = clamp(1.0 - d / uPointRanges[i], 0.0, 1.0);
        att *= att;
        float pd = max(dot(n, toL / max(d, 0.001)), 0.0);
        light += uPointColors[i] * att * mix(0.35, 1.0, pd);
      }
      vLight = mix(light, vec3(1.0), uEmissive);
    }

    #ifdef USE_COLOR
      vVertColor = color.rgb;
    #else
      vVertColor = vec3(1.0);
    #endif

    // --- fog: distance + ground fog ------------------------------------------
    float dist = length(view.xyz);
    float f = clamp((dist - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
    float ground = uGroundFog * clamp(1.0 - (world.y - uGroundFogY) / 6.0, 0.0, 1.0) * clamp(dist / 12.0, 0.0, 1.0);
    vFog = clamp(f + ground * (1.0 - f), 0.0, 1.0) * uFogScale;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform bool uUseMap;
  uniform vec3 uColor;
  uniform vec3 uFogColor;
  uniform float uOpacity;
  uniform float uAlphaTest;
  uniform vec3 uFoamColor;

  varying vec3 vAffineUv;
  varying vec2 vPerspUv;
  varying float vAffineAmt;
  varying vec3 vLight;
  varying float vFog;
  varying vec3 vVertColor;
  varying float vFoam;

  void main() {
    vec2 uv = mix(vPerspUv, vAffineUv.xy / vAffineUv.z, vAffineAmt);
    vec4 tex = uUseMap ? texture2D(uMap, uv) : vec4(1.0);
    if (tex.a < uAlphaTest) discard;
    vec3 c = tex.rgb * uColor * vVertColor * vLight;
    #ifdef WATER
      c = mix(c, uFoamColor * vLight, vFoam);
    #endif
    c = mix(c, uFogColor, vFog);
    gl_FragColor = vec4(c, uOpacity * tex.a);
  }
`;

/**
 * Build a PSX material.
 * opts: { map, color, unlit, noFog, fogScale, opacity, scroll, repeat,
 *         doubleSide, affine, alphaTest, emissive, vertexColors, water,
 *         additive, depthWrite }
 */
export function createPSXMaterial(shared, opts = {}) {
  const {
    map = null,
    color = 0xffffff,
    unlit = false,
    noFog = false,
    fogScale = noFog ? 0 : 1,
    opacity = 1,
    scroll = [0, 0],
    doubleSide = false,
    affine = -1,
    alphaTest = map ? 0.3 : 0,
    emissive = 0,
    vertexColors = false,
    water = false,
    additive = false,
    depthWrite,
  } = opts;

  if (map) {
    map.colorSpace = THREE.NoColorSpace;
    // Live canvases (TV, laptop) stay crisp in both presets.
    if (!map.isCanvasTexture || !map.userData?.live) {
      TEXTURES.add(map);
      applyFilter(map);
    }
  }

  const m = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: opacity < 1 || additive,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
    defines: water ? { WATER: '' } : {},
    uniforms: {
      ...shared,
      uMap: { value: map },
      uUseMap: { value: !!map },
      uColor: { value: new THREE.Color(color) },
      uUnlit: { value: unlit },
      uEmissive: { value: emissive },
      uFogScale: { value: fogScale },
      uOpacity: { value: opacity },
      uAlphaTest: { value: alphaTest },
      uScroll: { value: new THREE.Vector2(...scroll) },
      uRepeat: { value: map ? map.repeat.clone() : new THREE.Vector2(1, 1) },
      uOffset: { value: map ? map.offset.clone() : new THREE.Vector2(0, 0) },
      uMatAffine: { value: affine },
      uFoamColor: { value: new THREE.Color(0xc8d4dc) },
    },
  });
  if (additive) {
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
  }
  if (depthWrite !== undefined) m.depthWrite = depthWrite;
  return m;
}
