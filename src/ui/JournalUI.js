/**
 * JournalUI
 * ---------
 * J opens your journal: a two-page notebook. Left page lists your entries
 * (newest first); the right page is the open entry — a title line and lined
 * paper to write on. Every entry is stamped with the night, the in-game time
 * and the real date. Autosaves as you type (localStorage, this device only).
 */
const KEY = '3am-journal';

export class JournalUI {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.entries = load();
    this.openId = this.entries[0]?.id ?? null;
    this.el = document.createElement('div');
    this.el.id = 'journal';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="jr-book">
        <div class="jr-left">
          <div class="jr-head">journal<button class="jr-new" data-act="new">+ new page</button></div>
          <div class="jr-list"></div>
        </div>
        <div class="jr-right">
          <div class="jr-stamp"></div>
          <input class="jr-title" placeholder="untitled" maxlength="80" />
          <textarea class="jr-text" placeholder="what's on your mind at this hour…"></textarea>
          <div class="jr-foot">
            <span class="jr-count"></span>
            <span class="jr-saved"></span>
            <button class="jr-del" data-act="delete">tear out page</button>
            <button class="jr-close" data-act="close">close</button>
          </div>
        </div>
      </div>`;
    document.getElementById('ui').appendChild(this.el);
    this.list = this.el.querySelector('.jr-list');
    this.title = this.el.querySelector('.jr-title');
    this.text = this.el.querySelector('.jr-text');
    this.stamp = this.el.querySelector('.jr-stamp');
    this.count = this.el.querySelector('.jr-count');
    this.saved = this.el.querySelector('.jr-saved');

    this.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'new') this.#new();
      else if (act === 'close') game.closeUI();
      else if (act === 'delete') this.#delete();
      else if (act === 'open') {
        this.openId = t.dataset.id;
        this.render();
      }
    });
    const onEdit = () => {
      const e = this.#current();
      if (!e) return;
      e.title = this.title.value;
      e.text = this.text.value;
      e.edited = Date.now();
      this.saved.textContent = 'saving…';
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        save(this.entries);
        this.saved.textContent = 'saved';
        this.#renderList();
      }, 400);
      this.#renderCount();
    };
    this.title.addEventListener('input', onEdit);
    this.text.addEventListener('input', onEdit);
    // Keep typing from reaching the game (Esc still closes).
    for (const f of [this.title, this.text]) {
      f.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          f.blur();
          game.closeUI();
        }
        e.stopPropagation();
      });
    }
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.el.classList.remove('hidden');
    if (!this.entries.length) this.#new();
    this.render();
    setTimeout(() => this.text.focus(), 30);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.add('hidden');
    // Drop untouched blank pages.
    this.entries = this.entries.filter((e) => e.text.trim() || e.title.trim());
    save(this.entries);
    this.text.blur();
    this.title.blur();
  }

  #current() {
    return this.entries.find((e) => e.id === this.openId) ?? null;
  }

  #new() {
    const g = this.game;
    const e = {
      id: String(Date.now()),
      night: g.dayNight.day,
      clock: g.dayNight.label,
      place: g.scene?.label ?? '',
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      title: '',
      text: '',
      edited: Date.now(),
    };
    this.entries.unshift(e);
    this.openId = e.id;
    this.render();
    this.text.focus();
  }

  #delete() {
    const e = this.#current();
    if (!e) return;
    if ((e.text.trim() || e.title.trim()) && !confirm('Tear this page out? It will be gone for good.')) return;
    this.entries = this.entries.filter((x) => x !== e);
    save(this.entries);
    this.openId = this.entries[0]?.id ?? null;
    if (!this.openId) this.#new();
    this.render();
  }

  render() {
    this.#renderList();
    const e = this.#current();
    this.title.value = e?.title ?? '';
    this.text.value = e?.text ?? '';
    this.stamp.textContent = e ? `night ${e.night} · ${e.clock}${e.place ? ` · ${e.place}` : ''} · ${e.date}` : '';
    this.saved.textContent = '';
    this.#renderCount();
  }

  #renderList() {
    this.list.innerHTML = this.entries
      .map((e) => {
        const name = e.title.trim() || e.text.trim().split('\n')[0].slice(0, 40) || 'blank page';
        return `<div class="jr-item${e.id === this.openId ? ' cur' : ''}" data-act="open" data-id="${e.id}"><span>${esc(name)}</span><small>night ${e.night} · ${esc(e.clock)}</small></div>`;
      })
      .join('');
  }

  #renderCount() {
    const n = this.text.value.trim() ? this.text.value.trim().split(/\s+/).length : 0;
    this.count.textContent = `${n} word${n === 1 ? '' : 's'}`;
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}
}

function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
