import * as THREE from 'three';
import { Net, newRoomCode } from './Net.js';
import { Avatar } from './Avatar.js';
import { Voice } from './Voice.js';
import { ITEMS } from '../systems/InventorySystem.js';
import { wishFx } from '../scenes/WishingWell.js';

/**
 * Multiplayer
 * -----------
 * Everything that makes a room feel shared, on top of Net (the socket):
 *
 *  - you → room: your state 15×/s (scene, feet, look, anim, held item,
 *    smoking, flashlight, the vehicle + seat you're in, mic level)
 *  - room → you: other players as Avatars, interpolated ~120 ms behind
 *  - host → room: the shared world (time, weather, train, drive-in clock,
 *    deer herds); guests follow it. If the host leaves, the next player
 *    takes over seamlessly (their systems switch to authority mode).
 *  - events: lightning, trains, shots, deer hits, sandbox/garden edits,
 *    shared music/TV/fridge, hung paintings, gifts
 *  - rides: hop in as a passenger of someone else's vehicle
 *  - emotes (1 wave · 2 point · 3 sit · 4 lie down), gifts, the room badge
 */
const SEND_HZ = 15;
const DELAY = 0.12; // interpolation delay (s)

export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.net = game.net = new Net(game);
    this.voice = new Voice(this);
    this.remotes = new Map();
    this.handlers = new Map();
    this.ride = null; // { veh, seat, yaw, pitch } when we're a passenger
    this.emote = null; // { a, until }
    this.sendT = 0;
    this.worldT = 0;
    this.deerT = 0;
    this.#ui();
    this.#wire();
  }

  get online() {
    return this.net.online;
  }

  on(k, fn) {
    this.handlers.set(k, fn);
  }

  // ---------------------------------------------------------------------------
  // Lobby
  // ---------------------------------------------------------------------------

  async host(profile) {
    return this.join(newRoomCode(), profile);
  }

  async join(code, profile) {
    this.profile = profile;
    await this.net.join(code, profile);
    this.voice.start().catch((e) => this.game.hud.toast(`Mic unavailable: ${e.message}`, 4000));
    this.#badge();
    history.replaceState(null, '', `?room=${this.net.room}`);
    return this.net.room;
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  #wire() {
    const net = this.net;
    const g = this.game;
    net.on('welcome', (m) => {
      for (const r of this.remotes.values()) r.dispose();
      this.remotes.clear();
      for (const p of m.players) if (p.id !== net.id) this.#addRemote(p);
      if (m.world) this.#applyWorld(m.world);
      this.#badge();
      g.hud.toast(net.isHost ? `Room ${net.room} is open. Share the code.` : `Joined room ${net.room}.`, 4000);
    });
    net.on('join', (p) => {
      this.#addRemote(p);
      g.hud.toast(`${p.name} showed up.`, 3000);
      this.#badge();
      if (net.isHost) this.#sendWorld(true);
    });
    net.on('leave', (id) => {
      const r = this.remotes.get(id);
      if (r) g.hud.toast(`${r.name} left.`, 3000);
      if (this.ride && this.ride.driverId === id) this.hopOff(true);
      r?.dispose();
      this.remotes.delete(id);
      this.voice.drop(id);
      for (const v of g.vehicles.vehicles) if (v.remoteDriver === id) this.releaseVehicle(v);
      this.#badge();
    });
    net.on('host', (id) => {
      if (id === net.id) g.hud.toast("You're hosting the room now.", 3000);
      this.#badge();
    });
    net.on('state', (m) => this.remotes.get(m.id)?.push(m.s));
    net.on('world', (m) => this.#applyWorld(m.w));
    net.on('ev', (m) => this.handlers.get(m.e.k)?.(m.e, m.id));
    net.on('rtc', (m) => this.voice.signal(m.from, m.d));
    net.on('disconnect', () => g.hud.toast('Connection lost. Reconnecting…', 3000));

    // ---- shared-world events ---------------------------------------------------
    this.on('strike', (e) => g.weather.strike(e.dist, e.a, true));
    this.on('train', (e) => g.scenes.World.railway?.startRun(e.dir));
    this.on('deerHit', (e) => this.net.isHost && g.hunting.netHit(e.id, e.dmg, e.from));
    this.on('deerDressed', (e) => this.net.isHost && g.hunting.netDressed(e.id));
    this.on('shot', (e, id) => {
      const r = this.remotes.get(id);
      if (r && r.inMyScene) g.audio.oneShot('shotgun', { volume: 1, object: r.avatar.group });
    });
    this.on('give', (e, id) => {
      if (e.to !== this.net.id || !ITEMS[e.item]) return;
      g.inventory.add(e.item, e.n ?? 1);
      g.hud.toast(`${this.remotes.get(id)?.name ?? 'Someone'} gave you ${ITEMS[e.item].name}.`, 3500);
      g.audio.oneShot('click');
    });
    this.on('sand', (e) => g.scenes.World.playground?.sandbox.applyOp(e.op));
    this.on('garden', (e) => g.scenes.World.garden?.applyOp(e));
    this.on('fridge', (e) => g.scenes.House.built && g.scenes.House.setFridge?.(e.open));
    this.on('hang', (e) => g.scenes.House.built && g.scenes.House.hangPainting(e.slot, e.url, true, true));
    this.on('music', (e, id) => this.#remoteMusic(e, id));
    this.on('tv', (e) => this.game.devices?.get(e.dev)?.setChannel?.(e.ch, e.on));
    this.on('wish', (e, id) => {
      if (g.scene?.name !== 'World') return;
      wishFx(g, e.k, new THREE.Vector3(...e.p));
      g.hud.toast(`${this.remotes.get(id)?.name ?? 'Someone'} made a wish at the well.`, 3000);
    });
    this.on('flares', (e) => g.scene?.name === e.sc && g.fireworks.flares(new THREE.Vector3(...e.p), new THREE.Vector3(...e.v), e.h));
    this.on('flash', (e, id) => {
      const r = this.remotes.get(id);
      if (r?.inMyScene) g.polaroid.remoteFlash(r.avatar.group.position);
    });
    this.on('emote', (e, id) => {
      const r = this.remotes.get(id);
      if (r && r.inMyScene && e.a === 'wave') g.hud.toast(`${r.name} waves.`, 1800);
    });
  }

  #addRemote(p) {
    const r = new Remote(this, p);
    this.remotes.set(p.id, r);
    if (p.state) r.push(p.state);
    this.voice.connect(p.id);
  }

  /**
   * Everyone uses the same spawn points, so in a room each player gets their
   * own slot beside it (ordered by id): nobody appears inside anybody.
   */
  spawnSlot(sp) {
    if (!this.online || !sp) return sp;
    const ids = [this.net.id, ...this.remotes.keys()].sort();
    const slot = ids.indexOf(this.net.id);
    if (slot <= 0) return sp;
    const offs = [0, 1.1, -1.1, 2.2][slot] ?? slot * 1.1;
    const yaw = sp.yaw ?? 0;
    // sideways, relative to the way the spawn faces (camera looks down -Z)
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    return { ...sp, position: sp.position.clone().addScaledVector(right, offs) };
  }

  // ---------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------

  update(dt) {
    if (!this.online) return;
    const g = this.game;
    // Emotes (keyboard 1–4)
    if (!g.uiOpen && !g.focus && g.state === 'playing') {
      const em = { Digit1: 'wave', Digit2: 'point', Digit3: 'sitground', Digit4: 'lie' };
      for (const [k, a] of Object.entries(em)) {
        if (g.input.pressed(k)) {
          this.emote = { a, until: a === 'wave' || a === 'point' ? g.time + 2.5 : Infinity, at: g.player.feet.clone() };
          this.net.event('emote', { a });
          g.hud.toast(a === 'wave' ? 'You wave.' : a === 'point' ? 'You point.' : a === 'lie' ? 'You lie down. (move to get up)' : 'You sit down. (move to get up)', 1800);
        }
      }
    }
    if (this.emote && (g.time > this.emote.until || g.player.feet.distanceTo(this.emote.at) > 0.3 || g.vehicle.active || this.ride)) this.emote = null;

    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / SEND_HZ;
      this.net.send('state', { s: this.#myState() });
    }
    if (this.net.isHost) {
      this.worldT -= dt;
      if (this.worldT <= 0) this.#sendWorld();
      this.deerT -= dt;
      if (this.deerT <= 0) {
        this.deerT = 0.25;
        this.net.send('world', { w: { deer: g.hunting.netSnapshot() } });
      }
    }
    const now = performance.now() / 1000 - DELAY;
    for (const r of this.remotes.values()) r.update(dt, now);
    this.#updateRide(dt);
    this.voice.update(dt);
    this.#badgeTick();
  }

  #myState() {
    const g = this.game;
    const p = g.player;
    const v = g.vehicle.active;
    const feet = p.feet;
    const speed = Math.hypot(p.velocity.x, p.velocity.z);
    let a = speed > 5 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
    if (p.seated) a = (p.seat.pitch ?? 0) > 0.6 ? 'lie' : 'sit';
    if (this.emote) a = this.emote.a;
    const s = {
      sc: g.scene?.name,
      p: [r2(feet.x), r2(feet.y), r2(feet.z)],
      yaw: r2(p.yaw),
      pitch: r2(p.pitch),
      a,
      sp: r2(speed),
      it: g.inventory.equipped,
      sm: g.viewModel.smoking ? 1 : 0,
      pets: g.pets?.netState(),
      air: g.radio?.onAir ? 1 : undefined,
      fl: g.flashlightOn ? 1 : 0,
      talkLevel: r2(this.voice.level),
      mute: this.voice.muted ? 1 : 0,
    };
    if (p.seated && p.seat.eye) {
      const e = p.seat.eye;
      s.p = [r2(e.x), r2(e.y - 1.15), r2(e.z)];
      s.yaw = r2(p.seat.yaw ?? p.yaw);
    }
    if (v) {
      const o = v.object;
      s.a = v.cfg.ollie ? 'skate' : 'drive';
      s.v = { id: v.id, seat: 0, p: [r2(o.position.x), r2(o.position.y), r2(o.position.z)], h: r2(v.heading), r: [r2(o.rotation.x), r2(o.rotation.z)], spd: r2(v.speed), hl: v.headlightsOn ? 1 : 0 };
      if (v.cfg.fly) Object.assign(s.v, { ag: v.onGround ? 0 : 1, sm: v.smokeOn ? 1 : 0, bn: v.bannerText ?? undefined });
    } else if (this.ride) {
      s.a = 'ride';
      s.v = { id: this.ride.veh.id, seat: this.ride.seat };
    }
    return s;
  }

  #sendWorld(full = false) {
    const g = this.game;
    this.worldT = 1;
    const W = g.scenes.World;
    const run = W.railway?.run;
    const w = {
      min: r2(g.dayNight.minutes),
      day: g.dayNight.day,
      storm: r2(g.weather.storm),
      tgt: r2(g.weather.target),
      rail: run ? { dir: run.dir, s: Math.round(run.s) } : null,
      film: W.drivein?.clock,
    };
    if (full) {
      w.deer = g.hunting.netSnapshot();
      if (g.scenes.Cave?.built) w.ore = g.scenes.Cave.netSnapshot();
      if (g.balloon.t0) w.balloon = g.balloon.t0;
      w.tree = g.scenes.World.treehouse?.netSnapshot();
      if (g.scenes.World.funland?.on) w.fun = 1;
    }
    this.net.send('world', { w });
  }

  #applyWorld(w) {
    if (this.net.isHost) return;
    const g = this.game;
    if (w.min !== undefined) {
      const dn = g.dayNight;
      if (w.day !== dn.day || Math.abs(dn.minutes - w.min) > 2) {
        dn.day = w.day;
        dn.minutes = w.min;
      }
    }
    if (w.tgt !== undefined) {
      g.weather.target = w.tgt;
      if (Math.abs(g.weather.storm - w.storm) > 0.15) g.weather.storm = w.storm;
    }
    const W = g.scenes.World;
    if (w.rail && W.railway && !W.railway.run) W.railway.startRun(w.rail.dir, w.rail.s);
    if (w.film && W.drivein) W.drivein.setClock(w.film);
    if (w.deer) g.hunting.netApply(w.deer);
    if (w.balloon && !g.balloon.t0) g.balloon.t0 = w.balloon;
    if (w.tree) W.treehouse?.netApply(w.tree);
    if (w.fun && W.funland && !W.funland.on) this.handlers.get('funland')?.({});
    if (w.ore) {
      if (g.scenes.Cave?.built) g.scenes.Cave.netApply(w.ore);
      else g.pendingOre = w.ore;
    }
  }

  // ---------------------------------------------------------------------------
  // Vehicles driven by others, and riding along
  // ---------------------------------------------------------------------------

  /** Called by Remote when its state says it's driving `id`. */
  driveRemote(veh, r, v) {
    const g = this.game;
    if (g.vehicle.active === veh) return; // we're driving it (race) — ours wins locally
    if (veh.remoteDriver !== r.id) {
      veh.remoteDriver = r.id;
      veh.remoteName = r.name;
      if (!veh.engine) veh.engine = g.audio.engine(veh.object, veh.cfg.engine ?? {});
    }
    if (veh.sceneName !== r.state.sc) {
      veh.park(r.state.sc, { position: new THREE.Vector3(...v.p), yaw: v.h });
      g.vehicles.onSceneEnter(g.scene);
    }
    const o = veh.object;
    const k = 1 - Math.exp(-g.dtLast * 12);
    o.position.lerp(_v.set(...v.p), o.position.distanceTo(_v) > 8 ? 1 : k);
    veh.heading = lerpAngle(veh.heading, v.h, k);
    o.rotation.set(v.r?.[0] ?? 0, veh.heading, v.r?.[1] ?? 0, 'YXZ');
    veh.speed = v.spd ?? 0;
    if (veh.setHeadlights && !!v.hl !== !!veh.headlightsOn) veh.setHeadlights(!!v.hl);
    if (veh.prop) veh.prop.rotation.z += g.dtLast * 50;
    if (veh.cfg.fly) {
      veh.onGround = !v.ag;
      veh.smokeOn = !!v.sm;
      g.planeFX.setBanner(veh, v.bn ?? null);
    }
    veh.engine?.setRPM?.(Math.min(1, Math.abs(veh.speed) / veh.cfg.maxSpeed));
    o.updateMatrixWorld();
  }

  releaseVehicle(veh) {
    if (veh.cfg.fly) {
      this.game.planeFX.setBanner(veh, null);
      veh.smokeOn = false;
    }
    veh.remoteDriver = null;
    veh.remoteName = null;
    if (this.game.vehicle.active !== veh) {
      veh.engine?.stop();
      veh.engine = null;
      veh.speed = 0;
      veh.vel?.set(0, 0);
    }
  }

  /** Seats taken in `veh` by anyone (index → name). */
  seatsTaken(veh) {
    const taken = new Set();
    for (const r of this.remotes.values()) if (r.state?.v?.id === veh.id) taken.add(r.state.v.seat);
    if (this.ride?.veh === veh) taken.add(this.ride.seat);
    return taken;
  }

  /** Hop in as a passenger. */
  rideAlong(veh) {
    const g = this.game;
    const seats = veh.cfg.passengers ?? [];
    const taken = this.seatsTaken(veh);
    const seat = seats.findIndex((_, i) => !taken.has(i + 1));
    if (seat < 0) return g.hud.toast('No room.');
    this.ride = { veh, seat: seat + 1, yaw: 0, pitch: -0.05, driverId: veh.remoteDriver };
    g.player.enabled = false;
    g.audio.oneShot('door', { volume: 0.6 });
    g.hud.toast(`Riding with ${veh.remoteName ?? 'them'}. E to hop off.`, 3000);
  }

  hopOff(force = false) {
    const g = this.game;
    const r = this.ride;
    if (!r) return;
    if (!force && Math.abs(r.veh.speed) > 2) return g.hud.toast('Wait till they stop.');
    this.ride = null;
    const pt = r.veh.exitPoint?.() ?? r.veh.object.position.clone().add(new THREE.Vector3(1.5, 0, 0));
    const y = Math.max(pt.y ?? 0, g.scene.groundHeight(pt.x, pt.z));
    g.player.spawn({ position: new THREE.Vector3(pt.x, y, pt.z), yaw: g.player.yaw });
    g.player.enabled = true;
    g.audio.oneShot('door', { volume: 0.6 });
  }

  #updateRide(dt) {
    const r = this.ride;
    if (!r) return;
    const g = this.game;
    if (r.veh.sceneName !== g.scene?.name && g.state === 'playing') {
      g.changeScene(r.veh.sceneName, 'default');
      return;
    }
    if (!r.veh.remoteDriver) return this.hopOff(true); // driver got out
    if (g.input.locked) {
      const d = g.input.consumeMouseDelta();
      const s = g.mouseSensitivity;
      r.yaw = THREE.MathUtils.clamp(r.yaw - d.x * s, -2.2, 2.2);
      r.pitch = THREE.MathUtils.clamp(r.pitch - d.y * s, -0.9, 0.8);
    }
    if (g.input.pressed('KeyE')) {
      g.input.consume('KeyE');
      this.hopOff();
    }
  }

  /** Camera for a passenger (called from Game's render). */
  applyRideCamera(cam) {
    const r = this.ride;
    if (!r) return false;
    const seat = r.veh.cfg.passengers[r.seat - 1];
    cam.position.copy(seat).applyMatrix4(r.veh.object.matrixWorld);
    _q.setFromEuler(_e.set(r.pitch, Math.PI + r.yaw, 0, 'YXZ'));
    cam.quaternion.copy(r.veh.object.quaternion).multiply(_q);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Gifts + shared music
  // ---------------------------------------------------------------------------

  /** Best thing to hand over: what's in your hands, else food/drink/smokes/flowers. */
  giftable() {
    const inv = this.game.inventory;
    const eq = inv.equipped;
    if (eq && eq !== 'shotgun' && inv.has(eq)) return eq;
    const prefer = (i) => ITEMS[i.id].food || i.id === 'cigarettes' || i.id.startsWith('flower_') || i.id === 'weed';
    return inv.list().find(prefer)?.id ?? null;
  }

  give(r) {
    const g = this.game;
    const item = this.giftable();
    if (!item) return g.hud.toast('Nothing to give.');
    g.inventory.remove(item);
    this.net.event('give', { to: r.id, item });
    g.hud.toast(`You gave ${r.name} ${ITEMS[item].name}.`, 3000);
  }

  /** Someone used a shared music device: if it's in our scene, we hear it too. */
  #remoteMusic(e, id) {
    const g = this.game;
    const r = this.remotes.get(id);
    if (!r || r.state?.sc !== g.scene?.name) return;
    const obj = g.devices?.get(e.dev)?.obj;
    if (!obj) return;
    const m = g.music;
    if (!e.play) {
      if (m.speakerObject === obj) m.pause();
      return;
    }
    m.useSpeaker(obj);
    m.play(e.i).then(() => m.seek(e.pos ?? 0));
  }

  /** Local device use → tell the room. */
  shareMusic(dev) {
    if (!this.online) return;
    const m = this.game.music;
    this.net.event('music', { dev, play: m.playing, i: m.index, pos: r2(m.position) });
  }

  // ---------------------------------------------------------------------------
  // UI: room badge + map markers
  // ---------------------------------------------------------------------------

  #ui() {
    this.badgeEl = document.createElement('div');
    this.badgeEl.id = 'room';
    this.badgeEl.className = 'hidden';
    document.getElementById('hud').appendChild(this.badgeEl);
  }

  #badge() {
    const n = this.net;
    if (!n.online) return this.badgeEl.classList.add('hidden');
    this.badgeEl.classList.remove('hidden');
    this.badgeKey = null;
    this.#badgeTick();
  }

  #badgeTick() {
    const n = this.net;
    const rows = [...this.remotes.values()].map((r) => `${r.state?.talkLevel > 0.08 && !r.state?.mute ? '♪' : r.state?.mute ? '×' : '·'} ${r.name}${r.id === n.hostId ? ' (host)' : ''}`);
    const me = `${this.voice.muted ? 'MIC OFF (V)' : this.voice.level > 0.08 ? 'MIC ♪' : 'MIC ON'} · ${this.profile?.name ?? 'you'}${n.isHost ? ' (host)' : ''}`;
    const key = `${n.room}|${rows.join(',')}|${me}`;
    if (key === this.badgeKey) return;
    this.badgeKey = key;
    this.badgeEl.innerHTML = `<b>ROOM ${n.room}</b> <small>${this.remotes.size + 1}/4</small><br>${[me, ...rows].map((r) => `<span>${esc(r)}</span>`).join('<br>')}`;
  }

  /** Other players for the map: [{ x, z, name, scene }] */
  markers() {
    return [...this.remotes.values()].filter((r) => r.state).map((r) => ({ x: r.state.p[0], z: r.state.p[2], name: r.name, scene: r.state.sc }));
  }
}

