import * as THREE from 'three';
import { GeoScene } from './GeoScene.js';
import url from '../assets/geo/griffith.json?url';

/**
 * Griffith Observatory, Los Angeles
 * ---------------------------------
 * The real hillside (OpenStreetMap + elevation), and on it the observatory:
 * white art-deco walls, the big copper-green planetarium dome between two
 * telescope domes, the front lawn with the Astronomers Monument, terraces
 * with coin telescopes, the Hollywood sign on Mount Lee at its real bearing,
 * and all of Los Angeles laid out below — a sea of lights at night.
 * The planetarium show is inside (PlanetariumScene).
 */
export class GriffithScene extends GeoScene {
  constructor(game) {
    super(game, {
      name: 'Griffith',
      label: 'griffith observatory',
      url,
      base: '#8a8650',
      colors: { scrub: '#6a7040', grass: '#5a8a40', park: '#5a8a40', wood: '#4a5a32', residential: '#7a7a58' },
      fogExtra: 160,
      groundFog: 0,
      treeColors: [0x4a5a32, 0x5a6a38, 0x3a4a2a],
      palette: [0xf0e4cc, 0xe8d8c0, 0xf4ecdc, 0xe0d0b8],
      roof: 0xa84a34,
    });
  }

  style(b) {
    if (/Griffith Observatory/.test(b.n ?? '')) return { skip: true }; // built by hand below
    return super.style(b);
  }

  landmarks() {
    this.farView = 12000; // see the landmarks on the horizon
    const m = this.map;
    const ob = m.buildings.find((b) => /Griffith Observatory/.test(b.n ?? ''));
    const cx = ob ? (ob.minX + ob.maxX) / 2 : 58;
    const cz = ob ? (ob.minZ + ob.maxZ) / 2 : 87;
    const y = Math.max(m.heightAt(cx, cz), m.heightAt(cx - 30, cz), m.heightAt(cx + 30, cz));
    this.obs = { x: cx, z: cz, y };
    this.#observatory(cx, y, cz);
    this.#city(cx, y, cz);
    this.#hollywood();
    // the lawn, the monument, the bus stop at the top of the parking lot
    const mon = m.poi("Astronomers' Monument") ?? { x: cx, z: cz - 45 };
    this.#monument(mon.x, mon.z);
    this.busStop(cx + 6, cz - 70, 0);
    this.addSpawn('terrace', [cx, y + 0.1, cz + 22], Math.PI);
  }

