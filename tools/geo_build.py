"""
Turn a geo_fetch cache into a compact map the game loads.

    python3 tools/geo_build.py <name> <cache_dir> <out.json>

Everything is projected onto a flat local plane in metres, origin at the
centre of the downloaded box, +x east and +z SOUTH (game convention: north is
-z), and stored as integers in decimetres to keep the file small:

  roads:     [{t, n, w, p:[x,z,...]}]        highway lines (t = osm highway value)
  buildings: [{k, h, p:[...], n?}]           footprints, k = house|terrace|school|shop|farm|church|garage|shed|other
  areas:     [{k, p:[...], n?}]              park, grass, school, water, wetland, farmland, parking, playground, pitch, orchard, scrub, meadow, sand
  trees:     [x,z,...]                       individually mapped trees
  pois:      [{k, n, x, z}]                  named places
  dem:       {cell, nx, ny, x0, z0, h:[dm]}  heights (decimetres)

© OpenStreetMap contributors (ODbL); elevation: AWS Terrain Tiles.
"""
import json
import math
import sys
import xml.etree.ElementTree as ET

name, cache, out = sys.argv[1:4]
root = ET.parse(f"{cache}/{name}.osm").getroot()
dem = json.load(open(f"{cache}/{name}_dem.json"))

lats, lons = [], []
nodes = {}
ntags = {}
for n in root.iter("node"):
    la, lo = float(n.get("lat")), float(n.get("lon"))
    nodes[n.get("id")] = (la, lo)
    t = {x.get("k"): x.get("v") for x in n.findall("tag")}
    if t:
        ntags[n.get("id")] = t

# the box geo_fetch asked for = what the DEM covers; recover its centre from the DEM extents
W = -dem["x0"] * 2
H = -dem["z0"] * 2
la_all = sorted(v[0] for v in nodes.values())
lo_all = sorted(v[1] for v in nodes.values())
# centre: from the command line of geo_fetch, stored next to the dem
meta = json.load(open(f"{cache}/{name}_box.json"))
lat0 = (meta["s"] + meta["n"]) / 2
lon0 = (meta["w"] + meta["e"]) / 2
MX = 111320 * math.cos(math.radians(lat0))
MY = 110540


def xz(nid):
    la, lo = nodes[nid]
    return ((lo - lon0) * MX, -(la - lat0) * MY)


def inside(p, m=40):
    return -W / 2 - m < p[0] < W / 2 + m and -H / 2 - m < p[1] < H / 2 + m


def simplify(pts, tol):
    if len(pts) < 4:
        return pts

    def dp(a, b):
        ax, az = pts[a]
        bx, bz = pts[b]
        dx, dz = bx - ax, bz - az
        L = math.hypot(dx, dz) or 1e-9
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, pz = pts[i]
            d = abs(dz * px - dx * pz + bx * az - bz * ax) / L
            if d > best:
                best, bi = d, i
        if best > tol:
            return dp(a, bi)[:-1] + dp(bi, b)
        return [pts[a], pts[b]]

    return dp(0, len(pts) - 1)


def flat(pts):
    o = []
    for x, z in pts:
        o += [round(x * 10), round(z * 10)]
    return o


ways = {}
wtags = {}
for w in root.iter("way"):
    ways[w.get("id")] = [nd.get("ref") for nd in w.findall("nd") if nd.get("ref") in nodes]
    wtags[w.get("id")] = {x.get("k"): x.get("v") for x in w.findall("tag")}

ROAD_W = {
    "motorway": 14, "trunk": 13, "primary": 13, "secondary": 12, "tertiary": 10, "residential": 8,
    "unclassified": 7, "service": 5, "living_street": 6, "motorway_link": 7, "trunk_link": 7,
    "primary_link": 7, "secondary_link": 7, "tertiary_link": 7,
    "footway": 2, "path": 1.6, "cycleway": 2.4, "track": 3, "pedestrian": 4, "steps": 2, "bridleway": 2,
}

roads, buildings, areas, trees, pois = [], [], [], [], []


