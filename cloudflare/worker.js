/**
 * 3:00 a.m. — multiplayer room server on Cloudflare (Worker + Durable Objects).
 *
 * The client (src/net/Net.js) connects with a plain WebSocket:
 *   wss://<worker>/parties/main/<room>?_pk=<client id>
 *
 * One Durable Object per room = one shared night for up to MAX players.
 *   hello → welcome (your id, who's here, the host, world snapshot)
 *   state → relayed to the others        ev → relayed
 *   world → host only: merged into the snapshot + relayed
 *   rtc   → WebRTC voice signalling, forwarded to one peer
 * First player hosts; when they leave, the oldest remaining player takes over.
 */
const MAX = 4;

export class Room {
  constructor(state) {
    this.state = state;
    this.conns = new Map(); // id -> WebSocket
    this.players = new Map(); // id -> { id, name, char, joined, state }
    this.world = {};
    this.host = null;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('3:00 a.m. room server', { status: 200 });
    const url = new URL(req.url);
    const id = url.searchParams.get('_pk') || crypto.randomUUID();
    const { 0: client, 1: ws } = new WebSocketPair();
    ws.accept();
    if (this.players.size >= MAX) {
      ws.send(JSON.stringify({ t: 'full', max: MAX }));
      ws.close(1000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    // a reconnect with the same id replaces the old socket
    this.conns.get(id)?.close(1000, 'replaced');
    this.conns.set(id, ws);
    ws.addEventListener('message', (e) => this.#message(id, e.data));
    const bye = () => this.#close(id, ws);
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  #message(id, raw) {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    switch (m.t) {
      case 'hello': {
        const p = { id, name: String(m.name || 'someone').slice(0, 16), char: 'girl', joined: Date.now(), state: null };
        this.players.set(id, p);
        if (!this.host || !this.players.has(this.host)) this.host = id;
        this.#send(id, { t: 'welcome', id, host: this.host, players: [...this.players.values()], world: this.world });
        this.#others(id, { t: 'join', player: p });
        break;
      }
      case 'state': {
        const p = this.players.get(id);
        if (!p) return;
        p.state = m.s;
        this.#others(id, { t: 'state', id, s: m.s });
        break;
      }
      case 'world':
        if (id !== this.host) return;
        Object.assign(this.world, m.w);
        this.#others(id, { t: 'world', w: m.w });
        break;
      case 'ev':
        this.#others(id, { t: 'ev', id, e: m.e });
        break;
      case 'rtc':
        this.#send(m.to, { t: 'rtc', from: id, d: m.d });
        break;
    }
  }

  #close(id, ws) {
    if (this.conns.get(id) !== ws) return; // already replaced
    this.conns.delete(id);
    if (!this.players.delete(id)) return;
    this.#all({ t: 'leave', id });
    if (this.host === id) {
      const next = [...this.players.values()].sort((a, b) => a.joined - b.joined)[0];
      this.host = next?.id ?? null;
      if (this.host) this.#all({ t: 'host', id: this.host });
    }
    if (!this.players.size) this.world = {}; // empty room: fresh night next time
  }

  #send(id, msg) {
    try {
      this.conns.get(id)?.send(JSON.stringify(msg));
    } catch {}
  }

  #others(id, msg) {
    const s = JSON.stringify(msg);
    for (const [cid, ws] of this.conns) {
      if (cid === id) continue;
      try {
        ws.send(s);
      } catch {}
    }
  }

  #all(msg) {
    const s = JSON.stringify(msg);
    for (const ws of this.conns.values()) {
      try {
        ws.send(s);
      } catch {}
    }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/parties\/main\/([A-Za-z0-9_-]{1,40})$/);
    if (!m) return new Response('3:00 a.m. rooms', { status: 200 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
    return room.fetch(req);
  },
};
