import * as THREE from 'three';

/**
 * Town — the people of Pine Hollow
 * --------------------------------
 * Ten residents with routines on the shared game clock (so in a room
 * everyone sees Doug walking Pepper at the same corner). Talk to them once a
 * day, bring them things they like, and help with their little problems —
 * friendship goes up in hearts (0–10). At 5 and 10 hearts they give you
 * something. Friendships and quests are remembered in this browser.
 *
 *   E on someone: talk · give a gift · ask what's wrong (their quest)
 */
const KEY = '3am-town';

// Waypoint helpers resolve against the World's points of interest.
const RESIDENTS = [
  {
    id: 'doug', name: 'Doug', model: 'npc_man', blurb: 'walks his dog Pepper every night',
    schedule: [{ from: 1290, to: 300, path: [[-85, 140], [-62, 150], [-42, 133], [-66, 120], [-88, 128]], speed: 1.1, loop: true }],
    likes: ['venison', 'cooked_venison', 'burger', 'dish_steak'], loves: ['dish_steak'],
    lines: [
      ['“Evening. Or morning. Pepper doesn’t care which.”', '“She’s a rescue. Like most of us round here.”'],
      ['“You’re out late a lot. I respect it.”', '“Pepper likes you. She doesn’t like anybody.”'],
      ['“You ever need anything — and I mean anything — you knock on my door.”'],
    ],
    quest: {
      id: 'pepper', ask: '“Pepper slipped her collar by the park and won’t come to me. She might come to you?”',
      reminder: '“Any sign of Pepper? Last I saw, she was by the swings.”',
      done: '“PEPPER! Oh, you little— thank you. Thank you. I owe you a steak.”', reward: { item: 'dish_steak', n: 1 },
    },
    gift5: ['dish_steak', 1, '“Here. My famous venison steak. Don’t tell the deer.”'],
  },
  {
    id: 'ortega', name: 'Mrs. Ortega', model: 'npc_woman4', blurb: 'knits on her porch and knows everybody',
    schedule: [{ from: 1140, to: 330, at: [-245, 196.4], face: 0, anim: 'Sitting' }, { from: 330, to: 1140, at: [-243, 199], face: 0, anim: 'Idle' }],
    likes: ['flower_sunflower', 'flower_tulip', 'flower_poppy', 'pie', 'caramel_apple'], loves: ['flower_moonflower'],
    lines: [
      ['“Sit, sit. My knees won’t let me get up for visitors anymore.”', '“You’re the one in the house with the light on at 3 a.m. I see you.”'],
      ['“Margaret — Ray’s wife — taught me this stitch. Forty years ago.”', '“Have you eaten? You look like you haven’t eaten.”'],
      ['“You’re one of mine now. That’s just how it is.”'],
    ],
    quest: {
      id: 'letter', ask: '“Would you take this letter to Ray at the lighthouse? My hands shake too much for the walk.”',
      reminder: '“Did Ray get my letter? He’ll pretend he doesn’t care. He cares.”',
      done: '“He read it? Good. Good. Sixty years we’ve been arguing about that man’s tea.”', reward: { item: 'scarf', n: 1 },
    },
    gift5: ['scarf', 1, '“I made you a scarf. It’s lumpy. Wear it anyway.”'],
  },
  {
    id: 'twin_a', name: 'Kofi Okafor', model: 'npc_casual', blurb: 'one of the Okafor twins, skates the park',
    schedule: [{ from: 1260, to: 240, path: [[-140, 244], [-126, 244], [-126, 256], [-140, 256]], speed: 3.2, loop: true, anim: 'Run' }],
    likes: ['soda', 'milkshake', 'candy', 'chips'], loves: ['milkshake'],
    lines: [['“Watch this— okay, watch THIS one.”', '“My brother says he’s better. He’s not.”'], ['“You should skate with us sometime!”'], ['“You’re honestly the coolest grown-up in this town.”']],
    quest: {
      id: 'wheel', ask: '“Our lucky skate wheel rolled off at the drive-in last night. Can you find it?! It’s orange.”',
      reminder: '“The wheel’s somewhere at the drive-in! Orange! You can’t miss it! (You could miss it.)”',
      done: '“THE LUCKY WHEEL! We’re unbeatable now. Here, take our tickets.”', reward: { money: 8 },
    },
    gift5: ['milkshake', 2, '“We got you a milkshake. And another one. Don’t ask where from.”'],
  },
  {
    id: 'twin_b', name: 'Kwame Okafor', model: 'npc_hoodie', blurb: 'the other Okafor twin (the better skater, he says)',
    schedule: [{ from: 1260, to: 240, path: [[-126, 256], [-140, 256], [-140, 244], [-126, 244]], speed: 3.0, loop: true, anim: 'Run' }],
    likes: ['soda', 'milkshake', 'candy', 'popcorn'], loves: ['popcorn'],
    lines: [['“Kofi falls off more than me. Write that down.”'], ['“The drive-in shows the same three movies. We know every line.”'], ['“You can borrow my board any time. Seriously.”']],
    gift5: ['popcorn', 2, '“Drive-in popcorn. Snuck it out. It’s… fine.”'],
  },
  {
    id: 'pete', name: 'Officer Pete', model: 'npc_worker', blurb: 'the night patrol (mostly walks)',
    schedule: [{ from: 1320, to: 420, path: [[-40, 132], [40, 120], [120, 110], [196, 98], [120, 110], [40, 120]], speed: 1.3, loop: true }],
    likes: ['coffee', 'pancakes', 'pie'], loves: ['pancakes'],
    lines: [['“Quiet night. They’re all quiet nights.”', '“Stay off the train tracks, alright?”'], ['“Between you and me, the most dangerous thing in Pine Hollow is Mrs. Ortega’s driving.”'], ['“If I ever retire, I’m going fishing every night. Like you.”']],
    quest: {
      id: 'litter', ask: '“Somebody keeps leaving bottles at Mirror Lake. Could you pick up the five out there? Good citizen points.”',
      reminder: '“Five bottles round the lake shore. You’ve got sharp eyes.”',
      done: '“Clean lake. Gold star. Here — official Pine Hollow PD thank-you, in cash.”', reward: { money: 15 },
    },
    gift5: ['pancakes', 1, '“Diner pancakes. On the department. Don’t tell the department.”'],
  },
  {
    id: 'joyce', name: 'Joyce', model: 'npc_woman3', blurb: 'a night-shift nurse who lives on diner coffee',
    schedule: [{ from: 90, to: 330, at: 'diner', off: [2.5, 2.5], face: 0, anim: 'Idle' }],
    likes: ['coffee', 'burger', 'pie', 'energy_drink'], loves: ['coffee'],
    lines: [['“Twelve-hour shift. I’m running on fumes and Dolores’s coffee.”'], ['“You’re a good listener. Nobody listens at 4 a.m.”'], ['“If you’re ever sick, ask for me. I’ll sneak you the good jello.”']],
    quest: {
      id: 'coffee', ask: '“Is it terrible to ask a stranger for a coffee? I’ve got eight more hours.”',
      reminder: '“Coffee… please… (Dolores sells it inside.)”',
      done: '“You angel. You beautiful angel.”', reward: { money: 5 },
    },
    gift5: ['energy_drink', 2, '“Hospital vending machine special. For emergencies.”'],
  },
  {
    id: 'june', name: 'June', model: 'npc_dress', blurb: 'paints the harbor at night',
    schedule: [{ from: 60, to: 360, at: 'harbor', off: [-6, 8], face: -Math.PI / 2, anim: 'Standing' }],
    likes: ['flower_poppy', 'flower_tulip', 'candy', 'polaroid_film'], loves: ['flower_moonflower'],
    lines: [['“The light on the water at this hour… you can’t paint it. I keep trying.”'], ['“Will you sit for a portrait someday? You have a 3 a.m. face. That’s a compliment.”'], ['“I’m painting you into the harbor one. Small. In the corner. Waving.”']],
    quest: {
      id: 'photo', ask: '“Could you take a Polaroid of the lighthouse for me? I want to paint it, but it keeps moving. (The beam does.)”',
      reminder: '“Just one Polaroid of the lighthouse. Any angle. Bring it here.”',
      done: '“Oh, that’s perfect. Look at the fog on it. Here — a little painting of my own, for you.”', reward: { item: 'painting_harbor', n: 1 },
    },
    gift5: ['flower_poppy', 3, '“I pick these on the way. They’re for you.”'],
  },
  {
    id: 'lou', name: 'Lou', model: 'npc_human', blurb: 'a long-haul trucker who naps at the Quik Mart',
    schedule: [{ from: 0, to: 360, at: 'gasStation', off: [12, 8], face: Math.PI, anim: 'Idle' }],
    likes: ['burger', 'coffee', 'cigarettes', 'hot_pizza'], loves: ['burger'],
    lines: [['“Four hundred miles. Coffee. Four hundred more.”'], ['“Best view in the state is right here, at 4 a.m., from this parking lot.”'], ['“If you ever want to ride along on a run, I’d be glad of the company.”']],
    quest: {
      id: 'fuse', ask: '“Rig’s running lights blew a fuse. Quik Mart sells ’em — would you grab me one? My knee’s shot.”',
      reminder: '“A fuse, friend. Thirty-amp. Register’s got ’em.”',
      done: '“And there’s light! You just saved me a ticket. Take this.”', reward: { money: 12 },
    },
    gift5: ['hot_pizza', 2, '“Quik Mart pizza. Gourmet dining, truck-stop style.”'],
  },
  {
    id: 'marguerite', name: 'Marguerite', model: 'npc_woman1', blurb: 'does the crossword outside the diner',
    schedule: [{ from: 120, to: 330, at: 'diner', off: [-2.5, 2.5], face: 0, anim: 'Idle' }, { from: 900, to: 1080, at: 'playground', off: [4, -4], face: 0, anim: 'Idle' }],
    likes: ['coffee', 'pie', 'quantum_book'], loves: ['pie'],
    lines: [['“Seven down: ‘insomnia’. Eight across… hmm.”'], ['“My late husband did these in pen. Show-off.”'], ['“You’re my crossword buddy now. That’s a lifetime appointment.”']],
    quest: {
      id: 'crossword', ask: '“Fourteen across: ‘The lighthouse keeper’s late wife’. Eight letters. You know Ray, don’t you?”',
      reminder: '“Fourteen across, eight letters. Ray’s wife. Think, think.”',
      choices: ['Dorothy', 'Margaret', 'Abernathy'], answer: 'Margaret',
      wrong: '“Doesn’t fit. Eight letters, dear.”',
      done: '“MARGARET. Of course. She brought him tea every night, didn’t she? Here — for your trouble.”', reward: { item: 'pie', n: 1 },
    },
    gift5: ['pie', 1, '“A slice of cherry. I don’t eat dessert. That’s a lie.”'],
  },
  {
    id: 'nova', name: 'Nova', model: 'npc_woman2', blurb: 'an amateur astronomer up on the summit',
    schedule: [{ from: 1260, to: 330, at: 'gasStation', off: [-22, 10], face: 0, anim: 'Idle' }],
    likes: ['coffee', 'energy_drink', 'candy', 'ore_amethyst'], loves: ['ore_emerald'],
    lines: [['“That smudge? That’s a galaxy. Two million light-years. Hi.”'], ['“The meteor showers here are the best I’ve ever seen. Something about the fog.”'], ['“I named a star after you. Unofficially. It’s the faint one, left of Vega.”']],
    quest: {
      id: 'compass', ask: '“There’s a shipwreck off the lighthouse — my grandad said its brass compass still points at the North Star. Could you dive for it?”',
      reminder: '“The wreck is past the harbor, deep. The dive shop at the pier rents gear.”',
      done: '“It still works. It still points north. Thank you — this means more than I can say.”', reward: { money: 30 },
    },
    gift5: ['ore_amethyst', 2, '“Found these up on the ridge. They look like little night skies.”'],
  },
];

