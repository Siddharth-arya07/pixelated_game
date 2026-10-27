import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Renderer } from './Renderer.js';
import { InputManager } from './InputManager.js';
import { AssetLoader } from './AssetLoader.js';
import { AudioManager } from './AudioManager.js';
import { Tweens } from './Tween.js';
import { PlayerController } from '../systems/PlayerController.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { ShoppingSystem } from '../systems/ShoppingSystem.js';
import { FishingSystem } from '../systems/FishingSystem.js';
import { DayNightCycle } from '../systems/DayNightCycle.js';
import { ViewModelSystem } from '../systems/ViewModelSystem.js';
import { MusicSystem } from '../systems/MusicSystem.js';
import { HuntingSystem } from '../systems/HuntingSystem.js';
import { VideoLibrary } from '../media/VideoLibrary.js';
import { HouseScene } from '../scenes/HouseScene.js';
import { GroceryStoreScene } from '../scenes/GroceryStoreScene.js';
import { LakeScene } from '../scenes/LakeScene.js';
import { WorldScene } from '../scenes/WorldScene.js';
import { LighthouseScene } from '../scenes/LighthouseScene.js';
import { MapUI } from '../ui/MapUI.js';
import { WalkmanUI } from '../ui/WalkmanUI.js';
import { JournalUI } from '../ui/JournalUI.js';
import { PaintUI } from '../ui/PaintUI.js';
import { NoteUI } from '../ui/NoteUI.js';
import { Stargazing } from '../systems/Stargazing.js';
import { DinerScene } from '../scenes/DinerScene.js';
import { StudioScene } from '../scenes/StudioScene.js';
import { Instruments } from '../systems/Instruments.js';
import { Fireworks } from '../systems/Fireworks.js';
import { Meteors } from '../systems/Meteors.js';
import { Fireflies } from '../systems/Fireflies.js';
import { DreamScene } from '../scenes/DreamScene.js';
import { CaveScene } from '../scenes/CaveScene.js';
import { Pets } from '../systems/Pets.js';
import { Birds } from '../systems/Birds.js';
import { Ships } from '../systems/Ships.js';
import { Mining } from '../systems/Mining.js';
import { RayUI } from '../ui/RayUI.js';
import { Seasons } from '../systems/Seasons.js';
import { Radio } from '../systems/Radio.js';
import { PlaneFX } from '../vehicles/PlaneFX.js';
import { Balloon } from '../systems/Balloon.js';
import { BowlingScene } from '../scenes/BowlingScene.js';
import { ShedScene } from '../scenes/ShedScene.js';
import { FremontScene } from '../scenes/FremontScene.js';
import { HomeScene } from '../scenes/HomeScene.js';
import { NatureCenterScene } from '../scenes/NatureCenterScene.js';
import { Pier39Scene } from '../scenes/Pier39Scene.js';
import { AquariumScene } from '../scenes/AquariumScene.js';
import { GoldenGateScene } from '../scenes/GoldenGateScene.js';
import { GriffithScene } from '../scenes/GriffithScene.js';
import { PlanetariumScene } from '../scenes/PlanetariumScene.js';
import { NiagaraScene } from '../scenes/NiagaraScene.js';
import { Memories } from '../systems/Memories.js';
import { Roulette } from '../systems/Roulette.js';
import { Camping } from '../systems/Camping.js';
import { Phone } from '../ui/Phone.js';
import { Holidays } from '../systems/Holidays.js';
import { TextPrompt } from '../ui/TextPrompt.js';
import { Town } from '../systems/Town.js';
import { Dialogue } from '../ui/Dialogue.js';
import { SeaScene } from '../scenes/SeaScene.js';
import { SpaceScene } from '../scenes/SpaceScene.js';
import { Keeper } from '../systems/Keeper.js';
import { Rocket } from '../systems/Rocket.js';
import { Polaroid } from '../systems/Polaroid.js';
import { BookUI } from '../ui/BookUI.js';
import { CookingSystem } from '../systems/CookingSystem.js';
import { Multiplayer } from '../net/Multiplayer.js';
import { LobbyUI } from '../ui/LobbyUI.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { HungerSystem } from '../systems/HungerSystem.js';
import { TouchControls, isTouchDevice } from '../ui/TouchControls.js';
import { HUD } from '../ui/HUD.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { FishingUI } from '../ui/FishingUI.js';

