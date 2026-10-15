/**
 * TouchControls
 * -------------
 * Phones / tablets. Everything feeds the same InputManager the keyboard and
 * mouse use (keys, mouse buttons, mouse delta), so no system needs to know
 * it's on a touch screen.
 *
 *   left half    floating joystick → W/A/S/D (push to the rim = sprint);
 *                also throttle / steering when driving
 *   right half   drag to look; a quick tap = left click (interact, laptop
 *                cursor clicks, cast…)
 *   buttons      only the ones that matter right now: USE (E), the Q action,
 *                FIRE / DRAG (hold LMB), AIM (hold RMB), R, G, JUMP / BRAKE
 *   top bar      bag (I) · map (M) · lights (F/L) · radio (Q) · menu
 *
 * Pointer lock doesn't exist on touch: input.locked is simply true while
 * playing.
 */
export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);
}

const LOOK_SENS = 2.4;

export class TouchControls {
  constructor(game) {
    this.game = game;
    const input = (this.input = game.input);
    document.body.classList.add('touch');

    // Pointer lock stand-in.
    input.touch = true;
    input.requestLock = () => {
      if (input.locked) return;
      input.locked = true;
      input.onLockChange?.(true);
    };
    input.exitLock = () => {
      input.locked = false;
    };

    this.root = el('div', 'touch-ui hidden');
    document.getElementById('ui').appendChild(this.root);

    // ---- zones -------------------------------------------------------------
    this.stickZone = el('div', 'touch-zone left', this.root);
    this.lookZone = el('div', 'touch-zone right', this.root);
    this.stickBase = el('div', 'stick-base hidden', this.root);
    this.stickKnob = el('div', 'stick-knob', this.stickBase);
    this.stick = null; // { id, x0, y0 }
    this.look = null; // { id, x, y, t0, moved }

    this.stickZone.addEventListener('touchstart', (e) => this.#stickStart(e), { passive: false });
    this.lookZone.addEventListener('touchstart', (e) => this.#lookStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.#move(e), { passive: false });
    window.addEventListener('touchend', (e) => this.#end(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.#end(e), { passive: false });

    // ---- action buttons (bottom right) -------------------------------------
    const pad = el('div', 'touch-pad', this.root);
    this.btn = {
      use: this.#button(pad, 'USE', { key: 'KeyE' }),
      q: this.#button(pad, 'Q', { key: 'KeyQ' }),
      fire: this.#button(pad, 'FIRE', { mouse: 0 }),
      aim: this.#button(pad, 'AIM', { mouse: 2 }),
      r: this.#button(pad, 'R', { key: 'KeyR' }),
      g: this.#button(pad, 'TOSS', { key: 'KeyG' }),
      jump: this.#button(pad, 'JUMP', { key: 'Space' }),
    };
    // ---- top bar -------------------------------------------------------------
    const bar = el('div', 'touch-bar', this.root);
    this.top = {
      bag: this.#button(bar, 'BAG', { key: 'KeyI' }),
      map: this.#button(bar, 'MAP', { key: 'KeyM' }),
      walkman: this.#button(bar, '♪', { key: 'KeyP' }),
      journal: this.#button(bar, 'JOURNAL', { key: 'KeyJ' }),
      lights: this.#button(bar, 'LIGHTS', { key: 'KeyF' }),
      flash: this.#button(bar, 'TORCH', { key: 'KeyL' }),
      radio: this.#button(bar, 'RADIO', { key: 'KeyQ' }),
      next: this.#button(bar, '⏭', { key: 'KeyN' }),
      mic: this.#button(bar, 'MIC', { key: 'KeyV' }),
      wave: this.#button(bar, 'WAVE', { key: 'Digit1' }),
      menu: this.#button(bar, '☰', {
        tap: () => {
          if (game.uiOpen) game.closeUI();
          else if (game.map.visible) game.map.toggle();
          else if (game.focus) game.exitFocus();
          else game.pause();
        },
      }),
    };

    // Phones held upright: ask for landscape.
    this.rotate = el('div', 'rotate-hint', document.getElementById('ui'));
    this.rotate.textContent = 'turn your phone sideways';

    document.getElementById('start-hint').textContent = 'tap to start';
    const sens = document.getElementById('set-sens')?.closest('label');
    if (sens?.firstChild) sens.firstChild.textContent = 'look sensitivity ';
  }

  #button(parent, label, { key, mouse, tap }) {
    const b = el('button', 'tbtn', parent);
    b.textContent = label;
    const input = this.input;
    b.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('on');
        if (tap) return tap();
        if (key) {
          input.keys.add(key);
          input.keysPressed.add(key);
        }
        if (mouse !== undefined) {
          input.buttons.add(mouse);
          input.buttonsPressed.add(mouse);
        }
      },
      { passive: false },
    );
    const up = (e) => {
      e.preventDefault();
      b.classList.remove('on');
      if (key) input.keys.delete(key);
      if (mouse !== undefined) {
        input.buttons.delete(mouse);
        input.buttonsReleased.add(mouse);
      }
    };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    return b;
  }

  // ---- joystick ------------------------------------------------------------------

  #stickStart(e) {
    e.preventDefault();
    if (this.stick) return;
    const t = e.changedTouches[0];
    this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY };
    this.stickBase.style.left = `${t.clientX}px`;
    this.stickBase.style.top = `${t.clientY}px`;
    this.stickBase.classList.remove('hidden');
    this.#setStick(0, 0);
  }

  #setStick(dx, dy) {
    const R = 56;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    this.stickKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const nx = (dx * k) / R;
    const ny = (dy * k) / R;
    const keys = this.input.keys;
    const set = (code, on) => (on ? keys.add(code) : keys.delete(code));
    const th = 0.3;
    set('KeyW', ny < -th);
    set('KeyS', ny > th);
    set('KeyA', nx < -th);
    set('KeyD', nx > th);
    // Pushed all the way (on foot) = run.
    set('ShiftLeft', !this.game.vehicle.active && len > R * 1.25);
  }

  // ---- look / tap --------------------------------------------------------------------

  #lookStart(e) {
    e.preventDefault();
    if (this.look) return;
    const t = e.changedTouches[0];
    this.look = { id: t.identifier, x: t.clientX, y: t.clientY, t0: performance.now(), moved: 0 };
  }

  #move(e) {
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        e.preventDefault();
        this.#setStick(t.clientX - this.stick.x0, t.clientY - this.stick.y0);
      } else if (this.look && t.identifier === this.look.id) {
        e.preventDefault();
        const dx = t.clientX - this.look.x;
        const dy = t.clientY - this.look.y;
        this.look.x = t.clientX;
        this.look.y = t.clientY;
        this.look.moved += Math.abs(dx) + Math.abs(dy);
        this.input.mouseDX += dx * LOOK_SENS;
        this.input.mouseDY += dy * LOOK_SENS;
      }
    }
  }

  #end(e) {
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        this.stick = null;
        this.stickBase.classList.add('hidden');
        this.#setStick(0, 0);
        this.input.keys.delete('ShiftLeft');
      } else if (this.look && t.identifier === this.look.id) {
        // Short, still touch = a click.
        if (performance.now() - this.look.t0 < 250 && this.look.moved < 12) {
          const input = this.input;
          input.buttonsPressed.add(0);
          input.buttons.add(0);
          setTimeout(() => {
            input.buttons.delete(0);
            input.buttonsReleased.add(0);
          }, 60);
        }
        this.look = null;
      }
    }
  }

  // ---- per frame: show only what's useful ------------------------------------------------

  update() {
    const g = this.game;
    const playing = g.state === 'playing';
    this.root.classList.toggle('hidden', !playing);
    if (!playing) return;
    const v = g.vehicle.active;
    const prompt = document.getElementById('prompt');
    const promptText = prompt.classList.contains('hidden') ? '' : prompt.textContent;
    const smoking = g.viewModel.smoking;
    const gun = g.hunting.equipped;
    const fishing = g.fishing.active;
    const seated = g.player.seated;
    const ui = g.uiOpen || g.map.visible;
    const sand = !!g.interaction.focus?.target?.userData?.sandbox && !gun && !smoking;

    // Menus need taps: get the look/stick layers out of the way.
    this.stickZone.classList.toggle('hidden', g.uiOpen);
    this.lookZone.classList.toggle('hidden', g.uiOpen);
    const show = (b, on, label) => {
      b.classList.toggle('hidden', !on);
      if (label && b.textContent !== label) b.textContent = label;
    };
    const useLabel = v || g.mp?.ride ? 'EXIT' : g.focus ? 'BACK' : seated && !promptText ? 'STAND' : 'USE';
    show(this.btn.use, !ui && (!!promptText || !!v || seated || !!g.focus || fishing), fishing ? 'STOP' : useLabel);
    const qm = promptText.match(/\[Q\] (.+)$/);
    show(this.btn.q, !ui && !v && !!qm, qm ? qm[1].slice(0, 14) : 'Q');
    show(this.btn.fire, !ui && !v && (gun || smoking || fishing || sand), gun ? 'FIRE' : smoking ? 'DRAG' : sand ? 'DRAW' : 'CAST/REEL');
    show(this.btn.aim, !ui && !v && gun);
    show(this.btn.r, !ui && !v && (gun || smoking || sand), gun ? 'RELOAD' : sand ? 'RAKE' : 'ASH');
    show(this.btn.g, !ui && !v && smoking);
    show(this.btn.jump, !ui && !g.focus && !seated && (!v || v.kind === 'ground'), v ? 'BRAKE' : 'JUMP');

    show(this.top.bag, !g.focus && !fishing && !g.shopUI.visible && !g.map.visible);
    show(this.top.map, !g.focus && !g.uiOpen);
    show(this.top.walkman, !g.focus && !fishing && (!g.uiOpen || g.walkman.visible));
    show(this.top.journal, !g.focus && !fishing && (!g.uiOpen || g.journal.visible));
    show(this.top.lights, !!v && v.kind === 'ground');
    show(this.top.flash, !v && g.inventory.equipped === 'flashlight');
    show(this.top.radio, !!v?.radioToggle);
    show(this.top.next, !!v?.radioToggle);
    show(this.top.mic, !!g.mp?.online, g.mp?.voice.muted ? 'MIC ✕' : 'MIC');
    show(this.top.wave, !!g.mp?.online && !v && !ui);
    show(this.top.menu, true, ui || g.focus ? '✕' : '☰');
  }
}

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}
