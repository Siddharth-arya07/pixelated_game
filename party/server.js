/**
 * 3:00 a.m. — multiplayer room server (PartyKit).
 *
 * One room = one shared night for up to MAX players. The server is a thin,
 * trusted relay:
 *   - hello → welcome: assigns your id, tells you who's here, who hosts, and
 *     hands you the latest world snapshot + everyone's last state
 *   - state: per-player transform/anim at ~15 Hz → relayed to the others
 *   - ev: one-off events (shots, doors, sandbox edits, gifts…) → relayed
 *   - world: the host's shared-world patches (time, weather, train, deer…)
 *     → merged into the snapshot + relayed
 *   - rtc: WebRTC signalling for voice, forwarded to one peer only
 * The first player is the host; if they leave, the next oldest takes over.
 */
const MAX = 4;

export default class Room {
  constructor(room) {
    this.room = room;
    this.players = new Map(); // id -> { id, name, char, joined, state }
    this.world = {}; // merged host snapshot
    this.host = null;
  }

  onConnect(conn) {
    if (this.players.size >= MAX) {
      conn.send(JSON.stringify({ t: 'full', max: MAX }));
      conn.close();
    }
  }

  onMessage(raw, sender) {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const id = sender.id;
    switch (m.t) {
      case 'hello': {
        const p = { id, name: String(m.name || 'someone').slice(0, 16), char: 'girl', joined: Date.now(), state: null };
        this.players.set(id, p);
        if (!this.host || !this.players.has(this.host)) this.host = id;
        sender.send(JSON.stringify({ t: 'welcome', id, host: this.host, players: [...this.players.values()], world: this.world }));
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
      case 'world': {
        if (id !== this.host) return;
        Object.assign(this.world, m.w);
        this.#others(id, { t: 'world', w: m.w });
        break;
      }
      case 'ev':
        this.#others(id, { t: 'ev', id, e: m.e });
        break;
      case 'rtc': {
        const to = [...this.room.getConnections()].find((c) => c.id === m.to);
        to?.send(JSON.stringify({ t: 'rtc', from: id, d: m.d }));
        break;
      }
    }
  }

  onClose(conn) {
    const id = conn.id;
    if (!this.players.delete(id)) return;
    this.#all({ t: 'leave', id });
    if (this.host === id) {
      const next = [...this.players.values()].sort((a, b) => a.joined - b.joined)[0];
      this.host = next?.id ?? null;
      if (this.host) this.#all({ t: 'host', id: this.host });
    }
  }

  #others(id, msg) {
    this.room.broadcast(JSON.stringify(msg), [id]);
  }

  #all(msg) {
    this.room.broadcast(JSON.stringify(msg));
  }
}
