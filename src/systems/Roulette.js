import * as THREE from 'three';
import { Rules, ITEMS } from './roulette/Rules.js';
import { label } from './roulette/Table.js';

/**
 * Roulette — buckshot roulette in the back room behind your house
 * ----------------------------------------------------------------
 * Two chairs, one shotgun, multiplayer only (anyone else in the room can
 * stand around and watch). Purely for bragging rights: no money changes hands.
 *
 * Sync is lockstep: whoever sits in chair 1 picks a random seed and sends
 * `start`; from then on each player only sends their own moves, numbered,
 * and both clients feed them to their own copy of the rules (Rules.js). The
 * rules are deterministic, so the hidden shell order, the items and every
 * coin flip come out the same everywhere without ever being sent. People who
 * walk in late ask for the move list and replay it instantly.
 *
 * Network events (all under 'br'):
 *   sit {s} · stand {s} · start {seed, ids} · act {n, a} · forfeit {s}
 *   hello → state {to, seed, ids, log}
 *
 * At the table: look at the shotgun or an item and click. Holding the gun,
 * look at the other player to shoot them or down at yourself to shoot
 * yourself; RMB puts it back down. E stands up (twice during a match = forfeit).
 */
export class Roulette {
  constructor(game) {
    this.game = game;
    this.seats = [null, null]; // net ids
    this.mySeat = -1;
    this.match = null; // { rules, ids, names, buffer: Map(n → action) }
    this.queue = [];
    this.busy = false;
    this.mode = 'idle'; // idle | aim | steal | wait
    this.ray = new THREE.Raycaster();
    this.shakeT = 0;
    this.#ui();
    game.mp?.on('br', (e, id) => this.#net(e, id));
    game.net?.on('leave', (id) => this.#left(id));
    game.net?.on('welcome', () => {
      this.seats = [null, null];
      this.mySeat = -1;
      this.#end(true);
      this.#send({ t: 'hello' });
    });
    game.net?.on('join', () => {
      if (this.mySeat >= 0) this.#send({ t: 'sit', s: this.mySeat });
    });
  }

  /** Called by the shed when it builds its table. */
  bind(scene, table) {
    this.scene = scene;
    this.table = table;
  }

  get myId() {
    return this.game.net?.id;
  }

  get inShed() {
    return this.table && this.game.scene === this.scene;
  }

  name(p) {
    const id = this.match?.ids[p] ?? this.seats[p];
    if (!id) return '—';
    if (id === this.myId) return this.game.mp?.profile?.name || 'you';
    const n = this.game.mp?.remotes.get(id)?.name ?? this.game.net?.players.get(id)?.name;
    // remember names: someone who just left is still "Bob", not "stranger"
    if (n) (this.names ??= new Map()).set(id, n);
    return n ?? this.names?.get(id) ?? 'stranger';
  }

  #send(e) {
    this.game.net?.online && this.game.net.event('br', e);
  }

  // ---------------------------------------------------------------------------
  // Seats
  // ---------------------------------------------------------------------------

  seatPrompt(s) {
    if (this.seats[s] === this.myId && this.myId) return 'Your seat';
    if (this.seats[s]) return `${this.name(s)} is sitting here`;
    if (!this.game.net?.online) return 'Buckshot roulette needs a second player (host or join a room)';
    if (this.mySeat >= 0) return 'Take this seat';
    return `Sit down${this.seats[1 - s] ? ` across from ${this.name(1 - s)}` : ''} (buckshot roulette)`;
  }

  sit(s) {
    const g = this.game;
    if (!g.net?.online) return g.hud.toast('This one takes two. Host or join a multiplayer room first.', 3500);
    if (this.seats[s] && this.seats[s] !== this.myId) return g.hud.toast(`${this.name(s)} is already sitting there.`, 2500);
    if (this.match && !this.match.ids.includes(this.myId)) return g.hud.toast('A game is on. Watch, or wait for the next one.', 2500);
    this.seats[s] = this.myId;
    this.mySeat = s;
    const t = this.table;
    g.player.sit({
      eye: t.seatEye(s),
      yaw: t.seatYaw(s),
      pitch: -0.42,
      yawLimit: 1.25,
      standAt: t.standAt(s),
      custom: true,
      hint: () => this.#hint(),
      onStand: () => this.#stood(),
    });
    this.#send({ t: 'sit', s });
    g.hud.toast(this.seats[1 - s] ? `You sit down across from ${this.name(1 - s)}.` : 'You sit down. Waiting for someone to take the other chair…', 3000);
    this.#maybeStart();
  }

  /** Stand up (E). During a match the first press warns, the second forfeits. */
  #standRequest() {
    const g = this.game;
    if (this.match && !this.match.rules.over && this.match.ids[this.mySeat] === this.myId) {
      if (!this.forfeitArmed || g.time - this.forfeitArmed > 2.5) {
        this.forfeitArmed = g.time;
        g.hud.toast('Leaving now forfeits the game. Press E again to walk away.', 2500);
        return;
      }
      this.#send({ t: 'forfeit', s: this.mySeat });
      this.#forfeit(this.mySeat);
    }
    g.player.stand();
  }

