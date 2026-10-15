import { ITEMS } from '../systems/InventorySystem.js';

/**
 * ShopUI
 * ------
 * Renders a catalogue from ShoppingSystem: rows with price + Buy button,
 * and (at the register) a "sell your catch" section.
 */
const $ = (id) => document.getElementById(id);

export class ShopUI {
  constructor(game) {
    this.game = game;
    this.el = $('shop');
    this.title = $('shop-name');
    this.moneyEl = $('shop-money');
    this.list = $('shop-list');
    this.msg = $('shop-msg');
    this.visible = false;
    this.catalog = null;
    this.shop = null;
    game.inventory.onChange(() => this.visible && this.render());
  }

  show(catalog, shop) {
    this.catalog = catalog;
    this.shop = shop;
    this.visible = true;
    this.msg.textContent = '';
    this.el.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  render() {
    const inv = this.game.inventory;
    this.title.textContent = this.catalog.name;
    this.moneyEl.textContent = `Wallet: $${inv.money.toFixed(2)}`;
    this.list.innerHTML = '';

    for (const entry of this.catalog.stock) {
      const def = ITEMS[entry.id];
      const ok = this.shop.canBuy(entry);
      this.#row(def.name, def.desc, `$${entry.price.toFixed(2)}`, ok === true ? 'Buy' : ok, ok !== true, () => {
        this.msg.textContent = this.shop.buy(entry);
      });
    }

    if (this.catalog.buysCatch) {
      const sellable = this.shop.sellable();
      const head = document.createElement('div');
      head.className = 'shop-section';
      head.textContent = sellable.length ? 'SELL YOUR CATCH' : 'BRING FISH — THE CLERK BUYS THEM';
      this.list.appendChild(head);
      for (const it of sellable) {
        this.#row(`${it.name} x${it.count}`, 'Clerk shrugs.', `+$${it.value.toFixed(2)}`, 'Sell', false, () => {
          this.msg.textContent = this.shop.sell(it.id);
        });
      }
    }
  }

  #row(name, desc, price, label, disabled, onClick) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<div>${name}<div class="desc">${desc}</div></div><div class="price">${price}</div>`;
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    row.appendChild(b);
    this.list.appendChild(row);
  }
}
