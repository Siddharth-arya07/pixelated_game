# 3:00 a.m.

A first-person, PS1-style night game in Three.js with its own PSX renderer: 240 lines upscaled with nearest-neighbour, vertex snapping, affine texture warp, Gouraud lighting, 15-bit Bayer dither, and fog that never lifts.

It's 3:00 a.m. and you can't sleep. Check your email, put a tape on, heat a slice. Then take the old truck (slowly) up the mountain to the Quik Mart, or the coast road to the harbor, where the jet ski and the trawler are tied up. Ray left the lighthouse door unlocked. The good chair faces the TV.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 and click to start. Click again if the mouse is released. The title/pause card has a **graphics preset**, a **mouse sensitivity** slider and a **retro wobble** slider; all are saved in your browser.

- **PS1** (default): 240 lines, vertex snapping and affine texture warp, nearest-neighbour textures, 15-bit color with heavy dither.
- **PS2**: 448 lines, no wobble, smoothly filtered and mipmapped textures, 24-bit color, light dither, and the fog pushed back about 30%.

### On a phone or tablet

Touch controls switch on automatically. Play in landscape.
- **Moving:** a joystick appears wherever you touch the left side. Push it to the edge to run. It also steers vehicles.
- **Looking:** drag on the right side to look. Tap there to interact (or click on the laptop).
- **Buttons:** a few buttons appear only when they're useful: USE, the Q action, FIRE/DRAG, AIM, RELOAD/ASH, TOSS, JUMP/BRAKE.
- **Top bar:** BAG, MAP, LIGHTS/TORCH, RADIO, and ☰ (pause, or ✕ to close a menu).

### Deploy (Cloudflare Pages)

`npm run site:deploy` builds and publishes to https://three-am-nostalgia.pages.dev. The site is public; multiplayer connects through the site (`/parties/*` → the rooms worker, which has no public URL of its own). See `cloudflare/pages/`.

### Deploy (Netlify, old)

`netlify.toml` is included: build command `npm run build`, publish folder `dist`. The site root is rewritten to the built `src/ui/index.html`. Either:
- connect the folder or repo in the Netlify UI, or
- drag `dist/` onto app.netlify.com/drop. The build already includes the `_redirects` file it needs.

## Multiplayer (up to 4)

