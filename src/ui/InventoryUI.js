/**
 * InventoryUI
 * -----------
 * HTML overlay toggled with I. Grid of item stacks; click one to see its
 * description and Use / Equip / Drop buttons.
 */
const $ = (id) => document.getElementById(id);

export class InventoryUI {
  constructor(game) {
    this.game = game;
    this.el = $('inventory');
    this.list = $('inventory-list');
    this.detail = $('inventory-detail');
    this.selected = null;
    this.visible = false;
    game.inventory.onChange(() => this.visible && this.render());
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  render() {
    const inv = this.game.inventory;
    const items = inv.list();
    if (this.selected && !inv.has(this.selected)) this.selected = null;

    this.list.innerHTML = '';
    if (!items.length) {
      this.list.innerHTML = '<div class="empty">Pockets are empty. Lint.</div>';
    }
    for (const it of items) {
      const el = document.createElement('div');
      el.className = 'item';
      if (it.id === this.selected) el.classList.add('selected');
      if (it.id === inv.equipped) el.classList.add('equipped');
      el.innerHTML = `<div class="swatch" style="background:${it.color}"></div><div>${it.name}</div><div class="count">x${it.count}</div>`;
      el.addEventListener('click', () => {
        this.selected = it.id;
        this.render();
      });
      this.list.appendChild(el);
    }
    this.#renderDetail();
  }

  #renderDetail() {
    const inv = this.game.inventory;
    const id = this.selected;
    if (!id) {
      this.detail.innerHTML = `<span class="empty">Cash: $${inv.money.toFixed(2)} &middot; select an item</span>`;
      return;
    }
    const def = inv.def(id);
    this.detail.innerHTML = `<div><b>${def.name}</b> — ${def.desc}</div><div class="actions"></div>`;
    const actions = this.detail.querySelector('.actions');
    const btn = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    };
    // Using closes the menu so you can watch the animation.
    if (def.use) btn('Use', () => inv.use(id) && this.game.closeUI());
    if (def.equip) btn(inv.equipped === id ? 'Unequip' : 'Equip', () => inv.equip(id));
    btn('Drop', () => {
      inv.remove(id);
      this.game.hud.toast(`Dropped ${def.name}.`);
    });
  }
}
