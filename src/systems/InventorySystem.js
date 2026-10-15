import { CONFIG } from '../config.js';

/**
 * InventorySystem
 * ---------------
 * Item definitions, stack counts, money and the equipped tool.
 * Pure game state — the InventoryUI renders it, other systems mutate it.
 *
 *   inv.add('beer', 2)    inv.remove('beer')    inv.has('fishing_rod')
 *   inv.use('beer')       inv.equip('fishing_rod')
 *   inv.spend(5) -> bool  inv.earn(3)
 *   inv.onChange(fn)      fires after any change
 */

/** color = swatch shown in the UI; use = consumable effect; equip = tool. */
export const ITEMS = {
  beer: { name: 'Night Owl Beer', desc: 'Cheap lager. Things get wobbly.', color: '#c8a040', use: 'drinkBeer', food: 3 },
  energy_drink: { name: 'VOLT Energy', desc: 'Taurine-adjacent. Run faster for a minute.', color: '#3060c0', use: 'drinkEnergy', food: 6 },
  soda: { name: 'Popsi Cola', desc: 'Flat-ish. Still good.', color: '#1a3a9a', use: 'drinkSoda', food: 4 },
  cigarettes: { name: 'Marlboro Reds', desc: 'A pack of 20. Bad habit. Use to light one up.', color: '#c42020', use: 'smoke' },
  lighter: { name: 'Lighter', desc: 'Click click.', color: '#d0d040' },
  pizza: { name: 'Cold Pizza', desc: 'Pepperoni. Better heated — use the microwave.', color: '#d08030', use: 'eatCold', food: 25 },
  hot_pizza: { name: 'Hot Pizza', desc: 'Molten cheese at 3 a.m. Perfection.', color: '#f0a030', use: 'eatHot', food: 40 },
  frozen_pizza: { name: 'Frozen Pizza', desc: 'Needs the microwave.', color: '#a0c0e0' },
  chips: { name: 'Chips', desc: 'Sour cream & onion.', color: '#40a050', use: 'eatChips', food: 12 },
  noodles: { name: 'Instant Noodles', desc: 'Microwave it.', color: '#e0c040' },
  candy: { name: 'Candy Bar', desc: 'Nougat.', color: '#6a3a1a', use: 'eatCandy', food: 10 },
  bait: { name: 'Nightcrawlers', desc: 'A tub of worms. Fish bite faster.', color: '#8a5a4a' },
  fishing_rod: { name: 'Fishing Rod', desc: 'Old spinning rod. Equip it, then press E at the lake.', color: '#5a5040', equip: true },
  shotgun: { name: 'Beretta A400 12ga', desc: "Grandpa's semi-auto. Equip, LMB fire, RMB aim, R reload.", color: '#3a5a3a', equip: true },
  shells: { name: '12ga Shells', desc: 'Buckshot. Loaded with R while the shotgun is out.', color: '#c03020' },
  cooked_venison: { name: 'Cooked Venison', desc: 'Grey, chewy, microwaved. Honestly not bad.', color: '#5a3020', use: 'eatHot', food: 45 },
  venison: { name: 'Venison', desc: 'Field-dressed deer meat. Sell it at the harbor or Quik Mart, microwave it, or... eat it raw.', color: '#7a2a20', value: 18, catch: true, use: 'eatRaw', food: 15 },
  cooked_fish: { name: 'Cooked Fish', desc: 'Microwaved whole. Watch the bones.', color: '#c09060', use: 'eatHot', food: 30 },
  seeds_sunflower: { name: 'Sunflower Seeds', desc: 'Plant in the beds outside your house. Tall. Takes a while.', color: '#e0b020' },
  seeds_tulip: { name: 'Tulip Bulbs', desc: 'Red tulips. Plant them in the garden beds.', color: '#c03040' },
  seeds_poppy: { name: 'Poppy Seeds', desc: 'Orange poppies. Quickest to bloom.', color: '#e0601e' },
  seeds_moonflower: { name: 'Moonflower Seeds', desc: 'Only opens at night. Glows a little.', color: '#d8e0ff' },
  watering_can: { name: 'Watering Can', desc: 'Fill it at the spigot on the house wall. Rain does the job too.', color: '#4a7a5a' },
  flower_sunflower: { name: 'Sunflower', desc: 'From your garden. Put it in the vase inside.', color: '#f0c020' },
  flower_tulip: { name: 'Tulip', desc: 'From your garden. Put it in the vase inside.', color: '#d02a3a' },
  flower_poppy: { name: 'Poppy', desc: 'From your garden. Put it in the vase inside.', color: '#e8501e' },
  flower_moonflower: { name: 'Moonflower', desc: 'Still faintly glowing. Put it in the vase inside.', color: '#eef2ff' },
  coffee: { name: 'Diner Coffee', desc: 'Black, bitter, bottomless. Keeps you going a while.', color: '#3a2418', use: 'drinkEnergy', food: 4 },
  pancakes: { name: 'Pancakes', desc: 'A short stack, syrup, a pat of butter melting.', color: '#d8a050', use: 'eatHot', food: 50 },
  burger: { name: 'Diner Burger', desc: 'Greasy in the right way.', color: '#8a5a2a', use: 'eatHot', food: 60 },
  pie: { name: 'Cherry Pie', desc: 'A slice. Still warm.', color: '#b02a3a', use: 'eatCandy', food: 35 },
  milkshake: { name: 'Strawberry Milkshake', desc: 'An alien would cross the galaxy for this.', color: '#f0a0b8', use: 'drinkSoda', food: 30 },
  eggs: { name: 'Eggs', desc: 'Half a dozen. Cook them on the stove at home.', color: '#f0e8d0' },
  rice: { name: 'Rice', desc: 'A bag of long grain. Stove: with eggs, or with a fish.', color: '#e8e4d8' },
  bread: { name: 'Bread', desc: 'Sliced white. Toast it, or French toast with eggs.', color: '#d8a868' },
  dish_eggs: { name: 'Fried Eggs', desc: 'Sunny side up.', color: '#f0d060', use: 'eatHot', food: 30 },
  dish_toast: { name: 'Buttered Toast', desc: 'Crunchy. Buttery.', color: '#d89a50', use: 'eatChips', food: 18 },
  dish_french_toast: { name: 'French Toast', desc: 'Eggy, golden, a little cinnamon you found in the back of the cupboard.', color: '#d8a040', use: 'eatHot', food: 45 },
  dish_fried_rice: { name: 'Egg Fried Rice', desc: 'Better than takeout. Probably.', color: '#e8c870', use: 'eatHot', food: 55 },
  dish_stir_fry: { name: 'Noodle Stir-Fry', desc: 'Instant noodles, elevated.', color: '#d8a050', use: 'eatHot', food: 50 },
  dish_fish_rice: { name: 'Pan-Fried Fish & Rice', desc: 'Caught it, cooked it.', color: '#c8a070', use: 'eatHot', food: 65 },
  dish_steak: { name: 'Venison Steak', desc: 'Seared in the pan. The best thing in the house.', color: '#7a3a2a', use: 'eatHot', food: 70 },
  burnt_food: { name: 'Burnt Something', desc: 'It was food once.', color: '#2a2018', use: 'eatChips', food: 6 },
  popcorn: { name: 'Popcorn', desc: 'From the drive-in snack bar. Stale, buttery, perfect.', color: '#f0e0a0', use: 'eatChips', food: 18 },
  weed: { name: 'Weed', desc: 'A gram from the stash tin. Use it to smoke a quick one (needs a lighter), or hit the bong by the couch for more.', color: '#4a7a2a', use: 'smokeWeed' },
  flashlight: { name: 'Flashlight', desc: 'Lights the way. Toggle with L when equipped.', color: '#b0b0b0', equip: true },
  // --- catches -----------------------------------------------------------
  fish_perch: { name: 'Yellow Perch', desc: 'Small and bony.', color: '#c0b040', value: 4, catch: true },
  fish_bass: { name: 'Largemouth Bass', desc: 'A decent fighter.', color: '#4a7040', value: 9, catch: true },
  fish_trout: { name: 'Rainbow Trout', desc: 'Pretty. Tastes good.', color: '#c08090', value: 8, catch: true },
  fish_catfish: { name: 'Channel Catfish', desc: 'Whiskers. Heavy.', color: '#605848', value: 14, catch: true },
  fish_pike: { name: 'Northern Pike', desc: 'All teeth. Rare at night.', color: '#5a6a3a', value: 22, catch: true },
  old_boot: { name: 'Old Boot', desc: 'Size 11. Soaked.', color: '#3a2a1a', value: 0, catch: true },
};

