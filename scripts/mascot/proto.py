# PR-OS mascot prototypes (21 Oct 2026) — four new characters to choose from.
# Soft, cute body + glowing mechanical parts, on a small diorama, navy studio.
#   blender -b --python proto.py -- --char dragon --out out/dragon.png [--res 900] [--samples 64]
# chars: dragon (โพโพ), bird (บอระ), cloud (ฟูฟู), drop (จ๋อม)
import bpy, bmesh, math, sys, argparse, random
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--char", default="dragon")
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=900)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--cam", default="hero")  # hero | front
a = ap.parse_args(argv)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 8
sc.cycles.transmission_bounces = 8
sc.render.resolution_x = a.res
sc.render.resolution_y = a.res
sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"

FONT = "/usr/share/fonts/opentype/tlwg/Loma-Bold.otf"


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def mat(name, color, rough=0.45, sss=0.0, coat=0.0, metal=0.0, spec=0.5, sheen=0.0,
        emit=None, emit_k=0.0, trans=0.0, ior=1.45, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = lin(color)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["IOR"].default_value = ior
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
        p.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.3)
        p.inputs["Subsurface Scale"].default_value = 0.15
    if coat:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = 0.05
    if sheen:
        p.inputs["Sheen Weight"].default_value = sheen
        p.inputs["Sheen Tint"].default_value = (1, 1, 1, 1)
    if emit:
        p.inputs["Emission Color"].default_value = lin(emit)
        p.inputs["Emission Strength"].default_value = emit_k
    if trans:
        p.inputs["Transmission Weight"].default_value = trans
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
    return m


