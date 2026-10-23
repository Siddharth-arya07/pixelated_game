"""
Buckshot roulette assets -> game-ready GLBs.

    blender -b --python tools/br_export.py -- <downloads_dir> <out_dir>

<downloads_dir> holds the Poly Pizza GLBs named by model id (see JOBS) and the
game's own shotgun.glb is read from src/assets/models.

 - br_hand_l / br_hand_r : J-Toastie's rigged hand (CC-BY 3.0). The source is
   a left hand; the right one is mirrored here (scale -1 applied, so the
   game never renders a negative-determinant skinned mesh).
 - br_gun : the game's shotgun split into Body / Forend (slides when racked) /
   Barrel (sawn off by the handsaw), muzzle along +Z.
 - the rest are plain props, re-exported so textures are embedded.
"""
import sys
import os
import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
GUN = os.path.join(HERE, "..", "src", "assets", "models", "shotgun.glb")

PROPS = [
    ("br_magnifier", "c8HQVCBMIMR"),  # Gabriel Valdivia, CC-BY 3.0
    ("br_beer", "0o4ac2O90Hu"),  # Poly by Google, CC-BY 3.0
    ("br_cigs", "VrpefteXgT"),  # MaverickFX, CC0
    ("br_saw", "4inf1tGOi2A"),  # jeremy, CC-BY 3.0
    ("br_phone", "k2kgBepoMU"),  # Quaternius, CC0
    ("br_pills", "vtlZoL2RJj"),  # codedeck, CC-BY 3.0
    ("br_syringe", "MURJ8NK4N9"),  # J-Toastie, CC-BY 3.0
    ("br_bulb", "S3HkX8iTl2"),  # Quaternius, CC0
    ("br_ashtray", "aHmJIWIr1vI"),  # Jarlan Perez, CC-BY 3.0
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export(name):
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", export_animations=False, export_apply=False)
    print("wrote", name)


def select(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def hands():
    for side in ("l", "r"):
        reset()
        bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, "BEy8jbxm6A.glb"))
        for o in list(bpy.context.scene.objects):
            if o.type == "MESH" and o.name.startswith("Icosphere"):
                bpy.data.objects.remove(o)
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
        # unparent from RootNode, keep transforms
        for o in (arm,):
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
        if side == "r":
            arm.scale.x *= -1
        select([arm, mesh])
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        if side == "r":
            # applying a negative scale leaves the faces inside out
            select([mesh])
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.flip_normals()
            bpy.ops.object.mode_set(mode="OBJECT")
        for o in list(bpy.context.scene.objects):
            if o.type == "EMPTY" and o.name == "RootNode":
                bpy.data.objects.remove(o)
        export("br_hand_" + side)


def gun():
    reset()
    bpy.ops.import_scene.gltf(filepath=GUN)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    by_mat = {o.data.materials[0].name: o for o in meshes}
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    select(meshes)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    barrel = by_mat["mat_canna"]
    # forend: the wide islands of the barrel object just ahead of the receiver
    bm = bmesh.new()
    bm.from_mesh(barrel.data)
    bm.verts.ensure_lookup_table()
    seen = set()
    fore = set()
    # axis the gun lies along = the longest dimension of the barrel object
    dims = barrel.dimensions
    ax = max(range(3), key=lambda i: dims[i])
    lo = min(v.co[ax] for v in bm.verts)
    hi = max(v.co[ax] for v in bm.verts)
    side = [i for i in range(3) if i != ax]
    for v in bm.verts:
        if v.index in seen:
            continue
        st = [v]
        comp = []
        seen.add(v.index)
        while st:
            x = st.pop()
            comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen:
                    seen.add(y.index)
                    st.append(y)
        a0 = min(p.co[ax] for p in comp)
        a1 = max(p.co[ax] for p in comp)
        w = max(max(p.co[i] for p in comp) - min(p.co[i] for p in comp) for i in side)
        # the receiver end of the barrel object is `hi` (0 in the source)
        if w > 3.3 and a0 > lo + (hi - lo) * 0.45 and (a1 - a0) > 2.5:
            fore.update(p.index for p in comp)
    print("forend verts", len(fore), "axis", ax)
    bm.free()
    select([barrel])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for v in barrel.data.vertices:
        v.select = v.index in fore
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    forend = next(o for o in parts if o not in meshes)
    forend.name = "Forend"
    barrel.name = "Barrel"
    body = [by_mat["mat_calcio"], by_mat["mat_carcassa"]]
    select(body)
    bpy.ops.object.join()
    body[0].name = "Body"
    # orient: muzzle (the barrel's far end) toward +Z (glTF +Z = Blender -Y)
    root = bpy.data.objects.new("Gun", None)
    bpy.context.scene.collection.objects.link(root)
    for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        o.parent = root
    # in the source the muzzle is at -ax; Blender -Y exports as glTF +Z
    if ax == 1:
        pass  # muzzle already toward -Y
    else:
        root.rotation_euler[2] = 1.5708
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY" and o is not root:
            bpy.data.objects.remove(o)
    export("br_gun")


def props():
    for name, mid in PROPS:
        reset()
        bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, mid + ".glb"))
        for img in bpy.data.images:
            w, h = img.size
            if max(w, h) > 256:
                k = 256 / max(w, h)
                img.scale(max(1, int(w * k)), max(1, int(h * k)))
        export(name)


os.makedirs(OUT, exist_ok=True)
hands()
gun()
props()