/** Which first-person animation each consumable plays. */
const USE_ANIM = {
  drinkBeer: 'drink',
  drinkEnergy: 'drink',
  drinkSoda: 'drink',
  smoke: 'smoke',
  eatCold: 'eat',
  eatHot: 'eat',
  eatChips: 'eat',
  eatCandy: 'eat',
  eatRaw: 'eat',
};

export class InventorySystem {
  constructor(game) {
    this.game = game;
    this.items = new Map(); // id -> count
    this.money = CONFIG.economy.startMoney;
    this.equipped = null;
    this.listeners = new Set();
    this.drunk = 0; // decays over time
    this.high = 0; // bong: decays over ~4 minutes
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  #changed() {
    for (const fn of this.listeners) fn(this);
  }

  def(id) {
    return ITEMS[id];
  }

  count(id) {
    return this.items.get(id) ?? 0;
  }

  has(id, n = 1) {
    return this.count(id) >= n;
  }

  add(id, n = 1) {
    if (!ITEMS[id]) throw new Error(`Unknown item ${id}`);
    this.items.set(id, this.count(id) + n);
    this.#changed();
  }

  remove(id, n = 1) {
    const c = this.count(id) - n;
    if (c <= 0) {
      this.items.delete(id);
      if (this.equipped === id) this.equipped = null;
    } else this.items.set(id, c);
    this.#changed();
  }