  #stood() {
    if (this.mySeat < 0) return;
    const s = this.mySeat;
    this.mySeat = -1;
    this.mode = 'idle';
    if (this.seats[s] === this.myId) this.seats[s] = null;
    this.#send({ t: 'stand', s });
    this.game.hud.setPrompt(null);
    if (this.table?.held === s) this.table.held = -1;
  }

  #maybeStart() {
    clearTimeout(this.startTimer);
    if (this.match || this.mySeat !== 0 || !this.seats[0] || !this.seats[1]) return;
    this.startTimer = setTimeout(() => {
      if (this.match || this.mySeat !== 0 || !this.seats[0] || !this.seats[1]) return;
      const seed = (Math.random() * 2 ** 31) >>> 0;
      const ids = [...this.seats];
      this.#send({ t: 'start', seed, ids });
      this.#begin(seed, ids);
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Network
  // ---------------------------------------------------------------------------

  #net(e, id) {
    switch (e.t) {
      case 'hello':
        if (this.mySeat >= 0) this.#send({ t: 'sit', s: this.mySeat });
        if (this.match && !this.match.rules.over && this.#isReporter()) this.#send({ t: 'state', to: id, seed: this.match.seed, ids: this.match.ids, log: this.match.log });
        break;
      case 'sit': {
        const s = e.s;
        // someone moved chairs
        if (this.seats[1 - s] === id) this.seats[1 - s] = null;
        const cur = this.seats[s];
        if (!cur || cur === id) this.seats[s] = id;
        else if (cur === this.myId) {
          // both sat at once: the lower id keeps the chair
          if (id < this.myId) {
            this.seats[s] = id;
            this.game.hud.toast(`${this.game.mp?.remotes.get(id)?.name ?? 'Someone'} sat there first.`, 2500);
            this.mySeat = -1;
            this.game.player.seated && this.game.player.stand();
          } else this.#send({ t: 'sit', s });
        } else this.seats[s] = cur < id ? cur : id;
        this.#maybeStart();
        break;
      }
      case 'stand':
        if (this.seats[e.s] === id) this.seats[e.s] = null;
        break;
      case 'start':
        if (!this.match || this.match.rules.over) this.#begin(e.seed, e.ids);
        break;
      case 'act':
        if (!this.match || this.match.ids.indexOf(id) < 0) return;
        this.match.buffer.set(e.n, e.a);
        this.#drain();
        break;
      case 'state':
        if (e.to === this.myId && !this.match) this.#begin(e.seed, e.ids, e.log);
        break;
      case 'forfeit':
        if (this.match && this.match.ids[e.s] === id) this.#forfeit(e.s);
        break;
      default:
    }
  }

  /** The one player who answers late joiners' state requests. */
  #isReporter() {
    const ids = this.match.ids;
    return ids[0] === this.myId || (ids[1] === this.myId && !this.game.mp?.remotes.has(ids[0]));
  }

  #left(id) {
    const s = this.seats.indexOf(id);
    if (s >= 0) this.seats[s] = null;
    if (this.match && !this.match.rules.over) {
      const p = this.match.ids.indexOf(id);
      if (p >= 0) this.#forfeit(p, 'left');
    }
  }

  // ---------------------------------------------------------------------------
  // Match flow
  // ---------------------------------------------------------------------------

  #begin(seed, ids, log = []) {
    const rules = new Rules(seed);
    const fx = rules.start();
    fx.push({ k: 'turn', p: rules.turn });
    this.match = { seed, rules, ids: [...ids], log: [], buffer: new Map() };
    this.name(0);
    this.name(1);
    this.mode = 'idle';
    this.queue = [];
    const late = log.length > 0;
    for (const a of log) this.#apply(a, true);
    if (!this.inShed) return;
    if (late) this.table.layout(rules, [0, 1].map((p) => this.name(p)));
    else {
      this.table.reset();
      this.#queue(fx);
    }
  }

  #drain() {
    const m = this.match;
    while (m && m.buffer.has(m.rules.n)) {
      const a = m.buffer.get(m.rules.n);
      m.buffer.delete(m.rules.n);
      this.#apply(a);
    }
  }

  #apply(a, silent = false) {
    const m = this.match;
    const fx = m.rules.apply(a);
    if (!fx) {
      console.warn('[roulette] rejected move', a, 'at', m.rules.n);
      return false;
    }
    m.log.push(a);
    const end = fx.find((f) => f.k === 'roundEnd');
    if (end && !m.rules.over) fx.push(...m.rules.nextRound());
    if (!silent && this.inShed) this.#queue(fx);
    return true;
  }

  /** Public for touch controls / the console: make a move as the seated player. */
  act(a) {
    return this.#myTurn() && this.#act(a);
  }

  /** Our own move: check, apply, tell the other player. */
  #act(a) {
    const m = this.match;
    if (!m || !m.rules.legal(this.mySeat, a)) return false;
    const n = m.rules.n;
    if (!this.#apply(a)) return false;
    this.#send({ t: 'act', n, a });
    this.mode = 'wait';
    return true;
  }

  #forfeit(p, why = 'forfeit') {
    const m = this.match;
    if (!m || m.rules.over) return;
    m.rules.over = true;
    m.rules.winner = 1 - p;
    this.queue = [];
    this.table?.anim.flush();
    const w = 1 - p;
    this.#msg(why === 'left' ? `${this.name(p)} left. ${this.name(w)} wins by default.` : `${this.name(p)} walked away. ${this.name(w)} wins.`, 4000, 'round');
    this.#won(w);
    setTimeout(() => this.#end(), 3500);
  }

  #end(silent = false) {
    this.match = null;
    if (this.fx) this.fx.className = '';
    this.queue = [];
    this.mode = 'idle';
    if (!silent && this.inShed) this.table.reset();
    this.#maybeStart();
  }

  #won(w) {
    if (this.match?.ids[w] !== this.myId) return;
    let n = 0;
    try {
      n = Number(localStorage.getItem('3am-roulette') ?? 0) + 1;
      localStorage.setItem('3am-roulette', String(n));
    } catch {}
    this.game.scenes.World.backyard?.recordScore('roulette', n);
  }

  /** The player walked into the shed: show the table as it is right now. */
  enter() {
    if (!this.table) return;
    this.queue = [];
    if (this.match) this.table.layout(this.match.rules, [0, 1].map((p) => this.name(p)));
    else this.table.reset();
    this.#send({ t: 'hello' });
  }

  // ---------------------------------------------------------------------------
  // Playing the effects
  // ---------------------------------------------------------------------------

  #queue(fx) {
    this.queue.push(...fx);
    this.#run();
  }

  async #run() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const fx = this.queue.shift();
      // fallen behind (tabbed away)? catch up faster
      this.table.anim.speed = this.queue.length > 8 ? 3 : this.queue.length > 4 ? 1.6 : 1;
      try {
        await this.#play(fx);
      } catch (err) {
        console.error('[roulette]', err);
      }
    }
    this.table.anim.speed = 1;
    this.busy = false;
    if (this.mode === 'wait') this.mode = 'idle';
  }

  async #play(fx) {
    const t = this.table;
    const m = this.match;
    switch (fx.k) {
      case 'round':
        return t.roundStart(fx, [0, 1].map((p) => this.name(p)));
      case 'load':
        return t.load(fx, m?.rules);
      case 'turn':
        if (m) t.updateCut(m.rules);
        if (fx.p === this.mySeat) this.#msg('YOUR TURN', 1500, 'turn');
        else this.#msg(`${this.name(fx.p)}'s turn`, 1400);
        return;
      case 'shoot': {
        const who = this.name(fx.p);
        await t.shoot(fx);
        if (!fx.live && fx.at === 'self') this.#msg(`Blank. ${who} goes again.`, 1800);
        else if (fx.live) this.#msg(fx.at === 'self' ? `${who} shot themselves. (−${fx.dmg})` : `${who} shot ${this.name(fx.target)}. (−${fx.dmg})`, 2000, 'live');
        else this.#msg('Blank.', 1300, 'blank');
        return;
      }
      case 'skip':
        return t.skip(fx);
      case 'uncuff':
        return t.uncuff(fx);
      case 'item':
        return t.item(fx);
      case 'roundEnd':
        return t.roundEnd(fx);
      case 'matchEnd': {
        const w = fx.winner;
        this.#msg(w === this.mySeat ? 'YOU WIN' : `${this.name(w)} WINS`, 5000, 'round');
        this.#won(w);
        await t.anim.wait(2.5);
        // the loser comes round
        if (t.slump[1 - w]) {
          this.#shock(1 - w);
          t.slump[1 - w] = 0;
        }
        await t.anim.wait(2.5);
        this.#end();
        return;
      }
      default:
    }
  }

  // ---------------------------------------------------------------------------
  // Input (seated, our turn)
  // ---------------------------------------------------------------------------

  #myTurn() {
    const m = this.match;
    return m && this.mySeat >= 0 && m.ids[this.mySeat] === this.myId && m.rules.turn === this.mySeat && !m.rules.over && !m.rules.roundOver && !this.busy && !this.queue.length;
  }

  #hint() {
    if (!this.match) return this.seats[1 - this.mySeat] ? 'MOUSE look · the game starts in a moment · E stand up' : 'MOUSE look · waiting for a second player · E stand up';
    if (this.mode === 'aim') return 'look at them or down at yourself · LMB fire · RMB put the gun down';
    if (this.mode === 'steal') return 'LMB take one of their items · RMB cancel';
    if (this.#myTurn()) return 'LMB the shotgun or one of your items · MOUSE look · E stand up (forfeit)';
    return 'MOUSE look · wait your turn · E stand up (forfeit)';
  }

  #pick(objs) {
    const g = this.game;
    this.ray.setFromCamera(_center, g.camera);
    this.ray.far = 2.4;
    const hits = this.ray.intersectObjects(objs, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !objs.includes(o)) o = o.parent;
    return o;
  }

  #input() {
    const g = this.game;
    const input = g.input;
    const t = this.table;
    const p = this.mySeat;
    if (input.pressed('KeyE')) {
      input.consume('KeyE');
      if (this.mode === 'aim' && t.held === p) {
        this.mode = 'wait';
        t.release(p).then(() => this.mode === 'wait' && (this.mode = 'idle'));
        return;
      }
      return this.#standRequest();
    }
    if (!this.#myTurn()) {
      g.hud.setPrompt(this.match && !this.busy && !this.queue.length && this.match.rules.turn !== p ? `${this.name(1 - p)} is deciding…` : null);
      return;
    }
    const rules = this.match.rules;
    const click = input.mousePressed(0);
    const rclick = input.mousePressed(2);
    if (click) input.consumeMouse?.(0);
    if (this.mode === 'aim') {
      const self = g.player.pitch < -0.62;
      t.aimPreview(p, self ? 'self' : 'opp');
      g.hud.setPrompt(self ? '[LMB] Shoot YOURSELF    look up to aim at them · [RMB] put it down' : `[LMB] Shoot ${this.name(1 - p).toUpperCase()}    look down to aim at yourself · [RMB] put it down`);
      if (rclick) {
        this.mode = 'wait';
        t.release(p).then(() => this.mode === 'wait' && (this.mode = 'idle'));
      } else if (click) this.#act({ k: 'shoot', at: self ? 'self' : 'opp' });
      return;
    }
    if (this.mode === 'steal') {
      const objs = t.items[1 - p].filter(Boolean);
      const hit = this.#pick(objs);
      const slot = hit ? t.items[1 - p].indexOf(hit) : -1;
      const item = slot >= 0 ? rules.items[1 - p][slot] : null;
      if (rclick) {
        this.mode = 'idle';
        return;
      }
      if (!item) {
        g.hud.setPrompt('Look at one of their items to take it · [RMB] cancel');
        return;
      }
      const a = { k: 'item', slot: this.stealFrom, steal: slot };
      const ok = rules.legal(p, a);
      g.hud.setPrompt(ok ? `[LMB] Take their ${label(item)} and use it` : item === 'adrenaline' ? "You can't steal adrenaline." : `Their ${label(item)} is no use right now.`, !ok);
      if (click && ok) this.#act(a);
      return;
    }
    if (this.mode !== 'idle') return g.hud.setPrompt(null);
    const objs = [t.gun, ...t.items[p].filter(Boolean)];
    const hit = this.#pick(objs);
    if (!hit) return g.hud.setPrompt(null);
    if (hit === t.gun) {
      g.hud.setPrompt('[LMB] Pick up the shotgun');
      if (click) {
        this.mode = 'wait';
        t.hold(p).then(() => {
          if (this.mode === 'wait' && this.#myTurn()) this.mode = 'aim';
        });
      }
      return;
    }
    const slot = t.items[p].indexOf(hit);
    const item = rules.items[p][slot];
    if (!item) return g.hud.setPrompt(null);
    const usable = rules.canUse(p, item);
    const why = item === 'saw' ? 'The barrel is already sawn off.' : item === 'handcuffs' ? 'They are already cuffed.' : item === 'adrenaline' ? 'Nothing of theirs worth taking.' : "Can't use that now.";
    g.hud.setPrompt(usable ? `[LMB] ${ITEMS[item].name}: ${ITEMS[item].desc}` : `${ITEMS[item].name}: ${why}`, !usable);
    if (click && usable) {
      if (item === 'adrenaline') {
        this.stealFrom = slot;
        this.mode = 'steal';
        this.#msg('Pick one of their items', 1500);
      } else this.#act({ k: 'item', slot });
    }
  }

  // ---------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    if (!this.table) return;
    // left the chair some other way (scene change, respawn)
    if (this.mySeat >= 0 && (!g.player.seated || !g.player.seat?.custom)) this.#stood();
    if (!this.inShed) return;
    this.table.update(dt, g.camera);
    if (this.mySeat >= 0 && !g.uiOpen) this.#input();
    // shake
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      g.player.pitchOffset = (Math.random() - 0.5) * 0.05 * this.shakeAmp * (this.shakeT / this.shakeDur);
    } else if (this.shakeAmp) {
      g.player.pitchOffset = 0;
      this.shakeAmp = 0;
    }
  }

  /** For the remote avatars: reach for the floating hands, slump when shot. */
  rigFor(id) {
    if (!this.inShed) return null;
    const s = (this.match?.ids ?? this.seats).indexOf(id);
    if (s < 0 || this.seats[s] !== id) return null;
    const r = this.table.reach(s);
    return { l: r.l, r: r.r, slump: this.table.slump[s] };
  }

  // ---------------------------------------------------------------------------
  // On-screen bits (DOM)
  // ---------------------------------------------------------------------------

  #ui() {
    const root = document.getElementById('ui') ?? document.body;
    this.el = document.createElement('div');
    this.el.id = 'br';
    this.el.innerHTML = '<div class="br-msg"></div><div class="br-priv"></div>';
    root.appendChild(this.el);
    this.fx = document.createElement('div');
    this.fx.id = 'br-fx';
    root.appendChild(this.fx);
  }

  /** The interface the Table calls back into. */
  get ui() {
    return {
      msg: (t, ms, cls) => this.#msg(t, ms, cls),
      priv: (t, ms, cls) => this.#priv(t, ms, cls),
      name: (p) => this.name(p),
      mine: (p) => p === this.mySeat,
      hurt: (p, dmg, hp, small) => this.#hurt(p, dmg, hp, small),
      shock: (p) => this.#shock(p),
      shake: (k) => this.#shake(k, 0.6),
      look: (p, pitch, dur) => this.#look(p, pitch, dur),
    };
  }

  #msg(text, ms = 2000, cls = '') {
    if (!this.inShed) return;
    const m = this.el.querySelector('.br-msg');
    m.textContent = text;
    m.className = `br-msg show ${cls}`;
    clearTimeout(this.msgT);
    this.msgT = setTimeout(() => (m.className = 'br-msg'), ms);
  }

  #priv(text, ms = 2500, cls = '') {
    const m = this.el.querySelector('.br-priv');
    m.textContent = text;
    m.className = `br-priv show ${cls}`;
    clearTimeout(this.privT);
    this.privT = setTimeout(() => (m.className = 'br-priv'), ms);
  }

  /** Turn our own head (seated) to a pitch, facing straight down the table. */
  #look(p, pitch, dur) {
    const g = this.game;
    if (p !== this.mySeat || !g.player.seated) return;
    const yaw0 = g.player.seat.yaw;
    const d = THREE.MathUtils.euclideanModulo(g.player.yaw - yaw0 + Math.PI, Math.PI * 2) - Math.PI;
    g.player.yaw = yaw0 + d;
    g.tweens.to(g.player, { pitch, yaw: yaw0 }, dur, { ease: 'inOut' });
  }

  #shake(amp, dur) {
    this.shakeAmp = amp;
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  #hurt(p, dmg, hp, small = false) {
    const audio = this.game.audio;
    if (!this.inShed) return;
    if (p !== this.mySeat) {
      this.#shake(small ? 0.2 : 0.7, 0.35);
      return;
    }
    const f = this.fx;
    f.className = 'flash';
    this.#shake(small ? 0.6 : 2, small ? 0.3 : 0.6);
    if (small) {
      setTimeout(() => (f.className = 'red'), 60);
      setTimeout(() => (f.className = ''), 700);
      return;
    }
    audio.oneShot('tinnitus', { volume: 0.8 });
    setTimeout(() => (f.className = 'red'), 70);
    setTimeout(() => (f.className = hp > 0 ? 'black' : 'black dead'), 260);
    void dmg;
  }

  #shock(p) {
    if (p !== this.mySeat || !this.inShed) return;
    this.game.audio.oneShot('heartbeat', { volume: 0.8 });
    this.#shake(1.2, 0.3);
    this.#look(p, -0.42, 0.6);
    this.fx.className = 'wake';
    setTimeout(() => (this.fx.className = ''), 1200);
  }
}

const _center = new THREE.Vector2(0, 0);
