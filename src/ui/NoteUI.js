/**
 * NoteUI
 * ------
 * A handwritten note, read up close: a folded sheet of lined paper on a
 * dark backdrop. E / Esc / click closes it.
 */
export class NoteUI {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = 'note';
    this.el.className = 'hidden';
    this.el.innerHTML = '<div class="note-paper"><div class="note-text"></div><div class="note-hint">click or E to put it down</div></div>';
    document.getElementById('ui').appendChild(this.el);
    this.text = this.el.querySelector('.note-text');
    this.el.addEventListener('click', () => game.closeUI());
  }

  show(text) {
    this.text.textContent = text;
    this.visible = true;
    this.el.classList.remove('hidden');
    this.game.audio.oneShot('door', { volume: 0.15, rate: 2.4 }); // paper rustle
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }
}
