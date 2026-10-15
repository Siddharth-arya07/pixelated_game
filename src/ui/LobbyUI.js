/**
 * LobbyUI
 * -------
 * The title card's multiplayer bit: your name, then
 *   play alone · host a room (gets a 4-letter code) · join with a code.
 * An invite link (?room=ABCD) pre-fills the code. Name + character are
 * remembered on this device.
 */
const KEY = '3am-profile';

export class LobbyUI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = $('lobby');
    this.status = $('lb-status');
    this.name = $('lb-name');
    this.code = $('lb-code');
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {}
    this.char = 'girl'; // one character for now (mia)
    this.name.value = saved.name ?? '';
    const invite = new URLSearchParams(location.search).get('room');
    if (invite) {
      this.code.value = invite.toUpperCase().slice(0, 4);
      this.status.textContent = `You were invited to room ${this.code.value}. Pick a name and hit join.`;
    }
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('touchend', (e) => e.stopPropagation());
    $('lb-solo').addEventListener('click', () => this.#go('solo'));
    $('lb-host').addEventListener('click', () => this.#go('host'));
    $('lb-join').addEventListener('click', () => this.#go('join'));
    this.code.addEventListener('keydown', (e) => e.key === 'Enter' && this.#go('join'));
  }

  show() {
    this.el.classList.remove('hidden');
    document.getElementById('start-hint').classList.add('hidden');
  }

  async #go(mode) {
    const g = this.game;
    const profile = { name: this.name.value.trim() || 'someone', char: 'girl' };
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {}
    g.audio.resume();
    // Grab the mouse NOW, while this click still counts as a user gesture —
    // after awaiting the network the browser would refuse pointer lock.
    g.input.requestLock();
    try {
      if (mode === 'host') {
        this.status.textContent = 'Opening a room…';
        const code = await g.mp.host(profile);
        this.status.textContent = `Room ${code}`;
      } else if (mode === 'join') {
        const code = this.code.value.trim().toUpperCase();
        if (code.length !== 4) return (this.status.textContent = 'Room codes are 4 letters.');
        this.status.textContent = `Joining ${code}…`;
        await g.mp.join(code, profile);
      }
    } catch (e) {
      g.input.exitLock();
      this.status.textContent = e.message || 'Could not connect.';
      return;
    }
    g.lobbyChoice = mode;
    this.el.classList.add('hidden');
    g.start();
  }
}