def glow(name, color, k=6.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = lin(color)
    e.inputs["Strength"].default_value = k
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def link(o):
    if o.name not in sc.collection.objects:
        try:
            sc.collection.objects.link(o)
        except RuntimeError:
            pass
    return o


def smooth(o, sub=2):
    if o.type == "MESH":
        for poly in o.data.polygons:
            poly.use_smooth = True
        if sub:
            md = o.modifiers.new("sub", "SUBSURF")
            md.levels = sub
            md.render_levels = sub
    return o


def put(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def sphere(name, r, loc, m, scale=(1, 1, 1), rot=(0, 0, 0), sub=2, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return put(smooth(o, sub), m)


def cyl(name, r, depth, loc, m, rot=(0, 0, 0), bevel=0.0, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if bevel:
        md = o.modifiers.new("bev", "BEVEL")
        md.width = bevel
        md.segments = 4
        md.limit_method = "ANGLE"
    smooth(o, 0)
    return put(o, m)


def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = o.modifiers.new("bev", "BEVEL")
        md.width = bevel
        md.segments = 4
    smooth(o, 0)
    return put(o, m)


def torus(name, R, r, loc, m, rot=(0, 0, 0), arc=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=96, minor_segments=16,
                                     location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if arc is not None:  # keep only part of the ring: arc = (from_deg, to_deg) in local XY
        bm = bmesh.new()
        bm.from_mesh(o.data)
        kill = []
        for v in bm.verts:
            ang = math.degrees(math.atan2(v.co.y, v.co.x)) % 360
            lo, hi = arc
            inside = lo <= ang <= hi if lo <= hi else (ang >= lo or ang <= hi)
            if not inside:
                kill.append(v)
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
    return put(smooth(o, 1), m)


def tube(name, pts, radii, m, res=4, caps=True):
    """A smooth tapered tube along points (limbs, horns, tails, whiskers, cables)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0
    cu.bevel_resolution = res
    cu.resolution_u = 16
    cu.use_fill_caps = caps
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p, r in zip(sp.bezier_points, pts, radii):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
        bp.radius = r
    o = bpy.data.objects.new(name, cu)
    link(o)
    o.data.materials.append(m)
    return o


def text(name, s, loc, size, m, rot=(math.radians(90), 0, 0), extrude=0.006):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = s
    try:
        cu.font = bpy.data.fonts.load(FONT)
    except Exception:
        pass
    cu.size = size
    cu.extrude = extrude
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    o = bpy.data.objects.new(name, cu)
    o.location = loc
    o.rotation_euler = rot
    link(o)
    o.data.materials.append(m)
    return o


# ------------------------------------------------------------------ shared parts
EYE = mat("eye", "#1a1030", rough=0.05, coat=1.0)
WHITE_GLOW = glow("glint", "#ffffff", 3.0)
CYAN = glow("cyan", "#7ff3ff", 7.0)
PINK = glow("pinkglow", "#ff8fd0", 6.0)
GOLD = mat("gold", "#f3b53a", rough=0.22, metal=1.0)
STEEL = mat("steel", "#c9cfe0", rough=0.25, metal=1.0)
GUNMETAL = mat("gunmetal", "#3a3f58", rough=0.3, metal=0.9)
DARK = mat("dark", "#1c1530", rough=0.35)
CHEEK = mat("cheek", "#ff7f9e", rough=0.6, sss=0.3)
TONGUE = mat("tongue", "#ff6f8a", rough=0.45, sss=0.3)
MOUTH = mat("mouth", "#3b1030", rough=0.4)
CARD = mat("card", "#ffffff", rough=0.35)
PURPLE = mat("purple", "#6a2f86", rough=0.35, coat=0.6)


def cartoon_eye(name, loc, r, iris="#4b2a8a", squash=1.0, tilt=0.0):
    """Big glossy chibi eye: dark oval + coloured lower crescent + two glints."""
    x, y, z = loc
    sphere(name + "_ball", r, (x, y, z), EYE, (1.0, 0.55, 1.2 * squash), rot=(0, tilt, 0))
    sphere(name + "_iris", r * 0.62, (x, y - r * 0.33, z - r * 0.42 * squash), mat(name + "_im", iris, rough=0.1, coat=1.0, emit=iris, emit_k=0.6),
           (1.0, 0.45, 0.55))
    sphere(name + "_g1", r * 0.3, (x + r * 0.28, y - r * 0.5, z + r * 0.45 * squash), WHITE_GLOW, (1, 0.5, 1.1), sub=1)
    sphere(name + "_g2", r * 0.13, (x - r * 0.3, y - r * 0.5, z - r * 0.15), WHITE_GLOW, (1, 0.5, 1), sub=1)


def smile(name, loc, w, open_mouth=True):
    x, y, z = loc
    if open_mouth:
        m = sphere(name + "_m", w, (x, y, z), MOUTH, (1.0, 0.35, 0.7), sub=0, seg=48)
        bm = bmesh.new()
        bm.from_mesh(m.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.02 * w], context="VERTS")
        bm.to_mesh(m.data)
        bm.free()
        smooth(m, 2)
        sphere(name + "_t", w * 0.55, (x, y - w * 0.1, z - w * 0.38), TONGUE, (1.0, 0.35, 0.4))
    else:
        torus(name + "_s", w, w * 0.18, (x, y, z), MOUTH, rot=(math.radians(90), 0, 0), arc=(190, 350))


def megaphone(loc, rot, scale=1.0):
    root = bpy.data.objects.new("Megaphone", None)
    link(root)
    root.location = loc
    root.rotation_euler = rot
    root.scale = (scale, scale, scale)
    body_m = mat("mega", "#ffffff", rough=0.25, coat=1.0)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.32, radius2=0.09, depth=0.62, end_fill_type="NOTHING",
                                    location=(0.31, 0, 0), rotation=(0, math.radians(-90), 0))
    c = bpy.context.active_object
    sol = c.modifiers.new("sol", "SOLIDIFY")
    sol.thickness = 0.025
    smooth(c, 1)
    put(c, body_m)
    c.parent = root
    r = torus("MegaRim", 0.32, 0.03, (0.62, 0, 0), CYAN, rot=(0, math.radians(90), 0))
    r.parent = root
    b = torus("MegaBand", 0.2, 0.025, (0.33, 0, 0), PURPLE, rot=(0, math.radians(90), 0))
    b.parent = root
    h = cyl("MegaGrip", 0.05, 0.26, (0.12, 0, -0.14), GUNMETAL, rot=(math.radians(10), 0, 0))
    h.parent = root
    return root


def camera_prop(loc, rot, scale=1.0):
    root = bpy.data.objects.new("Camera", None)
    link(root)
    root.location = loc
    root.rotation_euler = rot
    root.scale = (scale, scale, scale)
    for o in (
        box("CamBody", (0.5, 0.24, 0.32), (0, 0, 0), mat("cambody", "#2b2f45", rough=0.35, coat=0.5), bevel=0.05),
        box("CamTop", (0.18, 0.18, 0.08), (-0.12, 0, 0.19), GUNMETAL, bevel=0.02),
        cyl("CamLens", 0.12, 0.16, (0.05, -0.18, 0), STEEL, rot=(math.radians(90), 0, 0), bevel=0.01),
        cyl("CamGlass", 0.085, 0.02, (0.05, -0.265, 0), mat("glass", "#1b2a55", rough=0.02, coat=1.0, metal=0.3), rot=(math.radians(90), 0, 0)),
        torus("CamRing", 0.118, 0.012, (0.05, -0.25, 0), CYAN, rot=(math.radians(90), 0, 0)),
        sphere("CamLed", 0.025, (0.19, -0.12, 0.1), PINK, sub=1),
    ):
        o.parent = root
    return root


def mic_prop(loc, rot, scale=1.0):
    root = bpy.data.objects.new("Mic", None)
    link(root)
    root.location = loc
    root.rotation_euler = rot
    root.scale = (scale, scale, scale)
    head = sphere("MicHead", 0.13, (0, 0, 0.2), mat("grille", "#b9c0d6", rough=0.35, metal=1.0))
    # grille texture
    nt = head.active_material.node_tree
    p = nt.nodes["Principled BSDF"]
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 30
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nt.links.new(br.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    for o in (
        head,
        torus("MicBand", 0.13, 0.018, (0, 0, 0.13), CYAN),
        cyl("MicBody", 0.055, 0.34, (0, 0, -0.03), mat("micbody", "#2b2f45", rough=0.3, coat=0.6), bevel=0.01),
        box("MicFlag", (0.16, 0.16, 0.08), (0, 0, 0.04), PURPLE, bevel=0.015),
    ):
        o.parent = root
    return root


def badge(neck_pts, card_loc, card_rot=(0, 0, 0)):
    tube("Lanyard", neck_pts, [0.012] * len(neck_pts), PURPLE, res=2)
    c = box("Badge", (0.22, 0.02, 0.28), card_loc, CARD, rot=card_rot, bevel=0.015)
    box("BadgeTop", (0.22, 0.022, 0.07), (card_loc[0], card_loc[1] - 0.001, card_loc[2] + 0.105), PURPLE, rot=card_rot, bevel=0.01)
    text("BadgeTxt", "ปชส.", (card_loc[0], card_loc[1] - 0.013, card_loc[2] - 0.02), 0.075, mat("badgetxt", "#5e2f73", rough=0.4),
         rot=(math.radians(90) + card_rot[0], card_rot[1], card_rot[2]))
    sphere("BadgeLed", 0.012, (card_loc[0] + 0.07, card_loc[1] - 0.014, card_loc[2] + 0.105), CYAN, sub=1)
    return c


# ------------------------------------------------------------------ diorama + studio
def diorama(top):
    base_m = mat("base", "#241a52", rough=0.28, coat=0.8, metal=0.2)
    cyl("Base", 2.0, 0.36, (0, 0, -0.18), base_m, bevel=0.04, verts=12)  # 12-sided: a machined look
    cyl("BaseLip", 2.05, 0.06, (0, 0, -0.03), GUNMETAL, bevel=0.01, verts=12)
    # glowing panel strips on each face of the 12-gon
    for i in range(12):
        ang = (i + 0.5) * math.tau / 12
        r = 1.95
        o = box(f"Strip{i}", (0.42, 0.01, 0.025), (r * math.cos(ang), r * math.sin(ang), -0.2), CYAN if i % 3 else PINK,
                rot=(0, 0, ang + math.pi / 2), bevel=0.004)
    top()


def top_dock():
    wood = mat("wood", "#7a4a2b", rough=0.6)
    for i in range(9):
        x = -1.68 + i * 0.42
        ln = 2 * math.sqrt(max(0.05, 1.9 ** 2 - (abs(x) + 0.21) ** 2))
        box(f"Plank{i}", (0.4, ln, 0.06), (x, 0, 0.0), wood, bevel=0.012)
    lan = mat("lantern", "#d8241c", rough=0.4, sss=0.2, emit="#ff3a1c", emit_k=0.8)
    for x, y in ((-1.4, 0.9), (1.45, 0.7)):
        cyl(f"Post{x}", 0.04, 1.3, (x, y, 0.65), wood)
        sphere(f"Lantern{x}", 0.2, (x, y, 1.15), lan, (1, 1, 1.15))
        cyl(f"LanCapT{x}", 0.09, 0.05, (x, y, 1.38), GOLD)
        cyl(f"LanCapB{x}", 0.09, 0.05, (x, y, 0.92), GOLD)
        tube(f"Tassel{x}", [(x, y, 0.9), (x, y, 0.72)], [0.02, 0.005], mat("tassel", "#f7c948", rough=0.6))


def top_lake():
    water = mat("water", "#14465a", rough=0.05, coat=1.0, spec=0.8)
    cyl("Water", 1.98, 0.04, (0, 0, -0.0), water, verts=12)
    pad = mat("pad", "#3d9a5a", rough=0.5, sss=0.1)
    for x, y, r in ((-1.2, -0.6, 0.38), (1.15, 0.4, 0.45), (0.5, -1.2, 0.3), (-0.6, 1.1, 0.34)):
        o = cyl(f"Pad{x}", r, 0.03, (x, y, 0.03), pad)
    petal = mat("petal", "#ff9fc4", rough=0.4, sss=0.5)
    cx, cy = 1.15, 0.4
    for i in range(8):
        ang = i * math.tau / 8
        sphere(f"Petal{i}", 0.12, (cx + 0.12 * math.cos(ang), cy + 0.12 * math.sin(ang), 0.16), petal, (0.6, 1.4, 0.5),
               rot=(math.radians(40) * math.cos(ang), math.radians(40) * math.sin(ang), ang))
    sphere("LotusCore", 0.07, (cx, cy, 0.2), mat("core", "#f6d34a", rough=0.5))
    reed = mat("reed", "#6b8f3a", rough=0.6)
    for i in range(7):
        x = -1.6 + random.random() * 0.5
        y = 0.2 + random.random() * 1.0
        h = 0.8 + random.random() * 0.7
        tube(f"Reed{i}", [(x, y, 0), (x + 0.05, y, h * 0.6), (x + 0.12, y, h)], [0.025, 0.018, 0.005], reed, res=2)
    for i in range(3):
        torus(f"Ripple{i}", 0.35 + i * 0.25, 0.006, (0, 0, 0.025), glow(f"rip{i}", "#7ff3ff", 1.5 - i * 0.4))


def top_sky():
    puff = mat("puffs", "#e9e3ff", rough=0.8, sss=0.4)
    mb = bpy.data.metaballs.new("PuffsMB")
    mb.resolution = 0.06
    mb.render_resolution = 0.04
    for x, y, r in ((-1.3, 0.5, 0.45), (-0.9, 0.9, 0.38), (1.2, -0.3, 0.42), (1.45, 0.4, 0.32), (0.3, 1.3, 0.35), (-1.0, -1.0, 0.3)):
        e = mb.elements.new()
        e.co = (x, y, 0.05)
        e.radius = r
    o = bpy.data.objects.new("Puffs", mb)
    link(o)
    o.data.materials.append(puff)
    star = glow("star", "#fff2a8", 6)
    for i, (x, y, z) in enumerate(((-1.5, -0.3, 1.6), (1.6, 0.9, 2.2), (-0.9, 1.4, 2.6), (1.3, -1.0, 1.2))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.06, location=(x, y, z))
        put(bpy.context.active_object, star)
    top_disc = mat("skyfloor", "#3a2a7a", rough=0.4, coat=0.6)
    cyl("SkyFloor", 1.98, 0.03, (0, 0, -0.01), top_disc, verts=12)


def top_river():
    water = mat("river", "#1c6f9a", rough=0.04, coat=1.0, spec=0.8)
    cyl("River", 1.98, 0.04, (0, 0, 0.0), water, verts=12)
    bank = mat("bank", "#5d7a3a", rough=0.7)
    stone = mat("stone", "#8a8fa8", rough=0.6)
    for i, (x, y, r) in enumerate(((-1.5, 0.8, 0.22), (1.4, 1.0, 0.18), (1.55, -0.6, 0.15), (-1.2, -1.1, 0.12))):
        sphere(f"Stone{i}", r, (x, y, 0.05), stone, (1.2, 1, 0.6))
    # where the rivers meet: two coloured currents on the surface
    for nm, pts, col in (("CurrentA", [(-1.85, 0.9, 0.025), (-0.9, 0.5, 0.025), (0.0, 0.25, 0.025)], "#7ff3ff"),
                         ("CurrentB", [(-1.2, -1.4, 0.025), (-0.5, -0.7, 0.025), (0.05, -0.05, 0.025)], "#b8a2ff")):
        t = tube(nm, pts, [0.03, 0.025, 0.012], glow(nm, col, 1.0), res=2)
        t.scale = (1, 1, 0.25)
    for i in range(3):
        torus(f"Ripple{i}", 0.4 + i * 0.28, 0.008, (0.1, 0.0, 0.03), glow(f"rip{i}", "#a8f6ff", 1.6 - i * 0.4))


def studio():
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = lin("#120b33")
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    # backdrop
    m = bpy.data.materials.new("backdrop")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    rmp = nt.nodes.new("ShaderNodeValToRGB")
    rmp.color_ramp.elements[0].color = lin("#1b1150")
    rmp.color_ramp.elements[1].color = lin("#0a0722")
    rmp.color_ramp.elements[1].position = 0.6
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], rmp.inputs["Fac"])
    nt.links.new(rmp.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 7, 4), rotation=(math.radians(90), 0, 0))
    bd = bpy.context.active_object
    bd.scale = (40, 20, 1)
    bd.data.materials.append(m)
    # soft halo behind the character
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=4.5, fill_type="NGON", location=(0, 6.9, 2.2), rotation=(math.radians(90), 0, 0))
    halo = bpy.context.active_object
    hm = bpy.data.materials.new("halo")
    hm.use_nodes = True
    h = hm.node_tree
    h.nodes.clear()
    ho = h.nodes.new("ShaderNodeOutputMaterial")
    mix = h.nodes.new("ShaderNodeMixShader")
    tr = h.nodes.new("ShaderNodeBsdfTransparent")
    he = h.nodes.new("ShaderNodeEmission")
    he.inputs["Color"].default_value = lin("#5a7cf0")
    he.inputs["Strength"].default_value = 0.55
    gr = h.nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = "SPHERICAL"
    htc = h.nodes.new("ShaderNodeTexCoord")
    mp = h.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / 4.5,) * 3
    pw = h.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 2.0
    h.links.new(htc.outputs["Object"], mp.inputs[0])
    h.links.new(mp.outputs[0], gr.inputs[0])
    h.links.new(gr.outputs["Fac"], pw.inputs[0])
    h.links.new(pw.outputs[0], mix.inputs["Fac"])
    h.links.new(tr.outputs[0], mix.inputs[1])
    h.links.new(he.outputs[0], mix.inputs[2])
    h.links.new(mix.outputs[0], ho.inputs[0])
    halo.data.materials.append(hm)
    # floor under the diorama
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.37))
    bpy.context.active_object.data.materials.append(mat("floor", "#0a0722", rough=0.45, spec=0.5))

    def area(name, loc, energy, size, color, target=(0, 0, 1.2)):
        l = bpy.data.lights.new(name, "AREA")
        l.energy = energy
        l.size = size
        l.color = lin(color)[:3]
        o = bpy.data.objects.new(name, l)
        link(o)
        o.location = loc
        t = bpy.data.objects.new(name + "T", None)
        link(t)
        t.location = target
        c = o.constraints.new("TRACK_TO")
        c.target = t
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
        return o

    area("Key", (-4, -5, 6.5), 1400, 3.5, "#ffe6c7")
    area("Fill", (5, -4, 2.5), 380, 5, "#cfdcff")
    area("Rim", (3, 5, 5), 1700, 2.5, "#d8b8ff")
    area("Rim2", (-4.5, 4, 3), 900, 2.5, "#8ff0ff")

    cd = bpy.data.cameras.new("Cam")
    cd.lens = 62
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 5.6
    cam = bpy.data.objects.new("Cam", cd)
    link(cam)
    if a.cam == "front":
        cam.location = (0, -10, 2.6)
    else:
        cam.location = (-3.2, -9.0, 3.4)
    tgt = bpy.data.objects.new("CamT", None)
    link(tgt)
    tgt.location = (0, 0, 1.15)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    cd.dof.focus_object = tgt
    sc.camera = cam


# ------------------------------------------------------------------ characters
def dragon():
    """โพโพ — dragon cub from the Paknampho Chinese New Year golden-dragon parade."""
    red = mat("dragon", "#e2463b", rough=0.42, sss=0.25, coat=0.25, sheen=0.15)
    cream = mat("belly", "#ffe2b0", rough=0.5, sss=0.3)
    # body + belly plates
    sphere("Body", 0.62, (0, 0.05, 0.78), red, (1.0, 0.92, 1.05))
    for i, (z, s) in enumerate(((0.55, 0.36), (0.78, 0.4), (1.0, 0.36))):
        sphere(f"Belly{i}", s, (0, -0.42, z), cream, (1.05, 0.35, 0.6))
    badge([(-0.33, -0.3, 1.38), (-0.2, -0.52, 1.18), (0.0, -0.6, 1.08), (0.2, -0.52, 1.18), (0.33, -0.3, 1.38)], (0.0, -0.64, 0.95))
    # head
    hz = 1.86
    sphere("Head", 0.82, (0, 0, hz), red, (1.08, 0.95, 0.9))
    sphere("Snout", 0.4, (0, -0.72, hz - 0.24), cream, (1.15, 0.85, 0.66))
    for s in (-1, 1):
        sphere(f"Nostril{s}", 0.045, (0.13 * s, -1.02, hz - 0.1), DARK, (1, 0.6, 0.7))
    smile("Grin", (0, -1.04, hz - 0.33), 0.2)
    for s in (-1, 1):  # two little fangs
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.035, radius2=0.0, depth=0.08, location=(0.09 * s, -1.07, hz - 0.36), rotation=(math.radians(180), 0, 0))
        put(smooth(bpy.context.active_object, 1), CARD)
    for s in (-1, 1):
        cartoon_eye(f"Eye{s}", (0.36 * s, -0.66, hz + 0.18), 0.19, iris="#e0a21b")
        sphere(f"Cheek{s}", 0.11, (0.62 * s, -0.55, hz - 0.12), CHEEK, (1.2, 0.4, 0.7))
        # brows: little gold flames
        tube(f"Brow{s}", [(0.22 * s, -0.72, hz + 0.45), (0.38 * s, -0.7, hz + 0.52), (0.52 * s, -0.62, hz + 0.47)], [0.035, 0.03, 0.012], GOLD)
        # horns: gold, curving back
        tube(f"Horn{s}", [(0.32 * s, -0.05, hz + 0.62), (0.42 * s, 0.05, hz + 0.95), (0.36 * s, 0.32, hz + 1.12)], [0.11, 0.07, 0.02], GOLD)
        tube(f"Antler{s}", [(0.41 * s, 0.02, hz + 0.88), (0.6 * s, -0.02, hz + 1.0), (0.66 * s, 0.05, hz + 1.12)], [0.05, 0.035, 0.015], GOLD)
        # whiskers: long gold strands ending in glowing tips (the mechanical touch)
        tube(f"Whisker{s}", [(0.4 * s, -0.95, hz - 0.12), (0.85 * s, -0.95, hz - 0.05), (1.15 * s, -0.7, hz + 0.25), (1.2 * s, -0.5, hz + 0.05)],
             [0.025, 0.018, 0.012, 0.008], GOLD)
        sphere(f"WhiskTip{s}", 0.04, (1.2 * s, -0.5, hz + 0.05), CYAN, sub=1)
        # ears
        sphere(f"Ear{s}", 0.16, (0.78 * s, 0.05, hz + 0.32), red, (0.5, 0.9, 1.3), rot=(0, math.radians(-30 * s), 0))
    # mane: golden tufts down the back of the head
    for i, (x, y, z) in enumerate(((0, 0.55, hz + 0.55), (0.25, 0.65, hz + 0.3), (-0.25, 0.65, hz + 0.3), (0, 0.78, hz + 0.05), (0, 0.7, hz - 0.3))):
        sphere(f"Mane{i}", 0.2, (x, y, z), mat("mane", "#f7c948", rough=0.55, sss=0.3, sheen=0.5), (0.8, 0.8, 1.2))
    # headset (mechanical): band over the head, glowing ear cups, mic boom
    torus("HeadBand", 0.9, 0.04, (0, 0.05, hz + 0.05), GUNMETAL, rot=(0, math.radians(90), 0), arc=(-10, 190))
    for s in (-1, 1):
        cyl(f"EarCup{s}", 0.17, 0.1, (0.9 * s, 0.05, hz + 0.02), GUNMETAL, rot=(0, math.radians(90), 0), bevel=0.02)
        torus(f"EarRing{s}", 0.13, 0.015, (0.96 * s, 0.05, hz + 0.02), CYAN, rot=(0, math.radians(90), 0))
    tube("Boom", [(-0.95, -0.05, hz - 0.05), (-0.85, -0.55, hz - 0.3), (-0.55, -0.85, hz - 0.42)], [0.02, 0.018, 0.015], GUNMETAL)
    sphere("BoomMic", 0.05, (-0.55, -0.87, hz - 0.42), mat("micfoam", "#2b2f45", rough=0.8))
    # arms: left waves, right holds the megaphone up
    tube("ArmL", [(-0.55, -0.1, 1.15), (-0.85, -0.25, 1.45), (-0.95, -0.3, 1.8)], [0.13, 0.11, 0.1], red)
    sphere("HandL", 0.14, (-0.96, -0.3, 1.85), cream)
    for i in range(3):
        sphere(f"FingerL{i}", 0.05, (-1.02 + i * 0.06, -0.38, 1.98 - abs(i - 1) * 0.02), cream, sub=1)
    tube("ArmR", [(0.55, -0.15, 1.1), (0.85, -0.35, 1.2), (1.0, -0.45, 1.35)], [0.13, 0.11, 0.1], red)
    sphere("HandR", 0.14, (1.02, -0.47, 1.38), cream)
    megaphone((1.05, -0.5, 1.45), (0, math.radians(-25), math.radians(-35)), 1.05)
    # legs
    for s in (-1, 1):
        tube(f"Leg{s}", [(0.3 * s, -0.05, 0.4), (0.33 * s, -0.12, 0.15)], [0.16, 0.15], red)
        sphere(f"Foot{s}", 0.2, (0.33 * s, -0.22, 0.1), cream, (1.0, 1.3, 0.55))
        for k in range(3):
            sphere(f"Claw{s}{k}", 0.04, (0.33 * s + (k - 1) * 0.09, -0.46, 0.08), GOLD, sub=1)
    # tail: curls round to the side and up, with glowing mechanical rings and a golden tip
    tail_pts = [(0.2, 0.55, 0.55), (0.9, 0.9, 0.45), (1.45, 0.5, 0.7), (1.5, -0.1, 1.15), (1.25, -0.2, 1.55)]
    tube("Tail", tail_pts, [0.24, 0.18, 0.13, 0.09, 0.05], red)
    for i, (p, r) in enumerate(((Vector((0.9, 0.9, 0.45)), 0.19), (Vector((1.45, 0.5, 0.7)), 0.14), (Vector((1.5, -0.1, 1.15)), 0.1))):
        o = torus(f"TailRing{i}", r, 0.02, p, CYAN if i != 1 else PINK)
        o.rotation_euler = (math.radians(70), math.radians(30 * i), math.radians(40 + 40 * i))
    for i in range(3):
        sphere(f"TailFlame{i}", 0.12 - i * 0.025, (1.22 - i * 0.05, -0.22, 1.62 + i * 0.12), mat("flame", "#f7c948", rough=0.5, sss=0.4, emit="#ffb43a", emit_k=1.2),
               (0.8, 0.8, 1.3))
    # back spikes (soft)
    for i, z in enumerate((1.2, 0.95, 0.7)):
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.1, radius2=0.0, depth=0.22, location=(0, 0.66 - i * 0.02, z), rotation=(math.radians(-70), 0, 0))
        put(smooth(bpy.context.active_object, 1), GOLD)
    top_dock_fn[0] = top_dock


def bird():
    """บอระ — the Bueng Boraphet bird (white eye-ring, glossy dark plumage, two long tail streamers)."""
    plume = mat("plume", "#2d4a5c", rough=0.35, sss=0.1, coat=0.6, sheen=0.4)
    nt = plume.node_tree
    p = nt.nodes["Principled BSDF"]
    # iridescent sheen: a green-blue tint that shifts with angle
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.4
    rmp = nt.nodes.new("ShaderNodeValToRGB")
    rmp.color_ramp.elements[0].color = lin("#2d4a5c")
    rmp.color_ramp.elements[1].color = lin("#3c8f7a")
    nt.links.new(lw.outputs["Facing"], rmp.inputs["Fac"])
    nt.links.new(rmp.outputs["Color"], p.inputs["Base Color"])
    white = mat("whiteplume", "#f4f2ff", rough=0.6, sss=0.3, sheen=0.6)
    beak = mat("beak", "#d9d84a", rough=0.3, sss=0.2, coat=0.4)
    leg = mat("leg", "#e07a3a", rough=0.5)
    # one round body-head (chick proportions)
    sphere("Body", 1.0, (0, 0, 1.25), plume, (1.0, 0.92, 1.05))
    sphere("Chest", 0.62, (0, -0.55, 0.95), mat("chest", "#3a5b70", rough=0.5, sheen=0.5), (1.1, 0.5, 1.0))
    # white rump puff + head tuft
    sphere("Rump", 0.35, (0, 0.85, 0.55), white, (1.2, 0.8, 0.8))
    for i, (x, z) in enumerate(((0, 2.35), (0.12, 2.3), (-0.12, 2.28))):
        tube(f"Tuft{i}", [(x, -0.1, 2.2), (x * 1.5, 0.0, 2.45), (x * 2.2 - 0.05, 0.2, 2.6)], [0.06, 0.04, 0.01], plume)
    # the famous white eye-rings: big and bright, the character's signature
    for s in (-1, 1):
        torus(f"EyeRing{s}", 0.25, 0.07, (0.4 * s, -0.83, 1.55), white, rot=(math.radians(80), 0, math.radians(-12 * s)))
        cartoon_eye(f"Eye{s}", (0.4 * s, -0.84, 1.55), 0.19, iris="#e0463b")
        sphere(f"Cheek{s}", 0.1, (0.62 * s, -0.75, 1.2), CHEEK, (1.2, 0.4, 0.7))
    # beak: short and chunky, open in a grin
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.3, radius2=0.05, depth=0.48, location=(0, -1.16, 1.33), rotation=(math.radians(-96), 0, 0))
    put(smooth(bpy.context.active_object, 2), beak)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.24, radius2=0.05, depth=0.34, location=(0, -1.08, 1.12), rotation=(math.radians(-78), 0, 0))
    put(smooth(bpy.context.active_object, 2), beak)
    sphere("BeakInside", 0.17, (0, -1.06, 1.22), TONGUE, (1, 0.6, 0.45))
    # wings as hands: holding the camera in front
    for s in (-1, 1):
        sphere(f"Wing{s}", 0.42, (0.92 * s, -0.25, 1.05), plume, (0.45, 0.9, 1.1), rot=(math.radians(-25), math.radians(25 * s), 0))
        for k in range(3):
            sphere(f"Feather{s}{k}", 0.1, (1.0 * s, -0.55 - k * 0.04, 0.78 - k * 0.09), plume, (0.5, 0.6, 1.2))
    camera_prop((0, -1.05, 0.72), (0, 0, 0), 1.1)
    tube("Strap", [(-0.6, -0.55, 1.3), (-0.3, -0.95, 0.95), (0.3, -0.95, 0.95), (0.6, -0.55, 1.3)], [0.018] * 4, PURPLE, res=2)
    # tail streamers: two long feathers ending in glowing mechanical tips
    for s in (-1, 1):
        tube(f"Streamer{s}", [(0.08 * s, 0.9, 0.7), (0.55 * s, 1.3, 0.55), (1.15 * s, 1.35, 1.0), (1.45 * s, 1.0, 1.75)], [0.06, 0.035, 0.025, 0.015], plume)
        sphere(f"StreamTip{s}", 0.08, (1.45 * s, 1.0, 1.75), CYAN if s < 0 else PINK, (1, 1, 1.6))
    # mechanical crest: a tiny antenna with a beacon
    tube("Antenna", [(0.3, 0.1, 2.15), (0.42, 0.15, 2.5)], [0.02, 0.012], STEEL)
    sphere("Beacon", 0.06, (0.43, 0.15, 2.55), PINK, sub=1)
    # legs + feet
    for s in (-1, 1):
        tube(f"Leg{s}", [(0.3 * s, -0.1, 0.35), (0.32 * s, -0.15, 0.06)], [0.06, 0.05], leg)
        for k in (-1, 0, 1):
            tube(f"Toe{s}{k}", [(0.32 * s, -0.15, 0.04), (0.32 * s + k * 0.12, -0.42, 0.03)], [0.04, 0.025], leg)
    badge([(0.55, -0.45, 1.6), (0.75, -0.55, 1.2), (0.7, -0.75, 0.95)], (0.66, -0.84, 0.82), card_rot=(0, 0, math.radians(-20)))
    top_dock_fn[0] = top_lake


def cloud():
    """ฟูฟู — a cloud from the city seal's heaven (no pavilion, no seal), floating on little jets."""
    fluff = mat("fluff", "#f1ecff", rough=0.75, sss=0.6, sheen=0.8)
    fluff.node_tree.nodes["Principled BSDF"].inputs["Subsurface Radius"].default_value = (0.8, 0.8, 1.0)
    mb = bpy.data.metaballs.new("CloudMB")
    mb.resolution = 0.05
    mb.render_resolution = 0.03
    lift = 0.55
    for x, y, z, r in ((0, 0, 1.3, 0.95), (-0.75, 0.05, 1.05, 0.62), (0.75, 0.05, 1.05, 0.62), (-0.45, 0.1, 1.9, 0.6), (0.45, 0.1, 1.95, 0.62),
                       (0, 0.15, 2.2, 0.55), (-1.05, 0.15, 1.55, 0.45), (1.05, 0.15, 1.6, 0.45), (0, -0.2, 0.85, 0.6)):
        e = mb.elements.new()
        e.co = (x, y, z + lift - 0.55)
        e.radius = r
        e.stiffness = 2.2
    o = bpy.data.objects.new("Cloud", mb)
    link(o)
    o.data.materials.append(fluff)
    hz = 1.45
    for s in (-1, 1):
        cartoon_eye(f"Eye{s}", (0.34 * s, -0.86, hz + 0.15), 0.2, iris="#5aa8f0", squash=0.95)
        sphere(f"Cheek{s}", 0.13, (0.66 * s, -0.78, hz - 0.15), CHEEK, (1.2, 0.4, 0.7))
        tube(f"Brow{s}", [(0.2 * s, -0.93, hz + 0.48), (0.36 * s, -0.95, hz + 0.53), (0.5 * s, -0.9, hz + 0.5)], [0.03, 0.03, 0.015], mat("browc", "#7b6bbf", rough=0.5))
    smile("Grin", (0, -1.0, hz - 0.18), 0.19)
    # puff arms, the right one holds the mic up
    sphere("ArmL", 0.24, (-1.2, -0.35, 1.05), fluff, (1, 0.9, 0.9))
    sphere("ArmR", 0.24, (1.15, -0.5, 1.45), fluff, (1, 0.9, 0.9))
    mic_prop((1.12, -0.62, 1.6), (math.radians(-20), math.radians(25), 0), 1.2)
    # mechanical jets underneath: steel pods with glowing exhaust
    for s in (-1, 1):
        cyl(f"Jet{s}", 0.17, 0.32, (0.42 * s, 0.0, 0.48), STEEL, bevel=0.03)
        torus(f"JetRing{s}", 0.17, 0.02, (0.42 * s, 0.0, 0.42), CYAN)
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.13, radius2=0.0, depth=0.45, location=(0.42 * s, 0, 0.12), rotation=(math.radians(180), 0, 0))
        flame = bpy.context.active_object
        put(smooth(flame, 1), glow(f"exhaust{s}", "#8ff0ff", 4.0))
    # little antenna with a star: the mechanical crown
    tube("Antenna", [(0.1, 0.1, 2.65), (0.18, 0.05, 2.95)], [0.025, 0.015], STEEL)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09, location=(0.19, 0.05, 3.0))
    put(bpy.context.active_object, glow("starc", "#fff2a8", 8))
    badge([(-0.55, -0.7, 1.05), (-0.45, -0.95, 0.85), (-0.3, -0.98, 0.78)], (-0.38, -1.05, 0.68), card_rot=(0, 0, math.radians(10)))
    top_dock_fn[0] = top_sky


def drop():
    """จ๋อม — a water drop from where the Ping and Nan meet to become the Chao Phraya."""
    glass = mat("glass", "#9fe6ff", rough=0.03, trans=1.0, ior=1.33, spec=0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.0, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = "Drop"
    me = o.data
    for v in me.vertices:
        z = v.co.z
        if z > 0:  # pull the top into a tip
            k = z ** 2.2
            v.co.x *= (1 - 0.95 * k)
            v.co.y *= (1 - 0.95 * k)
            v.co.z = z + 1.15 * k
    o.location = (0, 0, 1.05)
    o.scale = (1.0, 0.9, 0.95)
    put(smooth(o, 2), glass)
    # a soft glowing core so the glass never reads as empty
    sphere("Core", 0.55, (0, 0.05, 0.95), mat("core", "#7fd8ff", rough=0.4, emit="#5fc8ff", emit_k=1.8, alpha=1.0), (1, 0.9, 1))
    hz = 1.15
    for s in (-1, 1):
        cartoon_eye(f"Eye{s}", (0.32 * s, -0.82, hz + 0.12), 0.18, iris="#2f7de0")
        sphere(f"Cheek{s}", 0.11, (0.62 * s, -0.68, hz - 0.18), CHEEK, (1.2, 0.4, 0.7))
    smile("Grin", (0, -0.9, hz - 0.22), 0.18)
    # mechanical visor goggles pushed up on the head
    torus("GoggleBand", 0.72, 0.035, (0, 0, 1.78), GUNMETAL, rot=(math.radians(8), 0, 0))
    for s in (-1, 1):
        cyl(f"Goggle{s}", 0.17, 0.12, (0.25 * s, -0.68, 1.9), GUNMETAL, rot=(math.radians(70), 0, 0), bevel=0.02)
        cyl(f"GoggleLens{s}", 0.13, 0.02, (0.25 * s, -0.74, 1.92), glow(f"lens{s}", "#7ff3ff", 2.5), rot=(math.radians(70), 0, 0))
    # robot arms (segmented steel) holding a megaphone
    for s, end in ((-1, (-1.25, -0.45, 1.55)), (1, (1.2, -0.5, 1.0))):
        tube(f"Arm{s}", [(0.85 * s, -0.1, 1.0), ((0.85 * s + end[0]) / 2, -0.35, (1.0 + end[2]) / 2 + 0.1), end], [0.07, 0.06, 0.06], STEEL)
        sphere(f"Joint{s}", 0.09, ((0.85 * s + end[0]) / 2, -0.35, (1.0 + end[2]) / 2 + 0.1), GUNMETAL)
        torus(f"JointRing{s}", 0.09, 0.015, ((0.85 * s + end[0]) / 2, -0.35, (1.0 + end[2]) / 2 + 0.1), CYAN, rot=(0, math.radians(90), 0))
        sphere(f"Hand{s}", 0.12, end, mat("glove", "#ffffff", rough=0.35, coat=0.6))
    megaphone((1.25, -0.55, 1.08), (0, math.radians(10), math.radians(-30)), 0.95)
    # mechanical boots
    for s in (-1, 1):
        sphere(f"Boot{s}", 0.22, (0.32 * s, -0.12, 0.12), mat("boot", "#3a3f78", rough=0.3, coat=0.8), (1, 1.35, 0.6))
        torus(f"BootRing{s}", 0.2, 0.015, (0.32 * s, -0.12, 0.16), CYAN, rot=(0, 0, 0))
    badge([(-0.45, -0.62, 1.2), (-0.2, -0.88, 0.9), (0.0, -0.92, 0.8)], (0.0, -0.98, 0.68))
    top_dock_fn[0] = top_river


top_dock_fn = [None]
{"dragon": dragon, "bird": bird, "cloud": cloud, "drop": drop}[a.char]()
diorama(top_dock_fn[0])
studio()
sc.render.filepath = a.out
bpy.ops.render.render(write_still=True)
print("DONE", a.out)
