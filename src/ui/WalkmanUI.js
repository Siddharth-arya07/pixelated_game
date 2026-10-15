/**
 * WalkmanUI
 * ---------
 * P opens your Walkman: a cassette window with turning reels, the mixtape
 * track list, transport buttons, volume, a TAPE toggle (the retro cassette
 * sound), and "load songs" — pick audio files from your device (or drop them
 * on the player). They stay in this browser (IndexedDB); nothing is uploaded.
 *
 * Playing from the Walkman routes the music to your headphones, so it
 * follows you everywhere. The laptop / stereo / radios still work as
 * speakers.
 */
export class WalkmanUI {
  constructor(game) {
    this.game = game;
    this.music = game.music;
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = 'walkman';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="wm-body">
        <div class="wm-top">
          <span class="wm-brand">NIGHTWALK<small> stereo cassette player</small></span>
          <button class="wm-close" data-act="close">✕</button>
        </div>
        <div class="wm-window"><canvas width="360" height="120"></canvas></div>
        <div class="wm-now"><div class="wm-title"></div><div class="wm-artist"></div></div>
        <div class="wm-progress"><i></i></div>
        <div class="wm-controls">
          <button data-act="prev">◀◀</button>
          <button data-act="play" class="wm-play">▶</button>
          <button data-act="next">▶▶</button>
          <label class="wm-vol">VOL <input type="range" min="0" max="1" step="0.05" /></label>
          <button data-act="tape" class="wm-tape">TAPE</button>
        </div>
        <div class="wm-list"></div>
        <div class="wm-foot">
          <button data-act="load" class="wm-load">+ load songs</button>
          <span class="wm-note">your files stay on this device</span>
          <input type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" multiple hidden />
        </div>
      </div>`;
    document.getElementById('ui').appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.list = this.el.querySelector('.wm-list');
    this.file = this.el.querySelector('input[type=file]');
    this.vol = this.el.querySelector('.wm-vol input');
    this.reel = 0;

    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      this.#act(act, e.target.closest('[data-i]')?.dataset.i);
    });
    this.vol.addEventListener('input', () => (this.music.volume = Number(this.vol.value)));
    this.file.addEventListener('change', async () => {
      const n = await this.music.addFiles([...this.file.files]);
      this.file.value = '';
      this.game.hud.toast(n ? `Loaded ${n} song${n > 1 ? 's' : ''} onto the tape.` : 'No audio files in that selection.');
    });
    // Drop files straight onto the player.
    this.el.addEventListener('dragover', (e) => e.preventDefault());
    this.el.addEventListener('drop', async (e) => {
      e.preventDefault();
      const n = await this.music.addFiles([...(e.dataTransfer?.files ?? [])]);
      if (n) this.game.hud.toast(`Loaded ${n} song${n > 1 ? 's' : ''}.`);
    });
    const prev = this.music.onChange;
    this.music.onChange = () => {
      prev?.();
      if (this.visible) this.render();
    };
  }

  #act(act, i) {
    const m = this.music;
    const g = this.game;
    g.audio.oneShot('click');
    switch (act) {
      case 'close':
        return g.closeUI();
      case 'play':
        m.useHeadphones();
        return m.toggle();
      case 'next':
        m.useHeadphones();
        return m.next();
      case 'prev':
        m.useHeadphones();
        return m.prev();
      case 'tape':
        return m.setTape(!m.tape);
      case 'load':
        return this.file.click();
      case 'track': {
        const t = m.tracks[Number(i)];
        if (t.kind === 'file' && !t.blob && !t.url) return this.file.click();
        m.useHeadphones();
        return m.play(Number(i));
      }
      case 'remove':
        return m.removeFile(m.tracks[Number(i)]);
    }
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.el.classList.remove('hidden');
    this.vol.value = this.music.volume;
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  render() {
    const m = this.music;
    const t = m.current;
    this.el.querySelector('.wm-title').textContent = t?.title ?? '—';
    this.el.querySelector('.wm-artist').textContent = t?.artist ?? '';
    this.el.querySelector('.wm-play').textContent = m.playing ? '❚❚' : '▶';
    this.el.querySelector('.wm-tape').classList.toggle('on', m.tape);
    const rows = m.tracks.map((tr, k) => {
      const ready = tr.kind === 'gen' || tr.blob || tr.url;
      const cls = `wm-row${k === m.index ? ' cur' : ''}${ready ? '' : ' empty'}`;
      const side = tr.mixtape ? 'A' : tr.kind === 'gen' ? 'B' : 'A+';
      const tail = ready ? (tr.fileName ? `<button class="wm-x" data-act="remove" data-i="${k}" title="remove file">✕</button>` : '') : '<em>load file</em>';
      return `<div class="${cls}" data-act="track" data-i="${k}"><b>${side}${String(k + 1).padStart(2, '0')}</b><span>${esc(tr.title)}<small>${esc(tr.artist)}</small></span>${tail}</div>`;
    });
    this.list.innerHTML = rows.join('');
  }

  /** Called every frame while open: reels + progress bar. */
  update(dt) {
    if (!this.visible) return;
    const m = this.music;
    if (m.playing) this.reel += dt * 2.4;
    const dur = m.duration || 1;
    const k = Math.min(1, m.position / dur);
    this.el.querySelector('.wm-progress i').style.width = `${(k * 100).toFixed(1)}%`;
    drawCassette(this.canvas, this.reel, k, m.current, m.playing);
  }
}

function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** The cassette seen through the window: label, two reels, tape wound by progress. */
function drawCassette(c, rot, k, track, playing) {
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.fillStyle = '#16141a';
  ctx.fillRect(0, 0, W, H);
  // shell
  ctx.fillStyle = '#2a2830';
  roundRect(ctx, 14, 8, W - 28, H - 16, 10);
  ctx.fill();
  // label
  ctx.fillStyle = '#e8dcc0';
  roundRect(ctx, 30, 14, W - 60, 34, 4);
  ctx.fill();
  ctx.fillStyle = '#c04a3a';
  ctx.fillRect(30, 40, W - 60, 4);
  ctx.fillStyle = '#2a2040';
  ctx.font = '20px Caveat, cursive';
  ctx.textAlign = 'left';
  ctx.fillText('3 a.m. mix — side A', 40, 36);
  // window
  ctx.fillStyle = '#0c0b0e';
  roundRect(ctx, 80, 54, W - 160, 50, 6);
  ctx.fill();
  const reel = (x, wound) => {
    const r = 10 + wound * 14;
    ctx.fillStyle = '#4a3226';
    ctx.beginPath();
    ctx.arc(x, 79, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d0c0';
    ctx.beginPath();
    ctx.arc(x, 79, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2830';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = rot * (1.4 - wound) + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 3, 79 + Math.sin(a) * 3);
      ctx.lineTo(x + Math.cos(a) * 8, 79 + Math.sin(a) * 8);
      ctx.stroke();
    }
  };
  reel(130, 1 - k);
  reel(W - 130, k);
  // little red "playing" lamp
  ctx.fillStyle = playing ? '#ff4a3a' : '#3a1a18';
  ctx.beginPath();
  ctx.arc(W - 40, 70, 4, 0, Math.PI * 2);
  ctx.fill();
  void track;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
