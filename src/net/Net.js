import PartySocket from 'partysocket';

/**
 * Net
 * ---
 * The connection to a multiplayer room (PartyKit, see /party/server.js).
 *
 *   net.join(code, { name, char })   → resolves once welcomed
 *   net.send(type, payload)          'state' | 'ev' | 'world' | 'rtc'
 *   net.on(type, fn)                 'welcome' 'join' 'leave' 'state' 'ev' 'world' 'rtc' 'host' 'full'
 *   net.isHost / net.id / net.players (Map id → { id, name, char })
 *
 * Offline (no room) everything is a no-op, so systems can call net.* freely.
 */
const HOST = import.meta.env.VITE_PARTY_HOST || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'localhost:1999' : 'three-am-rooms.siddhartharya.partykit.dev');

export class Net {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.room = null;
    this.id = null;
    this.hostId = null;
    this.players = new Map();
    this.handlers = new Map();
    this.online = false;
  }

  get isHost() {
    return !this.online || this.hostId === this.id;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
  }

  #emit(type, ...args) {
    for (const fn of this.handlers.get(type) ?? []) {
      try {
        fn(...args);
      } catch (e) {
        console.error('[net]', type, e);
      }
    }
  }

  join(code, profile) {
    this.room = code.toUpperCase();
    this.profile = profile;
    return new Promise((resolve, reject) => {
      const s = new PartySocket({ host: HOST, room: `night-${this.room}` });
      this.socket = s;
      const timer = setTimeout(() => reject(new Error('Could not reach the room server.')), 8000);
      s.addEventListener('open', () => s.send(JSON.stringify({ t: 'hello', ...profile })));
      s.addEventListener('message', (ev) => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (m.t) {
          case 'welcome':
            clearTimeout(timer);
            this.online = true;
            this.id = m.id;
            this.hostId = m.host;
            this.players = new Map(m.players.filter((p) => p.id !== m.id).map((p) => [p.id, p]));
            this.#emit('welcome', m);
            resolve(m);
            break;
          case 'full':
            clearTimeout(timer);
            reject(new Error(`That room is full (max ${m.max}).`));
            break;
          case 'join':
            this.players.set(m.player.id, m.player);
            this.#emit('join', m.player);
            break;
          case 'leave':
            this.players.delete(m.id);
            this.#emit('leave', m.id);
            break;
          case 'host':
            this.hostId = m.id;
            this.#emit('host', m.id);
            break;
          default:
            this.#emit(m.t, m);
        }
      });
      s.addEventListener('close', () => this.#emit('disconnect'));
    });
  }

  send(t, payload = {}) {
    if (!this.online || this.socket?.readyState !== 1) return;
    this.socket.send(JSON.stringify({ t, ...payload }));
  }

  /** One-off event to everyone else. */
  event(k, data = {}) {
    this.send('ev', { e: { k, ...data } });
  }

  leave() {
    this.socket?.close();
    this.online = false;
    this.players.clear();
  }
}

/** Short, readable room codes. */
export function newRoomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}
