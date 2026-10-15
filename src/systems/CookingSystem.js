import * as THREE from 'three';

/**
 * CookingSystem
 * -------------
 * The stove in the house kitchen. Pick a recipe from what you're carrying,
 * the camera leans over the pan, and you take it off the heat (E) when the
 * doneness bar is in the golden zone:
 *   too early  → a bit raw (it still counts, but it's not great)
 *   golden     → perfect: two servings
 *   too late   → burnt (barely food). Leave it long enough and it smokes.
 * The food in the pan browns as it cooks; the burner glows and the pan sizzles.
 */
export const RECIPES = [
  { id: 'dish_steak', name: 'Venison Steak', needs: ['venison'], time: 11 },
  { id: 'dish_fish_rice', name: 'Pan-Fried Fish & Rice', needs: ['fish', 'rice'], time: 12 },
  { id: 'dish_fried_rice', name: 'Egg Fried Rice', needs: ['eggs', 'rice'], time: 10 },
  { id: 'dish_stir_fry', name: 'Noodle Stir-Fry', needs: ['noodles', 'eggs'], time: 9 },
  { id: 'dish_french_toast', name: 'French Toast', needs: ['bread', 'eggs'], time: 8 },
  { id: 'dish_eggs', name: 'Fried Eggs', needs: ['eggs'], time: 7 },
  { id: 'dish_toast', name: 'Buttered Toast', needs: ['bread'], time: 5 },
];
const FISH = ['fish_catfish', 'fish_bass', 'fish_trout', 'fish_perch', 'fish_pike'];
const ZONE = [0.72, 0.92]; // golden zone on the doneness bar
const BURN_OUT = 1.35;

export class CookingSystem {
  constructor(game) {
    this.game = game;
    this.choice = 0;
    this.cooking = null;
    this.ui = document.createElement('div');
    this.ui.id = 'cook';
    this.ui.className = 'hidden';
    this.ui.innerHTML = '<div class="ck-name"></div><div class="ck-bar"><span class="ck-zone"></span><i></i></div><div class="ck-hint">E — take it off the heat</div>';
    document.getElementById('ui').appendChild(this.ui);
  }

  /** What can be made right now, best first. */
  available() {
    const inv = this.game.inventory;
    const has = (n) => (n === 'fish' ? FISH.some((f) => inv.has(f)) : inv.has(n));
    return RECIPES.filter((r) => r.needs.every(has));
  }