// -----------------------------------------------------------------------------
// One remote player
// -----------------------------------------------------------------------------

class Remote {
  constructor(mp, p) {
    this.mp = mp;
    this.game = mp.game;
    this.id = p.id;
    this.name = p.name;
    this.char = p.char;
    this.buf = [];
    this.state = null;
    this.avatar = new Avatar(this.game, { name: p.name, char: p.char });
    this.inMyScene = false;
    // other players are solid: push our capsule out of theirs
    this.obstacle = {
      pushOut: (seg, r) => {
        if (!this.inMyScene || this.seatedInVehicle) return;
        const a = this.avatar.group.position;
        if (seg.start.y > a.y + this.avatar.height || seg.end.y < a.y) return;
        const dx = seg.start.x - a.x;
        const dz = seg.start.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = r + 0.3;
        if (d >= min) return;
        const nx = d > 1e-4 ? dx / d : 1;
        const nz = d > 1e-4 ? dz / d : 0;
        const push = min - d;
        seg.start.x += nx * push;
        seg.start.z += nz * push;
        seg.end.x += nx * push;
        seg.end.z += nz * push;
      },
    };
    this.game.player.dynamicObstacles.push(this.obstacle);
    // aim at them to give things
    this.avatar.hit.userData.interact = {
      prompt: () => {
        const item = mp.giftable();
        return item ? `Give ${ITEMS[item].name} to ${this.name}` : this.name;
      },
      available: () => (mp.giftable() ? true : `${this.name}`),
      range: 3,
      action: () => mp.give(this),
      secondary: () => ({ label: 'Wave', action: () => (mp.emote = { a: 'wave', until: this.game.time + 2.5, at: this.game.player.feet.clone() }, mp.net.event('emote', { a: 'wave' })) }),
    };
  }

