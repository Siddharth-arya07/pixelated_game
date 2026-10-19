/**
 * TextPrompt — a small "type something" card (notes, texts, banners).
 *   const text = await game.prompt.ask('Leave a note', 'was here…', 120)
 * Resolves to the trimmed text, or null if cancelled (Esc / empty).
 */
export class TextPrompt {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = 'textprompt';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="pn-card"><div class="pn-t"></div><input><button>OK</button></div>`;
    document.getElementById('ui').appendChild(this.el);
    this.title = this.el.querySelector('.pn-t');
    this.input = this.el.querySelector('input');
    this.el.querySelector('button').addEventListener('click', () => this.#done(true));
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.#done(true);
      if (e.key === 'Escape') this.#done(false);
    });
  }

  ask(title, placeholder = '', max = 120, value = '') {
    this.title.textContent = title;
    this.input.placeholder = placeholder;
    this.input.maxLength = max;
    this.input.value = value;
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.game.openUI(() => {
        this.visible = true;
        this.el.classList.remove('hidden');
      });
      setTimeout(() => this.input.focus(), 50);
    });
  }

  hide() {
    if (this.visible) this.#done(false);
  }

  #done(ok) {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.add('hidden');
    const v = ok ? this.input.value.trim() : '';
    const r = this.resolve;
    this.resolve = null;
    this.game.closeUI();
    r?.(v || null);
  }
}