def bkind(t):
    b = t.get("building", "")
    if b in ("house", "detached", "semidetached_house", "bungalow"):
        return "house"
    if b in ("apartments", "terrace", "residential", "dormitory"):
        return "terrace"
    if b in ("school", "kindergarten") or t.get("amenity") == "school":
        return "school"
    if b in ("retail", "commercial", "supermarket", "office", "industrial", "warehouse"):
        return "shop"
    if b in ("barn", "farm", "farm_auxiliary", "stable", "cowshed", "greenhouse", "silo"):
        return "farm"
    if b in ("church", "chapel", "mosque", "temple", "religious"):
        return "church"
    if b in ("garage", "garages", "carport"):
        return "garage"
    if b in ("shed", "hut", "roof"):
        return "shed"
    return "other"


AREA = {
    ("leisure", "park"): "park", ("leisure", "garden"): "park", ("leisure", "playground"): "playground",
    ("leisure", "pitch"): "pitch", ("leisure", "nature_reserve"): "reserve", ("leisure", "golf_course"): "grass",
    ("landuse", "grass"): "grass", ("landuse", "recreation_ground"): "grass", ("landuse", "meadow"): "meadow",
    ("landuse", "farmland"): "farmland", ("landuse", "orchard"): "orchard", ("landuse", "farmyard"): "farmyard",
    ("landuse", "reservoir"): "water", ("landuse", "basin"): "water", ("landuse", "residential"): "residential",
    ("landuse", "retail"): "paved", ("landuse", "commercial"): "paved",
    ("natural", "water"): "water", ("natural", "wetland"): "wetland", ("natural", "scrub"): "scrub",
    ("natural", "grassland"): "meadow", ("natural", "heath"): "scrub", ("natural", "wood"): "wood",
    ("landuse", "forest"): "wood", ("natural", "sand"): "sand", ("natural", "beach"): "sand",
    ("amenity", "parking"): "parking", ("amenity", "school"): "school", ("waterway", "riverbank"): "water",
    ("waterway", "waterfall"): "waterfall", ("man_made", "pier"): "pier", ("man_made", "breakwater"): "pier", ("natural", "bare_rock"): "rock",
    ("natural", "rock"): "rock", ("natural", "scree"): "rock", ("natural", "cliff"): "rock",
    ("leisure", "marina"): "water", ("tourism", "attraction"): "attraction", ("highway", "pedestrian"): "paved",
    ("landuse", "construction"): "paved", ("amenity", "parking_space"): "parking",
}


def area_kind(t):
    for (k, v), kind in AREA.items():
        if t.get(k) == v:
            return kind
    return None


def ring_ok(pts):
    return len(pts) >= 3 and any(inside(p, 0) for p in pts)


for wid, refs in ways.items():
    t = wtags[wid]
    if len(refs) < 2:
        continue
    pts = [xz(r) for r in refs]
    closed = refs[0] == refs[-1]
    hw = t.get("highway")
    if hw and not closed or hw in ("pedestrian",) and not t.get("area"):
        if hw in ROAD_W and any(inside(p) for p in pts):
            w = ROAD_W[hw]
            if t.get("lanes", "").isdigit() and hw not in ("footway", "path", "cycleway"):
                w = max(w, int(t["lanes"]) * 3.4 + 1)
            r = {"t": hw, "w": w, "p": flat(simplify(pts, 0.5))}
            if t.get("name"):
                r["n"] = t["name"]
            if t.get("bridge") == "yes":
                r["b"] = 1
            roads.append(r)
        continue
    if "building" in t and closed and ring_ok(pts):
        k = bkind(t)
        h = None
        if t.get("height", "").replace(".", "", 1).isdigit():
            h = float(t["height"])
        elif t.get("building:levels", "").isdigit():
            h = int(t["building:levels"]) * 3.1
        b = {"k": k, "p": flat(simplify(pts[:-1], 0.35))}
        if h:
            b["h"] = round(h, 1)
        if t.get("name"):
            b["n"] = t["name"]
        buildings.append(b)
        continue
    if t.get("waterway") in ("stream", "ditch", "drain", "canal", "river") and any(inside(p) for p in pts):
        roads.append({"t": "water_" + t["waterway"], "w": 4 if t["waterway"] in ("canal", "river") else 2, "p": flat(simplify(pts, 0.8))})
        continue
    if (t.get("natural") in ("coastline", "cliff") or t.get("man_made") == "pier") and not closed and any(inside(p) for p in pts):
        roads.append({"t": "pier" if t.get("man_made") == "pier" else t["natural"], "w": 6 if t.get("man_made") == "pier" else 0.5, "p": flat(simplify(pts, 0.8)), **({"n": t["name"]} if t.get("name") else {})})
        continue
    if t.get("barrier") in ("fence", "wall") and any(inside(p) for p in pts):
        roads.append({"t": "fence", "w": 0.1, "p": flat(simplify(pts, 0.3))})
        continue
    k = area_kind(t)
    if k and closed and ring_ok(pts):
        a = {"k": k, "p": flat(simplify(pts[:-1], 0.8))}
        if t.get("name"):
            a["n"] = t["name"]
        areas.append(a)

