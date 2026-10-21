/**
 * Dialogue — talking to a Pine Hollow resident
 * --------------------------------------------
 * Name, hearts, what they say (typed out), and a few choices:
 * chat · give something · their favour (ask / hand in) · bye.
 */
export class Dialogue {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = 'dialogue';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="dl-box"><div class="dl-head"><b></b><span class="dl-hearts"></span><i></i></div><div class="dl-text"></div><div class="dl-opts"></div></div>`;
    document.getElementById('ui').appendChild(this.el);
    this.nameEl = this.el.querySelector('b');
    this.heartsEl = this.el.querySelector('.dl-hearts');
    this.blurbEl = this.el.querySelector('i');
    this.textEl = this.el.querySelector('.dl-text');
    this.opts = this.el.querySelector('.dl-opts');
  }

  open(town, npc) {
    this.town = town;
    this.npc = npc;
    npc.talkT = 8;
    this.game.openUI(() => {
      this.visible = true;
      this.el.classList.remove('hidden');
    });
    this.#say(town.chat(npc));
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
    clearInterval(this.typeT);
  }

  update() {
    if (this.visible && this.game.input.pressed('KeyE')) {
      this.game.input.consume('KeyE');
      this.game.closeUI();
    }
  }

  #say(text) {
    const d = this.npc.def;
    this.nameEl.textContent = d.name;
    this.blurbEl.textContent = d.blurb;
    const h = this.town.heartsOf(d.id);
    this.heartsEl.textContent = '♥'.repeat(h) + '♡'.repeat(10 - h);
    clearInterval(this.typeT);
    let n = 0;
    this.textEl.textContent = '';
    this.typeT = setInterval(() => {
      n += 2;
      this.textEl.textContent = text.slice(0, n);
      if (n >= text.length) clearInterval(this.typeT);
    }, 18);
    this.#options();
  }

  #options() {
    const g = this.game;
    const t = this.town;
    const npc = this.npc;
    const q = npc.def.quest;
    const st = q ? t.questState(npc) : 2;
    const o = [];
    o.push(['Chat', () => this.#say(t.chat(npc))]);
    o.push(['Give something…', () => this.#gifts()]);
    if (q && st === 0) o.push(['“You look like something’s up?”', () => this.#offer()]);
    if (q && st === 1) {
      if (q.choices) o.push(['“About fourteen across…”', () => this.#choices()]);
      else if (t.canFinish(npc) === true) o.push(['“I did it!”', () => this.#finish()]);
      else o.push(['“About that favour…”', () => this.#say(q.reminder)]);
    }
    o.push(['Bye', () => g.closeUI()]);
    this.opts.innerHTML = '';
    for (const [label, fn] of o) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = fn;
      this.opts.appendChild(b);
    }
  }

  #offer() {
    const q = this.npc.def.quest;
    this.#say(q.ask);
    this.opts.innerHTML = '';
    const yes = document.createElement('button');
    yes.textContent = '“Sure, I’ll help.”';
    yes.onclick = () => {
      this.town.startQuest(this.npc);
      this.#say(q.id === 'letter' ? '“Thank you, dear. Here — careful, it’s sealed.” (You got the letter.)' : '“You’re a lifesaver.”');
    };
    const no = document.createElement('button');
    no.textContent = '“Maybe later.”';
    no.onclick = () => this.#say('“No rush. I’ll be around.”');
    this.opts.append(yes, no);
  }

  #choices() {
    const q = this.npc.def.quest;
    this.#say(q.reminder);
    this.opts.innerHTML = '';
    for (const c of q.choices) {
      const b = document.createElement('button');
      b.textContent = `“${c}?”`;
      b.onclick = () => {
        if (c === q.answer) this.#finish();
        else this.#say(q.wrong);
      };
      this.opts.appendChild(b);
    }
  }

  #finish() {
    const q = this.npc.def.quest;
    this.town.finishQuest(this.npc);
    this.#say(q.done);
  }

  #gifts() {
    const g = this.game;
    const items = g.inventory.list().filter((i) => !i.equip && !['letter_ray', 'skate_wheel', 'trash_bottle', 'brass_compass'].includes(i.id));
    this.opts.innerHTML = '';
    if (!items.length) {
      this.#say('(Your pockets are empty. Lint doesn’t count.)');
      return;
    }
    for (const it of items.slice(0, 12)) {
      const b = document.createElement('button');
      b.textContent = `${it.name} ×${it.count}`;
      b.onclick = () => this.#say(this.town.gift(this.npc, it.id));
      this.opts.appendChild(b);
    }
    const back = document.createElement('button');
    back.textContent = '(never mind)';
    back.onclick = () => this.#options();
    this.opts.appendChild(back);
  }
}
