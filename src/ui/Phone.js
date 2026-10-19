/**
 * Phone — a little flip phone (O)
 * -------------------------------
 *  MESSAGES   text friends in the room (or everyone); incoming texts buzz
 *  CALLS      Ray (advice, any hour) · Dolores at the diner (pizza delivered
 *             to your doorstep, $6) · the weather line
 *  WEATHER    what it's doing, the season, temperature, wind
 *  SKY        moon phase (real), meteor showers, sunrise, balloon flights
 *  CALENDAR   today's date, holidays, and a "preview a holiday" switch
 *  PETS       who you've tamed and what they've learned
 */
const KEY_HOL = '3am-holiday-preview';

export class Phone {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.inbox = [];
    this.unread = 0;
    this.el = document.createElement('div');
    this.el.id = 'phone';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="ph-body"><div class="ph-top"><span class="ph-time"></span><span class="ph-sig">▂▄▆█</span></div><div class="ph-screen"></div><div class="ph-keys"><button data-k="back">◀ back</button><button data-k="home">●</button><button data-k="close">close ✕</button></div></div>`;
    document.getElementById('ui').appendChild(this.el);
    this.screen = this.el.querySelector('.ph-screen');
    this.el.querySelector('[data-k=back]').onclick = () => this.#home();
    this.el.querySelector('[data-k=home]').onclick = () => this.#home();
    this.el.querySelector('[data-k=close]').onclick = () => game.closeUI();
    game.mp?.on('sms', (e, id) => this.#incoming(e, id));
  }

  toggle() {
    if (this.visible) return this.game.closeUI();
    this.game.openUI(() => {
      this.visible = true;
      this.el.classList.remove('hidden');
      this.#home();
    });
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  update() {
    const g = this.game;
    if (g.input.pressed('KeyO') && !g.focus && (this.visible || !g.uiOpen)) this.toggle();
    if (this.visible) this.el.querySelector('.ph-time').textContent = g.dayNight.label;
    // the pizza's here
    if (this.pizzaAt && Date.now() > this.pizzaAt) {
      this.pizzaAt = null;
      this.#deliver();
    }
  }

  #render(title, html) {
    this.screen.innerHTML = `<div class="ph-title">${title}</div><div class="ph-content">${html}</div>`;
    this.screen.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => this[`go_${b.dataset.go}`]?.(b.dataset.arg)));
  }

  #home() {
    const apps = [
      ['messages', `✉ Messages${this.unread ? ` (${this.unread})` : ''}`],
      ['calls', '☎ Calls'],
      ['weather', '☁ Weather'],
      ['sky', '☾ Sky tonight'],
      ['calendar', '▦ Calendar'],
      ['pets', '🐾 Pets'],
    ];
    this.#render('PINE-PHONE', apps.map(([k, l]) => `<button class="ph-btn" data-go="${k}">${l}</button>`).join(''));
  }

  // ---- messages ------------------------------------------------------------------------

  go_messages() {
    this.unread = 0;
    const g = this.game;
    const friends = [...(g.mp?.remotes?.values() ?? [])];
    const list = this.inbox.slice(-8).reverse().map((m) => `<div class="ph-msg ${m.me ? 'me' : ''}"><b>${esc(m.me ? `to ${m.to}` : m.from)}</b> ${esc(m.t)}</div>`).join('') || '<div class="ph-dim">No messages yet.</div>';
    const send = g.net?.online ? [`<button class="ph-btn" data-go="text" data-arg="*">✎ Text everyone</button>`, ...friends.map((r) => `<button class="ph-btn" data-go="text" data-arg="${r.id}">✎ Text ${esc(r.name)}</button>`)].join('') : '<div class="ph-dim">Join a room to text friends.</div>';
    this.#render('MESSAGES', send + list);
  }

  async go_text(to) {
    const g = this.game;
    const name = to === '*' ? 'everyone' : g.mp.remotes.get(to)?.name ?? 'them';
    this.hide();
    const t = await g.prompt.ask(`Text ${name}:`, 'u up?', 140);
    if (t) {
      g.net.event('sms', { to, t });
      this.inbox.push({ me: true, to: name, t });
      g.hud.toast(`📱 Sent to ${name}.`, 1500);
    }
  }

  #incoming(e, id) {
    const g = this.game;
    if (e.to !== '*' && e.to !== g.net?.id) return;
    const from = g.mp.remotes.get(id)?.name ?? 'Someone';
    this.inbox.push({ from, t: e.t });
    this.unread++;
    g.hud.toast(`📱 ${from}: ${e.t}`, 5000);
    this.#buzz();
  }

  #buzz() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 1320;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.05, t + k * 0.18);
      e.gain.setValueAtTime(0, t + k * 0.18 + 0.1);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + k * 0.18);
      o.stop(t + k * 0.18 + 0.12);
    }
  }

  // ---- calls -----------------------------------------------------------------------------

  go_calls() {
    this.#render('CALLS', `<button class="ph-btn" data-go="ray">☎ Ray (lighthouse)</button><button class="ph-btn" data-go="dolores">☎ Dolores (Seaview Diner)</button><button class="ph-btn" data-go="weatherline">☎ Weather line</button>`);
  }

  go_ray() {
    const lines = [
      '“You’re up too? Course you are. Put the kettle on, it helps.”',
      '“Whatever it is, it’ll look smaller in the morning. Most things do.”',
      '“Go look at the sea for a bit. It doesn’t fix anything. It helps anyway.”',
      '“I’ve got a story with your name on it. Come by the lighthouse.”',
      '“The light’s on. That’s all you need to know tonight.”',
      '“Feed that cat if you see her. Don’t tell her I asked.”',
      '“Bonfire tonight? I might wander down. Bring marshmallows.”',
    ];
    this.#call('Ray', lines[Math.floor(Math.random() * lines.length)]);
  }

  go_dolores() {
    const g = this.game;
    if (this.pizzaAt) return this.#call('Dolores', '“It’s coming, hon, it’s coming. The boy drives like a grandma.”');
    if (!g.inventory.spend(6)) return this.#call('Dolores', '“Six bucks, hon. Call back when you’ve got it.”');
    this.pizzaAt = Date.now() + 45000;
    this.#call('Dolores', '“Pepperoni? Course. Forty-five minutes. Kidding — it’ll be on your doorstep before you know it.” ($6)');
  }

  #deliver() {
    const g = this.game;
    const W = g.scenes.World;
    if (!W?.built) return g.inventory.add('hot_pizza');
    const h = W.poi.house;
    const box = g.assets.model('pizza_box');
    const x = h.x + 1.2;
    const z = h.z + 6.2;
    const y = W.groundHeight(x, z);
    const m = box ?? new THREE_box(W);
    m.position.set(x, y, z);
    W.root.add(m);
    W.addInteractable(m, {
      prompt: 'Pizza delivery!',
      action: () => {
        g.inventory.add('hot_pizza');
        m.removeFromParent();
        W.interactables = W.interactables.filter((o) => o !== m);
        g.hud.toast('Still hot. Dolores drew a smiley face on the box.', 3000);
      },
    });
    g.hud.toast('🛵 Ding-dong. Pizza on your doorstep!', 4000);
    this.#buzz();
  }

  go_weatherline() {
    this.#call('Weather line', this.#weatherText());
  }

  #call(who, line) {
    this.#render(`CALLING ${who.toUpperCase()}…`, `<div class="ph-dim">ring… ring…</div>`);
    this.#ring();
    setTimeout(() => this.visible && this.#render(who.toUpperCase(), `<div class="ph-line">${esc(line)}</div><button class="ph-btn" data-go="calls">hang up</button>`), 1600);
  }

  #ring() {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    for (const [f, s] of [[440, 0], [480, 0], [440, 0.8], [480, 0.8]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.03, t + s);
      e.gain.setValueAtTime(0, t + s + 0.5);
      o.connect(e).connect(this.game.audio.master);
      o.start(t + s);
      o.stop(t + s + 0.55);
    }
  }

  // ---- info apps ------------------------------------------------------------------------------

  #weatherText() {
    const g = this.game;
    const st = g.weather.storm;
    const season = g.seasons?.name ?? 'autumn';
    const cond = season === 'winter' && st > 0.15 ? 'Snow' : st > 0.6 ? 'Thunderstorm' : st > 0.3 ? 'Rain' : st > 0.1 ? 'Drizzle' : 'Clear, foggy';
    const base = { winter: -2, spring: 11, summer: 21, autumn: 9 }[season];
    const m = g.dayNight.minutes;
    const temp = Math.round(base + 5 * Math.sin(((m - 540) / 1440) * Math.PI * 2) - st * 3);
    const wind = Math.round(g.weather.wind * 30);
    return `${cond}. ${temp}°C. Wind ${wind} km/h. ${g.seasons?.label ?? ''} in Pine Hollow.`;
  }

  go_weather() {
    this.#render('WEATHER', `<div class="ph-line">${this.#weatherText()}</div>`);
  }

