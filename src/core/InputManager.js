/**
 * InputManager
 * ------------
 * Keyboard + mouse abstraction with per-frame edge detection.
 *
 *   input.down('KeyW')        held right now
 *   input.pressed('KeyE')     went down this frame
 *   input.mouseDown(0)        left button held
 *   input.mousePressed(0)     left button went down this frame
 *   input.mouseReleased(0)    left button went up this frame
 *   input.consumeMouseDelta() accumulated pointer-lock movement
 *   input.consume('KeyE')     swallow a press so later systems don't see it
 *
 * Call `endFrame()` once at the end of every game-loop tick.
 */
export class InputManager {
  constructor(element) {
    this.element = element;
    this.keys = new Set();
    this.keysPressed = new Set();
    this.buttons = new Set();
    this.buttonsPressed = new Set();
    this.buttonsReleased = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this._skip = 0;
    this.wheel = 0;
    this.onLockChange = null;

    // Typing in a text field (journal, laptop mail…) isn't game input.
    const typing = (e) => {
      const t = e.target;
      return t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) && e.code !== 'Escape';
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat || typing(e)) return;
      // Stop the browser scrolling / quick-find while playing.
      if (['Space', 'Tab', 'Quote', 'Slash'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.keysPressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.buttons.clear();
    });

    window.addEventListener('mousedown', (e) => {
      this.buttons.add(e.button);
      this.buttonsPressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      this.buttons.delete(e.button);
      this.buttonsReleased.add(e.button);
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => (this.wheel += e.deltaY), { passive: true });

    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Browsers (Chrome/Safari) occasionally report a huge bogus delta right
      // after locking or on fast flicks — that's the "camera snaps" glitch.
      // Skip the first couple of events after locking and drop outliers.
      if (this._skip > 0) {
        this._skip--;
        return;
      }
      if (Math.abs(e.movementX) > 180 || Math.abs(e.movementY) > 180) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      this._skip = 2;
      this.mouseDX = this.mouseDY = 0;
      this.onLockChange?.(this.locked);
    });
  }

  requestLock() {
    if (this.locked) return;
    // requestPointerLock returns a promise in modern browsers; ignore rejections
    // (e.g. when called too soon after the user pressed ESC).
    // unadjustedMovement = raw mouse input without OS acceleration (Chrome);
    // browsers that don't support it reject, so fall back to a plain lock.
    let p;
    try {
      p = this.element.requestPointerLock?.({ unadjustedMovement: true });
    } catch {
      p = this.element.requestPointerLock?.();
    }
    p?.catch?.(() => this.element.requestPointerLock?.()?.catch?.(() => {}));
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.keysPressed.has(code);
  }

  mouseDown(button = 0) {
    return this.buttons.has(button);
  }

  mousePressed(button = 0) {
    return this.buttonsPressed.has(button);
  }

  mouseReleased(button = 0) {
    return this.buttonsReleased.has(button);
  }

  /** Mark a key / mouse press as handled so later systems this frame ignore it. */
  consume(code) {
    this.keysPressed.delete(code);
  }

  consumeMouse(button = 0) {
    this.buttonsPressed.delete(button);
  }

  /** -1..1 axis from two keys. */
  axis(neg, pos) {
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  }

  /** Accumulated scroll since last call (+ = down). */
  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  consumeMouseDelta() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  endFrame() {
    this.keysPressed.clear();
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();
  }
}
