/**
 * HUD
 * ---
 * Crosshair, interaction prompt, the big serif "3:00 a.m." clock, money,
 * equipped item, speedometer, toasts, and context-sensitive control hints.
 */
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.root = $('hud');
    this.prompt = $('prompt');
    this.clock = $('clock');
    this.location = $('location');
    this.money = $('money');
    this.equipped = $('equipped');
    this.speedo = $('speedo');
    this.toasts = $('toasts');
    this.hint = $('controls-hint');
    this.ammo = $('ammo');
    this._prompt = null;
    this._clock = '';
  }

  show() {
    this.root.classList.remove('hidden');
  }

  setPrompt(text, disabled = false) {
    const key = text ? `${text}|${disabled}` : null;
    if (key === this._prompt) return;
    this._prompt = key;
    this.prompt.classList.toggle('hidden', !text);
    this.prompt.classList.toggle('disabled', disabled);
    if (text) this.prompt.textContent = text;
  }

  setClock(label) {
    if (label !== this._clock) this.clock.textContent = this._clock = label;
  }

  setLocation(name) {
    this.location.textContent = name;
  }

  setMoney(amount) {
    this.money.textContent = `$${amount.toFixed(2)}`;
  }

  setEquipped(name) {
    this.equipped.textContent = name ? `holding: ${name}` : '';
  }

  /** mph readout while driving; null hides it. */
  setSpeed(ms, gear) {
    if (ms == null) return this.speedo.classList.add('hidden');
    this.speedo.classList.remove('hidden');
    this.speedo.innerHTML = `${Math.round(Math.abs(ms) * 2.237)} <small>MPH ${gear}</small>`;
  }

  /** Hide the big clock/location while leaning into a screen. */
  setFocused(on) {
    this.clock.classList.toggle('hidden', on);
    this.location.classList.toggle('hidden', on);
  }

  /** Shotgun ammo: loaded | reserve. null hides it. */
  setAmmo(mag, reserve, reloading, nearest = null) {
    if (mag === null) {
      if (!this.ammo.classList.contains('hidden')) this.ammo.classList.add('hidden');
      return;
    }
    this.ammo.classList.remove('hidden');
    const t = `${'▮'.repeat(mag)}${'▯'.repeat(Math.max(0, 5 - mag))}  ${reserve}${reloading ? '  reloading…' : ''}${nearest ? `   deer ~${Math.round(nearest.d / 5) * 5} m ${nearest.dir}` : ''}`;
    if (this.ammo.textContent !== t) this.ammo.textContent = t;
  }

  setHint(text) {
    if (this.hint.textContent !== text) this.hint.textContent = text;
  }

  toast(text, ms = 2800) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }
}
