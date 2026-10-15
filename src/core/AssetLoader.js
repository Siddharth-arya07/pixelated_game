import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MODELS, TEXTURES, AUDIO } from '../assets/manifest.js';

/**
 * AssetLoader
 * -----------
 * Discovers whatever files exist in /src/assets/{models,textures,audio} at
 * build time (import.meta.glob), loads the ones the manifest knows about, and
 * reports progress. Missing files are fine: getters return null and the
 * caller builds a procedural stand-in.
 *
 *   await assets.load({ audioContext, onProgress })
 *   assets.model('microwave')   -> fresh clone (THREE.Group) or null
 *                                  (clone.userData.animations = AnimationClip[])
 *   assets.texture('grass')     -> THREE.Texture or null
 *   assets.audio('truck_engine')-> AudioBuffer or null
 */

// Vite resolves these globs at build time into { './path': 'hashed-url' }.
const modelFiles = import.meta.glob('../assets/models/*.{glb,gltf}', { eager: true, query: '?url', import: 'default' });
const textureFiles = import.meta.glob('../assets/textures/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
const audioFiles = import.meta.glob('../assets/audio/*.{ogg,mp3,wav}', { eager: true, query: '?url', import: 'default' });

/** Map a glob result to { filename: url } and { basename: url }. */
function index(files) {
  const byName = {};
  const byBase = {};
  for (const [path, url] of Object.entries(files)) {
    const name = path.split('/').pop();
    byName[name] = url;
    byBase[name.replace(/\.[^.]+$/, '')] = url;
  }
  return { byName, byBase };
}

export class AssetLoader {
  constructor(renderer) {
    this.renderer = renderer; // used to convert GLTF materials to PSX ones
    this.models = new Map();
    this.clips = new Map();
    this.textures = new Map();
    this.audioBuffers = new Map();
    this.missing = [];
  }

  async load({ audioContext, onProgress } = {}) {
    const models = index(modelFiles);
    const textures = index(textureFiles);
    const audio = index(audioFiles);

    const jobs = [];
    // Every model file in the folder loads, keyed by basename; MODELS adds sizing.
    for (const [key, url] of Object.entries(models.byBase)) {
      jobs.push(() => this.#loadModel(key, MODELS[key] ?? {}, url));
    }
    for (const key of Object.keys(MODELS)) if (!models.byBase[key]) this.missing.push(`models/${key}.glb`);
    for (const [key, file] of Object.entries(TEXTURES)) {
      const url = textures.byName[file] ?? textures.byBase[key];
      if (url) jobs.push(() => this.#loadTexture(key, url));
    }
    if (audioContext) {
      for (const [key, base] of Object.entries(AUDIO)) {
        const url = audio.byBase[base];
        if (url) jobs.push(() => this.#loadAudio(key, url, audioContext));
      }
    }

    let done = 0;
    const total = Math.max(jobs.length, 1);
    onProgress?.(0, total);
    // Load in parallel; a broken file shouldn't take the whole game down.
    await Promise.all(
      jobs.map((job) =>
        job()
          .catch((err) => console.warn('[AssetLoader]', err))
          .finally(() => onProgress?.(++done, total)),
      ),
    );
    if (jobs.length === 0) onProgress?.(1, 1);

    console.info(
      `[AssetLoader] ${this.models.size} model(s) loaded` +
        (this.missing.length ? `; procedural stand-ins for: ${this.missing.join(', ')}` : '.'),
    );
  }

  async #loadModel(key, def, url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const inner = gltf.scene;
    this.renderer.applyPSX(inner, def.psx);

    // Normalise scale + pivot: centred on X/Z, sitting on y = 0.
    if (def.rotateX || def.rotateZ) {
      inner.rotation.order = 'ZYX'; // X first, then Z
      inner.rotation.x = def.rotateX ?? 0;
      inner.rotation.z = def.rotateZ ?? 0;
    }
    if (def.rotateY) inner.rotation.y = def.rotateY;
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (def.fit?.height) s = def.fit.height / Math.max(size.y, 1e-4);
    else if (def.fit?.length) s = def.fit.length / Math.max(size.x, size.z, 1e-4);
    inner.scale.multiplyScalar(s);
    inner.updateMatrixWorld(true);
    box.setFromObject(inner);
    const center = box.getCenter(new THREE.Vector3());
    inner.position.x -= center.x;
    inner.position.z -= center.z;
    inner.position.y -= box.min.y;

    const wrapper = new THREE.Group();
    wrapper.name = key;
    wrapper.add(inner);
    wrapper.userData.fromFile = true;
    // Clips live outside userData: Object3D.clone JSON-copies userData.
    this.clips.set(key, gltf.animations ?? []);
    this.models.set(key, wrapper);
  }

  async #loadTexture(key, url) {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.textures.set(key, tex);
  }

  async #loadAudio(key, url, ctx) {
    const res = await fetch(url);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    this.audioBuffers.set(key, buf);
  }

  /** Fresh clone of a loaded model, or null if the file wasn't provided. */
  model(key) {
    const tpl = this.models.get(key);
    if (!tpl) return null;
    // SkeletonUtils.clone rebinds skinned meshes to the cloned bones.
    const c = SkeletonUtils.clone(tpl);
    c.userData.animations = this.clips.get(key);
    return c;
  }

  hasModel(key) {
    return this.models.has(key);
  }

  texture(key) {
    return this.textures.get(key) ?? null;
  }

  audio(key) {
    return this.audioBuffers.get(key) ?? null;
  }
}