# multipolygon areas: stitch outer rings
for rel in root.iter("relation"):
    t = {x.get("k"): x.get("v") for x in rel.findall("tag")}
    if t.get("type") != "multipolygon":
        continue
    k = area_kind(t)
    isb = "building" in t
    if not k and not isb:
        continue
    segs = [list(ways[m.get("ref")]) for m in rel.findall("member") if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("ref") in ways]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, sg in enumerate(segs):
                if not sg:
                    continue
                if sg[0] == ring[-1]:
                    ring += sg[1:]
                elif sg[-1] == ring[-1]:
                    ring += sg[::-1][1:]
                elif sg[-1] == ring[0]:
                    ring = sg[:-1] + ring
                elif sg[0] == ring[0]:
                    ring = sg[::-1][:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(ring) > 3:
            rings.append(ring)
    for ring in rings:
        pts = [xz(r) for r in ring]
        if not ring_ok(pts):
            continue
        if isb:
            buildings.append({"k": bkind(t), "p": flat(simplify(pts[:-1], 0.35)), **({"n": t["name"]} if t.get("name") else {})})
        else:
            a = {"k": k, "p": flat(simplify(pts[:-1], 0.8))}
            if t.get("name"):
                a["n"] = t["name"]
            areas.append(a)

# points: trees and named places
for nid, t in ntags.items():
    p = xz(nid)
    if not inside(p, 0):
        continue
    if t.get("natural") == "tree":
        trees += [round(p[0] * 10), round(p[1] * 10)]
    elif t.get("name") and any(k in t for k in ("amenity", "shop", "tourism", "leisure", "historic", "natural", "place", "highway")):
        pois.append({"k": t.get("amenity") or t.get("shop") or t.get("tourism") or t.get("leisure") or t.get("historic") or t.get("natural") or t.get("place") or t.get("highway"), "n": t["name"], "x": round(p[0], 1), "z": round(p[1], 1)})
# named areas/buildings become POIs too (their centroid)
for coll in (buildings, areas):
    for o in coll:
        if o.get("n"):
            xs = o["p"][0::2]
            zs = o["p"][1::2]
            pois.append({"k": o.get("k"), "n": o["n"], "x": round(sum(xs) / len(xs) / 10, 1), "z": round(sum(zs) / len(zs) / 10, 1), "area": 1})

# halve the heightmap resolution (16 m cells are plenty for rolling hills)
nx, ny = dem["nx"], dem["ny"]
hx, hy = (nx + 1) // 2, (ny + 1) // 2
d = {"cell": dem["cell"] * 2, "nx": hx, "ny": hy, "x0": dem["x0"], "z0": dem["z0"]}
d["h"] = [round(dem["h"][min(ny - 1, j * 2) * nx + min(nx - 1, i * 2)] * 10) for j in range(hy) for i in range(hx)]
res = {
    "name": name,
    "origin": {"lat": lat0, "lon": lon0},
    "size": [round(W, 1), round(H, 1)],
    "roads": roads,
    "buildings": buildings,
    "areas": areas,
    "trees": trees,
    "pois": pois,
    "dem": d,
    "credit": "© OpenStreetMap contributors (ODbL) · elevation: AWS Terrain Tiles / USGS",
}
json.dump(res, open(out, "w"), separators=(",", ":"))
import collections

print(name, "roads", len(roads), "buildings", len(buildings), collections.Counter(b["k"] for b in buildings).most_common(), "areas", collections.Counter(a["k"] for a in areas).most_common(), "trees", len(trees) // 2, "pois", len(pois))