export class Town {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.state = load();
    this.quest = this.state.quest ?? {};
    this.hearts = this.state.hearts ?? {};
    this.talked = this.state.talked ?? {};
    this.flags = this.state.flags ?? {};
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  setupWorld(world) {
    this.world = world;
    for (const def of RESIDENTS) {
      const obj = this.game.assets.model(def.model);
      if (!obj) continue;
      const mixer = new THREE.AnimationMixer(obj);
      const npc = { def, obj, mixer, anim: null, cur: null, pos: obj.position, yaw: 0, talkT: 0 };
      obj.userData.interact = {
        prompt: () => `Talk to ${def.name}${this.#questMark(def)}`,
        range: 3,
        action: () => this.game.dialogue.open(this, npc),
      };
      this.npcs.push(npc);
    }
    this.#questProps(world);
  }

  #questMark(def) {
    const q = def.quest;
    if (!q) return '';
    const st = this.quest[q.id] ?? 0;
    return st === 0 ? '  (!)' : st === 1 ? '  (…)' : '';
  }

  #play(npc, name) {
    if (npc.anim === name) return;
    const clips = npc.obj.userData.animations ?? [];
    const c = clips.find((cl) => cl.name.endsWith(name) || cl.name.endsWith('|' + name)) ?? clips.find((cl) => /Idle/.test(cl.name));
    if (!c) return;
    npc.cur?.fadeOut(0.25);
    npc.cur = npc.mixer.clipAction(c).reset().fadeIn(0.25).play();
    npc.anim = name;
  }

  #resolve(at, off) {
    const W = this.world;
    if (Array.isArray(at)) return new THREE.Vector3(at[0], 0, at[1]);
    const p = W.poi[at] ?? W.spawns[at]?.position ?? new THREE.Vector3();
    return new THREE.Vector3(p.x + (off?.[0] ?? 0), 0, p.z + (off?.[1] ?? 0));
  }

  /** Where is this resident right now (shared clock)? null = at home / asleep. */
  #where(def) {
    const m = this.game.dayNight.minutes;
    for (const s of def.schedule) {
      const inside = s.from <= s.to ? m >= s.from && m < s.to : m >= s.from || m < s.to;
      if (!inside) continue;
      if (s.path) {
        const pts = s.path.map(([x, z]) => new THREE.Vector3(x, 0, z));
        const segs = s.loop ? pts.map((p, i) => [p, pts[(i + 1) % pts.length]]) : pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]);
        const lens = segs.map(([a, b]) => a.distanceTo(b));
        const total = lens.reduce((a, b) => a + b, 0);
        const since = ((m - s.from + 1440) % 1440) * 60; // game seconds since the shift began
        let d = (since * s.speed * 0.033) % total; // (the clock runs 30× fast; walk at a believable pace)
        for (let i = 0; i < segs.length; i++) {
          if (d <= lens[i]) {
            const [a, b] = segs[i];
            const p = a.clone().lerp(b, d / lens[i]);
            return { p, yaw: Math.atan2(b.x - a.x, b.z - a.z), anim: s.anim ?? 'Walk', moving: true };
          }
          d -= lens[i];
        }
      }
      const p = this.#resolve(s.at, s.off);
      return { p, yaw: s.face ?? 0, anim: s.anim ?? 'Idle', moving: false };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const W = this.world;
    if (!W) return;
    const here = g.scene === W;
    for (const npc of this.npcs) {
      const w = here ? this.#where(npc.def) : null;
      if (!w) {
        if (npc.obj.parent) {
          npc.obj.removeFromParent();
          W.interactables = W.interactables.filter((o) => o !== npc.obj);
        }
        continue;
      }
      if (npc.obj.parent !== W.root) {
        W.root.add(npc.obj);
        W.interactables.push(npc.obj);
      }
      npc.talkT -= dt;
      const talking = npc.talkT > 0;
      npc.pos.set(w.p.x, W.groundHeight(w.p.x, w.p.z), w.p.z);
      if (talking && !w.moving) {
        // hold still and look at you
        const f = g.player.feet;
        npc.yaw = Math.atan2(f.x - npc.pos.x, f.z - npc.pos.z);
        this.#play(npc, w.anim === 'Sitting' ? 'Sitting' : 'Wave');
      } else {
        npc.yaw = w.yaw;
        this.#play(npc, w.anim === 'Sitting' ? (npc.def.model === 'npc_woman2' ? 'SitIdle' : 'Sitting') : w.anim === 'Walk' ? (npc.def.model === 'npc_woman2' ? 'Walking' : 'Walk') : w.anim);
      }
      npc.obj.rotation.y = npc.yaw;
      npc.mixer.update(dt);
    }
    this.#questTick(dt);
  }

  // ---------------------------------------------------------------------------
  // Talking, gifts, quests (called by the Dialogue UI)
  // ---------------------------------------------------------------------------

  heartsOf(id) {
    return this.hearts[id] ?? 0;
  }

  addHearts(npc, n) {
    const id = npc.def.id;
    const before = this.heartsOf(id);
    this.hearts[id] = Math.min(10, before + n);
    const g = this.game;
    if (before < 5 && this.hearts[id] >= 5 && npc.def.gift5) {
      const [item, c, text] = npc.def.gift5;
      setTimeout(() => {
        g.inventory.add(item, c);
        g.hud.toast(`${npc.def.name}: ${text}`, 5000);
      }, 1800);
    }
    if (before < 10 && this.hearts[id] >= 10) setTimeout(() => g.hud.toast(`♥ ${npc.def.name} is one of your favourite people in Pine Hollow now. ♥`, 5000), 2500);
    this.#save();
  }

  /** One chat a day counts toward friendship. */
  chat(npc) {
    const id = npc.def.id;
    npc.talkT = 6;
    const h = this.heartsOf(id);
    const tier = h < 3 ? 0 : h < 7 ? 1 : 2;
    const lines = npc.def.lines[tier];
    const line = lines[Math.floor(Math.random() * lines.length)];
    const day = this.game.dayNight.day;
    if (this.talked[id] !== day) {
      this.talked[id] = day;
      this.addHearts(npc, 1);
    }
    return line;
  }

  gift(npc, item) {
    const g = this.game;
    const d = npc.def;
    g.inventory.remove(item);
    npc.talkT = 6;
    if (d.loves?.includes(item)) {
      this.addHearts(npc, 4);
      return `“For me? Oh — this is my favourite thing in the world.” (♥♥♥♥)`;
    }
    if (d.likes?.includes(item)) {
      this.addHearts(npc, 2);
      return `“That’s so kind. Thank you.” (♥♥)`;
    }
    return `“Oh. Um. Thank you…?” (they look politely confused)`;
  }

  questState(npc) {
    return this.quest[npc.def.quest?.id] ?? 0;
  }

  startQuest(npc) {
    const q = npc.def.quest;
    this.quest[q.id] = 1;
    const g = this.game;
    if (q.id === 'letter') g.inventory.add('letter_ray');
    if (q.id === 'pepper') this.#spawnPepper();
    if (q.id === 'wheel') this.#spawnWheel();
    this.#save();
  }

  /** Can this quest be handed in right now? Returns true or a reason. */
  canFinish(npc) {
    const g = this.game;
    const q = npc.def.quest;
    const inv = g.inventory;
    switch (q.id) {
      case 'pepper':
        return this.pepper?.following && this.pepper.obj.position.distanceTo(npc.pos) < 6 ? true : null;
      case 'letter':
        return this.flags.rayLetter ? true : null;
      case 'wheel':
        return inv.has('skate_wheel') ? true : null;
      case 'litter':
        return inv.has('trash_bottle', 5) ? true : null;
      case 'coffee':
        return inv.has('coffee') ? true : null;
      case 'photo':
        return (g.polaroid?.photos ?? []).some((p) => p.lighthouse) ? true : null;
      case 'fuse':
        return inv.has('fuse') ? true : null;
      case 'compass':
        return inv.has('brass_compass') ? true : null;
      default:
        return null;
    }
  }

  finishQuest(npc) {
    const g = this.game;
    const q = npc.def.quest;
    const inv = g.inventory;
    if (q.id === 'wheel') inv.remove('skate_wheel');
    if (q.id === 'litter') inv.remove('trash_bottle', 5);
    if (q.id === 'coffee') inv.remove('coffee');
    if (q.id === 'fuse') inv.remove('fuse');
    if (q.id === 'compass') inv.remove('brass_compass');
    if (q.id === 'pepper' && this.pepper) {
      this.pepper.obj.removeFromParent();
      this.pepper = null;
    }
    this.quest[q.id] = 2;
    if (q.reward?.item) inv.add(q.reward.item, q.reward.n ?? 1);
    if (q.reward?.money) inv.earn(q.reward.money);
    this.addHearts(npc, 5);
    this.#save();
    g.audio.oneShot('register', { volume: 0.4, rate: 1.3 });
  }

  // ---- quest props ------------------------------------------------------------------------

  #questProps(W) {
    if (this.quest.pepper === 1) this.#spawnPepper();
    if (this.quest.wheel === 1 && !this.game.inventory.has('skate_wheel')) this.#spawnWheel();
  }

  #spawnPepper() {
    const W = this.world;
    if (!W || this.pepper) return;
    const obj = this.game.assets.model('dog_shiba');
    if (!obj) return;
    const p = W.poi.playground;
    obj.position.set(p.x + 6, W.groundHeight(p.x + 6, p.z + 5), p.z + 5);
    obj.scale.multiplyScalar(0.8);
    W.root.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    const clip = (n) => (obj.userData.animations ?? []).find((c) => c.name.endsWith(n));
    let cur = mixer.clipAction(clip('Idle_2_HeadLow') ?? clip('Idle')).play();
    this.pepper = {
      obj,
      mixer,
      following: false,
      play: (n) => {
        const c = clip(n);
        if (!c || cur.getClip() === c) return;
        cur.fadeOut(0.2);
        cur = mixer.clipAction(c).reset().fadeIn(0.2).play();
      },
    };
    W.addInteractable(obj, {
      prompt: () => (this.pepper?.following ? 'Pepper (following you)' : '“Pepper! Here, girl!”'),
      action: () => {
        if (!this.pepper) return;
        this.pepper.following = true;
        this.game.hud.toast('Pepper sniffs your hand, sneezes, and decides you’re alright. Take her back to Doug.', 4000);
      },
    });
  }

  #spawnWheel() {
    const W = this.world;
    const d = W.poi.drivein;
    const x = d.x + 14;
    const z = d.z - 9;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), W.mat({ color: 0xff8a20, unlit: true }));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, W.groundHeight(x, z) + 0.06, z);
    W.root.add(m);
    W.addLight({ position: [x, W.groundHeight(x, z) + 0.4, z], color: 0xff9a30, range: 2.5, intensity: 0.6 });
    W.addInteractable(m, {
      prompt: 'An orange skate wheel!',
      range: 2.5,
      action: () => {
        this.game.inventory.add('skate_wheel');
        m.removeFromParent();
        W.interactables = W.interactables.filter((o) => o !== m);
        this.game.hud.toast('Found the lucky wheel. Back to the twins at the park.', 3000);
      },
    });
  }

  /** Bottles at the lake (when Pete's quest is on), Pepper following. */
  #questTick(dt) {
    const g = this.game;
    if (this.pepper) {
      this.pepper.mixer.update(dt);
      if (this.pepper.following && g.scene === this.world) {
        const o = this.pepper.obj;
        const f = g.player.feet;
        const d = Math.hypot(f.x - o.position.x, f.z - o.position.z);
        if (d > 2) {
          const k = Math.min(1, (dt * (d > 6 ? 6 : 2.5)) / d);
          o.position.x += (f.x - o.position.x) * k;
          o.position.z += (f.z - o.position.z) * k;
          o.position.y = this.world.groundHeight(o.position.x, o.position.z);
          o.rotation.y = Math.atan2(f.x - o.position.x, f.z - o.position.z);
          this.pepper.play(d > 6 ? 'Gallop' : 'Walk');
        } else this.pepper.play('Idle_2');
      }
    }
    const lake = g.scenes.Lake;
    if (this.quest.litter === 1 && lake?.built && !this.bottles && g.scene === lake) {
      this.bottles = true;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        const x = Math.sin(a) * 18.5;
        const z = -25 + Math.cos(a) * 18.5;
        const b = lake.place('beer_bottle', { x, z, rotY: a });
        b.rotation.z = Math.PI / 2;
        lake.addInteractable(b, {
          prompt: 'Pick up the bottle',
          range: 2.4,
          action: () => {
            g.inventory.add('trash_bottle');
            b.removeFromParent();
            lake.interactables = lake.interactables.filter((o) => o !== b);
            g.hud.toast(`Bottle ${g.inventory.count('trash_bottle')}/5.`, 1500);
          },
        });
      }
    }
  }

  /** Map dots for residents who are out and about. */
  markers() {
    if (!this.world) return [];
    return this.npcs.map((n) => ({ n, w: this.#where(n.def) })).filter((o) => o.w).map(({ n, w }) => ({ x: w.p.x, z: w.p.z, name: n.def.name }));
  }

  list() {
    return RESIDENTS.map((d) => ({ d, hearts: this.heartsOf(d.id), quest: d.quest ? this.quest[d.quest.id] ?? 0 : null }));
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ quest: this.quest, hearts: this.hearts, talked: this.talked, flags: this.flags }));
    } catch {}
  }

  saveFlags() {
    this.#save();
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