  #observatory(cx, y, cz) {
    const white = this.mat({ map: this.tex('wall', 6, 2), color: 0xf4f0e6 });
    const copper = this.mat({ color: 0x5a9080 });
    const dark = this.mat({ color: 0x3a4a48 });
    // a flat terrace all around, so the building sits level on the ridge
    const pad = this.box(110, 2, 70, this.mat({ map: this.tex('checker_tiles', 20, 14), color: 0xd8d0c0 }), cx, y - 0.9, cz);
    void pad;
    // main block
    this.box(74, 10, 24, white, cx, y + 5, cz);
    // trim lines (art deco)
    for (const yy of [8.6, 9.6]) this.box(74.4, 0.3, 24.4, this.mat({ color: 0xc8c0b0 }), cx, y + yy, cz, { collide: false });
    // central drum + planetarium dome
    this.box(26, 4, 26, white, cx, y + 12, cz, { collide: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), copper);
    dome.position.set(cx, y + 14, cz);
    this.root.add(dome);
    // the two telescope domes on the wings
    for (const sx of [-1, 1]) {
      const wx = cx + sx * 33;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 5, 20), white);
      drum.position.set(wx, y + 12.5, cz);
      this.root.add(drum);
      const d = new THREE.Mesh(new THREE.SphereGeometry(6.6, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), copper);
      d.position.set(wx, y + 15, cz);
      this.root.add(d);
      const slit = this.box(1.2, 0.2, 6.6, dark, wx, y + 21.4, cz, { collide: false });
      slit.rotation.x = 0;
    }
    // front entrance (north side, facing the lawn)
    for (let i = -2; i <= 2; i++) this.box(1, 8, 1, white, cx + i * 3.2, y + 4, cz - 12.6);
    const door = this.box(4, 3.4, 0.2, this.mat({ color: 0x3a3028 }), cx, y + 1.7, cz - 12.1, { collide: false });
    this.addInteractable(door, { prompt: 'Go inside to the planetarium show', action: () => this.game.changeScene('Planetarium', 'seat') });
    this.addSpawn('door', [cx, y + 0.1, cz - 16], 0);
    // terrace railings and coin telescopes on the city side (south)
    // a thin rail on posts (you can see the city through it)
    const railMat = this.mat({ color: 0xe0d8c8 });
    this.box(100, 0.08, 0.08, railMat, cx, y + 0.95, cz + 34, { collide: false });
    this.box(100, 0.06, 0.06, railMat, cx, y + 0.5, cz + 34, { collide: false });
    for (let px = -50; px <= 50; px += 2.5) this.box(0.06, 0.95, 0.06, railMat, cx + px, y + 0.47, cz + 34, { collide: false });
    this.addColliderBox(cx, y + 0.6, cz + 34, 100, 1.2, 0.3);
    for (const sx of [-30, -10, 10, 30]) {
      const t = this.place('coin_telescope', { x: cx + sx, y: y, z: cz + 32, rotY: Math.PI });
      this.addInteractable(t, {
        prompt: 'Look through the telescope (25¢)',
        range: 2.2,
        action: () => {
          const g = this.game;
          g.audio.oneShot('register', { volume: 0.3 });
          const at = t.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.4, 0));
          g.enterFocus({ position: at, target: at.clone().add(new THREE.Vector3(Math.sin(sx) * 0.2, -0.12, 1)), fov: 14, hint: 'E step back' });
        },
      });
    }
    this.addLight({ position: [cx, y + 6, cz - 16], color: 0xfff0d8, range: 22, intensity: 1.2 });
    this.addLight({ position: [cx, y + 4, cz + 26], color: 0xfff0d8, range: 26, intensity: 0.9 });
    // dome glow at night
    this.domeGlow = this.addLight({ position: [cx, y + 22, cz], color: 0x9ad8c8, range: 30, intensity: 0.5 });
  }

  #monument(x, z) {
    const y = this.groundHeight(x, z);
    const stone = this.mat({ color: 0xd8d0c0 });
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 12, 4), stone);
    ob.position.set(x, y + 6, z);
    ob.rotation.y = Math.PI / 4;
    this.root.add(ob);
    this.box(4.5, 1.2, 4.5, stone, x, y + 0.6, z);
    // six astronomers around the base
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 3, 6), this.mat({ color: 0x8a8a78 }));
      f.position.set(x + Math.cos(a) * 1.7, y + 2.0, z + Math.sin(a) * 1.7);
      this.root.add(f);
    }
    const plaque = this.signPost(x + 3, z + 3, ['ASTRONOMERS MONUMENT'], 0, { bg: '#4a4038', fg: '#e8d8b0', w: 2.2, h: 0.5, y0: 1 });
    this.memoryNote(plaque, 'Read the plaque', 'Six astronomers who looked up and wondered: Hipparchus, Copernicus, Galileo, Kepler, Newton, Herschel.\n\nThey all started the same way you did:\na kid, at night, looking up.');
  }

  /** Los Angeles below: day haze or a sea of lights. */
  #city(cx, y, cz) {
    const night = this.mat({ map: cityLights(), unlit: true, fogScale: 0, depthWrite: true });
    const day = this.mat({ map: cityDay(), fogScale: 0.15 });
    const geo = new THREE.PlaneGeometry(60000, 30000);
    geo.rotateX(-Math.PI / 2);
    this.cityDay = new THREE.Mesh(geo, day);
    this.cityDay.position.set(cx, 110, cz + 15500);
    this.root.add(this.cityDay);
    // at night: tens of thousands of lights along a street grid, out to the horizon
    const N = 26000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const z = cz + 600 + Math.pow(Math.random(), 1.6) * 26000;
      const spread = 4000 + (z - cz) * 0.9;
      let x = cx + (Math.random() - 0.5) * spread * 2;
      let zz = z;
      // snap most lights onto streets (every 160 m both ways)
      if (Math.random() < 0.8) {
        if (Math.random() < 0.5) x = Math.round(x / 160) * 160;
        else zz = Math.round(zz / 160) * 160;
      }
      pos.set([x, 112, zz], i * 3);
      const r = Math.random();
      c.setHex(r < 0.62 ? 0xffb050 : r < 0.85 ? 0xfff0c8 : r < 0.95 ? 0xffffff : 0xff5040);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.cityNight = new THREE.Points(pg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true }));
    this.cityNight.frustumCulled = false;
    this.root.add(this.cityNight);
    // the dark ground under the lights
    const ground = new THREE.Mesh(geo, this.mat({ color: 0x0a0a10, fogScale: 0 }));
    ground.position.set(cx, 108, cz + 15500);
    this.root.add(ground);
    this.cityGround = ground;
    void night;
    // downtown's towers, far southeast
    const towers = this.mat({ map: towerTex(), fogScale: 0.1, unlit: true });
    for (let i = 0; i < 14; i++) {
      const h = 80 + ((i * 47) % 140);
      const t = this.box(30 + (i % 3) * 10, h, 30, towers, cx + 6500 + (i % 5) * 60 - 120, 110 + h / 2, cz + 9000 + Math.floor(i / 5) * 70, { collide: false });
      void t;
    }
  }

  #hollywood() {
    const o = this.data.origin;
    const MX = 111320 * Math.cos((o.lat * Math.PI) / 180);
    const x = (-118.3215 - o.lon) * MX;
    const z = -(34.1341 - o.lat) * 110540;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(900, 360, 10), this.mat({ color: 0x6a6a48, fogScale: 0.12 }));
    hill.position.set(x, 160 + 180, z);
    this.root.add(hill);
    const letters = this.mat({ color: 0xf8f8f8, fogScale: 0.06 });
    const word = 'HOLLYWOOD';
    // facing south-east toward the city (and us)
    const g = new THREE.Group();
    g.position.set(x + 260, 420, z + 520);
    g.rotation.y = -0.45;
    for (let i = 0; i < word.length; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(11, 14, 1), letters);
      l.position.set((i - 4) * 14, 0, 0);
      g.add(l);
    }
    this.root.add(g);
  }

  update(dt, time) {
    super.update(dt, time);
    const day = this.game.dayNight.isDaylight;
    if (this.cityNight) {
      this.cityNight.visible = !day;
      this.cityGround.visible = !day;
      this.cityDay.visible = day;
    }
    if (this.domeGlow) this.domeGlow.enabled = !day;
  }
}

