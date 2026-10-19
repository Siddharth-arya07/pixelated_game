import * as THREE from 'three';

/**
 * Pets
 * ----
 * Four strays live around the map: a shiba behind your house, a husky at the
 * harbor, a ginger cat by the diner and a cat that sleeps by the lighthouse.
 * Strays wander near their spot; dogs are curious, cats keep their distance.
 *
 * Win one over with food (dogs: meat, burgers, pizza · cats: fish) — three
 * times — and it's yours: you name it, it follows you everywhere (indoors
 * too), lies down when you sit, and E pets it. Q tells it to stay / come.
 * Tamed pets are remembered between visits (this browser).
 *
 * Multiplayer: your pets ride along in your state, so friends see them
 * walking beside you (with their names); a stray someone else tamed isn't
 * a stray any more in your world either.
 */
const STRAYS = [
  { sid: 'shiba', model: 'dog_shiba', kind: 'dog', label: 'shiba inu', home: [-184, 182] }, // front yard, by the porch
  { sid: 'husky', model: 'dog_husky', kind: 'dog', label: 'husky', home: [316, 42] },
  { sid: 'cat_diner', model: 'cat', kind: 'cat', label: 'ginger cat', home: [184, 80] },
  { sid: 'cat_light', model: 'cat', kind: 'cat', label: 'scruffy cat', home: [398, -44] },
];
const FOOD = {
  dog: ['dish_steak', 'cooked_venison', 'venison', 'burger', 'hot_pizza', 'pizza', 'cooked_fish', 'pancakes', 'dish_fish_rice'],
  cat: ['cooked_fish', 'dish_fish_rice', 'fish_perch', 'fish_trout', 'fish_bass', 'fish_catfish', 'fish_pike'],
};
const NEED = 3;
const KEY = '3am-pets';

/** Find a clip by name, ignoring armature prefixes ("AnimalArmature|Walk"). */
function clip(obj, name) {
  return (obj.userData.animations ?? []).find((c) => c.name === name || c.name.endsWith('|' + name));
}

class Animal {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.obj = game.assets.model(def.model) ?? new THREE.Group();
    this.obj.name = def.sid;
    this.mixer = new THREE.AnimationMixer(this.obj);
    this.cur = null;
    this.anim = 'Idle';
    this.pos = this.obj.position;
    this.yaw = 0;
    this.play('Idle');
  }

  play(name, fade = 0.25) {
    if (this.anim === name && this.cur) return;
    const c = clip(this.obj, name) ?? clip(this.obj, 'Idle');
    if (!c) return;
    const a = this.mixer.clipAction(c);
    a.reset().fadeIn(fade).play();
    this.cur?.fadeOut(fade);
    this.cur = a;
    this.anim = name;
  }

  /** Walk toward (x, z) at `speed`, sliding along walls. Returns distance left. */
  moveTo(x, z, speed, dt, scene, floorY) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const step = Math.min(d, speed * dt);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
    }
    _seg.start.set(this.pos.x, (floorY ?? this.pos.y) + 0.25, this.pos.z);
    _seg.end.set(this.pos.x, (floorY ?? this.pos.y) + 0.45, this.pos.z);
    scene.collideCapsule(_seg, 0.22, { terrain: false });
    this.pos.x = _seg.start.x;
    this.pos.z = _seg.start.z;
    this.pos.y = floorY ?? (scene.outdoor ? scene.groundHeight(this.pos.x, this.pos.z) : this.pos.y);
    this.obj.rotation.y = this.yaw;
    return d;
  }
}