/**
 * Game
 * ----
 * Owns every system and runs the main loop.
 *
 * App state:   loading → title → playing ⇄ paused, with `transition` while
 *              fading between scenes.
 * Scene state: House | GroceryStore | Lake | World (the overworld). Moving
 *              between them happens through doors (interactables) and road
 *              triggers (on foot or in the truck).
 */
export class Game {
  constructor(mount) {
    this.mount = mount;
    this.state = 'loading';
    this.scene = null;
    this.timer = new THREE.Timer();
    this.time = 0;
    this.flashlightOn = false;
    this.tweens = new Tweens();
    this.focus = null; // camera "lean in" mode (laptop)
  }

  async init() {
    // ---- core ---------------------------------------------------------------
    this.renderer = new Renderer(this.mount);
    this.camera = new THREE.PerspectiveCamera(CONFIG.render.fov, this.renderer.aspect, 0.05, 120);
    this.renderer.onResize = (aspect) => {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    };
    this.input = new InputManager(this.renderer.domElement);
    this.assets = new AssetLoader(this.renderer);
    this.audio = new AudioManager(this.camera, this.assets);

    // ---- UI -----------------------------------------------------------------
    this.hud = new HUD();
    this.overlay = document.getElementById('overlay');
    this.fade = document.getElementById('fade');

    // ---- load assets (progress bar on the title card) ---------------------
    const fill = document.getElementById('loading-fill');
    const text = document.getElementById('loading-text');
    await this.assets.load({
      audioContext: this.audio.ctx,
      onProgress: (done, total) => {
        fill.style.width = `${(done / total) * 100}%`;
        text.textContent = `loading... ${done}/${total}`;
      },
    });

    // ---- systems ------------------------------------------------------------
    this.inventory = new InventorySystem(this);
    this.player = new PlayerController(this);
    this.vehicles = new VehicleSystem(this);
    this.vehicle = this.vehicles; // (older name, still used in a few places)
    this.music = new MusicSystem(this);
    this.hunting = new HuntingSystem(this);
    this.videos = new VideoLibrary(this);
    this.interaction = new InteractionSystem(this);
    this.shopping = new ShoppingSystem(this);
    this.fishing = new FishingSystem(this);
    this.dayNight = new DayNightCycle(this);
    this.inventoryUI = new InventoryUI(this);
    this.shopUI = new ShopUI(this);
    this.fishingUI = new FishingUI();
    this.viewModel = new ViewModelSystem(this);
    this.vehicles.init();
    this.fishing.init();
    this.viewModel.init();
    this.hunting.init();

    this.inventory.onChange((inv) => {
      this.hud.setMoney(inv.money);
      this.hud.setEquipped(inv.equipped ? inv.def(inv.equipped).name : null);
    });
    this.hud.setMoney(this.inventory.money);

    // ---- scenes (built lazily on first visit) -------------------------------
    this.map = new MapUI(this);
    this.walkman = new WalkmanUI(this);
    this.journal = new JournalUI(this);
    this.paint = new PaintUI(this);
    this.note = new NoteUI(this);
    this.stargazing = new Stargazing(this);
    this.cooking = new CookingSystem(this);
    this.mp = new Multiplayer(this);
    this.instruments = new Instruments(this);
    this.fireworks = new Fireworks(this);
    this.meteors = new Meteors(this);
    this.fireflies = new Fireflies(this);
    this.pets = new Pets(this);
    this.birds = new Birds(this);
    this.ships = new Ships(this);
    this.mining = new Mining(this);
    this.rayUI = new RayUI(this);
    this.seasons = new Seasons(this);
    this.radio = new Radio(this);
    this.planeFX = new PlaneFX(this);
    this.balloon = new Balloon(this);
    this.camping = new Camping(this);
    this.phone = new Phone(this);
    this.holidays = new Holidays(this);
    this.prompt = new TextPrompt(this);
    this.town = new Town(this);
    this.dialogue = new Dialogue(this);
    this.keeper = new Keeper(this);
    this.rocket = new Rocket(this);
    this.roulette = new Roulette(this);
    this.memories = new Memories(this);
    this.polaroid = new Polaroid(this);
    this.book = new BookUI(this);
    this.weather = new WeatherSystem(this);
    this.hunger = new HungerSystem(this);
    this.touch = isTouchDevice() ? new TouchControls(this) : null;
    this.scenes = {
      House: new HouseScene(this),
      GroceryStore: new GroceryStoreScene(this),
      Lake: new LakeScene(this),
      World: new WorldScene(this),
      Lighthouse: new LighthouseScene(this),
      Diner: new DinerScene(this),
      Studio: new StudioScene(this),
      Dream: new DreamScene(this),
      Cave: new CaveScene(this),
      Bowling: new BowlingScene(this),
      Shed: new ShedScene(this),
      Fremont: new FremontScene(this),
      Home: new HomeScene(this),
      NatureCenter: new NatureCenterScene(this),
      Pier39: new Pier39Scene(this),
      Aquarium: new AquariumScene(this),
      GoldenGate: new GoldenGateScene(this),
      Griffith: new GriffithScene(this),
      Planetarium: new PlanetariumScene(this),
      Niagara: new NiagaraScene(this),
      Sea: new SeaScene(this),
      Space: new SpaceScene(this),
    };
    // Vehicles start parked: truck + bike at the house, boat + jet ski at the pier.
    const world = this.scenes.World;
    world.ensureBuilt();
    this.hunting.setupWorld(world);
    this.pets.setupWorld(world);
    this.birds.setupWorld(world);
    this.ships.setupWorld(world);
    this.balloon.setupWorld(world);
    this.town.setupWorld(world);
    this.keeper.setupWorld(world);
    this.rocket.setupWorld(world);
    this.memories.setupWorld(world);
    const place = (id, spawn) => {
      const sp = world.spawns[spawn];
      const y = this.vehicles.get(id).kind !== 'water' ? world.groundHeight(sp.position.x, sp.position.z) : 0;
      this.vehicles.get(id).park('World', { position: sp.position.clone().setY(y), yaw: sp.yaw });
    };
    place('truck', 'truck_home');
    place('bike', 'bike_home');
    place('skateboard', 'skate_home');
    place('boat', 'boat_mooring');
    place('jetski', 'jetski_mooring');
    place('plane', 'plane_park');

    // ---- title card → play --------------------------------------------------
    text.textContent = 'ready';
    document.getElementById('loading-bar').classList.add('hidden');
    document.getElementById('start-hint').classList.remove('hidden');
    this.state = 'title';
    this.lobby = new LobbyUI(this);
    this.lobby.show();
    this.overlay.addEventListener('click', () => this.#onOverlayClick());
    // Touch: start on touchend too (some mobile browsers swallow the click).
    this.overlay.addEventListener('touchend', (e) => {
      if (e.target.closest('#settings') || e.target.closest('#lobby') || this.overlay.classList.contains('hidden')) return;
      e.preventDefault();
      this.#onOverlayClick();
    });
    this.#initSettings();
    this.input.onLockChange = (locked) => this.#onLockChange(locked);

    this.renderer.renderer.setAnimationLoop(() => this.#loop());
  }

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  /** Title → playing (also called by the lobby after joining a room). */
  start() {
    this.#onOverlayClick();
  }

  #onOverlayClick() {
    if (this.state === 'title' && !this.lobbyChoice) return; // pick in the lobby first
    this.audio.resume();
    if (this.state === 'title') {
      this.state = 'playing';
      this.hud.show();
      this.changeScene('House', 'start', { fade: false });
      this.hud.toast("It's 3:00 a.m. You can't sleep.", 4000);
      this.ambience = this.audio.ambient('night_ambience', { volume: 0.05 });
    }
    if (this.state === 'paused') this.state = 'playing';
    this.overlay.classList.add('hidden');
    this.input.requestLock();
  }

  /**
   * Mouse sensitivity + "retro wobble" (vertex snapping and texture warp
   * strength) on the title/pause card. Saved in localStorage.
   */
  #initSettings() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('3am-settings') ?? '{}');
    } catch {}
    this.settings = { sensitivity: saved.sensitivity ?? 1, retro: saved.retro ?? CONFIG.render.jitter, graphics: saved.graphics ?? 'ps1', weather: saved.weather ?? 'auto' };
    const gfx = document.getElementById('set-gfx');
    gfx.value = this.settings.graphics;
    const applyGfx = () => {
      this.settings.graphics = gfx.value;
      this.renderer.setPreset(gfx.value);
      document.getElementById('set-retro').closest('label').style.opacity = gfx.value === 'ps1' ? 1 : 0.35;
      try {
        localStorage.setItem('3am-settings', JSON.stringify(this.settings));
      } catch {}
    };
    gfx.addEventListener('change', applyGfx);
    const wx = document.getElementById('set-weather');
    wx.value = this.settings.weather;
    this.weather.setMode(this.settings.weather);
    wx.addEventListener('change', () => {
      this.settings.weather = wx.value;
      this.weather?.setMode(wx.value);
      try {
        localStorage.setItem('3am-settings', JSON.stringify(this.settings));
      } catch {}
    });
    const bind = (id, key, apply) => {
      const input = document.getElementById(id);
      const label = document.getElementById(`${id}-v`);
      input.value = this.settings[key];
      const update = () => {
        this.settings[key] = Number(input.value);
        label.textContent = this.settings[key].toFixed(2);
        apply(this.settings[key]);
        try {
          localStorage.setItem('3am-settings', JSON.stringify(this.settings));
        } catch {}
      };
      input.addEventListener('input', update);
      update();
    };
    bind('set-sens', 'sensitivity', () => {});
    bind('set-retro', 'retro', (v) => {
      this.renderer.setRetro(v);
    });
    applyGfx();
    // Don't let fiddling with sliders start/resume the game.
    document.getElementById('settings').addEventListener('click', (e) => e.stopPropagation());
  }

  /** Radians of turn per pixel of mouse movement. */
  get mouseSensitivity() {
    return CONFIG.player.mouseSensitivity * (this.settings?.sensitivity ?? 1) * (this.lookScale ?? 1);
  }

  #onLockChange(locked) {
    if (locked) return;
    // Lost pointer lock without a menu open → pause.
    if (this.state === 'playing' && !this.uiOpen) this.pause();
  }

  pause() {
    this.state = 'paused';
    document.getElementById('loading-text').textContent = 'paused';
    document.getElementById('start-hint').textContent = 'click to resume';
    this.overlay.classList.remove('hidden');
  }

  get uiOpen() {
    return this.inventoryUI.visible || this.shopUI.visible || this.walkman?.visible || this.journal?.visible || this.paint?.visible || this.note?.visible || this.book?.visible || this.polaroid?.visible || this.pets?.visible || this.rayUI?.visible || this.planeFX?.visible || this.phone?.visible || this.prompt?.visible || this.dialogue?.visible || this.memories?.visible;
  }

  openUI(fn) {
    fn();
    this.input.exitLock();
  }

  closeUI() {
    this.inventoryUI.hide();
    this.walkman.hide();
    this.journal.hide();
    this.paint.hide();
    this.note.hide();
    this.book.hide();
    this.pets.hide();
    this.rayUI.hide();
    this.planeFX.hide();
    this.phone.hide();
    this.prompt.hide();
    this.dialogue.hide();
    this.memories?.hide();
    this.polaroid.hide();
    if (this.shopUI.visible) this.shopping.close();
    this.input.requestLock();
    // ESC doesn't count as a user gesture, so re-locking can fail → pause.
    setTimeout(() => {
      if (!this.input.locked && this.state === 'playing' && !this.uiOpen) this.pause();
    }, 200);
  }

  /**
   * Switch the active scene.
   * @param name       'House' | 'GroceryStore' | 'Lake' | 'World'
   * @param spawn      spawn point name in the target scene
   * @param truckSpawn where to park the truck if we're driving it over
   */
  async changeScene(name, spawn, { truckSpawn = null, fade = true } = {}) {
    const prevState = this.state;
    if (fade) {
      this.state = 'transition';
      this.fade.classList.add('on');
      this.audio.oneShot(this.vehicle.driving ? 'reel' : 'door', { volume: 0.4 });
      await wait(380);
    }

    if (this.focus) this.exitFocus(true);
    if (this.player.seated) this.player.seat = null;
    if (this.scene) {
      // Music coming out of a device in the room you're leaving stops.
      let o = this.music.speakerObject;
      while (o?.parent) o = o.parent;
      if (o === this.scene.root) this.music.pause();
      this.scene.stopSounds();
      this.scene.onExit();
      this.scene.root.remove(this.camera);
    }
    const scene = this.scenes[name];
    await scene.preload?.(); // big real-world maps load their data first
    scene.ensureBuilt();
    this.scene = scene;
    scene.root.add(this.camera); // so camera-attached viewmodels render

    const v = this.vehicles.active;
    // Only road triggers carry a vehicle along; anything else drops you out.
    if (v && !(truckSpawn && v.kind === 'ground' && scene.spawns[truckSpawn])) {
      v.onExit();
      this.vehicles.active = null;
      this.player.enabled = true;
    }
    if (this.vehicles.active && truckSpawn) {
      const sp = scene.spawns[truckSpawn];
      this.vehicles.carryActive(name, { position: sp.position.clone().setY(scene.groundHeight(sp.position.x, sp.position.z)), yaw: sp.yaw });
    } else {
      this.player.spawn(this.mp.spawnSlot(scene.spawns[spawn] ?? scene.spawns.default));
    }
    this.vehicle.onSceneEnter(scene);
    scene.triggers.forEach((t) => (t.inside = true)); // don't fire on arrival
    scene.startSounds();
    scene.onEnter(spawn);
    this.hud.setLocation(scene.label);
    // Crickets are loud outside, barely there through the walls.
    this.ambience?.setVolume(scene.outdoor ? 0.35 : 0.05, 0.5);

    if (fade) {
      await wait(80);
      this.fade.classList.remove('on');
      // Only restore if nothing (e.g. a pause) changed the state meanwhile.
      if (this.state === 'transition') this.state = prevState === 'transition' ? 'playing' : prevState;
    }
  }

  respawn() {
    this.player.spawn(this.scene.spawns.default);
  }

  /**
   * Lean the camera into something (the laptop). While focused the player
   * can't move; `onUpdate(dt, input)` gets the frame; E leaves.
   * @param {{ position: THREE.Vector3, target: THREE.Vector3, fov?: number, fit?: {w:number,h:number},
   *           hint?: string, onUpdate?: Function, onExit?: Function }} f
   */
  enterFocus(f) {
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(f.position, f.target, _up));
    this.focus = { ...f, quat: q, k: { v: 0 }, leaving: false };
    // Screens need more lines to be readable; snap back on exit.
    if (f.hiRes) this.renderer.setLines(Math.min(960, this.renderer.baseLines * 2));
    this.hud.setFocused(true);
    this.player.movementLocked = true;
    this.tweens.to(this.focus.k, { v: 1 }, 0.55, { ease: 'inOut' });
  }

  exitFocus(immediate = false) {
    const f = this.focus;
    if (!f || f.leaving) return;
    f.leaving = true;
    f.onExit?.();
    if (f.hiRes) this.renderer.setLines(this.renderer.baseLines);
    this.hud.setFocused(false);
    const done = () => {
      if (this.focus === f) this.focus = null;
      this.player.movementLocked = false;
      this.camera.fov = CONFIG.render.fov;
      this.camera.updateProjectionMatrix();
    };
    if (immediate) done();
    else this.tweens.to(f.k, { v: 0 }, 0.4, { ease: 'inOut' }).then(done);
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  #loop() {
    this.timer.update();
    this.tick(Math.min(this.timer.getDelta(), 0.1));
  }

  /** Advance one frame. Public so you can step the game from the console. */
  tick(dt) {
    this.time += dt;
    this.dtLast = dt;
    if (this.state === 'playing' && this.scene) {
      this.tweens.update(dt);
      this.#update(dt);
    }
    if (this.scene) this.#render(dt);
    this.touch?.update();
    this.input.endFrame();
  }

  #update(dt) {
    const input = this.input;
    const scene = this.scene;

    // ---- menus ------------------------------------------------------------
    if (input.pressed('KeyI') && !this.fishing.active && !this.shopUI.visible && !this.focus) {
      if (this.inventoryUI.visible) this.closeUI();
      else this.openUI(() => this.inventoryUI.show());
    }
    if (input.pressed('KeyM') && !this.focus && !this.uiOpen) this.map.toggle();
    if (input.pressed('KeyP') && !this.focus && !this.fishing.active && !this.shopUI.visible) {
      if (this.walkman.visible) this.closeUI();
      else if (!this.uiOpen) this.openUI(() => this.walkman.show());
    }
    if (input.pressed('KeyJ') && !this.focus && !this.fishing.active && !this.shopUI.visible) {
      if (this.journal.visible) this.closeUI();
      else if (!this.uiOpen) this.openUI(() => this.journal.show());
    }
    if (input.pressed('Escape') && this.uiOpen) this.closeUI();
    if (input.pressed('KeyE') && this.note.visible) {
      input.consume('KeyE');
      this.closeUI();
    }
    if (input.pressed('KeyL') && this.inventory.equipped === 'flashlight') {
      this.flashlightOn = !this.flashlightOn;
      this.audio.oneShot('click');
    }

    // ---- world ------------------------------------------------------------
    this.weather.update(dt, scene);
    this.dayNight.update(dt, scene);
    if (this.focus) {
      // Leaning into the laptop: only the focus target gets input.
      const exitKey = this.focus.exitKey ?? 'KeyE';
      if (input.pressed(exitKey) && !this.focus.leaving) {
        input.consume(exitKey);
        this.exitFocus();
      } else this.focus.onUpdate?.(dt, input);
      input.consumeMouseDelta();
      this.hud.setPrompt(null);
    } else if (!this.uiOpen) {
      // Order matters: vehicle (E = exit) and fishing run before the
      // interaction system so one E press doesn't trigger two things.
      this.vehicle.update(dt, scene);
      this.fishing.update(dt, this.time);
      this.player.update(dt, scene);
      this.interaction.update(scene);
    } else {
      this.hud.setPrompt(null);
      input.consumeMouseDelta();
    }
    this.inventory.update(dt);
    this.book.update();
    this.polaroid.update(dt);
    this.fireworks.update(dt);
    this.meteors.update(dt);
    this.fireflies.update(dt);
    this.pets.update(dt);
    this.birds.update(dt);
    this.ships.update(dt);
    this.mining.update(dt);
    this.rayUI.update(dt);
    this.seasons.update(dt);
    this.radio.update(dt);
    this.planeFX.update(dt);
    this.balloon.update(dt);
    this.camping.update(dt);
    this.phone.update(dt);
    this.holidays.update(dt);
    this.town.update(dt);
    this.keeper.update(dt);
    this.rocket.update(dt);
    this.roulette.update(dt);
    this.memories.update(dt);
    this.dialogue.update(dt);
    this.hunger.update(dt);
    this.stargazing.update(dt);
    this.mp.update(dt);
    this.viewModel.update(dt);
    this.hunting.update(dt);
    this.music.update(dt);
    this.map.update();
    this.walkman.update(dt);
    scene.update(dt, this.time);
    this.#checkTriggers(scene);

    // ---- HUD --------------------------------------------------------------
    this.hud.setClock(this.dayNight.label);
    if (this.focus) {
      this.hud.setSpeed(null);
      this.hud.setHint(this.focus.hint ?? 'E get up');
    } else if (this.vehicles.driving) {
      const v = this.vehicles.active;
      this.hud.setSpeed(v.speed, v.speed < -0.1 ? 'R' : 'D');
      const smoke = this.viewModel.smoking ? ' · LMB drag' : '';
      this.hud.setHint(
        v.kind === 'air'
          ? `SHIFT/CTRL throttle ${Math.round(v.throttle * 100)}% · W/S nose up/down · F flares · R smoke · G drop · B banner · A/D bank · SPACE brakes · alt ${Math.round(v.altitude)} m · E get out`
          : v.kind === 'water'
          ? `W/S throttle · A/D steer · MOUSE look${smoke} · E get off at the dock`
          : v.cfg.ollie
            ? `W push · A/D carve · S slow down · SPACE ollie · MOUSE look${smoke} · E step off`
            : `W/S gas/brake · A/D steer · SPACE handbrake · F lights${v.radioToggle ? ' · Q radio · N next' : ''} · MOUSE look${smoke} · E exit`,
      );
    } else {
      this.hud.setSpeed(null);
      let hint = this.mp.ride ? `riding with ${this.mp.ride.veh.remoteName ?? 'them'} · MOUSE look · E hop off` : `WASD move · SHIFT run · E interact · I inventory · O phone · H bus${this.inventory.equipped === 'flashlight' ? ' · L flashlight' : ''}`;
      if (this.fishing.active) hint = 'LMB cast / reel · E or RMB stop fishing';
      else if (this.scene?.name === 'Space') hint = 'MOUSE look around · sit back and enjoy the trip';
      else if (this.scene?.name === 'Sea') hint = 'WASD swim · SPACE up · C down · SHIFT kick · hold F log a creature · E interact / climb out at the surface';
      else if (this.seasons.mode === 'skate') hint = 'W push · A/D turn · SPACE brake · MOUSE look · E step off the ice';
      else if (this.seasons.mode === 'sled') hint = 'A/D steer · S drag your feet · MOUSE look · E get off';
      else if (this.balloon.riding) hint = 'MOUSE look around · hold Q to fire the burner';
      else if (this.mining.pick) hint = `LMB swing the pickaxe${this.scene?.name === 'Cave' ? ' at ore veins' : ''} · E interact · I inventory`;
      else if (this.inventory.equipped === 'jar') hint = `LMB catch a firefly (${this.fireflies.jar}/20 in the jar) · E interact · I inventory`;
      else if (this.polaroid.equipped) hint = 'LMB take photo · Q / scroll film · RMB zoom · K album · X put away';
      else if (this.viewModel.smoking) hint = `HOLD LMB drag · R flick ash · G toss${this.player.seated ? ' · E stand' : ' · WASD move'}`;
      else if (this.player.seat?.hint) hint = this.player.seat.hint();
      else if (this.player.seated) hint = 'MOUSE look · I inventory (smoke, drink) · E stand up';
      else if (this.hunting.equipped) hint = 'LMB fire · RMB aim · R reload · E interact · I inventory';
      else if (this.interaction.focus?.def.hint) hint = this.interaction.focus.def.hint;
      this.hud.setHint(hint);
    }
  }

  #checkTriggers(scene) {
    const driving = this.vehicle.driving;
    const pos = driving ? this.vehicle.object.position : this.player.feet;
    for (const t of scene.triggers) {
      const inside = t.box.containsPoint(_p.set(pos.x, Math.max(pos.y, t.box.min.y + 0.01), pos.z));
      if (inside && !t.inside && (!t.vehicleOnly || driving)) t.onEnter(this);
      t.inside = inside;
      if (this.scene !== scene) return; // trigger changed scene
    }
  }

  #render(dt) {
    const scene = this.scene;
    // Camera
    if (this.vehicle.driving) {
      // (e.g. you were aiming down sights when you got in)
      if (this.camera.fov !== CONFIG.render.fov && !this.focus) {
        this.camera.fov = CONFIG.render.fov;
        this.camera.updateProjectionMatrix();
      }
      this.vehicle.applyCamera(dt);
    }
    else if (!this.mp.applyRideCamera(this.camera)) {
      this.player.applyCamera();
      if (!this.focus) this.hunting.applyCamera();
      this.cameraHook?.(this.camera);
      if (this.zoomFov && !this.focus) {
        this.camera.fov += (this.zoomFov - this.camera.fov) * Math.min(1, this.dtLast * 10);
        this.camera.updateProjectionMatrix();
      } else if (this.zoomFov === null && !this.focus && !this.hunting.equipped && Math.abs(this.camera.fov - CONFIG.render.fov) > 0.05) {
        this.camera.fov = CONFIG.render.fov;
        this.camera.updateProjectionMatrix();
        this.zoomFov = undefined;
      }
    }
    // Drunk: the horizon rolls and drifts.
    const drunk = this.inventory.drunkFx ?? 0;
    if (drunk > 0.001) {
      this.camera.rotation.z += Math.sin(this.time * 0.8) * drunk * 0.07;
      this.camera.rotation.y += Math.sin(this.time * 0.53 + 1) * drunk * 0.03;
    }
    // High: the room breathes (FOV swell) and the head floats a little.
    const high = this.inventory.highFx ?? 0;
    if (high > 0.001 && !this.focus) {
      this.camera.fov += (2 + Math.sin(this.time * 0.6) * 3) * Math.min(1, high * 1.6);
      this.camera.rotation.z += Math.sin(this.time * 0.35) * 0.02 * high;
      this.camera.updateProjectionMatrix();
    }
    if (this.focus) {
      const k = this.focus.k.v;
      this.camera.position.lerp(this.focus.position, k);
      this.camera.quaternion.slerp(this.focus.quat, k);
      // `fit` = { w, h } metres that must stay fully visible at this distance,
      // whatever the window's aspect ratio is.
      let target = this.focus.fov ?? CONFIG.render.fov;
      if (this.focus.fit) {
        const d = this.focus.position.distanceTo(this.focus.target);
        const halfH = Math.max(this.focus.fit.h / 2, this.focus.fit.w / 2 / this.camera.aspect) * 1.08;
        target = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / d));
      }
      this.camera.fov = CONFIG.render.fov + (target - CONFIG.render.fov) * k;
      this.camera.updateProjectionMatrix();
    }
    // Draw distance ends a bit past the fog wall (cheap culling on the big map).
    let far = Math.max(40, this.renderer.shared.uFogFar.value + 18);
    // Sky shows (fireworks, shooting stars) live well past the fog wall.
    if (this.fireworks.n || this.meteors.list.length || this.meteors.watching) far = Math.max(far, 420);
    if (this.ships.wantFar) far = Math.max(far, (this.farBoost ?? 0) > 1000 ? 1700 : 1100);
    // memory places with landmarks on the horizon (the bridge, LA, Alcatraz)
    if (this.scene?.farView) far = Math.max(far, this.scene.farView);
    if (Math.abs(this.camera.far - far) > 1) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    // Lights: scene lights + vehicles + flashlight + ember
    const lights = scene.lights.concat(this.vehicle.activeLights(scene), this.viewModel.lights, this.hunting.lights, this.fireworks.lights, this.polaroid.lights, this.fireflies.lights, this.mining.lights);
    if (this.flashlightOn && this.inventory.equipped === 'flashlight' && !this.vehicle.driving) {
      this.camera.getWorldDirection(_dir);
      _flash.position.copy(this.camera.position).addScaledVector(_dir, 2.5);
      lights.push(_flash);
    }
    this.renderer.updateLights(lights, this.camera.position, this.time);
    this.renderer.render(scene.root, this.camera, this.time);
    // Polaroid: grab the frame while the drawing buffer still holds it.
    if (this.captureNext) {
      const fn = this.captureNext;
      this.captureNext = null;
      fn(this.renderer.domElement);
    }
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _flash = { position: new THREE.Vector3(), color: new THREE.Color(0xfff8e0), range: 9, intensity: 1, enabled: true, priority: 5 };
