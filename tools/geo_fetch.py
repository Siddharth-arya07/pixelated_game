"""
Download real-world map data for one of the memory places.

    python3 tools/geo_fetch.py <name> <west> <south> <east> <north> <cache_dir>

 - OpenStreetMap (© OpenStreetMap contributors, ODbL) through the main API,
   in tiles small enough for its 50k-node limit, merged into one .osm file
 - elevation from the AWS Terrain Tiles (Mapzen "terrarium" encoding, mostly
   USGS 3DEP here) at zoom 15, stitched into a 16-bit heightmap .npy-free
   JSON grid (metres)

Run tools/geo_build.py afterwards to turn the cache into src/assets/geo/<name>.json.
"""
import json
import math
import os
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zlib

UA = {"User-Agent": "3am-nostalgia-game/1.0 (personal project)"}


def get(url, tries=4):
    # curl, not urllib: the python.org macOS build ships without CA certificates
    for k in range(tries):
        r = subprocess.run(["curl", "-sSfL", "--max-time", "180", "-A", UA["User-Agent"], url], capture_output=True)
        if r.returncode == 0 and r.stdout:
            return r.stdout
        print("  retry", k + 1, url, r.stderr.decode()[:120])
        time.sleep(3 + k * 3)
    raise SystemExit("failed: " + url)


def fetch_osm(name, w, s, e, n, out):
    step = 0.012
    nodes, ways, rels = {}, {}, {}
    xs = max(1, math.ceil((e - w) / step))
    ys = max(1, math.ceil((n - s) / step))
    for i in range(xs):
        for j in range(ys):
            b = (w + (e - w) * i / xs, s + (n - s) * j / ys, w + (e - w) * (i + 1) / xs, s + (n - s) * (j + 1) / ys)
            path = os.path.join(out, f"{name}_osm_{i}_{j}.osm")
            if not os.path.exists(path):
                url = "https://api.openstreetmap.org/api/0.6/map?bbox=%.5f,%.5f,%.5f,%.5f" % b
                print("osm", i, j, url)
                data = get(url)
                open(path, "wb").write(data)
                time.sleep(1)
            root = ET.parse(path).getroot()
            for el in root:
                (nodes if el.tag == "node" else ways if el.tag == "way" else rels if el.tag == "relation" else {})[el.get("id")] = el
    merged = ET.Element("osm", version="0.6")
    for d in (nodes, ways, rels):
        for el in d.values():
            merged.append(el)
    ET.ElementTree(merged).write(os.path.join(out, f"{name}.osm"))
    print("osm merged:", len(nodes), "nodes", len(ways), "ways", len(rels), "relations")


def png_rgb(data):
    """Tiny PNG decoder for 8-bit RGB/RGBA (no palette, no interlace)."""
    pos = 8
    w = h = 0
    ct = 2
    idat = b""
    while pos < len(data):
        ln = struct.unpack(">I", data[pos : pos + 4])[0]
        typ = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + ln]
        if typ == b"IHDR":
            w, h, _bd, ct = struct.unpack(">IIBB", chunk[:10])
        elif typ == b"IDAT":
            idat += chunk
        pos += 12 + ln
    bpp = 3 if ct == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows = []
    prev = bytearray(stride)
    i = 0
    for _ in range(h):
        f = raw[i]
        line = bytearray(raw[i + 1 : i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, bpp, rows


def fetch_dem(name, w, s, e, n, out, z=15):
    def tile(lat, lon):
        k = 2**z
        return (lon + 180) / 360 * k, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * k

    x0, y0 = tile(n, w)
    x1, y1 = tile(s, e)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    tiles = {}
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            path = os.path.join(out, f"dem_{z}_{tx}_{ty}.png")
            if not os.path.exists(path):
                data = get(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png")
                open(path, "wb").write(data)
            tiles[(tx, ty)] = png_rgb(open(path, "rb").read())

    def elev(fx, fy):
        tx, ty = int(fx), int(fy)
        t = tiles.get((tx, ty))
        if not t:
            return 0.0
        _w, _h, bpp, rows = t
        px = min(255, max(0, int((fx - tx) * 256)))
        py = min(255, max(0, int((fy - ty) * 256)))
        r, g, b = rows[py][px * bpp : px * bpp + 3]
        return r * 256 + g + b / 256 - 32768

    # sample a regular grid in metres (local tangent plane, origin = bbox centre)
    lat0 = (s + n) / 2
    lon0 = (w + e) / 2
    mx = 111320 * math.cos(math.radians(lat0))
    my = 110540
    W = (e - w) * mx
    H = (n - s) * my
    cell = 8.0
    nx = int(W / cell) + 1
    ny = int(H / cell) + 1
    grid = []
    for j in range(ny):
        for i in range(nx):
            x = -W / 2 + i * cell
            zz = -H / 2 + j * cell  # +z = south
            lon = lon0 + x / mx
            lat = lat0 - zz / my
            fx, fy = tile(lat, lon)
            grid.append(round(elev(fx, fy), 1))
    json.dump({"cell": cell, "nx": nx, "ny": ny, "x0": -W / 2, "z0": -H / 2, "h": grid}, open(os.path.join(out, f"{name}_dem.json"), "w"))
    print("dem", nx, "x", ny, "min", min(grid), "max", max(grid))


if __name__ == "__main__":
    name = sys.argv[1]
    w, s, e, n = map(float, sys.argv[2:6])
    out = sys.argv[6]
    os.makedirs(out, exist_ok=True)
    json.dump({"w": w, "s": s, "e": e, "n": n}, open(os.path.join(out, f"{name}_box.json"), "w"))
    fetch_osm(name, w, s, e, n, out)
    fetch_dem(name, w, s, e, n, out)