export class Pets {
  constructor(game) {
    this.game = game;
    this.saved = load();
    this.strays = new Map(); // sid → Animal (world strays + owned pets share these)
    this.owned = []; // Animals that are yours
    this.remote = new Map(); // `${id}:${sid}` → Animal
    this.hearts = [];
    this.sceneName = null;
    this.#ui();
    game.mp?.on('petTamed', (e, id) => this.#remoteTamed(e, id));
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  /** Called once the World is built. */
  setupWorld(world) {
    for (const def of STRAYS) {
      const a = new Animal(this.game, def);
      const [x, z] = def.home;
      a.home = new THREE.Vector3(x, world.groundHeight(x, z), z);
      a.pos.copy(a.home);
      a.trust = this.saved[def.sid]?.trust ?? 0;
      a.name = this.saved[def.sid]?.name ?? null;
      a.stay = false;
      a.t = Math.random() * 4;
      a.target = a.home.clone();
      this.strays.set(def.sid, a);
      if (a.name) {
        a.owned = true;
        this.owned.push(a);
      }
      a.obj.userData.interact = this.#interactDef(a);
    }
    // a dented food bowl where the shiba hangs out, under the porch light
    const sh = this.strays.get('shiba');
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.07, 10), world.mat({ color: 0xb03030 }));
    bowl.position.copy(sh.home).add(new THREE.Vector3(0.6, 0.035, 0.3));
    world.root.add(bowl);
    world.addLight({ position: [sh.home.x, sh.home.y + 2.2, sh.home.z], color: 0xffd8a0, range: 7, intensity: 0.9 });
  }

