/**
 * HungerSystem
 * ------------
 * You have to eat. `hunger` is a fullness meter, 100 = stuffed, 0 = empty.
 *
 *  - drains over ~15 real minutes, faster while sprinting, slower seated
 *  - < 35: stomach growls (warning toast)
 *  - < 15: you're weak: slower walking, the world swims a little
 *  -   0: starving. A 90 s countdown; eat something or you pass out
 *  - pass out: you wake up at home the next night, 3:00 a.m., minus a
 *    quarter of your cash and anything you were carrying that could spoil
 *
 * Food values live on the item defs (InventorySystem ITEMS[id].food).
 */
const DRAIN = 100 / (15 * 60); // per second
const STARVE_TIME = 90;

export class HungerSystem {
  constructor(game) {
    this.game = game;
    this.hunger = 80;
    this.starve = STARVE_TIME;
    this.warned = 0; // 0 none, 1 growl, 2 weak
    this.dead = false;
    this.el = document.getElementById('hunger');
    this.bar = this.el?.querySelector('i');
  }

  get weak() {
    return this.hunger < 15;
  }

  eat(amount, id) {
    if (!amount) return;
    this.hunger = Math.min(100, this.hunger + amount);
    this.starve = STARVE_TIME;
    if (this.hunger > 40) this.warned = 0;
    else if (this.hunger > 18) this.warned = Math.min(this.warned, 1);
    const g = this.game;
    if (id && this.hunger >= 95) g.hud.toast('Stuffed.');
  }

  update(dt) {
    const g = this.game;
    if (this.dead || g.state !== 'playing') return;
    const p = g.player;
    const sprint = !p.seated && !g.vehicle.active && (g.input.down('ShiftLeft') || g.input.down('ShiftRight'));
    const munchies = 1 + (g.inventory.high ?? 0) * 1.2; // the munchies are real
    const k = (p.seated || g.focus ? 0.6 : sprint ? 1.7 : 1) * munchies;
    this.hunger = Math.max(0, this.hunger - DRAIN * k * dt);

    if (this.hunger < 35 && this.warned < 1) {
      this.warned = 1;
      g.hud.toast('Your stomach growls. Eat something.', 3500);
      g.audio.oneShot('growl', { volume: 0.7 });
    }
    if (this.hunger < 15 && this.warned < 2) {
      this.warned = 2;
      g.hud.toast("You feel weak. You need food. Now.", 4000);
      g.audio.oneShot('growl', { volume: 1 });
    }
    if (this.hunger <= 0) {
      this.starve -= dt;
      if (Math.floor(this.starve) % 15 === 0 && Math.floor(this.starve + dt) !== Math.floor(this.starve)) {
        g.hud.toast(`STARVING. Eat or you'll pass out (${Math.ceil(this.starve)}s)`, 3000);
      }
      if (this.starve <= 0) this.knockOut();
    }
    this.#render();
  }

  /** Extra screen swim layered onto the drunk effect while weak. */
  get wobble() {
    if (this.hunger >= 15) return 0;
    return 0.12 + (this.hunger <= 0 ? 0.25 * (1 - this.starve / STARVE_TIME) : 0);
  }

  #render() {
    if (!this.bar) return;
    const pct = Math.round(this.hunger);
    if (pct !== this._shown) {
      this._shown = pct;
      this.bar.style.width = `${pct}%`;
      this.el.classList.toggle('low', pct < 35);
    }
    this.el.classList.toggle('starving', this.hunger <= 0 && Math.floor(this.game.time * 3) % 2 === 0);
  }

  /**
   * You go down (starving, hit by a train…): black screen, lose a quarter of
   * your cash and anything perishable, wake up at home at the next 3 a.m.
   */
  async knockOut(title = 'You passed out from hunger.', wake = 'You wake up on the kitchen floor. The fridge hums. Eat something.', sound = 'growl') {
    const g = this.game;
    if (this.dead) return;
    this.dead = true;
    if (g.vehicle.active) g.vehicle.exit();
    if (g.player.seated) g.player.stand();
    if (g.uiOpen) g.closeUI();
    const screen = document.getElementById('death');
    screen.querySelector('span').textContent = title;
    screen.classList.remove('hidden');
    g.audio.oneShot(sound, { volume: 1, rate: 0.7 });

    // Lose a quarter of the cash and everything perishable.
    const inv = g.inventory;
    const lost = Math.round(inv.money * 0.25 * 100) / 100;
    if (lost > 0) inv.spend(lost);
    for (const it of inv.list()) {
      if (it.catch || it.food) inv.remove(it.id, it.count);
    }
    screen.querySelector('small').textContent = `You lost $${lost.toFixed(2)} and everything that could spoil.`;

    await new Promise((r) => setTimeout(r, 3800));
    const dn = g.dayNight;
    dn.advance(((24 * 60 + 180 - dn.minutes) % (24 * 60)) || 24 * 60); // next 3:00 a.m.
    await g.changeScene('House', 'default');
    screen.classList.add('hidden');
    this.hunger = Math.max(45, this.hunger);
    this.starve = STARVE_TIME;
    this.warned = 0;
    this.dead = false;
    g.hud.toast(wake, 5000);
  }
}
