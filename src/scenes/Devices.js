import * as THREE from 'three';
import { TVScreen } from '../media/VideoLibrary.js';

/**
 * Devices
 * -------
 * Reusable interactive furniture shared by the house and the lighthouse:
 *
 *   addTV(scene, tvObject, opts)        channels on a CRT (E next channel, Q power)
 *   addMusicDevice(scene, obj, label)   stereo / radio → shared MusicSystem
 *   addSeat(scene, obj, seat)           sit down (E), look around, smoke, stand (E)
 */

/** Put a live TVScreen on the front of a CRT model. Returns the TVScreen. */
export function addTV(scene, tv, { channels, lightAt } = {}) {
  const g = scene.game;
  const screen = new TVScreen(g, { channels });
  // Measure in the TV's own frame (unrotated) so any facing works.
  const rotY = tv.rotation.y;
  tv.rotation.y = 0;
  const b = scene.bounds(tv);
  tv.rotation.y = rotY;
  tv.updateMatrixWorld(true);
  const size = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3()).sub(tv.position);
  // The tube is on the model's front (+Z local), a little left of the knobs.
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.58, size.y * 0.62, 2, 2), scene.mat({ map: screen.texture, unlit: true, affine: 0 }));
  plane.position.set(c.x - size.x * 0.12, b.min.y - tv.position.y + size.y * 0.52, c.z + size.z / 2 + 0.006);
  const holder = new THREE.Group();
  holder.position.copy(tv.position);
  holder.rotation.y = rotY;
  holder.add(plane);
  scene.root.add(holder);
  const depth = size.z / 2;

  const glowPos = lightAt ?? new THREE.Vector3(c.x, b.min.y - tv.position.y + size.y * 0.5, c.z + depth + 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY).add(holder.position);
  const light = scene.addLight({ position: glowPos, color: 0x8098c8, range: 4.5, intensity: 1.0, flicker: true });
  scene.updaters.push((dt) => {
    screen.update(dt);
    light.enabled = screen.on;
  });
  // Shared TV: other players in the room see the same channel.
  const key = `${scene.name}:tv:${(g.devices ??= new Map()).size}`;
  g.devices.set(key, {
    obj: tv,
    setChannel: (ch, on) => {
      screen.channel = ch % screen.channels.length;
      screen.on = !!on;
      screen.switchT = 0.25;
    },
  });
  const share = () => g.net?.online && g.net.event('tv', { dev: key, ch: screen.channel, on: screen.on });
  scene.addInteractable(tv, {
    prompt: () => (screen.on ? `Change channel (${screen.name})` : 'Turn on TV'),
    action: () => {
      if (!screen.on) screen.on = true;
      else screen.nextChannel();
      g.audio.oneShot('click');
      share();
    },
    secondary: () =>
      screen.on
        ? {
            label: 'Turn off',
            action: () => {
              screen.on = false;
              g.audio.oneShot('click');
              share();
            },
          }
        : null,
  });
  return screen;
}

/** A stereo/radio that plays the shared music player out of itself. */
export function addMusicDevice(scene, obj, label = 'radio') {
  const g = scene.game;
  const key = `${scene.name}:${label}`;
  (g.devices ??= new Map()).set(key, { obj });
  const music = () => g.music;
  const here = () => music().speakerObject === obj;
  scene.addInteractable(obj, {
    prompt: () => {
      const m = music();
      if (here() && m.playing) return `Next track  ♪ ${m.current.title}`;
      return `Turn on ${label}`;
    },
    action: () => {
      const m = music();
      if (here() && m.playing) m.next();
      else {
        m.useSpeaker(obj);
        m.play();
        g.hud.toast(`♪ ${m.current.artist} — ${m.current.title}`);
      }
      g.audio.oneShot('click');
      setTimeout(() => g.mp?.shareMusic(key), 300);
    },
    secondary: () =>
      here() && music().playing
        ? {
            label: `Turn off ${label}`,
            action: () => {
              music().pause();
              g.audio.oneShot('click');
              g.mp?.shareMusic(key);
            },
          }
        : null,
  });
}

/**
 * Make an object sittable.
 * seat = { eye: [x,y,z] world camera position, yaw (player yaw), standAt: [x,y,z], pitch?, yawLimit? }
 */
export function addSeat(scene, obj, seat, prompt = 'Sit down') {
  const g = scene.game;
  const s = {
    ...seat,
    eye: new THREE.Vector3(...seat.eye),
    standAt: new THREE.Vector3(...seat.standAt),
  };
  scene.addInteractable(obj, {
    prompt,
    range: 2.6,
    enabled: () => !g.player.seated,
    action: () => {
      g.player.sit(s);
      g.hud.toast('E to stand up. You can smoke here.', 3000);
    },
  });
}