  #ui() {
    this.nameEl = document.createElement('div');
    this.nameEl.id = 'petname';
    this.nameEl.className = 'hidden';
    this.nameEl.innerHTML = `<div class="pn-card"><div class="pn-t"></div><input maxlength="16" placeholder="name"><button>That’s the one</button></div>`;
    document.getElementById('ui').appendChild(this.nameEl);
    this.nameInput = this.nameEl.querySelector('input');
    const done = () => this.#finishNaming();
    this.nameEl.querySelector('button').addEventListener('click', done);
    this.nameInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') done();
    });
  }

  get visible() {
    return !this.nameEl.classList.contains('hidden');
  }

  hide() {
    if (this.visible && this.naming) this.#finishNaming();
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  #interactDef(a) {
    const g = this.game;
    const food = () => FOOD[a.def.kind].find((f) => g.inventory.has(f));
    return {
      range: 2.6,
      prompt: () => {
        if (a.owned) return a.def.kind === 'dog' ? `Pet ${a.name} · Z sit · T throw a stick` : `Pet ${a.name}`;
        const f = food();
        if (f) return `Offer ${g.inventory.def(f).name} to the ${a.def.label} (${a.trust}/${NEED})`;
        return `The ${a.def.label} watches you. (${a.def.kind === 'dog' ? 'it’d eat meat, burgers, pizza' : 'it’d like some fish'})`;
      },
      action: () => (a.owned ? this.#pet(a) : this.#feed(a, food())),
      secondary: () => (a.owned ? { label: a.stay ? `Call ${a.name}` : `Tell ${a.name} to stay`, action: () => this.#toggleStay(a) } : null),
    };
  }

  #feed(a, item) {
    const g = this.game;
    if (!item) {
      this.#voice(a, 0.6);
      return g.hud.toast(a.def.kind === 'cat' ? 'It blinks at you slowly. Cats want fish.' : 'Its nose twitches. Bring it something meaty.', 2500);
    }
    g.inventory.remove(item);
    a.trust++;
    a.eatT = 2.5;
    a.play('Eating');
    if (!clip(a.obj, 'Eating')) a.play('Idle_Eating');
    this.#heartBurst(a, 3);
    this.#voice(a, 1);
    this.#save();
    if (a.trust >= NEED) {
      a.owned = true;
      this.owned.push(a);
      g.net?.online && g.net.event('petTamed', { sid: a.def.sid });
      setTimeout(() => this.#askName(a), 1400);
    } else g.hud.toast(a.trust === 1 ? `The ${a.def.label} wolfs it down and backs off a step. Again sometime.` : 'It lets you get a little closer this time.', 3000);
  }

  #askName(a) {
    const g = this.game;
    this.naming = a;
    this.nameEl.querySelector('.pn-t').textContent = `The ${a.def.label} leans against your leg. It’s decided: it’s yours. What’s its name?`;
    this.nameInput.value = a.def.kind === 'cat' ? 'Biscuit' : 'Mochi';
    g.openUI(() => this.nameEl.classList.remove('hidden'));
    setTimeout(() => this.nameInput.select(), 50);
  }

  #finishNaming() {
    const g = this.game;
    const a = this.naming;
    if (!a) return;
    this.naming = null;
    a.name = (this.nameInput.value.trim() || 'Buddy').slice(0, 16);
    this.nameEl.classList.add('hidden');
    this.#save();
    g.closeUI();
    g.hud.toast(`${a.name} is your ${a.def.kind} now. They’ll follow you around. E to pet · Q to make them stay.`, 6000);
  }

  #pet(a) {
    a.petT = 2;
    if (a.def.kind === 'cat') a.play('Headbutt');
    else a.play('Jump_ToIdle');
    this.#heartBurst(a, 4);
    this.#voice(a, 1.2);
    const lines = a.def.kind === 'cat' ? [`${a.name} purrs like a little engine.`, `${a.name} headbutts your hand. Again. Again.`, `${a.name} pretends not to like it. Purring gives them away.`] : [`${a.name}’s whole back half wags.`, `${a.name} leans into it with a happy groan.`, `${a.name} rolls over for belly rubs.`];
    this.game.hud.toast(lines[Math.floor(Math.random() * lines.length)], 2500);
  }

  #toggleStay(a) {
    a.stay = !a.stay;
    a.stayAt = a.pos.clone();
    a.stayScene = this.game.scene.name;
    this.game.hud.toast(a.stay ? `${a.name} sits and waits.` : `${a.name} comes running.`, 2000);
    this.#voice(a, 0.8);
  }

  #remoteTamed(e) {
    // someone in the room tamed this stray: it's their pet now, not ours to find
    const a = this.strays.get(e.sid);
    if (a && !a.owned) a.takenByRemote = true;
  }

  // ---------------------------------------------------------------------------
  // Per frame
  // ---------------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const scene = g.scene;
    if (!scene || !this.strays.size) return;
    const changed = this.sceneName !== scene.name;
    this.sceneName = scene.name;
    const feet = g.player.feet;
    const indoorY = scene.outdoor ? null : feet.y;
    const taken = this.#remoteTakenSids();

    let i = 0;
    for (const a of this.strays.values()) {
      const follows = a.owned && !a.stay;
      const inScene = follows ? true : a.owned && a.stay ? a.stayScene === scene.name : scene.name === 'World' && !taken.has(a.def.sid) && !a.takenByRemote;
      this.#attach(a, inScene ? scene : null);
      if (!inScene) continue;
      if (follows && (changed || a.pos.distanceTo(feet) > 35)) {
        // catch up: appear just behind you
        // (in front of you: behind could be the other side of a door)
        const ahead = _v.set(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw)).multiplyScalar(0.9 + i * 0.4);
        a.pos.set(feet.x + ahead.x + (i % 2 ? 0.5 : -0.5) * Math.cos(g.player.yaw), feet.y, feet.z + ahead.z - (i % 2 ? 0.5 : -0.5) * Math.sin(g.player.yaw));
        if (scene.outdoor) a.pos.y = scene.groundHeight(a.pos.x, a.pos.z);
      }
      a.mixer.update(dt);
      if ((a.eatT -= dt) > 0 || (a.petT -= dt) > 0 || a.busy) continue;
      if (follows) this.#follow(a, dt, scene, indoorY, i++);
      else if (a.owned) this.#idleAt(a, dt, scene, indoorY);
      else this.#wild(a, dt, scene);
    }
    this.#tricks(dt);
    this.#updateRemote(dt);
    this.#updateHearts(dt);
  }

  #attach(a, scene) {
    if (scene) {
      if (a.obj.parent !== scene.root) {
        a.obj.removeFromParent();
        scene.root.add(a.obj);
        scene.interactables.push(a.obj);
        a.scene = scene;
      }
    } else if (a.obj.parent) {
      a.obj.removeFromParent();
      if (a.scene) a.scene.interactables = a.scene.interactables.filter((o) => o !== a.obj);
      a.scene = null;
    }
  }

  #follow(a, dt, scene, floorY, i) {
    const g = this.game;
    const p = g.player;
    const feet = p.feet;
    const side = i % 2 ? 1 : -1;
    const tx = feet.x + Math.sin(p.yaw) * 1.5 + Math.cos(p.yaw) * side * 0.8;
    const tz = feet.z + Math.cos(p.yaw) * 1.5 - Math.sin(p.yaw) * side * 0.8;
    const d = Math.hypot(tx - a.pos.x, tz - a.pos.z);
    a.obj.visible = !g.vehicle.active && !g.mp?.ride;
    if (!a.obj.visible) {
      // riding along in the vehicle with you: catch up when you get out
      a.pos.set(feet.x, feet.y, feet.z);
      return;
    }
    if (d > 1.1) {
      const run = d > 5;
      a.moveTo(tx, tz, run ? 6.5 : 2.2, dt, scene, floorY);
      a.play(run ? (a.def.kind === 'cat' ? 'Run' : 'Gallop') : 'Walk');
    } else {
      a.moveTo(a.pos.x, a.pos.z, 0, dt, scene, floorY);
      const lazy = p.seated || g.mp?.emote;
      a.play(lazy ? (a.def.kind === 'dog' ? 'Idle_2_HeadLow' : 'Idle') : a.def.kind === 'dog' && Math.sin(g.time * 0.3 + i) > 0.6 ? 'Idle_2' : 'Idle');
      a.yaw = lerpAngle(a.yaw, Math.atan2(feet.x - a.pos.x, feet.z - a.pos.z), Math.min(1, dt * 3));
      a.obj.rotation.y = a.yaw;
    }
  }

  #idleAt(a, dt, scene, floorY) {
    a.moveTo(a.stayAt.x, a.stayAt.z, 2, dt, scene, floorY);
    a.play(a.def.kind === 'dog' ? 'Idle_2_HeadLow' : 'Idle');
  }

  #wild(a, dt, scene) {
    const g = this.game;
    const feet = g.player.feet;
    const dp = Math.hypot(feet.x - a.pos.x, feet.z - a.pos.z);
    // first time you're near: it makes itself known
    if (dp < 14 && !a.noticed) {
      a.noticed = true;
      this.#voice(a, a.def.kind === 'dog' ? 1.2 : 1);
      this.game.hud.toast(a.def.kind === 'dog' ? `A ${a.def.label} trots over, tail going. Looks hungry.` : `A ${a.def.label} watches you from a safe distance.`, 3500);
    }
    const running = Math.hypot(g.player.velocity.x, g.player.velocity.z) > 5;
    a.t -= dt;
    if (a.def.kind === 'cat' && dp < 2.4 - a.trust * 0.5 && a.trust < NEED) {
      // too close: trot away from you
      const away = _v.set(a.pos.x - feet.x, 0, a.pos.z - feet.z).normalize().multiplyScalar(4);
      a.target.set(a.pos.x + away.x, 0, a.pos.z + away.z);
      a.t = 2;
    } else if (a.def.kind === 'dog' && dp < 9 && !running) {
      // curious: come and look at you
      const stop = Math.max(1.6, 3 - a.trust * 0.5);
      if (dp > stop) a.target.set(feet.x, 0, feet.z);
      else a.target.copy(a.pos);
      a.t = 1;
    } else if (a.t <= 0) {
      const r = 7 * Math.random();
      const an = Math.random() * Math.PI * 2;
      a.target.set(a.home.x + Math.cos(an) * r, 0, a.home.z + Math.sin(an) * r);
      a.t = 4 + Math.random() * 6;
      if (Math.random() < 0.4) a.target.copy(a.pos); // just sit a while
    }
    const d = Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z);
    if (d > 0.6) {
      const fast = a.def.kind === 'cat' && dp < 3;
      a.moveTo(a.target.x, a.target.z, fast ? 4 : 1.3, dt, scene);
      a.play(fast ? 'Run' : 'Walk');
    } else {
      a.moveTo(a.pos.x, a.pos.z, 0, dt, scene);
      a.play(dp < 8 && a.def.kind === 'dog' ? 'Idle_2' : 'Idle');
    }
  }

  // ---------------------------------------------------------------------------
  // Tricks: fetch (dogs), sit (dogs, learned), gifts (cats)
  // ---------------------------------------------------------------------------

  mapMarkers() {
    return [...this.strays.values()].filter((a) => !a.owned && !a.takenByRemote).map((a) => ({ x: a.home.x, z: a.home.z, label: a.def.label }));
  }

  #tricks(dt) {
    const g = this.game;
    const scene = g.scene;
    const dogs = this.owned.filter((a) => a.def.kind === 'dog' && !a.stay && a.obj.parent === scene?.root);
    const free = !g.uiOpen && !g.focus && g.player.enabled && !g.vehicle.active;
    // T: throw a stick (outside, with a dog around)
    if (free && g.input.pressed('KeyT') && dogs.length) {
      if (!scene.outdoor) g.hud.toast('Not in the house!', 1500);
      else if (!this.stick) this.#throwStick(dogs[0]);
    }
    // Z: "Sit!" to the dog you're looking at
    const f = g.interaction.focus?.target;
    const a = f && [...this.strays.values()].find((x) => x.obj === f);
    if (free && g.input.pressed('KeyZ') && a?.owned) this.#sit(a);
    if (this.stick) this.#fetch(dt);
    // cats leave presents on the doorstep, one per cat per day
    const day = g.dayNight.day;
    if (this.giftDay !== day && g.scenes.World?.built) {
      if (this.giftDay !== undefined) for (const c of this.owned.filter((x) => x.def.kind === 'cat')) this.#gift(c);
      this.giftDay = day;
    }
  }

  #sit(a) {
    const g = this.game;
    if (a.def.kind === 'cat') return g.hud.toast(`${a.name} looks at you like you’ve lost your mind.`, 2500);
    const t = (this.saved[a.def.sid] ??= {});
    t.sit = (t.sit ?? 0) + 1;
    const learned = t.sit >= 3;
    if (!learned && Math.random() < 0.6) {
      g.hud.toast(`${a.name} tilts their head. (${t.sit}/3 — keep at it)`, 2000);
    } else {
      a.petT = 4;
      a.play('Idle_2_HeadLow');
      this.#heartBurst(a, 2);
      g.hud.toast(learned ? (t.sit === 3 ? `${a.name} sits! They’ve learned SIT. Good dog!` : `${a.name} sits. Very good.`) : `${a.name} sits — by accident, probably. Good dog anyway!`, 2500);
    }
    this.#saveTricks(a, t);
  }

  #saveTricks(a, t) {
    this.saved[a.def.sid] = { ...this.saved[a.def.sid], ...t };
    this.#save();
  }

  #throwStick(dog) {
    const g = this.game;
    const scene = g.scene;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.6, 5), scene.mat({ color: 0x6a4a2a }));
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    m.position.copy(g.camera.position).addScaledVector(dir, 0.6);
    scene.root.add(m);
    this.stick = { m, vel: dir.multiplyScalar(13).add(new THREE.Vector3(0, 4, 0)), dog, phase: 'fly', scene };
    g.hud.toast(`“Go get it, ${dog.name}!”`, 1500);
    this.#voice(dog, 1.2);
  }

  #fetch(dt) {
    const g = this.game;
    const st = this.stick;
    const dog = st.dog;
    if (g.scene !== st.scene || !dog.owned) {
      st.m.removeFromParent();
      this.stick = null;
      return;
    }
    const scene = st.scene;
    if (st.phase === 'fly') {
      st.vel.y -= 9.8 * dt;
      st.m.position.addScaledVector(st.vel, dt);
      st.m.rotation.x += dt * 9;
      const gy = scene.groundHeight(st.m.position.x, st.m.position.z);
      if (st.m.position.y <= gy + 0.05) {
        st.m.position.y = gy + 0.05;
        st.m.rotation.set(Math.PI / 2, Math.random() * 3, 0);
        st.phase = 'chase';
      }
    }
    if (st.phase === 'fly' || st.phase === 'chase') {
      const d = dog.moveTo(st.m.position.x, st.m.position.z, 7.5, dt, scene);
      dog.play('Gallop');
      dog.busy = true;
      if (st.phase === 'chase' && d < 0.7) st.phase = 'return';
    } else if (st.phase === 'return') {
      const f = g.player.feet;
      const d = dog.moveTo(f.x, f.z, 5.5, dt, scene);
      dog.play('Gallop');
      st.m.position.copy(dog.pos).add(_v.set(Math.sin(dog.yaw) * 0.45, 0.4, Math.cos(dog.yaw) * 0.45));
      st.m.rotation.set(0, dog.yaw + Math.PI / 2, Math.PI / 2);
      if (d < 1.4) {
        st.m.position.set(f.x + Math.sin(dog.yaw) * 0.8, scene.groundHeight(f.x, f.z) + 0.05, f.z + Math.cos(dog.yaw) * 0.8);
        st.m.rotation.set(Math.PI / 2, 0, 0);
        dog.busy = false;
        dog.petT = 1.5;
        dog.play('Idle_2');
        this.#heartBurst(dog, 3);
        this.#voice(dog, 1.2);
        const t = (this.saved[dog.def.sid] ??= {});
        t.fetch = (t.fetch ?? 0) + 1;
        this.#saveTricks(dog, t);
        g.hud.toast(t.fetch === 1 ? `${dog.name} brings it back and drops it at your feet. Fetch! (T to throw again)` : `${dog.name} drops the stick, tail going. (${t.fetch} fetches)`, 2500);
        const m = st.m;
        setTimeout(() => m.removeFromParent(), 20000);
        this.stick = null;
      }
    }
  }

  #gift(cat) {
    const g = this.game;
    const W = g.scenes.World;
    const h = W.poi.house;
    const x = h.x + (Math.random() - 0.5) * 2;
    const z = h.z + 6.3;
    const y = W.groundHeight(x, z);
    const roll = Math.random();
    const gift = roll < 0.25 ? 'gift_mouse' : roll < 0.45 ? 'gift_sock' : roll < 0.62 ? 'gift_feather' : roll < 0.8 ? 'gift_cap' : roll < 0.95 ? 'gift_coin' : 'gift_ring';
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), W.mat({ color: parseInt(g.inventory.def(gift).color.slice(1), 16) }));
    m.position.set(x, y + 0.03, z);
    W.root.add(m);
    W.addInteractable(m, {
      prompt: `${cat.name} left something on the doorstep`,
      range: 2.4,
      action: () => {
        g.inventory.add(gift);
        m.removeFromParent();
        W.interactables = W.interactables.filter((o) => o !== m);
        g.hud.toast(`${g.inventory.def(gift).name}. ${cat.name} looks extremely pleased with themselves.`, 4000);
      },
    });
    if (g.scene === W) g.hud.toast(`Somewhere near the front door, ${cat.name} has left you a present.`, 3500);
  }

  // ---------------------------------------------------------------------------
  // Multiplayer
  // ---------------------------------------------------------------------------

  /** Compact state for Multiplayer (#myState). */
  netState() {
    const out = [];
    for (const a of this.owned) {
      if (!a.obj.parent || !a.obj.visible) continue;
      out.push({ sid: a.def.sid, n: a.name, p: [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z)], y: r2(a.yaw), a: a.anim });
    }
    return out.length ? out : undefined;
  }

  #remoteTakenSids() {
    const s = new Set();
    for (const r of this.game.mp?.remotes?.values() ?? []) for (const p of r.state?.pets ?? []) s.add(p.sid);
    return s;
  }

  #updateRemote(dt) {
    const g = this.game;
    const seen = new Set();
    for (const r of g.mp?.remotes?.values() ?? []) {
      const st = r.state;
      if (!st?.pets || st.sc !== g.scene.name) continue;
      for (const p of st.pets) {
        const key = `${r.id}:${p.sid}`;
        seen.add(key);
        let a = this.remote.get(key);
        if (!a) {
          const def = STRAYS.find((d) => d.sid === p.sid);
          if (!def) continue;
          a = new Animal(g, def);
          a.pos.set(...p.p);
          a.label = makeLabel(p.n);
          a.obj.add(a.label);
          this.remote.set(key, a);
        }
        if (a.obj.parent !== g.scene.root) g.scene.root.add(a.obj);
        a.pos.lerp(_v.set(...p.p), Math.min(1, dt * 8));
        a.yaw = lerpAngle(a.yaw, p.y, Math.min(1, dt * 8));
        a.obj.rotation.y = a.yaw;
        a.play(p.a);
        a.mixer.update(dt);
      }
    }
    for (const [key, a] of this.remote) {
      if (!seen.has(key)) {
        a.obj.removeFromParent();
        this.remote.delete(key);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Little hearts + barks/meows
  // ---------------------------------------------------------------------------

  #heartBurst(a, n) {
    const scene = this.game.scene;
    for (let k = 0; k < n; k++) {
      const h = new THREE.Mesh(_heartGeo, scene.mat({ color: 0xff5a8a, unlit: true, doubleSide: true }));
      h.position.copy(a.pos).add(_v.set((Math.random() - 0.5) * 0.4, 0.6 + k * 0.1, (Math.random() - 0.5) * 0.4));
      h.scale.setScalar(0.12);
      scene.root.add(h);
      this.hearts.push({ h, t: 0, d: k * 0.2 });
    }
  }

  #updateHearts(dt) {
    const cam = this.game.camera;
    for (let k = this.hearts.length - 1; k >= 0; k--) {
      const o = this.hearts[k];
      o.t += dt;
      o.h.position.y += dt * 0.6;
      o.h.quaternion.copy(cam.quaternion);
      o.h.visible = o.t > o.d;
      if (o.t > 1.6 + o.d) {
        o.h.removeFromParent();
        this.hearts.splice(k, 1);
      }
    }
  }

  #voice(a, k = 1) {
    const ctx = this.game.audio.ctx;
    const t = ctx.currentTime;
    const d = this.game.camera.position.distanceTo(a.pos);
    const out = ctx.createGain();
    out.gain.value = Math.min(1, 3 / (1 + d)) * 0.5;
    out.connect(this.game.audio.master);
    if (a.def.kind === 'dog') {
      const big = a.def.sid === 'husky';
      for (let b = 0; b < (k > 1 ? 2 : 1); b++) {
        const t0 = t + b * 0.22;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(big ? 260 : 420, t0);
        o.frequency.exponentialRampToValueAtTime(big ? 150 : 260, t0 + 0.12);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = big ? 700 : 1100;
        f.Q.value = 2;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t0);
        e.gain.linearRampToValueAtTime(0.8, t0 + 0.01);
        e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
        o.connect(f).connect(e).connect(out);
        o.start(t0);
        o.stop(t0 + 0.2);
      }
    } else {
      // meow: a vowel sweep "mi-aaow"
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(760, t + 0.18);
      o.frequency.linearRampToValueAtTime(480, t + 0.6);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.linearRampToValueAtTime(1600, t + 0.2);
      f.frequency.linearRampToValueAtTime(700, t + 0.6);
      f.Q.value = 4;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.5, t + 0.05);
      e.gain.linearRampToValueAtTime(0.4, t + 0.4);
      e.gain.linearRampToValueAtTime(0, t + 0.65);
      o.connect(f).connect(e).connect(out);
      o.start(t);
      o.stop(t + 0.7);
    }
  }

  #save() {
    const out = {};
    for (const a of this.strays.values()) if (a.trust || a.name) out[a.def.sid] = { ...this.saved[a.def.sid], trust: a.trust, name: a.name };
    try {
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch {}
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const x = c.getContext('2d');
  x.font = 'bold 18px monospace';
  x.textAlign = 'center';
  x.fillStyle = '#000a';
  x.fillText(text, 65, 23);
  x.fillStyle = '#ffe8f0';
  x.fillText(text, 64, 22);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
  s.scale.set(0.8, 0.2, 1);
  s.position.y = 1.0;
  return s;
}

const _heartGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.6);
  s.bezierCurveTo(-1.2, 0.2, -0.6, 1.1, 0, 0.5);
  s.bezierCurveTo(0.6, 1.1, 1.2, 0.2, 0, -0.6);
  return new THREE.ShapeGeometry(s);
})();
const _v = new THREE.Vector3();
const _seg = new THREE.Line3(new THREE.Vector3(), new THREE.Vector3());
const r2 = (v) => Math.round(v * 100) / 100;
function lerpAngle(a, b, k) {
  const d = THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + d * k;
}
