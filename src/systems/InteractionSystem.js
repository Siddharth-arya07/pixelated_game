import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * InteractionSystem
 * -----------------
 * Each frame, raycast from the centre of the screen against the active
 * scene's interactables. The closest one in range becomes the "focus": its
 * prompt is shown on the HUD and E / left click triggers its action.
 *
 * Interactable def (set via scene.addInteractable):
 *   { prompt: string | () => string,
 *     action: () => void,
 *     range?: number,                 // default CONFIG.player.interactRange
 *     enabled?: () => boolean,        // hidden entirely when false
 *     available?: () => true | string // shown greyed out with a reason
 *     secondary?: { label, action } | () => {…} | null  // bound to Q
 *     occlude?: boolean               // ignore if terrain/props block the ray }
 */
export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 20;
    this.focus = null;
    this._center = new THREE.Vector2(0, 0);
  }

  update(scene) {
    const game = this.game;
    this.focus = null;

    // Nothing to interact with while driving / fishing / in a menu.
    if (!game.player.enabled || game.fishing.active || game.uiOpen) {
      game.hud.setPrompt(null);
      return;
    }

    // Centre ray first; if it misses, try a small ring of offset rays so tiny
    // props (cans, cigarettes, the laptop) don't need pixel-perfect aim.
    for (const [ox, oy] of AIM_OFFSETS) {
      this.raycaster.setFromCamera(this._center.set(ox, oy), game.camera);
      const hits = this.raycaster.intersectObjects(scene.interactables, true);
      for (const hit of hits) {
        const target = findInteractable(hit.object);
        if (!target) continue;
        const def = target.userData.interact;
        if (def.enabled && !def.enabled()) continue;
        if (hit.distance > (def.range ?? CONFIG.player.interactRange)) continue;
        // Big surfaces (the sea plane) can sit under terrain: only count them
        // if nothing solid is in the way.
        if (def.occlude && scene.raycastStatic(this.raycaster.ray, hit.distance) < hit.distance - 0.05) continue;
        this.focus = { target, def, point: hit.point.clone() };
        break;
      }
      if (this.focus) break;
    }

    if (!this.focus) {
      // Seated and not looking at anything: E stands you up.
      if (game.player.seated) {
        game.hud.setPrompt('[E] Stand up');
        if (game.input.pressed('KeyE')) {
          game.input.consume('KeyE');
          game.player.stand();
        }
      } else game.hud.setPrompt(null);
      return;
    }

    const { def, point } = this.focus;
    const label = typeof def.prompt === 'function' ? def.prompt(point) : def.prompt;
    const avail = def.available ? def.available() : true;
    if (avail !== true) {
      game.hud.setPrompt(avail, true);
      return;
    }
    const second = def.secondary && (typeof def.secondary === 'function' ? def.secondary() : def.secondary);
    game.hud.setPrompt(second ? `[E] ${label}   [Q] ${second.label}` : `[E] ${label}`);
    if (second && game.input.pressed('KeyQ')) {
      game.input.consume('KeyQ');
      second.action(point);
      return;
    }

    // LMB also interacts, except while smoking (LMB = take a drag).
    const click = !def.noClick && game.input.locked && game.input.mousePressed(0) && !game.viewModel.smoking && game.inventory.equipped !== 'shotgun' && game.inventory.equipped !== 'polaroid' && game.inventory.equipped !== 'jar' && !game.mining?.pick;
    if (game.input.pressed('KeyE') || click) {
      game.input.consume('KeyE');
      game.input.consumeMouse(0);
      def.action(point);
    }
  }
}

/** NDC offsets tried in order: centre, then a small diamond around it. */
const AIM_OFFSETS = [
  [0, 0],
  [0, -0.06],
  [0, 0.06],
  [-0.05, 0],
  [0.05, 0],
  [0, -0.12],
];

/** Walk up the hierarchy to the object that owns the interact def. */
function findInteractable(obj) {
  while (obj) {
    if (obj.userData?.interact) return obj;
    obj = obj.parent;
  }
  return null;
}