On the title card, enter a name (everyone plays as mia's character). Then choose one:
- **play alone**
- **host a room**, which gives you a 4-letter code and an invite link like `…/?room=FQAJ`
- **join** with a code

**What's shared:**
- **Players:** you see each other walk, run, sit, ride, lie on the roof, skate, smoke (the ember glows), hold the shotgun and point flashlights.
- **Voice:** **always on**, in 3D from each player's head. It fades with distance, is silent across scenes, and is clear inside the same vehicle. **V** mutes you, and a ♪ by a name means they're talking.
- **Rides:** E on a friend's vehicle = **Ride along**. Seats: truck (passenger + 2 in the bed), bike (back seat), boat (3 on deck), jet ski (1 behind). E hops off once it's stopped.
- **The host runs the night:** time, storms (same lightning, same thunder), the train and crossing, the drive-in programme (watch the same frame together) and the deer. Anyone can shoot a deer, and the host settles it. If the host leaves, the next player takes over.
- **Edits:** sandbox digs, castles and writing; the garden; the fridge; TVs; shared music devices (stereo, jukebox, radios, truck radio); and hung paintings.
- **Private to you:** inventory, money, hunger, journal, Walkman, being high or drunk, the map.
- **Social:** **1** wave · **2** point · **3** sit · **4** lie down. E on a friend gives them what's in your hands, or food, smokes or a flower.
- **Map:** friends show as blue dots.

**Running it:**
- **Locally:** run `npm run rooms` (the Cloudflare room server, port 1999) next to `npm run dev`.
- **Online:** deploy the room server (Cloudflare Worker + Durable Objects) once with `npx wrangler login` then `npm run rooms:deploy`. Put the host it prints in `VITE_ROOMS_HOST` (or edit `src/net/Net.js`), then rebuild and redeploy the site.
- **Voice relay (optional):** for networks that block peer-to-peer voice, set `VITE_TURN_URL`, `VITE_TURN_USER` and `VITE_TURN_PASS` to a TURN relay.

**Character:** mia's model (rigged), animated in code on top of her idle clip. The guy character was removed because his model has no rig.

## Controls

| On foot | | Driving (always first person) | |
|---|---|---|---|
| WASD / Shift | move / run | W / S | throttle / brake + reverse |
| Mouse | look | A / D | steer |
| E / click | interact (E on nothing while seated = stand) | Space | handbrake |
| Q | secondary action (TV off, radio off…) | F | headlights (land) |
| I / M | inventory (Use / Equip / Drop) / fold-out map | Mouse | look around the cab |
| L | flashlight (if equipped) | E | get out (boats: only at the dock) |

**Hunger**: the FOOD bar (top right) empties over about 15 minutes, faster if you sprint.
- **Warnings:** at a third your stomach growls. Below 15% you get weak (slow, the world swims). At empty you have 90 seconds to eat.
- **Passing out:** if you don't eat in time you wake at home the next night at 3:00 a.m., minus a quarter of your cash and anything perishable.
- **Food:** pizza (hot is better), noodles, chips, candy, cooked venison and cooked fish. The microwave cooks venison and fish. Raw venison works too, but it makes you queasy.
- **Fridge:** restocks every night.

**Selling**: **Harbor Fish Co.**, the shack at the harbor, buys all your fish and venison through its night window (E), paying 25% more than the Quik Mart clerk. Q shows the prices.

**Walkman** (P): your own cassette player. Music goes to your headphones and follows you everywhere.
- **The mixtape:** "3 a.m. mix". The player doesn't ship with these recordings. Press **+ load songs** (or drop files on the player) to add the MP3s you own. They're kept in this browser only and never uploaded with the game. Matching files fill their slot automatically:
  - Motion Picture Soundtrack (Radiohead)
  - Shine On You Crazy Diamond (Pink Floyd)
  - Need 2 (Pinegrove)
  - Wading in Waist-High Water (Fleet Foxes)
  - A Quick One Before the Eternal Worm Devours Connecticut (Have a Nice Life)
  - Smokestack Lightning (Howlin' Wolf)
  - The Chain (Fleetwood Mac)
- **Other files:** anything else you load goes after the mixtape. The built-in generative songs are on side B.
- **TAPE:** the retro cassette sound for all music: band-limited, warm saturation, wow and flutter, and hiss. Toggle it on the player.

**Journal** (J): a notebook for your own thoughts. Entries are stamped with the night, the in-game time, where you are and the real date. It autosaves on this device. "+ new page" starts an entry, "tear out page" deletes one.

**Garden**: two raised beds in front of the house.
- **Seeds:** Quik Mart, aisle 3: poppy, tulip, sunflower, and moonflower (opens only at night and glows).
- **Planting:** E plants the first kind you carry, Q a different kind.
- **Watering:** take the watering can by the porch and fill it at the spigot on the house wall. Rain waters everything.
- **Growing:** plants only grow while the soil is wet (dark soil = wet) and droop when it's dry. They bloom in about 10–14 minutes.
- **Picking:** pick a bloom and put it in the vase on the TV cabinet.

**Stargazing**: the sky is the real one.
- **What's in it:** about 150 of the brightest stars (real positions, magnitudes, distances, spectral types), constellation lines, and the Milky Way along the real galactic plane. The Moon shows its actual phase, and Mercury, Venus, Mars, Jupiter and Saturn sit where they really are.
- **When and where:** computed for today's date at the in-game time, seen from the New England coast (42.4° N).
- **Identifying things:** outside at night, click any star, planet or the Moon under the crosshair. Its details appear as plain white text.
- **Telescopes:** one on your **roof** (ladder on the east wall of the house, where you can lie back on a blanket) and one at the **scenic overlook** on the mountain by the Quik Mart. Scroll or Q zooms (3×, 8×, 22×) and fainter stars appear as you zoom. E steps back.
- **Visibility:** fainter field stars are decorative fill, not catalog stars. Daylight and storms hide the sky.

**The railway**: a line runs across the south of the map and crosses the town road at a level crossing with flashing lights, a bell and barriers.
- **The train:** it comes every two or three minutes, horn first.
- **Danger:** don't stand on the tracks.

**Starlite Drive-In** (south of the coast road): an abandoned drive-in whose projector still runs.
- **The screen:** 20 × 8.5 m, playing four original short films on a loop with intermissions:
  - *The Thing from Route 9* (1958, black and white)
  - *FOG* (1981)
  - *The Keeper's Daughter* (1946, Technicolor)
  - the cartoon *Midnight Snack*
- **Lot:** the screen's light washes over the lot, and the soundtrack comes from the speaker posts. Park the truck facing the screen or take a lawn chair. The snack bar sells popcorn.

**Seaview Diner** (north of the coast road): a chrome diner with a neon sign. Inside, order at the counter (coffee, pancakes, burger, pie, a strawberry milkshake), pick songs on the jukebox, or sit at a table.

**Cooking**: the stove in the kitchen.
- **Recipes:** fried eggs, toast, French toast, egg fried rice, noodle stir-fry, fish & rice, venison steak. Buy eggs, rice and bread at the Quik Mart.
- **Cooking:** pick a recipe (Q switches), then take it off the heat (E) when the bar is in the golden zone.
- **Results:** perfect gives two servings, too early is raw, and too late burns.

**Skateboard**: by the porch.
- **Controls:** W pushes (kick by kick), A/D carves, Space pops an ollie.
- **Ground:** fast on asphalt, a slog on grass and gravel.

**Painting**: the easel by the window (E).
- **Tools:**
  - BRUSH paints bristle strokes. They run dry over a long stroke (lift to reload) and pick up the wet paint under them.
  - KNIFE smears the paint that's there.
  - BLEND softens edges.
- **Paint:** 14 oil colours, MIX to blend a colour into the current one, or any colour from the picker.
- **Finishing:** undo, a fresh canvas, and hanging your painting in any of the three frames in the house.
- **The walls:** three procedural oil paintings (Lighthouse in a Storm; Sunflowers, 3 a.m.; Starry Night over Route 9). E on one to look closer.

**Bong**: by the couch. Take a gram from the stash tin on the bookcase (3 a night) and you need a lighter.
- **The hit:** lean in, light it, a long bubbling pull, then a big cloud (and sometimes a coughing fit).
- **Effects:** being high warms and saturates the colours, drifts the hue and fringes the edges. It also gives you the munchies (hunger drains faster) and wears off over a few minutes.

**Smoking** (Use a pack, you need a lighter): you light up with a Zippo. **Hold LMB** to drag (the ember flares and lights your face), then release to exhale. **R** flicks the ash, **G** tosses it. It burns down by itself, faster while you drag. Works walking, sitting, or driving.

**Hunting**:
- **Getting the gun:** grandpa's Beretta hangs over the front door at home. Equip it from the inventory. Buy more shells at the Quik Mart, aisle 3.
- **Shooting:** LMB fires, RMB aims down the sights, and R loads one shell at a time (4+1). Pellets spread, lose damage with range, and trees and terrain block them. Headshots do triple damage.
- **Deer:** herds live on the mountain flanks and in the western woods. They notice you at about 16 m (further if you sprint or drive), stare, then bolt and warn the herd, and a gunshot scatters everything within 140 m.
- **After the kill:** field-dress a kill (E) for venison. Sell it at the register or microwave it. Vehicles don't stop for deer.
- **Indoors:** you can't fire inside.

**Pine Hollow Park** (south of the town road, west of the house):
- **Sandbox:** the sand really deforms and slumps.
  - **Digging:** hold E. The sand sprays into a pile beside the hole, and loose walls cave in.
  - **Castles:** Q pats down a bucket castle (stack them for towers). Packed sand stands up; loose sand slides to its natural slope.
  - **Drawing:** hold LMB to write in the sand with your finger.
  - **Raking:** R rakes an area smooth.
  - **Rain and feet:** footprints follow you, walking through a castle knocks it down, and rain wets the sand (it holds steeper) then slowly melts everything.
- **Swings:** sit with E, then press W in time with the swing to go higher. The chains creak.
- **Also there:** a slide (E at the ladder), a seesaw, a bench you can sit and smoke on, and a flickering lamp.

**Thunderstorms**: they roll in off the sea every few minutes and pass again.
- **Outside:** rain and wind, the fog closes in, and the sea gets rough, so the boat and jet ski feel it. Roads get slippery.
- **Lightning:** the world flashes, with bolts over the hills and thunder that arrives later the further away it struck. Indoors you see the flashes through the windows and hear the rain drumming, muffled.
- **Setting:** the title/pause card has a **weather** option: storms come and go, always storming, or no storms.

**The lighthouse**: the door is up the stone steps on the south side. Inside, E at the spiral stair climbs to the **gallery** 15 m up. Walk around the rail with the lamp turning over your head, or sit on the crate facing the sea and smoke. E at the lantern-room wall climbs back down.

**The truck cab**:
- **Dash:** a backlit amber gauge cluster (speedometer, fuel, temp, high-beam and brake lights), a column shifter and a three-spoke wheel.
- **Radio:** a cassette radio. Q turns it on or off, N skips track, and the display shows the song.
- **Mirror:** a rear-view mirror with a pine-tree air freshener that swings when you brake and corner.
- **Rain:** in storms, drops collect on the windshield and the wipers clear them.

**Drinking / eating**: first-person animations. Beer stacks a drunk effect (double vision, wavy screen, rolling horizon, you drift when walking) that wears off over a few minutes. It's screen-space only, so the world never deforms.

**Laptop** (E): the camera leans in and the render switches to 480 lines so text is readable. The mouse moves a cursor. Apps:
- **Mail**: the inbox; some emails have video attachments.
- **Videos**: built-in VHS tapes, plus any `.mp4`/`.webm` you drop in `src/assets/videos/`.
- **Music**: Winamp-style player.
- **DINO.EXE**: SPACE to jump.

E gets up.

**Music**: one player is shared by the laptop, the house stereo and the lighthouse radio. Sound comes from whichever device you used.
- **Built in:** 5 generative songs synthesised live (lo-fi, ambient, synthwave, late-night jazz).
- **Your own files:** drop `.mp3`/`.ogg`/`.wav` files into `src/assets/music/` to add them.
- **Device controls:** E plays or skips to the next track, Q turns it off.

**TV**: E changes channel (news, infomercial, aquarium, home video, static… and a tape at the lighthouse you probably shouldn't watch), Q turns it off. Sit on the couch or in Ray's chair to watch and smoke.

**Fishing**: equip the rod. Look at the lake or the sea (from the pier) and press E. Hold the mouse button and release to cast; click when it bites, then hold to reel and release to ease the tension.

## New places & things

- **Pine Hollow Airfield** (east of the drive-in): the biplane. SHIFT/CTRL throttle, W/S nose up/down, F flares, A/D bank, SPACE brakes, E get out on the ground. Land too hard (or in the sea) and it gets towed back. Friends can ride in the back seat.
- **The old silver mine** (foot of the mountain): two levels, minecart line, cage lift, a crystal grotto with an underground lake. Take the old pickaxe and helmet at the entrance, LMB veins to mine, sell ore to Old Pete (+25%). Better picks break harder rock. Find Walt's five journal pages.
- **Pets**: a shiba (behind your house), a husky (harbor), two cats (diner, lighthouse). Feed them three times (dogs: meat/burgers/pizza, cats: fish) to tame and name them. E pet, Q stay/come.
- **Birds**: gulls round the harbor and lighthouse, crows over the fields, swallows by day, pigeons that scatter.
- **Ray** at the bottom of the lighthouse tells you a story a night (12 of them). The gallery telescope looks out at the ships in the shipping lane.

- **Seasons** turn every two in-game days (starting from the real one): winter snow, a frozen lake to skate on and a sled on the porch; spring blossom; summer fireflies; autumn leaves.
- **WPHR 3AM**: go on air at Ray's radio desk in the lighthouse — your instruments and mic reach everyone tuned in (music playing or in a vehicle).
- **Beach bonfire** south of the harbor: logs to sit on, marshmallow roasting, and Ray on even nights.
- **Biplane extras**: R smoke, G care-package drop, B towed banner, F flares.
- **Mine level 3**: repair the old train (valve in the gold room, chain from Pete, 5 coal), ride to the underground falls, dig fossils for the cabinet at home.
- **Pets**: T throw a stick (dogs fetch), Z teach sit; cats leave gifts on the doorstep. Untamed strays show as paw prints on the map.
- **Backyard patio** beside the house: arcade cabinets, beer pong, darts, the chug-off, free cooler, a shared Hall of Fame.
- **Balloon rides** at dawn (5–8 a.m.) from the east end of the airfield; friends can ride in the same basket.

- **Stardust Lanes** (bowling, just off the town road): 5 frames on lane 1 — A/D aim, Z/C hook, hold SPACE. Scores go on the patio Hall of Fame.
- **Camping**: buy a tent (Quik Mart), use it outside; sleep in it for a starry dream and a misty dawn.
- **Funland** (west of town): fix the generator (fuse from the register, grease from the outdoor aisle, pull the cord 3×) and ride the Ferris wheel.
- **Treehouse** behind your house: build it in 6 stages with planks (lumber pile, or bundles from the Quik Mart); leave notes on the corkboard (Q).
- **Fishing**: sea fish off the beach/pier, night-only and rare fish, C to fish from the stopped boat (the Lighthouse Leviathan lives out there), and a fish tank at home.
- **Phone (O)**: text friends, call Ray or Dolores (pizza delivery), weather, moon phase, calendar (preview holidays), pets.
- **Holidays** by the real date: Halloween (pumpkins, trick-or-treat at the neighbours), Christmas (lights, tree, presents, white Christmas), New Year's Eve (midnight fireworks over the harbor).

- **The people of Pine Hollow**: ten residents with routines (Doug & Pepper, Mrs. Ortega, the Okafor twins, Officer Pete, Joyce, June, Lou, Marguerite, Nova). Talk daily, give gifts, help with their favours; friendship hearts in the phone's People app. They show on the map.
- **Diving**: gear from the dive shop at the harbor, then the pier ladder (or X from the stopped boat). Shallows, kelp forest, coral reef, the wreck of the Margaret Rose, an air-pocket cave, the deep trench with mantas, jellies and a singing whale. Hold F to fill your Sea Log. No monsters.

## The map

1 km², always foggy:

```
            peaks
   ┌──────────────────────────┐
   │   Quik Mart (summit ~110m)│
   │   gravel switchbacks       │       sea →
   │   paved switchbacks        │   lighthouse (cliff)
   │        valley road         │      gravel climb
lake ← town ─ house ── junction ── coast road ── harbor: pier, boat, jet ski
   └──────────────────────────┘
```

- **Your house**: truck and bike in the driveway.
- **The mountain road**: 700 m of switchbacks at ~15% (up to 17% on the gravel), with guardrails only on the lower curves. The truck tops out around 27 mph on the flat and crawls up the gravel at walking pace. Stop on a steep bit and it rolls back. Off the road it slides down. The bike is quicker but loses grip on gravel.
- **The harbor**: the fishing trawler and the jet ski bob on real waves (the same wave function drives the water shader and their buoyancy). The jet ski leaves the water off crests and leaves a wake. You can only get off at the pier.
- **The lighthouse**: its beam sweeps through the fog and you'll hear the foghorn across the bay. Inside is Ray's room with the radio, TV, chair, stove and a note, and the stair to the gallery up top.
- **Pine Hollow Park**: the playground with the sandbox, swings and slide.

Press **M** for the fold-out map.
- **Mirror Lake**: the road west, with a campfire and the dock.

## Project structure

```
src/
  main.js · config.js
  core/       Game (loop, scenes, focus mode, settings) · Renderer (PSX pipeline + post)
              InputManager · AssetLoader · AudioManager (+ synth fallbacks) · Procedural · Tween
  render/     PSXMaterial (our PS1 shader) · Water (shared wave field)
  world/      MapLayout (POIs + road control points) · Terrain (heightfield, road carving, surfaces)
  vehicles/   Vehicle (base, FPV camera) · GroundVehicle (truck, bike) · Watercraft (boat, jet ski)
  net/        Net (room socket) · Multiplayer (sync, rides, gifts) · Avatar · Voice (WebRTC)
  systems/    Stargazing · CookingSystem · HungerSystem (food) · MusicSystem (+ tape FX, your files) · · WeatherSystem (storms, rain, lightning) · HuntingSystem (shotgun, deer AI) · PlayerController (capsule + BVH, seats) · VehicleSystem · InteractionSystem (E/Q)
              InventorySystem · ViewModelSystem (hands, smoking, drinking) · MusicSystem
              ShoppingSystem · FishingSystem · DayNightCycle
  computer/   ComputerOS (desktop, windows, Mail/Videos/Music/DINO apps) · emails.js
  media/      VideoLibrary (VHS tapes + video files, TVScreen) · Films (the drive-in programme)
  world/      … StarCatalog (stars, planets, Moon) · StarSky
  minigames/  DinoGame
  scenes/     BaseScene · Props · Devices (TV, radio, seats)
              DinerScene · DriveIn · Railway · Telescope · Garden · HouseScene · GroceryStoreScene · LakeScene · WorldScene · LighthouseScene · Playground (sandbox, swings)
  ui/         index.html · style.css · WalkmanUI · JournalUI · TouchControls · MapUI · HUD · InventoryUI · ShopUI · FishingUI
  assets/     manifest.js · models/ · textures/ · audio/ · music/ · videos/
cloudflare/
  worker.js           Cloudflare Worker + Durable Object room server (relay, host, world snapshot, voice signalling)
  wrangler.toml       Worker config
tools/
  blender_export.py   converts downloaded packs into the bundled GLBs (embeds textures, decimates)
```

### Notes on the renderer

- **No three-psx any more.** `render/PSXMaterial.js` is our own shader:
  - Vertex snapping and affine warp both fade out close to the camera, where they used to tear and swim.
  - 8 per-vertex point lights.
  - Distance fog plus ground fog.
  - Skinning (the animated clerk and fish) and instancing (thousands of trees and grass tufts).
  - A WATER mode for the sea.
- **Post pass** (`core/Renderer.js`): drunk distortion, a little bloom, vignette, 4×4 Bayer dither, 15-bit quantisation. The internal resolution is 240 lines, and its width follows your window so pixels stay square. The laptop temporarily renders at 480 lines.
- **Lights**: the 8 most relevant are picked each frame, and ones near the cutoff fade instead of popping.
- **Colour management is off** (the PS1 lit in gamma space). Hex colours are used as-is.
- **Debugging**: `window.game` is exposed:
  - `game.tick(1/60)` steps one frame.
  - `game.changeScene('Lighthouse', 'door')` teleports.
  - `game.vehicles.get('jetski')` returns a vehicle.

## Assets & credits

Bundled models (converted with `tools/blender_export.py`; textures embedded, heavy models decimated):

| Model(s) | Author / source | License |
|---|---|---|
| Furniture, Mini Market, Food, Nature kits | [Kenney](https://kenney.nl) | CC0 |
| Pickup truck, fishing rod, fish | Quaternius via [Poly Pizza](https://poly.pizza) | CC0 |
| [Lighthouse](https://poly.pizza/m/bk72ChfpGo-), [fishing boat](https://poly.pizza/m/d2QPCNGeGp3) | Poly by Google via Poly Pizza | **CC-BY 3.0** |
| [Beer can](https://sketchfab.com/3d-models/beer-can-b3257907af8248ab99cd27ff8c6a86d1) | Arte Hexe | **CC-BY 4.0** |
| [Low Poly Veggie Lovers Pizza](https://sketchfab.com/3d-models/low-poly-veggie-lovers-pizza-d997cc894ca849f2a3e5736d2cbf3c0d) | zhya | **CC-BY 4.0** |
| [Marlboro Pack of 20 Cigarettes](https://sketchfab.com/3d-models/marlboro-pack-of-20-cigarettes-4eb251a5b2874b3ea329da82db428a5d) | vmek3d | **CC-BY 4.0** |
| [Jet Ski (RWB)](https://sketchfab.com/3d-models/jet-ski-rwb-5091bd9321cc420cabad353e98178c69) | KnightOwl | **CC-BY 4.0** |
| Tangara Sydney Trains T set, skateboard, telescope, restaurant interior | your downloads (Sketchfab) | check each model's page |
| [Realistic Deer](https://sketchfab.com/3d-models/realistic-deer-76039b75cdc0492a80680c2404725496) | pighunt3r15 | **CC-BY 4.0** |
| [Beretta A400 xtreme plus 12ga](https://sketchfab.com/3d-models/beretta-a400-xtreme-plus-12ga-green-9867d2d0caed44baa0833365adc00374) | geyges | **Sketchfab Standard** (use in your game; don't redistribute the model on its own) |
| [Cyberpunk bike](https://sketchfab.com/3d-models/cyberpunk-bike-efcf679a115c487face1adc2ce7e8b8c) | daCruz | **CC-BY-NC 4.0 (non-commercial only)** |
| Drum Kit, Acoustic Guitar, Piano, Microphone | smoj, Dave, jeremy, Poly by Google via Poly Pizza | **CC-BY 3.0** |
| Shiba Inu, Husky, Cat, Pigeon, Bat, Pirate Captain (Ray), Cruise Ship, Sail Ship, Stone Pickaxe, Minecart | Quaternius via Poly Pizza | CC0 |
| Hanging Lantern | Kay Lousberg via Poly Pizza | CC0 |
| [Container Ship](https://poly.pizza/m/3AmDGcCu6Ll) | Alex Safayan via Poly Pizza | **CC-BY 3.0** |
| Townspeople (10 animated characters), reef fish, whale, manta, dolphin, sea chest | Quaternius via Poly Pizza | CC0 |
| Shipwreck | Kenney | CC0 |
| Coral reef set | MiniPoly | CC0 |
| Turtle, jellyfish, octopus, seahorse, starfish, crab, urchin, shell, coral, kelp | Poly by Google via Poly Pizza | **CC-BY 3.0** |
| Stylized WW1 plane | supplied by the project owner | (check the source's licence before publishing) |

CC-BY means the credit above (and on the title screen) must stay with the game. **The bike is non-commercial only**: replace it before selling or monetising the game. The cigarette pack shows a real brand; that's fine for a personal project, but swap it for the procedural "Marlowe" pack (delete `src/assets/models/cigarette_pack.glb`) before publishing.

Built in code: the laptop, the hi-fi rack, VOLT cans, ashtray, steering wheel/dash, all textures, all sounds (WebAudio synthesis), music, and the VHS tapes.

### Adding your own

- **Models**: drop a `.glb` into `src/assets/models/`. It's loaded automatically, keyed by filename. Add a `fit` size in `src/assets/manifest.js`. Models should face +Z.
  - Kenney-style GLBs that reference an external `Textures/colormap.png` need re-exporting through `tools/blender_export.py` so the texture gets embedded.
- **Music**: `src/assets/music/*.mp3|ogg|wav`.
- **Videos**: `src/assets/videos/*.mp4|webm`.
- **Sounds**: `src/assets/audio/<key>.ogg` (keys are listed in `manifest.js`). Everything has a synth fallback.
