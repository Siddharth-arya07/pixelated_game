import { BOOK } from './bookText.js';

/**
 * BookUI
 * ------
 * The quantum physics book from the coffee table, read up close as a crisp
 * HTML two-page spread (real text, not the PSX framebuffer, so it's sharp at
 * any resolution). ←/→, A/D or clicking a page turns; E / Esc closes.
 * Remembers your page.
 */
export class BookUI {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.spread = 0;
    try {
      this.spread = Number(localStorage.getItem('3am-book-page')) || 0;
    } catch {}
    this.el = document.createElement('div');
    this.el.id = 'book';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="bk-book">
      <div class="bk-page bk-left"></div><div class="bk-spine"></div><div class="bk-page bk-right"></div>
    </div><div class="bk-hint">← → turn · E close</div>`;
    document.getElementById('ui').appendChild(this.el);
    this.left = this.el.querySelector('.bk-left');
    this.right = this.el.querySelector('.bk-right');
    this.left.addEventListener('click', (e) => (e.stopPropagation(), this.turn(-1)));
    this.right.addEventListener('click', (e) => (e.stopPropagation(), this.turn(1)));
    this.el.addEventListener('click', () => game.closeUI());
    this.el.addEventListener('wheel', (e) => e.stopPropagation());
  }

  get spreads() {
    return Math.ceil(BOOK.pages.length / 2);
  }

  show() {
    this.visible = true;
    this.el.classList.remove('hidden');
    this.#render();
    this.game.audio.oneShot('door', { volume: 0.15, rate: 2.4 });
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  turn(d) {
    const s = Math.max(0, Math.min(this.spreads - 1, this.spread + d));
    if (s === this.spread) return;
    this.spread = s;
    try {
      localStorage.setItem('3am-book-page', String(s));
    } catch {}
    this.game.audio.oneShot('door', { volume: 0.12, rate: 2.8 + Math.random() * 0.4 });
    this.#render();
  }

  update() {
    if (!this.visible) return;
    const i = this.game.input;
    if (i.pressed('ArrowRight') || i.pressed('KeyD')) this.turn(1);
    if (i.pressed('ArrowLeft') || i.pressed('KeyA')) this.turn(-1);
  }

  #render() {
    const a = this.spread * 2;
    const foot = (n) => (n > 1 && n <= BOOK.pages.length - 1 ? `<div class="bk-foot">${n}</div>` : '');
    this.left.innerHTML = `<div class="bk-body">${BOOK.pages[a] ?? ''}</div>${foot(a + 1)}`;
    this.right.innerHTML = `<div class="bk-body">${BOOK.pages[a + 1] ?? ''}</div>${foot(a + 2)}`;
    this.left.scrollTop = this.right.scrollTop = 0;
  }
}
