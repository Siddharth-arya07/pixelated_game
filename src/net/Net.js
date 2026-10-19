/**
 * Net
 * ---
 * The connection to a multiplayer room on the Cloudflare Worker (see /cloudflare/worker.js).
 * Plain WebSocket to wss://<site>/parties/main/<room>?_pk=<id> (the site hands it to the
 * rooms worker); reconnects with the same id.
 *
 *   net.join(code, { name, char })   → resolves once welcomed
 *   net.send(type, payload)          'state' | 'ev' | 'world' | 'rtc'
 *   net.on(type, fn)                 'welcome' 'join' 'leave' 'state' 'ev' 'world' 'rtc' 'host' 'full'
 *   net.isHost / net.id / net.players (Map id → { id, name, char })
 *
 * Offline (no room) everything is a no-op, so systems can call net.* freely.
 */
const LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// Online, rooms live behind the site itself (/parties/* → rooms worker); locally, wrangler dev.
const HOST = import.meta.env.VITE_ROOMS_HOST || (LOCAL ? 'localhost:1999' : location.host);
const PROTO = LOCAL ? 'ws' : 'wss';

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
    this.clientId = crypto.randomUUID();
    this.closing = false;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.leave();
        reject(new Error(`Could not reach the room server (${HOST}).`));
      }, 8000);
      this.#connect({ resolve, reject, timer });
    });
  }

  #connect(pending, attempt = 0) {
    const url = `${PROTO}://${HOST}/parties/main/night-${this.room}?_pk=${this.clientId}`;
    const s = new WebSocket(url);
    this.socket = s;
    s.addEventListener('open', () => s.send(JSON.stringify({ t: 'hello', ...this.profile })));
    s.addEventListener('message', (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (m.t) {
        case 'welcome':
          attempt = 0;
          this.online = true;
          this.id = m.id;
          this.hostId = m.host;
          this.players = new Map(m.players.filter((p) => p.id !== m.id).map((p) => [p.id, p]));
          this.#emit('welcome', m);
          if (pending) {
            clearTimeout(pending.timer);
            pending.resolve(m);
            pending = null;
          }
          break;
        case 'full':
          this.closing = true;
          if (pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`That room is full (max ${m.max}).`));
            pending = null;
          }
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
    s.addEventListener('close', () => {
      if (this.socket !== s) return;
      this.#emit('disconnect');
      if (this.closing) return;
      // dropped: retry with backoff, same id so the server replaces our old slot
      const wait = Math.min(1000 * 2 ** attempt, 10000);
      setTimeout(() => !this.closing && this.socket === s && this.#connect(pending, attempt + 1), wait);
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
    this.closing = true;
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
