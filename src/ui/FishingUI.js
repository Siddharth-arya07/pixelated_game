/**
 * FishingUI
 * ---------
 * Status line, cast power bar and the tension meter + distance readout.
 */
const $ = (id) => document.getElementById(id);

export class FishingUI {
  constructor() {
    this.el = $('fishing');
    this.status = $('fishing-status');
    this.powerWrap = $('power-wrap');
    this.powerFill = $('power-fill');
    this.tensionWrap = $('tension-wrap');
    this.tensionFill = $('tension-fill');
    this.distance = $('fish-distance');
  }

  show() {
    this.el.classList.remove('hidden');
    this.showTension(false);
    this.setPower(0);
  }

  hide() {
    this.el.classList.add('hidden');
  }

  setStatus(text, alert = false) {
    this.status.textContent = text;
    this.status.classList.toggle('alert', alert);
  }

  setPower(p) {
    this.powerFill.style.width = `${Math.round(p * 100)}%`;
  }

  showTension(on) {
    this.tensionWrap.classList.toggle('hidden', !on);
    this.powerWrap.classList.toggle('hidden', on);
  }

  setTension(t, dist) {
    const pct = Math.min(1, t) * 100;
    this.tensionFill.style.width = `${pct}%`;
    // green → yellow → red
    this.tensionFill.style.background = t > 0.8 ? 'var(--danger)' : t > 0.55 ? 'var(--accent)' : 'var(--good)';
    this.distance.textContent = `${Math.max(0, dist).toFixed(1)}m`;
  }
}
