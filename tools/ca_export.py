"""
California memory assets -> game-ready GLBs.

    blender -b --python tools/ca_export.py -- <downloads_dir> <out_dir>

Poly Pizza downloads named by model id. The kid is Quaternius's "Animated
Woman" (CC0) recoloured after the reference photo (dark curly hair, black tee,
denim, pink sandals); she's shrunk and given a child's proportions in code
(see systems/Memories.js).
"""
import os
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)

# name, id, {ratio: decimate, anims: keep-list (substring match), tex: max px}
JOBS = [
    ("kid", "9kF7eTDbhO", {"anims": ["Idle", "Walking", "Running", "SitIdle", "Sitting", "PickUp", "Jump"], "recolor": True}),
    ("bus", "4CPpvEmrMoF", {}),
    ("bus_stop_shelter", "OWczicNWhO", {}),
    ("play_structure", "ee0cso-KZnC", {"ratio": 0.35}),
    ("swing_set", "e-IJdcqZH4p", {}),
    ("slide", "dDe3njWPbg0", {"ratio": 0.12}),
    ("merry_go_round", "8BliGG-e55g", {}),
    ("chicken", "ineV9pU5VL", {"anims": ["Idle", "Walk"]}),
    ("pig", "TNvG3QUFlp", {"anims": ["Idle"]}),
    ("goat", "d7dImmjtF8E", {"ratio": 0.5}),
    ("snake", "x9x0viZs8V", {"anims": ["Idle", "Walk"]}),
    ("snake_corn", "bJ2kKpMmPq", {}),
    ("sea_lion", "45HRvXYpvUG", {}),
    ("harbor_seal", "428MKgODp0H", {}),
    ("cake", "38GEFBlOXw", {}),
    ("balloons", "eRag_AC3KiS", {}),
    ("picnic_table", "LM6QWe8kFT", {}),
    ("mailbox_us", "2olZ0G8iur", {}),
    ("coin_telescope", "3HJCpDzBQEw", {}),
]

# hair / shirt / jeans / shoes / skin bands of the Quaternius palette texture
RECOLOR = [
    ((231, 189, 145), (196, 138, 98)),  # skin: warm tan
    ((209, 194, 112), (38, 24, 18)),  # hair: dark brown, nearly black
    ((231, 101, 92), (28, 28, 30)),  # shirt: black tee
    ((97, 135, 211), (74, 104, 150)),  # jeans: denim
    ((240, 71, 47), (214, 150, 158)),  # shoes: pink-grey sandals
]


def recolor_images():
    for img in bpy.data.images:
        if not img.size[0]:
            continue
        px = list(img.pixels)
        for i in range(0, len(px), 4):
            c = tuple(round(v * 255) for v in px[i : i + 3])
            for src, dst in RECOLOR:
                if sum(abs(a - b) for a, b in zip(c, src)) < 30:
                    px[i : i + 3] = [v / 255 for v in dst]
                    break
        img.pixels[:] = px
        img.pack()


for name, mid, opt in JOBS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(SRC, mid + ".glb")
    if not os.path.exists(path):
        print("missing", path)
        continue
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name.startswith("Icosphere") and not o.data.materials:
            bpy.data.objects.remove(o)
    if opt.get("ratio"):
        for o in bpy.context.scene.objects:
            if o.type == "MESH" and len(o.data.polygons) > 200:
                mod = o.modifiers.new("d", "DECIMATE")
                mod.ratio = opt["ratio"]
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=mod.name)
    keep = opt.get("anims")
    if keep is not None:
        for a in list(bpy.data.actions):
            if not any(k == a.name.split("|")[-1] for k in keep):
                bpy.data.actions.remove(a)
    if opt.get("recolor"):
        recolor_images()
    for img in bpy.data.images:
        w, h = img.size
        if max(w, h) > 256:
            k = 256 / max(w, h)
            img.scale(max(1, int(w * k)), max(1, int(h * k)))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, name + ".glb"),
        export_format="GLB",
        export_animations=keep is not None,
        export_animation_mode="ACTIONS",
    )
    print("wrote", name)