  push(s) {
    this.buf.push({ t: performance.now() / 1000, s });
    if (this.buf.length > 30) this.buf.shift();
    this.state = s;
  }

  /** Interpolated state at time `t` (seconds). */
  #sample(t) {
    const b = this.buf;
    if (!b.length) return null;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > t) i--;
    const a = b[Math.max(0, i - 1)];
    const c = b[i];
    if (a === c || c.t <= a.t) return { ...c.s };
    const k = THREE.MathUtils.clamp((t - a.t) / (c.t - a.t), 0, 1);
    const s = { ...c.s };
    s.p = a.s.p.map((v, j) => v + (c.s.p[j] - v) * k);
    s.yaw = lerpAngle(a.s.yaw, c.s.yaw, k);
    if (a.s.v?.p && c.s.v?.p && a.s.v.id === c.s.v.id) s.v = { ...c.s.v, p: a.s.v.p.map((v, j) => v + (c.s.v.p[j] - v) * k), h: lerpAngle(a.s.v.h, c.s.v.h, k) };
    return s;
  }

  update(dt, t) {
    const g = this.game;
    const s = this.#sample(t);
    if (!s) return;
    const scene = g.scene;
    const here = scene && s.sc === scene.name;
    const av = this.avatar;
    if (here !== this.inMyScene || (here && av.group.parent !== scene.root)) {
      av.group.parent?.remove(av.group);
      if (this.inScene) this.inScene.interactables = this.inScene.interactables.filter((o) => o !== av.hit);
      this.inScene = null;
      if (here) {
        scene.root.add(av.group);
        scene.interactables.push(av.hit);
        this.inScene = scene;
      }
      this.inMyScene = here;
    }
    // vehicles they drive are moved from their state, wherever we are
    const veh = s.v ? g.vehicles.get(s.v.id) : null;
    if (veh && s.v.seat === 0 && s.v.p) this.mp.driveRemote(veh, this, s.v);
    else for (const v of g.vehicles.vehicles) if (v.remoteDriver === this.id) this.mp.releaseVehicle(v);
    if (!here) return;

    const grp = av.group;
    this.seatedInVehicle = !!veh;
    if (veh) {
      // sit in the vehicle: driver seat or passenger seat i
      const seat = s.v.seat === 0 ? veh.cfg.avatarSeat ?? veh.cfg.seat : veh.cfg.avatarPassengers?.[s.v.seat - 1] ?? veh.cfg.passengers?.[s.v.seat - 1] ?? veh.cfg.seat;
      grp.position.copy(seat).applyMatrix4(veh.object.matrixWorld);
      grp.position.y -= veh.cfg.ollie ? 1.62 : 1.15;
      grp.rotation.set(0, veh.heading, 0);
      if (veh.cfg.fly) grp.quaternion.copy(veh.object.quaternion);
      if (s.v.seat !== 0) s.a = s.a === 'skate' ? 'skate' : 'ride';
    } else {
      grp.position.set(s.p[0], s.p[1], s.p[2]);
      grp.rotation.set(0, s.yaw + Math.PI, 0);
    }
    av.setName(this.name, (s.talkLevel ?? 0) > 0.08 && !s.mute);
    av.update(dt, s, g.camera.position);
    // never look at the inside of someone's head (shared spawns, seats, rides)
    const head = _v.copy(grp.position);
    head.y += av.height * 0.75;
    const close = Math.hypot(g.camera.position.x - grp.position.x, g.camera.position.z - grp.position.z) < 0.5 && Math.abs(g.camera.position.y - head.y) < 1;
    av.body.visible = !close;
  }

  dispose() {
    const obs = this.game.player.dynamicObstacles;
    const i = obs.indexOf(this.obstacle);
    if (i >= 0) obs.splice(i, 1);
    const av = this.avatar;
    if (this.inScene) this.inScene.interactables = this.inScene.interactables.filter((o) => o !== av.hit);
    av.dispose();
  }
}

function r2(v) {
  return Math.round(v * 100) / 100;
}
function lerpAngle(a, b, k) {
  const d = THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + d * k;
}
function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
