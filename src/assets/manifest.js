/**
 * Asset manifest
 * --------------
 * Every model in /src/assets/models is loaded automatically and keyed by its
 * filename (`microwave.glb` → 'microwave'). This table only adds *sizing*:
 * whatever scale the source file uses, the loader rescales it so that
 *
 *   { height: h }  the model is h metres tall
 *   { length: l }  its longest horizontal side is l metres
 *
 * and re-pivots it to sit on y = 0, centred on X/Z. `rotateY` (radians)
 * spins a model that faces the wrong way — game convention is facing +Z.
 *
 * Models not listed here load at their native scale. If a file is missing,
 * scenes fall back to a procedural stand-in (see scenes/Props.js).
 *
 * The bundled models came from CC0 packs — see README "Assets" for sources
 * and tools/blender_export.py for how they were converted.
 */
export const MODELS = {
  // --- House (Kenney Furniture Kit) -----------------------------------------
  microwave: { fit: { length: 0.52 } },
  fridge: { fit: { height: 1.85 } },
  kitchen_cabinet: { fit: { height: 0.9 } },
  kitchen_sink: { fit: { height: 0.9 } },
  kitchen_upper: { fit: { length: 0.62 } },
  crt_tv: { fit: { length: 0.62 } },
  tv_cabinet: { fit: { length: 1.2 } },
  bed: { fit: { length: 2.1 } },
  lamp_floor: { fit: { height: 1.6 } },
  desk: { fit: { length: 1.4 } },
  chair: { fit: { height: 1.0 } },
  couch: { fit: { length: 2.0 } },
  speaker: { fit: { height: 0.9 } },
  rug: { fit: { length: 2.6 } },
  trashcan: { fit: { height: 0.45 } },
  plant: { fit: { height: 1.0 } },
  bookcase: { fit: { length: 1.2 } },
  books: { fit: { length: 0.3 } },
  side_table: { fit: { height: 0.55 } },
  cardboard_box: { fit: { length: 0.55 } },

  // --- Store (Kenney Mini Market) ---------------------------------------------
  shelf_boxes: { fit: { height: 1.8 } },
  shelf_bags: { fit: { height: 1.8 } },
  shelf_end: { fit: { height: 1.8 } },
  freezer_chest: { fit: { height: 0.95 } },
  freezers_standing: { fit: { height: 2.1 } },
  cash_register: { fit: { length: 0.55 } },
  clerk: { fit: { height: 1.7 } },
  shopping_cart: { fit: { height: 1.05 } },
  basket: { fit: { length: 0.5 } },
  display_fruit: { fit: { height: 1.1 } },
  display_bread: { fit: { height: 1.5 } },
  bottle_return: { fit: { height: 1.8 } },
  column: { fit: { height: 3.2 } },

  // --- Food / props (Kenney Food Kit) ------------------------------------------
  pizza: { fit: { length: 0.26 } },
  pizza_box: { fit: { length: 0.45 } },
  soda_can: { fit: { height: 0.12 } },
  beer_bottle: { fit: { height: 0.25 } },
  chips_bag: { fit: { height: 0.26 } },

  // --- Nature (Kenney Nature Kit) ------------------------------------------------
  tree_pine: { fit: { height: 8 } },
  tree_pine2: { fit: { height: 7 } },
  tree_oak: { fit: { height: 6 } },
  rock: { fit: { length: 1.8 } },
  rock2: { fit: { length: 1.4 } },
  log: { fit: { length: 2.4 } },
  stump: { fit: { height: 0.6 } },
  bush: { fit: { height: 1.1 } },
  grass: { fit: { height: 0.45 } },
  campfire: { fit: { length: 1.0 } },
  tent: { fit: { length: 2.4 } },
  fence: { fit: { length: 2.0 } },

  // --- Lighthouse interior (Kenney Furniture Kit) ------------------------------------
  lounge_chair: { fit: { height: 1.0 } },
  radio: { fit: { length: 0.45 } },
  coffee_table: { fit: { length: 1.1 } },
  rug_round: { fit: { length: 2.6 } },
  lamp_table: { fit: { height: 0.6 } },
  bookcase_closed: { fit: { height: 1.9 } },
  stove: { fit: { height: 0.95 } },
  coat_rack: { fit: { height: 1.8 } },

  // --- User-supplied (Sketchfab, CC-BY / CC-BY-NC — see README credits) ----------
  beer_can: { fit: { height: 0.12 } },
  pizza_whole: { fit: { length: 0.32 } },
  cigarette_pack: { fit: { height: 0.09 } },
  bike: { fit: { length: 2.2 } },
  jetski: { fit: { length: 3.1 } },
  shotgun: { fit: { length: 1.25 } }, // muzzle at +Z (Sketchfab Standard licence)
  deer: { fit: { height: 1.75 }, rotateY: -Math.PI / 2 }, // CC-BY 4.0, pighunt3r15
  bong: { fit: { height: 0.45 } },
  train: {}, // native metres: 2 cars, 54 m, along Z
  skateboard: { fit: { length: 0.82 }, rotateX: -Math.PI / 2, rotateZ: -Math.PI / 2 }, // modelled standing on its tail, on its side
  telescope: { fit: { height: 1.55 } },
  // --- Pets, birds, Ray, ships, the mine (Quaternius CC0 · Kay Lousberg CC0 · Alex Safayan CC-BY 3.0) ---
  dog_shiba: { fit: { height: 0.62 } },
  dog_husky: { fit: { height: 0.78 } },
  cat: { fit: { height: 0.36 } },
  pigeon: { fit: { height: 0.3 } },
  bat: { fit: { length: 0.55 } },
  ray: { fit: { height: 1.74 } },
  cruise_ship: { fit: { length: 150 } },
  container_ship: { fit: { length: 170 } },
  sail_ship: { fit: { length: 42 } },
  pickaxe: { fit: { length: 0.75 } },
  minecart: { fit: { length: 1.4 } },
  lantern: { fit: { height: 0.42 } },
  // --- California memories (Quaternius, Kenney, CreativeTrio: CC0 · Poly by Google, Zsky, J-Toastie, sirkitree, Jarlan Perez, jeremy, elkiotbear, Don Carson, Emmett Baber: CC-BY 3.0) ---
  kid: { fit: { height: 1.32 } }, // a ~9-year-old; head enlarged in code
  bus: { fit: { length: 12 }, rotateY: Math.PI / 2 },
  bus_stop_shelter: { fit: { length: 3.6 } },
  play_structure: { fit: { length: 9 } },
  swing_set: { fit: { height: 2.4 } },
  slide: { fit: { height: 2.2 } },
  merry_go_round: { fit: { length: 2.6 } },
  chicken: { fit: { height: 0.42 } },
  pig: { fit: { length: 1.2 } },
  goat: { fit: { height: 0.85 } },
  snake: { fit: { length: 0.9 } },
  snake_corn: { fit: { length: 1.1 } },
  sea_lion: { fit: { length: 2.0 } },
  harbor_seal: { fit: { length: 1.5 } },
  cake: { fit: { length: 0.32 } },
  balloons: { fit: { height: 1.6 } },
  picnic_table: { fit: { length: 1.9 } },
  mailbox_us: { fit: { height: 1.15 } },
  coin_telescope: { fit: { height: 1.5 } },
  // --- Buckshot roulette (J-Toastie, Poly by Google, jeremy, codedeck, Gabriel Valdivia, Jarlan Perez: CC-BY 3.0 · Quaternius, MaverickFX: CC0) ---
  br_gun: { fit: { length: 0.92 } }, // split into Body / Forend / Barrel (tools/br_export.py)
  br_bulb: { fit: { height: 0.8 } },
  br_ashtray: { fit: { length: 0.13 } },
  // --- Townspeople (Quaternius CC0) ---
  npc_woman1: { fit: { height: 1.68 } },
  npc_woman2: { fit: { height: 1.62 } },
  npc_woman3: { fit: { height: 1.7 } },
  npc_woman4: { fit: { height: 1.58 } },
  npc_man: { fit: { height: 1.8 } },
  npc_dress: { fit: { height: 1.66 } },
  npc_casual: { fit: { height: 1.74 } },
  npc_hoodie: { fit: { height: 1.74 } },
  npc_worker: { fit: { height: 1.82 } },
  npc_human: { fit: { height: 1.86 } },
  // --- Under the sea ---
  sea_clownfish: { fit: { length: 0.32 } },
  sea_zebrafish: { fit: { length: 0.34 } },
  sea_mandarin: { fit: { length: 0.24 } },
  sea_butterflyfish: { fit: { length: 0.3 } },
  sea_tang: { fit: { length: 0.34 } },
  sea_whale: { fit: { length: 14 } },
  sea_manta: { fit: { length: 4.2 } },
  sea_dolphin: { fit: { length: 2.4 } },
  sea_turtle: { fit: { length: 1.3 } },
  sea_jelly: { fit: { height: 0.7 } },
  sea_octopus: { fit: { length: 1.4 } },
  sea_seahorse: { fit: { height: 0.25 } },
  sea_starfish: { fit: { length: 0.32 } },
  sea_crab: { fit: { length: 0.36 } },
  sea_urchin: { fit: { length: 0.24 } },
  sea_shell: { fit: { length: 0.2 } },
  sea_coral: { fit: { height: 1.3 } },
  sea_coral2: { fit: { height: 2.6 } },
  sea_kelp: { fit: { height: 1.0 } },
  sea_reef: { fit: { length: 7 } },
  sea_wreck: { fit: { length: 34 } },
  sea_chest: { fit: { length: 1.1 } },
  // Stylized WW1 plane (supplied by the user)
  plane: { fit: { length: 8.5 } },
  // native metres; an interior built with inward-facing walls and soft alpha:
  // keep both faces, no alpha cut-out, no affine swim on the big wall polys
  char_girl: { fit: { height: 1.65 } },
  drum_kit: { fit: { length: 1.7 } }, // CC-BY 3.0 smoj (Poly Pizza)
  guitar: { fit: { height: 1.0 } }, // CC-BY 3.0 Dave (Poly Pizza)
  piano: { fit: { length: 1.55 } }, // CC-BY 3.0 jeremy (Poly Pizza)
  mic_stand: { fit: { height: 1.55 } }, // CC-BY 3.0 Poly by Google
  diner: { psx: { doubleSide: true, alphaTest: 0, affine: 0 } },

  // --- Poly by Google via Poly Pizza (CC-BY 3.0) ---------------------------------
  lighthouse: { fit: { height: 22 } },
  fishing_boat: { fit: { length: 9 } },

  // --- Quaternius (Poly Pizza) -------------------------------------------------------
  pickup_truck: { fit: { length: 5.2 }, rotateY: 0 },
  fishing_rod: { fit: { height: 2.0 } }, // modelled upright, tip at +Y
  fish: { fit: { length: 0.45 } },
};

