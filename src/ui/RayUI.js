import { STORIES } from '../scenes/rayStories.js';

/**
 * RayUI
 * -----
 * Sitting with Ray at the bottom of the lighthouse: he tells you a story,
 * a paragraph at a time (it types out like he's thinking it through).
 * Click / SPACE / → for the next bit. One new story a night; after that
 * he'll tell you another if you ask. Remembers which ones you've heard.
 */
const KEY = '3am-ray';

export class RayUI {
  constructor(game) {
    this.game = game;
    this.visible = false;
    try {
      this.heard = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      this.heard = [];
    }
    this.el = document.createElement('div');
    this.el.id = 'ray';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="ry-card"><div class="ry-who">RAY</div><div class="ry-title"></div><div class="ry-text"></div><div class="ry-foot"></div></div>`;
    document.getElementById('ui').appendChild(this.el);
    this.titleEl = this.el.querySelector('.ry-title');
    this.textEl = this.el.querySelector('.ry-text');
    this.footEl = this.el.querySelector('.ry-foot');
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.next();
    });
    game.mp?.on('rayStory', (e, id) => {
      if (game.scene?.name !== 'Lighthouse' || this.visible) return;
      this.pending = e.i;
      const who = game.mp.remotes.get(id)?.name ?? 'Someone';
      game.hud.toast(`${who} is listening to Ray: “${STORIES[e.i].title}”. Sit with him to listen in.`, 4000);
    });
  }

  /** Open with tonight's story (or the one a friend is hearing). */
  open() {
    const g = this.game;
    const night = g.dayNight.day;
    let i = this.pending;
    this.pending = null;
    if (i == null) {
      if (this.night === night && this.current != null) i = this.current;
      else {
        const fresh = STORIES.findIndex((_, k) => !this.heard.includes(k));
        i = fresh >= 0 ? fresh : Math.floor(Math.random() * STORIES.length);
      }
    }
    this.night = night;
    this.#start(i);
    g.openUI(() => {
      this.visible = true;
      this.el.classList.remove('hidden');
    });
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
    clearInterval(this.typeT);
  }

  #start(i) {
    this.current = i;
    this.para = 0;
    const s = STORIES[i];
    this.titleEl.textContent = `“${s.title}”`;
    this.textEl.innerHTML = '';
    if (!this.heard.includes(i)) {
      this.heard.push(i);
      try {
        localStorage.setItem(KEY, JSON.stringify(this.heard));
      } catch {}
    }
    this.game.net?.online && this.game.net.event('rayStory', { i });
    this.#type();
  }

  #type() {
    const s = STORIES[this.current];
    const text = s.p[this.para];
    const p = document.createElement('p');
    this.textEl.appendChild(p);
    let n = 0;
    clearInterval(this.typeT);
    this.typing = true;
    this.typeT = setInterval(() => {
      n += 2;
      p.textContent = text.slice(0, n);
      if (n >= text.length) this.#doneTyping();
    }, 22);
    this.footEl.textContent = 'click / SPACE to keep listening · E to leave';
    this.#murmur();
  }

  #doneTyping() {
    clearInterval(this.typeT);
    this.typing = false;
    const s = STORIES[this.current];
    const ps = this.textEl.querySelectorAll('p');
    ps[ps.length - 1].textContent = s.p[this.para];
    if (this.para >= s.p.length - 1) {
      this.footEl.innerHTML = `<span>${this.heard.length}/${STORIES.length} stories heard</span> <button data-a="more">“Tell me another one, Ray.”</button> <button data-a="bye">“Goodnight, Ray.”</button>`;
      this.footEl.querySelector('[data-a=more]').onclick = () => {
        const fresh = STORIES.findIndex((_, k) => !this.heard.includes(k));
        const i = fresh >= 0 ? fresh : (this.current + 1) % STORIES.length;
        this.game.hud.toast(['“Another? You’re worse than the cat.”', '“Alright, alright. Put the kettle on.”', '“Hm. Let me think…”'][Math.floor(Math.random() * 3)], 2500);
        this.#start(i);
      };
      this.footEl.querySelector('[data-a=bye]').onclick = () => this.game.closeUI();
    }
  }

  next() {
    if (this.typing) return this.#doneTyping();
    const s = STORIES[this.current];
    if (this.para < s.p.length - 1) {
      this.para++;
      this.#type();
    }
  }

  update() {
    if (!this.visible) return;
    const i = this.game.input;
    if (i.pressed('Space') || i.pressed('ArrowRight') || i.pressed('KeyD')) this.next();
    if (i.pressed('KeyE')) {
      i.consume('KeyE');
      this.game.closeUI();
    }
  }

  /** A low, gravelly "hmm" so it feels like someone's talking. */
  #murmur() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(82, t + 0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.08, t + 0.08);
    e.gain.linearRampToValueAtTime(0, t + 0.7);
    o.connect(f).connect(e).connect(this.game.audio.master);
    o.start(t);
    o.stop(t + 0.75);
  }
}