  spend(amount) {
    if (this.money + 1e-6 < amount) return false;
    this.money = Math.round((this.money - amount) * 100) / 100;
    this.#changed();
    return true;
  }

  earn(amount) {
    this.money = Math.round((this.money + amount) * 100) / 100;
    this.#changed();
  }

  equip(id) {
    if (!ITEMS[id]?.equip || !this.has(id)) return;
    this.equipped = this.equipped === id ? null : id;
    this.game.hud.toast(this.equipped ? `Equipped ${ITEMS[id].name}` : `Put away ${ITEMS[id].name}`);
    this.#changed();
  }

  /**
   * Consume an item: play its first-person animation, then apply the effect.
   * Returns false if your hands are busy (already drinking/smoking).
   */
  use(id) {
    const def = ITEMS[id];
    if (!def?.use || !this.has(id)) return false;
    const g = this.game;
    const vm = g.viewModel;
    if (vm.smoking) {
      g.hud.toast('Finish your cigarette first (G to toss it).');
      return false;
    }
    if (vm.busy) {
      g.hud.toast('Hands are full.');
      return false;
    }
    const anim = USE_ANIM[def.use];

    // Weed from the bag: a quick hit (same lean-in-and-light animation as the bong, a bit weaker).
    if (def.use === 'smokeWeed') {
      if (!this.has('lighter')) {
        g.hud.toast('No lighter. The Quik Mart sells them.');
        return false;
      }
      this.remove(id);
      vm.bongHit().then((ok) => (ok ? this.addHigh(0.4) : this.add(id)));
      return true;
    }

    // Cigarettes come 20 to a pack: only remove the pack when it's empty.
    if (def.use === 'smoke') {
      if (!this.has('lighter')) {
        g.hud.toast('No lighter. The Quik Mart sells them.');
        return false;
      }
      this.cigsLeft = (this.cigsLeft ?? 20) - 1;
      if (this.cigsLeft <= 0) {
        this.cigsLeft = 20;
        this.remove(id);
      } else this.#changed();
      vm.startSmoking().then(() => this.#applyEffect('smoke'));
      return true;
    }
    this.remove(id);
    vm.play(anim, id).then(() => {
      this.#applyEffect(def.use);
      g.hunger?.eat(def.food, id);
    });
    return true;
  }

  #applyEffect(effect) {
    const g = this.game;
    switch (effect) {
      case 'drinkBeer':
        this.drunk = Math.min(1.6, this.drunk + 0.45);
        g.hud.toast(this.drunk > 1 ? 'The room is... doing a thing.' : '...that hits.');
        break;
      case 'drinkEnergy':
        g.player.speedBoost = 60;
        g.hud.toast('Heart rate: concerning. Speed: up.');
        break;
      case 'drinkSoda':
        g.hud.toast('Fizzy.');
        break;
      case 'smoke':
        g.hud.toast(`Hold LMB to drag · R flick ash · G toss  (${this.cigsLeft} left)`, 4500);
        break;
      case 'eatCold':
        g.hud.toast('Cold. Still pizza.');
        break;
      case 'eatHot':
        g.hud.toast('Perfect. 10/10.');
        break;
      case 'eatChips':
        g.hud.toast('*crunch*');
        break;
      case 'eatCandy':
        g.hud.toast('Sugar.');
        break;
      case 'eatRaw':
        this.drunk = Math.min(1.6, this.drunk + 0.35); // queasy
        g.hud.toast('Raw deer. Your stomach turns over.');
        break;
    }
  }

  /** One hit: get higher (caps out), munchies kick in. */
  addHigh(k = 0.45) {
    const g = this.game;
    const before = this.high;
    this.high = Math.min(1.2, this.high + k);
    if (before < 0.3) setTimeout(() => g.hud.toast('You feel it creeping in…', 3000), 1200);
    if (before < 0.3 && this.high >= 0.3) setTimeout(() => g.hud.toast('Oh. Oh, that\'s nice.', 3500), 5000);
    if (this.high > 0.8) setTimeout(() => g.hud.toast('Everything is very... a lot. And you could eat.', 3500), 6000);
  }

  /** Called every frame: being drunk wears off over a couple of minutes. */
  update(dt) {
    if (this.high > 0) this.high = Math.max(0, this.high - dt * 0.0042);
    this.highFx = (this.highFx ?? 0) + (this.high - (this.highFx ?? 0)) * Math.min(1, dt * 0.6);
    this.game.renderer.setHigh(Math.min(1, this.highFx * 1.6)); // even one hit should be clearly felt
    if (this.drunk > 0) this.drunk = Math.max(0, this.drunk - dt * 0.005);
    // Ease the screen FX in so the first sip doesn't snap the image.
    this.drunkFx = (this.drunkFx ?? 0) + (this.drunk - (this.drunkFx ?? 0)) * Math.min(1, dt * 0.8);
    this.game.renderer.setDrunk(this.drunkFx + (this.game.hunger?.wobble ?? 0));
  }

  /** Sorted list for the UI. */
  list() {
    return [...this.items.entries()].map(([id, count]) => ({ id, count, ...ITEMS[id] }));
  }
}