function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...rep);
  return t;
}

function cityLights() {
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = '#05060c';
      g.fillRect(0, 0, 256, 256);
      // the street grid: orange sodium lights in lines
      for (let i = 0; i < 256; i += 8) {
        for (let j = 0; j < 256; j += 2) {
          if (Math.random() < 0.55) {
            g.fillStyle = Math.random() < 0.8 ? '#ffb050' : '#fff0c0';
            g.fillRect(i, j, 1, 1);
            g.fillRect(j, i, 1, 1);
          }
        }
      }
      for (let k = 0; k < 900; k++) {
        g.fillStyle = ['#ffd080', '#ffffff', '#ff8040', '#80c0ff'][k % 4];
        g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
      }
    },
    [60, 30],
  );
}

function cityDay() {
  return canvasTex(
    128,
    128,
    (g) => {
      g.fillStyle = '#a8a090';
      g.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 600; k++) {
        g.fillStyle = ['#c8c0b0', '#8a8678', '#b8b0a0', '#7a8a6a'][k % 4];
        g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 4);
      }
      g.fillStyle = '#9a9488';
      for (let i = 0; i < 128; i += 8) {
        g.fillRect(i, 0, 1, 128);
        g.fillRect(0, i, 128, 1);
      }
    },
    [120, 60],
  );
}

function towerTex() {
  return canvasTex(16, 32, (g) => {
    g.fillStyle = '#1a2030';
    g.fillRect(0, 0, 16, 32);
    for (let y = 1; y < 32; y += 2) for (let x = 1; x < 16; x += 2) if (Math.random() < 0.5) {
      g.fillStyle = '#ffe8a0';
      g.fillRect(x, y, 1, 1);
    }
  }, [2, 6]);
}