  /** Called by the house: the stove, the pan and the food blob. */
  setupStove(scene, stove) {
    const g = this.game;
    this.scene = scene;
    const b = scene.bounds(stove);
    const top = b.max.y;
    const cx = (b.min.x + b.max.x) / 2 - 0.15;
    const cz = (b.min.z + b.max.z) / 2 + 0.1;
    // burner glow ring + pan + food
    this.burner = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 14), scene.mat({ color: 0x1a1a1a }));
    this.burnerOn = scene.mat({ color: 0xff5a1a, unlit: true });
    this.burnerOff = this.burner.material;
    this.burner.rotation.x = Math.PI / 2;
    this.burner.position.set(cx, top + 0.005, cz);
    scene.root.add(this.burner);
    const pan = new THREE.Group();
    const iron = scene.mat({ color: 0x2a2a2e });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.04, 14), iron);
    base.position.y = 0.025;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.03), iron);
    handle.position.set(0.22, 0.04, 0);
    pan.add(base, handle);
    pan.position.set(cx, top + 0.01, cz);
    pan.rotation.y = -0.4;
    scene.root.add(pan);
    this.foodMat = scene.mat({ color: 0xe8d8a0 });
    this.food = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.025, 10), this.foodMat);
    this.food.position.set(cx, top + 0.055, cz);
    this.food.visible = false;
    scene.root.add(this.food);
    this.light = scene.addLight({ position: [cx, top + 0.3, cz + 0.3], color: 0xff8030, range: 2.4, intensity: 0, priority: 2 });
    this.panPos = new THREE.Vector3(cx, top + 0.05, cz);

    scene.addInteractable(stove, {
      range: 2.4,
      prompt: () => {
        const list = this.available();
        if (!list.length) return 'Stove';
        return `Cook ${list[this.choice % list.length].name}`;
      },
      available: () => (this.available().length ? true : 'Nothing to cook. Eggs, rice and bread at the Quik Mart; fish and venison from outside.'),
      action: () => this.#start(),
      secondary: () => {
        const list = this.available();
        if (list.length < 2) return null;
        const next = list[(this.choice + 1) % list.length];
        return { label: `Make ${next.name} instead`, action: () => (this.choice = (this.choice + 1) % list.length) };
      },
    });
  }

  #start() {
    const g = this.game;
    const list = this.available();
    const r = list[this.choice % list.length];
    if (!r) return;
    // use up the ingredients
    for (const n of r.needs) g.inventory.remove(n === 'fish' ? FISH.find((f) => g.inventory.has(f)) : n);
    this.cooking = { r, t: 0, smoked: 0 };
    this.food.visible = true;
    this.food.scale.set(1, 1, 1);
    this.burner.material = this.burnerOn;
    this.light.intensity = 0.9;
    this.ui.classList.remove('hidden');
    this.ui.querySelector('.ck-name').textContent = r.name;
    const z = this.ui.querySelector('.ck-zone');
    z.style.left = `${(ZONE[0] / BURN_OUT) * 100}%`;
    z.style.width = `${((ZONE[1] - ZONE[0]) / BURN_OUT) * 100}%`;
    this.sizzle = g.audio.positional('sizzle', this.food, { volume: 0.7, refDistance: 1.5 });
    g.audio.oneShot('lighter', { volume: 0.5, rate: 0.6 });
    g.enterFocus({
      position: this.panPos.clone().add(new THREE.Vector3(0, 0.55, 0.45)),
      target: this.panPos,
      fov: 50,
      hint: 'E take it off the heat',
      onUpdate: (dt) => this.#tick(dt),
      onExit: () => this.#finish(),
    });
  }

  #tick(dt) {
    const c = this.cooking;
    if (!c) return;
    c.t += dt;
    const k = c.t / c.r.time; // doneness
    // raw → golden → brown → black
    const col = new THREE.Color(0xe8d8a0);
    if (k < 0.85) col.lerp(new THREE.Color(0xd89a40), k / 0.85);
    else col.set(0xd89a40).lerp(new THREE.Color(0x1a120c), Math.min(1, (k - 0.85) / 0.5));
    this.foodMat.uniforms.uColor.value.copy(col);
    this.food.scale.y = 1 + Math.sin(c.t * 9) * 0.06;
    this.light.intensity = 0.8 + Math.sin(c.t * 13) * 0.1;
    this.ui.querySelector('i').style.left = `${Math.min(100, (k / BURN_OUT) * 100)}%`;
    this.ui.classList.toggle('golden', k >= ZONE[0] && k <= ZONE[1]);
    this.ui.classList.toggle('burning', k > ZONE[1]);
    if (k > 1.05) {
      c.smoked += dt;
      if (c.smoked > 0.4) {
        c.smoked = 0;
        this.game.viewModel.puffAt?.(this.panPos);
      }
    }
    if (k >= BURN_OUT) this.game.exitFocus();
  }

  #finish() {
    const g = this.game;
    const c = this.cooking;
    this.cooking = null;
    this.sizzle?.stop();
    this.burner.material = this.burnerOff;
    this.light.intensity = 0;
    this.ui.classList.add('hidden');
    this.food.visible = false;
    if (!c) return;
    const k = c.t / c.r.time;
    if (k < ZONE[0] * 0.6) {
      g.inventory.add(c.r.id);
      g.hud.toast(`${c.r.name}. Very raw. You put it on a plate anyway.`, 3500);
    } else if (k < ZONE[0]) {
      g.inventory.add(c.r.id);
      g.hud.toast(`${c.r.name}. A little underdone, but fine.`, 3000);
    } else if (k <= ZONE[1]) {
      g.inventory.add(c.r.id, 2);
      g.audio.oneShot('register', { volume: 0.3, rate: 1.4 });
      g.hud.toast(`${c.r.name}. Perfect. Enough for two.`, 3500);
    } else {
      g.inventory.add('burnt_food');
      g.hud.toast(k >= BURN_OUT ? 'Smoke everywhere. That is charcoal now.' : `Burnt ${c.r.name.toLowerCase()}. Edible. Technically.`, 3500);
    }
  }
}
