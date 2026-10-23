/**
 * Buckshot roulette: the rules
 * ----------------------------
 * A pure, deterministic engine. Both players run their own copy from the same
 * seed and feed it the same actions in the same order, so every random draw
 * (shell order, items, the phone, expired pills) comes out identical on both
 * screens without ever sending the hidden shell order over the wire.
 *
 * The rules follow the original 2-player game, by way of the MIT-licensed
 * reference engine github.com/Bytestorm5/Buckshot-Roulette-Python:
 *  - 3 rounds; charges 2 / 4 / 5; items dealt per load 0 / 2 / 4 (8 slots max)
 *  - each load: 2–8 shells, shown (live/blank counts) then shuffled
 *  - shoot yourself with a blank and you go again; anything else passes the turn
 *  - handsaw doubles the next shot; handcuffs skip the other player's next turn
 *  - final round: at 2 charges or less the defibrillator wires are cut and
 *    nothing heals you any more
 *
 * apply(action) → array of effect records for the animator, e.g.
 *   { k:'shoot', p, at, live, dmg } { k:'item', p, item, ... } { k:'load', ... }
 */

export const ITEMS = {
  magnifier: { name: 'Magnifying glass', cap: 3, desc: 'Check the shell in the chamber.' },
  beer: { name: 'Beer', cap: 2, desc: 'Rack the shotgun. Ejects the current shell.' },
  cigarettes: { name: 'Cigarettes', cap: 1, desc: 'Takes the edge off. Regain 1 charge.' },
  saw: { name: 'Handsaw', cap: 3, desc: 'Shotgun deals 2 damage on the next shot.' },
  handcuffs: { name: 'Handcuffs', cap: 1, desc: 'The other player skips their next turn.' },
  phone: { name: 'Burner phone', cap: 1, desc: 'A mysterious voice gives you an insight from the future.' },
  inverter: { name: 'Inverter', cap: 8, desc: 'Swaps the polarity of the current shell.' },
  meds: { name: 'Expired medicine', cap: 1, desc: '50% chance to regain 2 charges. If not, lose 1.' },
  adrenaline: { name: 'Adrenaline', cap: 2, desc: 'Steal an item from the other player and use it immediately.' },
};
export const ITEM_KEYS = Object.keys(ITEMS);
export const ROUNDS = [
  { hp: 2, items: 0 },
  { hp: 4, items: 2 },
  { hp: 5, items: 4 },
];
export const SLOTS = 8;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rules {
  constructor(seed) {
    this.seed = seed;
    this.r = rng(seed);
    this.round = -1;
    this.wins = [0, 0];
    this.hp = [0, 0];
    this.max = 0;
    this.shells = [];
    this.items = [Array(SLOTS).fill(null), Array(SLOTS).fill(null)];
    this.turn = 0;
    this.saw = false;
    this.cuffs = [0, 0]; // 2 = will skip their next turn, 1 = skipped, breaks free next time
    this.over = false; // match over
    this.roundOver = false;
    this.winner = -1;
    this.loads = 0;
    this.n = 0; // actions applied
  }

  int(a, b) {
    return a + Math.floor(this.r() * (b - a + 1));
  }

  /** First thing after construction: round 1, first load. */
  start() {
    return this.#newRound();
  }

  get live() {
    return this.shells.filter(Boolean).length;
  }

  get blank() {
    return this.shells.length - this.live;
  }

  /** Final round with 2 charges or less: nothing heals. */
  wiresCut(p) {
    return this.round === ROUNDS.length - 1 && this.hp[p] <= 2;
  }

  #newRound() {
    this.round++;
    this.roundOver = false;
    const R = ROUNDS[this.round];
    this.max = R.hp;
    this.hp = [R.hp, R.hp];
    this.items = [Array(SLOTS).fill(null), Array(SLOTS).fill(null)];
    this.saw = false;
    this.cuffs = [0, 0];
    // who starts: alternates, first round decided by the seed
    this.turn = (this.round + (this.seed & 1)) % 2;
    const fx = [{ k: 'round', round: this.round, hp: R.hp, turn: this.turn }];
    fx.push(...this.#load());
    return fx;
  }

  #load() {
    let total;
    let live;
    if (this.round === 0 && this.loads === 0) {
      total = 3;
      live = 1;
    } else {
      total = this.int(2, 8);
      live = Math.min(total - 1, Math.max(1, Math.round(total * (0.35 + this.r() * 0.3))));
    }
    this.loads++;
    const shells = Array.from({ length: total }, (_, i) => i < live);
    for (let i = shells.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [shells[i], shells[j]] = [shells[j], shells[i]];
    }
    this.shells = shells;
    const deal = [[], []];
    const n = ROUNDS[this.round].items;
    for (const p of [0, 1]) {
      for (let k = 0; k < n; k++) {
        const slot = this.items[p].indexOf(null);
        if (slot < 0) break;
        const choices = ITEM_KEYS.filter((it) => this.count(p, it) < ITEMS[it].cap && !(it === 'saw' && this.max <= 2));
        const item = choices[Math.floor(this.r() * choices.length)];
        this.items[p][slot] = item;
        deal[p].push({ slot, item });
      }
    }
    return [{ k: 'load', live, blank: total - live, total, deal, turn: this.turn }];
  }

  count(p, item) {
    return this.items[p].filter((x) => x === item).length;
  }

  /** Can player p use the item in their slot right now? (also used for adrenaline steals) */
  canUse(p, item, { stolen = false } = {}) {
    const o = 1 - p;
    switch (item) {
      case 'saw':
        return !this.saw;
      case 'handcuffs':
        return this.cuffs[o] === 0;
      case 'adrenaline':
        if (stolen) return false;
        return this.items[o].some((it) => it && it !== 'adrenaline' && this.canUse(p, it, { stolen: true }));
      default:
        return true;
    }
  }

  /** Is this action legal for player p right now? */
  legal(p, a) {
    if (this.over || this.roundOver || p !== this.turn || !this.shells.length) return false;
    if (a.k === 'shoot') return a.at === 'self' || a.at === 'opp';
    if (a.k === 'item') {
      const item = this.items[p][a.slot];
      if (!item || !this.canUse(p, item)) return false;
      if (item === 'adrenaline') {
        const st = this.items[1 - p][a.steal];
        return !!st && st !== 'adrenaline' && this.canUse(p, st, { stolen: true });
      }
      return true;
    }
    return false;
  }

  /** Apply one action ({k:'shoot', at} | {k:'item', slot, steal?}) for the current player. */
  apply(a) {
    const p = this.turn;
    if (!this.legal(p, a)) return null;
    this.n++;
    const fx = [];
    if (a.k === 'shoot') this.#shoot(p, a.at, fx);
    else this.#item(p, a.slot, a.steal, fx);
    this.#after(fx);
    return fx;
  }

  #shoot(p, at, fx) {
    const target = at === 'self' ? p : 1 - p;
    const live = this.shells.shift();
    let dmg = 0;
    if (live) {
      dmg = this.saw ? 2 : 1;
      this.hp[target] = Math.max(0, this.hp[target] - dmg);
    }
    fx.push({ k: 'shoot', p, at, target, live, dmg, saw: this.saw, hp: this.hp[target] });
    this.saw = false;
    if (!live && at === 'self') return; // blank at yourself: go again
    this.#pass(fx);
  }

  #pass(fx) {
    const o = 1 - this.turn;
    if (this.cuffs[o] === 2) {
      this.cuffs[o] = 1;
      fx.push({ k: 'skip', p: o });
      return;
    }
    if (this.cuffs[o] === 1) {
      this.cuffs[o] = 0;
      fx.push({ k: 'uncuff', p: o });
    }
    this.turn = o;
  }

  #item(p, slot, steal, fx) {
    const item = this.items[p][slot];
    this.items[p][slot] = null;
    if (item === 'adrenaline') {
      const o = 1 - p;
      const st = this.items[o][steal];
      this.items[o][steal] = null;
      const e = { k: 'item', p, item, slot, steal: { slot: steal, item: st } };
      fx.push(e);
      e.steal.fx = this.#use(p, st);
      return;
    }
    fx.push({ k: 'item', p, item, slot, ...this.#use(p, item) });
  }

  /** The item's effect; returns the details the animator needs. */
  #use(p, item) {
    switch (item) {
      case 'magnifier':
        return { shell: this.shells[0] };
      case 'beer': {
        const shell = this.shells.shift();
        return { shell };
      }
      case 'cigarettes': {
        const ok = !this.wiresCut(p) && this.hp[p] < this.max;
        if (ok) this.hp[p]++;
        return { heal: ok, hp: this.hp[p], cut: this.wiresCut(p) };
      }
      case 'saw':
        this.saw = true;
        return {};
      case 'handcuffs':
        this.cuffs[1 - p] = 2;
        return { target: 1 - p };
      case 'phone': {
        if (this.shells.length < 2) return { idx: -1 };
        const idx = this.int(1, this.shells.length - 1);
        return { idx, shell: this.shells[idx] };
      }
      case 'inverter':
        if (this.shells.length) this.shells[0] = !this.shells[0];
        return {};
      case 'meds': {
        const good = this.r() < 0.5;
        if (good) {
          if (!this.wiresCut(p)) this.hp[p] = Math.min(this.max, this.hp[p] + 2);
        } else this.hp[p] = Math.max(0, this.hp[p] - 1);
        return { good, hp: this.hp[p] };
      }
      default:
        return {};
    }
  }

  /** Deaths, end of round/match, and reloading an empty gun. */
  #after(fx) {
    const dead = this.hp[0] <= 0 ? 0 : this.hp[1] <= 0 ? 1 : -1;
    if (dead >= 0) {
      const w = 1 - dead;
      this.wins[w]++;
      this.roundOver = true;
      fx.push({ k: 'roundEnd', winner: w, loser: dead, wins: [...this.wins], round: this.round });
      if (this.wins[w] >= 2 || this.round >= ROUNDS.length - 1) {
        this.over = true;
        this.winner = this.wins[0] > this.wins[1] ? 0 : 1;
        fx.push({ k: 'matchEnd', winner: this.winner, wins: [...this.wins] });
      }
      return;
    }
    if (!this.shells.length) fx.push(...this.#load());
    fx.push({ k: 'turn', p: this.turn });
  }

  /** Called by both clients after the round-end animation. */
  nextRound() {
    if (!this.roundOver || this.over) return null;
    const fx = this.#newRound();
    fx.push({ k: 'turn', p: this.turn });
    return fx;
  }
}
