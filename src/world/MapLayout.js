/**
 * MapLayout
 * ---------
 * The authored part of the overworld: points of interest and road control
 * points. Terrain.js turns this into a heightfield (procedural hills, a
 * mountain ridge to the north, the sea to the east) and carves the roads in.
 *
 * World units are metres. +X = east, -Z = north. Sea level is y = 0.
 *
 *          N (-Z)
 *   mountain ridge + Quik Mart on the summit plateau
 *        switchbacks
 *          |                         harbor ── pier, boat, jet ski
 *   lake ──house── junction ────────── coast road ── lighthouse headland
 *          (town)                            sea →
 */
export const MAP = {
  size: 1000, // metres, square, centred on the origin
  spacing: 4, // heightfield grid spacing (m)
  seaLevel: 0,

  /** Points of interest (y is filled in from the terrain at build time). */
  poi: {
    house: { x: -190, z: 172 }, // lot north of the town road
    junction: { x: -40, z: 130 },
    gasStation: { x: -12, z: -246, radius: 34 }, // flattened summit plateau
    harbor: { x: 330, z: 52, radius: 26 },
    lighthouse: { x: 408, z: -62, radius: 30 },
    lakeExit: { x: -470, z: 232 },
    diner: { x: 196, z: 68, radius: 20 }, // Seaview Diner, north of the coast road
    drivein: { x: 110, z: 180, radius: 38 }, // Starlite Drive-In, south of the coast road
    playground: { x: -134, z: 250, radius: 14 }, // Pine Hollow Park, south of the town road
  },

  /** Coastline x as a function of z (sea is east of it). */
  coastX: (z) => 335 + 22 * Math.sin(z / 95) + 10 * Math.sin(z / 37),

  /**
   * Roads: control points [x, z]; heights follow the (smoothed) terrain.
   * surface: 'asphalt' | 'gravel'. width in metres. maxGrade = rise/run cap.
   */
  roads: [
    {
      // The railway: nearly flat, gravel ballast, crosses the town road once.
      name: 'rail',
      rail: true,
      maxGrade: 0.03,
      surface: 'gravel',
      width: 4.4,
      points: [
        [-495, 120],
        [-400, 138],
        [-330, 170],
        [-280, 214],
        [-230, 262],
        [-120, 302],
        [40, 352],
        [130, 420],
        [165, 495],
      ],
    },
    {
      name: 'town',
      maxGrade: 0.09,
      surface: 'asphalt',
      width: 7,
      points: [
        [-440, 232],
        [-360, 222],
        [-280, 215],
        [-215, 208],
        [-150, 196],
        [-95, 168],
        [-40, 130],
      ],
    },
    {
      name: 'coast',
      maxGrade: 0.08,
      surface: 'asphalt',
      width: 7,
      points: [
        [-40, 130],
        [40, 118],
        [120, 108],
        [200, 96],
        [265, 78],
        [305, 62],
        [322, 54],
      ],
    },
    {
      // Harbor up to the lighthouse headland: narrow, steep, gravel.
      name: 'lighthouse',
      maxGrade: 0.16,
      surface: 'gravel',
      width: 4.5,
      points: [
        [322, 54],
        [334, 30],
        [348, 8],
        [368, -18],
        [386, -40],
        [398, -55],
      ],
    },
    {
      name: 'valley',
      maxGrade: 0.08,
      surface: 'asphalt',
      width: 6.5,
      points: [
        [-40, 130],
        [-38, 80],
        [-30, 30],
        [-24, -10],
        [-20, -32],
      ],
    },
    {
      // The switchbacks. Paved at the bottom, gravel up top, no shoulders.
      name: 'mountain',
      maxGrade: 0.17, // the truck can *just* crawl up 17% on gravel
      surface: 'asphalt',
      gravelAfter: 0.45, // fraction of the way up where the paving ends
      width: 5.2,
      points: [
        [-20, -32],
        [-10, -48],
        [35, -62],
        [66, -72],
        [70, -82],
        [42, -90],
        [-55, -102],
        [-94, -110],
        [-98, -121],
        [-70, -130],
        [18, -143],
        [56, -153],
        [60, -163],
        [32, -170],
        [-48, -181],
        [-82, -192],
        [-84, -203],
        [-58, -212],
        [-30, -226],
        [-14, -238],
      ],
    },
  ],
};