  go_sky() {
    const g = this.game;
    const phase = moonPhase(new Date());
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    const icon = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const k = Math.round(phase * 8) % 8;
    const rows = [
      `${icon[k]} ${names[k]} (${Math.round(phase * 100)}% through the cycle)`,
      g.meteors?.shower ? '☄ METEOR SHOWER tonight — lie on the truck roof (Q at the truck)' : '☄ No shower tonight. The odd shooting star.',
      '☀ Sunrise around 6:30 a.m.',
      '🎈 Balloon rides from the airfield, 5–8 a.m.',
      g.holidays?.current ? `★ ${g.holidays.label}` : '',
    ].filter(Boolean);
    this.#render('SKY TONIGHT', rows.map((r) => `<div class="ph-line">${r}</div>`).join(''));
  }

  go_calendar() {
    const g = this.game;
    const d = new Date();
    const pv = localStorage.getItem(KEY_HOL) || 'off';
    const opts = [['off', 'real date'], ['halloween', 'Halloween'], ['christmas', 'Christmas'], ['newyear', 'New Year’s Eve']];
    this.#render(
      'CALENDAR',
      `<div class="ph-line">${d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
       <div class="ph-line">${g.holidays?.current ? `It’s ${g.holidays.label}!` : 'No holiday today.'}</div>
       <div class="ph-dim">Preview a holiday:</div>
       ${opts.map(([k, l]) => `<button class="ph-btn ${pv === k ? 'on' : ''}" data-go="holiday" data-arg="${k}">${pv === k ? '◉' : '○'} ${l}</button>`).join('')}`,
    );
  }

  go_holiday(k) {
    try {
      if (k === 'off') localStorage.removeItem(KEY_HOL);
      else localStorage.setItem(KEY_HOL, k);
    } catch {}
    this.game.holidays?.refresh();
    this.go_calendar();
  }

  go_pets() {
    const g = this.game;
    const own = g.pets?.owned ?? [];
    const rows = own.length
      ? own.map((a) => {
          const t = g.pets.saved[a.def.sid] ?? {};
          const tricks = [t.sit >= 3 ? 'sit' : null, t.fetch ? `fetch ×${t.fetch}` : null].filter(Boolean).join(', ');
          return `<div class="ph-line"><b>${esc(a.name)}</b> — ${a.def.label}${a.stay ? ' (staying put)' : ''}${tricks ? `<br><small>knows: ${tricks}</small>` : ''}</div>`;
        })
      : ['<div class="ph-dim">No pets yet. Strays show as paw prints on the map (M).</div>'];
    this.#render('PETS', rows.join(''));
  }
}

function moonPhase(date) {
  // days since a known new moon (2000-01-06 18:14 UTC), over the synodic month
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - known) / 86400000;
  const p = (days % 29.530588853) / 29.530588853;
  return p < 0 ? p + 1 : p;
}

function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function THREE_box() {
  throw new Error('pizza_box model missing');
}

export { KEY_HOL };
