"""
Batch-convert downloaded asset packs into game-ready GLBs.

    blender -b --python tools/blender_export.py -- <downloads_dir> <out_dir>

Why: Kenney GLBs reference an external Textures/colormap.png, which Vite won't
bundle next to a hashed GLB. Re-exporting through Blender embeds the texture.
It also lets us decimate heavy models (PS1 budget), strip unwanted parts, and
convert FBX/OBJ when a pack has no GLB.

Each JOB: (out_name, relative_source_path, options)
  options.keep    -> only keep objects whose name starts with one of these
  options.drop    -> delete objects/meshes using a material containing this
  options.ratio   -> decimate (collapse) ratio for meshes
  options.tex     -> downscale every texture so its longest side is <= tex px
"""
import sys
import os
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)

FURN = "x_furniture-kit/Models/GLTF format/"
MINI = "x_mini-market/Models/GLB format/"
FOOD = "x_food-kit/Models/GLB format/"
NAT = "x_nature-kit/Models/GLTF format/"

JOBS = [
    # ---- house (Kenney Furniture Kit) ----
    ("microwave", FURN + "kitchenMicrowave.glb", {}),
    ("fridge", FURN + "kitchenFridge.glb", {}),
    ("kitchen_cabinet", FURN + "kitchenCabinet.glb", {}),
    ("kitchen_sink", FURN + "kitchenSink.glb", {}),
    ("kitchen_upper", FURN + "kitchenCabinetUpper.glb", {}),
    ("crt_tv", FURN + "televisionVintage.glb", {}),
    ("tv_cabinet", FURN + "cabinetTelevision.glb", {}),
    ("bed", FURN + "bedDouble.glb", {}),
    ("lamp_floor", FURN + "lampRoundFloor.glb", {}),
    ("desk", FURN + "desk.glb", {}),
    ("chair", FURN + "chairDesk.glb", {}),
    ("couch", FURN + "loungeSofa.glb", {}),
    ("speaker", FURN + "speaker.glb", {}),
    ("rug", FURN + "rugRectangle.glb", {}),
    ("trashcan", FURN + "trashcan.glb", {}),
    ("plant", FURN + "pottedPlant.glb", {}),
    ("bookcase", FURN + "bookcaseOpenLow.glb", {}),
    ("books", FURN + "books.glb", {}),
    ("side_table", FURN + "sideTable.glb", {}),
    ("cardboard_box", FURN + "cardboardBoxClosed.glb", {}),
    # ---- store (Kenney Mini Market) ----
    ("shelf_boxes", MINI + "shelf-boxes.glb", {}),
    ("shelf_bags", MINI + "shelf-bags.glb", {}),
    ("shelf_end", MINI + "shelf-end.glb", {}),
    ("freezer_chest", MINI + "freezer.glb", {}),
    ("freezers_standing", MINI + "freezers-standing.glb", {}),
    ("cash_register", MINI + "cash-register.glb", {}),
    ("clerk", MINI + "character-employee.glb", {}),
    ("shopping_cart", MINI + "shopping-cart.glb", {}),
    ("basket", MINI + "shopping-basket.glb", {}),
    ("display_fruit", MINI + "display-fruit.glb", {}),
    ("display_bread", MINI + "display-bread.glb", {}),
    ("bottle_return", MINI + "bottle-return.glb", {}),
    ("column", MINI + "column.glb", {}),
    # ---- food (Kenney Food Kit) ----
    ("pizza", FOOD + "pizza.glb", {"keep": ["slice1"]}),
    ("pizza_box", FOOD + "pizza-box.glb", {}),
    ("soda_can", FOOD + "soda-can.glb", {}),
    ("beer_bottle", FOOD + "soda-bottle.glb", {}),
    ("chips_bag", FOOD + "bag.glb", {}),
    # ---- nature (Kenney Nature Kit) ----
    ("tree_pine", NAT + "tree_pineTallA.glb", {}),
    ("tree_pine2", NAT + "tree_pineTallC.glb", {}),
    ("tree_oak", NAT + "tree_oak_dark.glb", {}),
    ("rock", NAT + "rock_largeA.glb", {}),
    ("rock2", NAT + "rock_largeC.glb", {}),
    ("log", NAT + "log_large.glb", {}),
    ("stump", NAT + "stump_old.glb", {}),
    ("bush", NAT + "plant_bushLarge.glb", {}),
    ("grass", NAT + "grass_large.glb", {}),
    ("campfire", NAT + "campfire_logs.glb", {}),
    ("tent", NAT + "tent_detailedClosed.glb", {}),
    ("fence", NAT + "fence_planks.glb", {}),
    # ---- lighthouse interior extras (Kenney Furniture Kit) ----
    ("lounge_chair", FURN + "loungeChairRelax.glb", {}),
    ("radio", FURN + "radio.glb", {}),
    ("coffee_table", FURN + "tableCoffee.glb", {}),
    ("rug_round", FURN + "rugRound.glb", {}),
    ("lamp_table", FURN + "lampRoundTable.glb", {}),
    ("bookcase_closed", FURN + "bookcaseClosed.glb", {}),
    ("stove", FURN + "kitchenStove.glb", {}),
    ("coat_rack", FURN + "coatRackStanding.glb", {}),
    # ---- user-supplied Sketchfab models (CC-BY / CC-BY-NC, see README) ----
    ("beer_can", "user/beer_can.glb", {"tex": 128}),
    ("pizza_whole", "user/low_poly_veggie_lovers_pizza.glb", {"tex": 128}),
    ("cigarette_pack", "user/marlboro_pack_of_20_cigarettes.glb", {"ratio": 0.08, "tex": 128}),
    ("bike", "user/cyberpunk_bike.glb", {"ratio": 0.07, "tex": 256}),
    ("jetski", "user/jet_ski_rwb.glb", {"ratio": 0.07, "tex": 256}),
    ("shotgun", "user/beretta_a400_xtreme_plus_12ga_green.glb", {"ratio": 0.07, "tex": 256}),
    ("deer", "user/realistic_deer.glb", {"ratio": 0.18, "tex": 256}),
    ("bong", "user/bong.glb", {"ratio": 0.05, "tex": 256}),
    ("train", "user/tangara_sydney_trains_t_set.glb", {"ratio": 0.7, "tex": 256}),
    ("char_girl", "user/handpaint_-_girl_01.glb", {"tex": 512}),
    # Poly Pizza, CC-BY 3.0: Drum Kit (smoj), Acoustic Guitar (Dave), Piano (jeremy), Microphone (Poly by Google)
    ("drum_kit", "user/drums.glb", {"tex": 256}),
    ("guitar", "user/guitar.glb", {"ratio": 0.3, "tex": 256}),
    ("piano", "user/piano.glb", {"tex": 256}),
    ("mic_stand", "user/mic.glb", {"tex": 256}),
    ("plane", "user/stylized_ww1_plane.glb", {"drop_prefix": ["pCube12"], "drop": "Tooner", "join": {"prop": ["pCube1_Blur_effect_0", "pCube4_Blur_effect_0"]}, "ratio": 0.6, "tex": 256}),
    # Quaternius via Poly Pizza (CC0): pets, pigeon, bat, captain (Ray), cruise ship, sail ship, pickaxe, minecart
    ("dog_shiba", "user/shiba.glb", {"tex": 256}),
    ("dog_husky", "user/husky.glb", {"tex": 256}),
    ("cat", "user/cat.glb", {"tex": 256}),
    ("pigeon", "user/pigeon.glb", {"ratio": 0.5, "tex": 128}),
    ("bat", "user/bat.glb", {"ratio": 0.5, "tex": 128}),
    ("ray", "user/captain.glb", {"ratio": 0.35, "tex": 256}),
    ("cruise_ship", "user/cruise_ship.glb", {"tex": 256}),
    ("sail_ship", "user/sail_ship.glb", {"ratio": 0.5, "tex": 256}),
    ("pickaxe", "user/pickaxe.glb", {"tex": 128}),
    ("minecart", "user/minecart.glb", {"tex": 128}),
    # Kay Lousberg via Poly Pizza (CC0): hanging lantern · Alex Safayan (CC-BY 3.0): container ship
    ("lantern", "user/lantern.glb", {"tex": 128}),
    ("container_ship", "user/container_ship.glb", {"tex": 256}),
    ("skateboard", "user/skateboard.glb", {"ratio": 0.2, "tex": 128}),
    ("telescope", "user/telescope.glb", {"ratio": 0.1, "tex": 256}),
    ("diner", "user/restaurant_in_the_evening.glb", {"ratio": 0.45, "ratio_above": 4000, "tex": 512}),
    # ---- Poly by Google via Poly Pizza (CC-BY 3.0) ----
    ("lighthouse", "q_lighthouse.glb", {"tex": 256}),
    ("fishing_boat", "q_boat.glb", {"ratio": 0.35}),
    # ---- Quaternius (Poly Pizza) ----
    ("pickup_truck", "q_truck.glb", {"ratio": 0.33}),
    ("fishing_rod", "q_rod.glb", {}),
    ("fish", "q_fish.glb", {"drop": "Outline"}),
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_any(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)


def apply_options(opts):
    keep = opts.get("keep")
    if keep:
        for ob in list(bpy.data.objects):
            if ob.type == "MESH" and not any(ob.name.startswith(k) for k in keep):
                bpy.data.objects.remove(ob, do_unlink=True)
    drop = opts.get("drop")
    if drop:
        for ob in list(bpy.data.objects):
            if ob.type == "MESH" and any(drop in (s.material.name if s.material else "") for s in ob.material_slots):
                # Remove only the offending faces' material slot by deleting the mesh if it's all outline.
                mats = [s.material.name for s in ob.material_slots if s.material]
                if all(drop in m for m in mats):
                    bpy.data.objects.remove(ob, do_unlink=True)
                else:
                    strip_material_faces(ob, drop)
    tex = opts.get("tex")
    if tex:
        for img in bpy.data.images:
            w, h = img.size
            if max(w, h) > tex:
                k = tex / max(w, h)
                img.scale(max(1, int(w * k)), max(1, int(h * k)))
                img.pack()
    planar = opts.get("planar")
    if planar:
        # Planar dissolve: merges coplanar faces, keeps UV seams (good for
        # architecture, where collapse decimation smears the textures).
        for ob in bpy.data.objects:
            if ob.type == "MESH":
                mod = ob.modifiers.new("planar", "DECIMATE")
                mod.decimate_type = "DISSOLVE"
                mod.angle_limit = planar
                mod.delimit = {"UV", "MATERIAL", "SEAM"}
    for pre in opts.get("drop_prefix", []):
        for ob in list(bpy.data.objects):
            if ob.name.startswith(pre):
                bpy.data.objects.remove(ob, do_unlink=True)
    groups = opts.get("join")
    if groups is not None:
        # Merge into a few named meshes (fewer draw calls); named groups keep
        # their own node (e.g. a propeller to spin), everything else -> "body".
        taken = set()
        for gname, names in list(groups.items()) + [("body", None)]:
            obs = [o for o in bpy.data.objects if o.type == "MESH" and o.name not in taken and (names is None or o.name in names)]
            if not obs:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            for o in obs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = obs[0]
            bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            if len(obs) > 1:
                bpy.ops.object.join()
            j = bpy.context.view_layer.objects.active
            j.name = gname
            bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
            taken.add(gname)
        for ob in list(bpy.data.objects):
            if ob.type == "EMPTY":
                bpy.data.objects.remove(ob, do_unlink=True)
    ratio = opts.get("ratio")
    only_above = opts.get("ratio_above", 0)  # only decimate meshes heavier than this (tris)
    if ratio:
        for ob in bpy.data.objects:
            if ob.type == "MESH" and (not only_above or len(ob.data.polygons) > only_above):
                mod = ob.modifiers.new("decimate", "DECIMATE")
                mod.ratio = ratio
                mod.use_collapse_triangulate = True


def strip_material_faces(ob, needle):
    """Delete faces that use a material whose name contains `needle`."""
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    for i, slot in enumerate(ob.material_slots):
        if slot.material and needle in slot.material.name:
            ob.active_material_index = i
            bpy.ops.object.material_slot_select()
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.select_set(False)


def tri_count():
    deps = bpy.context.evaluated_depsgraph_get()
    n = 0
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            me = ob.evaluated_get(deps).to_mesh()
            me.calc_loop_triangles()
            n += len(me.loop_triangles)
            ob.evaluated_get(deps).to_mesh_clear()
    return n


ONLY = set(argv[2].split(",")) if len(argv) > 2 else None

for name, rel, opts in JOBS:
    if ONLY and name not in ONLY:
        continue
    src = os.path.join(SRC, rel)
    if not os.path.exists(src):
        print(f"[skip] {name}: missing {src}")
        continue
    reset()
    import_any(src)
    apply_options(opts)
    out = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_apply=True,  # bake modifiers (decimate)
        export_animations=True,
        export_image_format="AUTO",  # embeds textures in the GLB
        export_yup=True,
    )
    print(f"[ok] {name:18s} {tri_count():6d} tris  <- {rel}")
