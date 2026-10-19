import { ITEMS } from './InventorySystem.js';

/**
 * ShoppingSystem
 * --------------
 * Catalogues for each shelf / counter in the Quik Mart, and the buy/sell
 * rules. ShopUI renders whatever `open(catalogId)` hands it.
 */
export const CATALOGS = {
  snacks: {
    name: 'AISLE 1 — SNACKS & FOOD',
    stock: [
      { id: 'chips', price: 2.49 },
      { id: 'candy', price: 1.29 },
      { id: 'noodles', price: 1.79 },
      { id: 'frozen_pizza', price: 5.99 },
      { id: 'eggs', price: 3.49 },
      { id: 'rice', price: 2.29 },
      { id: 'bread', price: 2.49 },
    ],
  },
  drinks: {
    name: 'COOLER — COLD DRINKS',
    stock: [
      { id: 'beer', price: 2.99 },
      { id: 'energy_drink', price: 3.49 },
      { id: 'soda', price: 1.49 },
    ],
  },
  frozen: {
    name: 'FREEZER',
    stock: [
      { id: 'frozen_pizza', price: 5.99 },
      { id: 'noodles', price: 1.79 },
      { id: 'candy', price: 1.29 },
    ],
  },
  outdoor: {
    name: 'AISLE 3 — OUTDOOR & AUTO',
    stock: [
      { id: 'fishing_rod', price: 24.99, unique: true },
      { id: 'bait', price: 3.99 },
      { id: 'jar', price: 1.49, unique: true },
      { id: 'tent', price: 19.99, unique: true },
      { id: 'plank_bundle', price: 9, gives: { id: 'planks', n: 10 } },
      { id: 'grease', price: 6, unique: true },
      { id: 'flashlight', price: 7.99, unique: true },
      { id: 'shells', price: 1.25 },
      { id: 'seeds_poppy', price: 1.99 },
      { id: 'seeds_tulip', price: 2.49 },
      { id: 'seeds_sunflower', price: 2.99 },
      { id: 'seeds_moonflower', price: 4.99 },
    ],
  },
  fireworks: {
    name: 'END CAP — FIREWORKS & FILM',
    stock: [
      { id: 'fw_sparkler', price: 1.99 },
      { id: 'fw_fountain', price: 4.99 },
      { id: 'fw_rocket', price: 3.49 },
      { id: 'fw_chrys', price: 4.49 },
      { id: 'fw_willow', price: 4.99 },
      { id: 'fw_palm', price: 4.99 },
      { id: 'fw_ring', price: 4.49 },
      { id: 'fw_heart', price: 5.49 },
      { id: 'fw_crossette', price: 4.99 },
      { id: 'fw_strobe', price: 3.99 },
      { id: 'fw_roman', price: 6.99 },
      { id: 'fw_cake', price: 24.99 },
      { id: 'polaroid_film', price: 6.99 },
      { id: 'polaroid', price: 39.99, unique: true },
      { id: 'lighter', price: 0.99 },
    ],
  },
  assay: {
    name: 'ASSAY OFFICE — OLD PETE',
    stock: [
      { id: 'pickaxe', price: 8, unique: true },
      { id: 'pickaxe_steel', price: 45, unique: true },
      { id: 'pickaxe_diamond', price: 160, unique: true },
      { id: 'miner_helmet', price: 12, unique: true },
      { id: 'part_chain', price: 30, unique: true },
      { id: 'coffee', price: 1 },
    ],
    buysCatch: true,
    sellBonus: 1.25, // Pete pays the best price for ore
    sellLabel: 'SELL TO PETE (+25% on ore)',
  },
  diner: {
    name: 'SEAVIEW DINER — OPEN 24 HRS',
    stock: [
      { id: 'coffee', price: 1.25 },
      { id: 'pancakes', price: 4.5 },
      { id: 'burger', price: 6.75 },
      { id: 'pie', price: 3.0 },
      { id: 'milkshake', price: 3.75 },
    ],
  },
  snackbar: {
    name: 'STARLITE SNACK BAR',
    stock: [
      { id: 'popcorn', price: 3.0 },
      { id: 'soda', price: 1.75 },
      { id: 'candy', price: 1.5 },
    ],
  },
  counter: {
    name: 'REGISTER',
    stock: [
      { id: 'cigarettes', price: 8.99 },
      { id: 'lighter', price: 0.99 },
      { id: 'hot_pizza', price: 3.5 },
      { id: 'fuse', price: 4, unique: true },
    ],
    buysCatch: true, // the clerk will take fish off your hands
  },
};

export class ShoppingSystem {
  constructor(game) {
    this.game = game;
    this.current = null;
  }

  open(catalogId) {
    this.current = catalogId;
    this.game.shopUI.show(CATALOGS[catalogId], this);
  }

  close() {
    this.current = null;
    this.game.shopUI.hide();
  }

  canBuy(entry) {
    const inv = this.game.inventory;
    if (entry.unique && inv.has(entry.id)) return 'Already have one';
    if (inv.money + 1e-6 < entry.price) return 'Not enough cash';
    return true;
  }

  buy(entry) {
    const inv = this.game.inventory;
    const ok = this.canBuy(entry);
    if (ok !== true) return ok;
    inv.spend(entry.price);
    if (entry.gives) inv.add(entry.gives.id, entry.gives.n);
    else inv.add(entry.id);
    this.game.audio.oneShot('register', { volume: 0.6 });
    return `Bought ${ITEMS[entry.id].name}.`;
  }

  /** Fish the clerk will buy: every caught item with a value. */
  sellable() {
    return this.game.inventory.list().filter((i) => i.catch && i.value > 0);
  }

  sell(id) {
    const inv = this.game.inventory;
    const def = ITEMS[id];
    if (!inv.has(id) || !def?.value) return 'Nothing to sell';
    const cat = CATALOGS[this.current];
    const price = Math.round(def.value * (id.startsWith('ore_') ? cat?.sellBonus ?? 1 : 1) * 100) / 100;
    inv.remove(id);
    inv.earn(price);
    this.game.audio.oneShot('register', { volume: 0.6 });
    return `Sold ${def.name} for $${price.toFixed(2)}. ${cat?.sellBonus ? '"Good rock, that."' : '"Uh... thanks?"'}`;
  }

  /** Sell every sellable thing at once. */
  sellAll() {
    let n = 0;
    let total = this.game.inventory.money;
    for (const it of this.sellable()) for (let k = 0; k < it.count; k++, n++) this.sell(it.id);
    total = this.game.inventory.money - total;
    return n ? `Sold ${n} things for $${total.toFixed(2)}.` : 'Nothing to sell';
  }
}