/**
 * Textures (PNG/JPG). Keep them tiny (32–128 px) for the PS1 look; they're
 * forced to nearest filtering. Missing ones are generated procedurally.
 */
export const TEXTURES = {
  wood_floor: 'wood_floor.png',
  checker_tiles: 'checker_tiles.png',
  wall: 'wall.png',
  ceiling: 'ceiling.png',
  asphalt: 'asphalt.png',
  grass: 'grass.png',
  dirt: 'dirt.png',
  water: 'water.png',
  planks: 'planks.png',
  siding: 'siding.png',
  counter_tile: 'counter_tile.png',
  store_floor: 'store_floor.png',
  store_wall: 'store_wall.png',
  road: 'road.png',
  brick: 'brick.png',
  fabric: 'fabric.png',
  bark: 'bark.png',
  pine: 'pine.png',
  rock: 'rock.png',
};

/**
 * Audio (OGG/MP3/WAV, any of those extensions works — matched by basename).
 * Missing ones are synthesised with WebAudio so there's always *some* sound.
 */
export const AUDIO = {
  fluorescent_hum: 'fluorescent_hum',
  truck_engine: 'truck_engine',
  water_lapping: 'water_lapping',
  night_ambience: 'night_ambience',
  microwave_hum: 'microwave_hum',
  microwave_beep: 'microwave_beep',
  door: 'door',
  fridge_open: 'fridge_open',
  footstep_1: 'footstep_1',
  footstep_2: 'footstep_2',
  footstep_3: 'footstep_3',
  footstep_4: 'footstep_4',
  reel: 'reel',
  splash: 'splash',
  line_snap: 'line_snap',
  can_open: 'can_open',
  gulp: 'gulp',
  lighter: 'lighter',
  inhale: 'inhale',
  register: 'register',
  bite: 'bite',
  blip: 'blip',
  campfire: 'campfire',
  radio: 'radio', // drop any lo-fi track named radio.ogg/mp3 for the stereo
};
