# โพโพ (dragon cub) + ฟูฟู (cloud sidekick) — rigged, animated TV loops.
#   blender -b --python popo.py -- --pose idle --out out/anim-idle/ [--w 560 --h 360] [--samples 6] [--frames 84] [--still 0.3]
# Poses: idle wave announce point celebrate. Every motion is periodic in t∈[0,1),
# so frame N wraps to frame 0 without a seam.
#
# Rig: a hierarchy of empties (root → hips → chest → head, shoulder → elbow →
# hand, tail0…tail4, whisker chains). Limbs, tail and whiskers are curve tubes
# whose control points are hooked to those empties, so they bend smoothly.
import bpy, bmesh, math, sys, argparse, os, random
from mathutils import Vector, Euler, Quaternion, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--pose", default="idle")
ap.add_argument("--out", required=True)
ap.add_argument("--w", type=int, default=700)
ap.add_argument("--h", type=int, default=450)
ap.add_argument("--samples", type=int, default=16)
ap.add_argument("--frames", type=int, default=84)
ap.add_argument("--still", type=float, default=-1.0, help="render one frame at this t instead of the loop")
ap.add_argument("--cam", default="hero")
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.render.resolution_x = a.w
sc.render.resolution_y = a.h
sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"

# shared helpers, materials, diorama and studio from the prototype script
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "proto.py")).read()
exec(src[src.index("FONT ="):src.index("# ------------------------------------------------------------------ characters")])

TAU = math.tau


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    link(e)
    e.empty_display_size = 0.1
    if parent is not None:
        e.parent = parent
        e.location = parent.matrix_world.inverted() @ Vector(loc)
    else:
        e.location = loc
    e.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update()
    return e


def attach(o, parent):
    """Parent keeping the current world transform."""
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    o.matrix_world = mw
    return o


def hook_tube(name, pts, radii, m, hooks, res=4):
    """Tube whose i-th control point follows hooks[i] (an empty)."""
    o = tube(name, pts, radii, m, res=res)
    bpy.context.view_layer.update()
    for i, h in enumerate(hooks):
        md = o.modifiers.new(f"hook{i}", "HOOK")
        md.object = h
        md.vertex_indices_set([i * 3, i * 3 + 1, i * 3 + 2])
        md.matrix_inverse = h.matrix_world.inverted()
        md.center = Vector(pts[i])
    return o


def aim(rest_dir, target_dir):
    return Vector(rest_dir).normalized().rotation_difference(Vector(target_dir).normalized())


S = []  # every animated control, for keyframing


def ctrl(e):
    S.append(e)
    return e


# ================================================================== โพโพ
red = mat("dragon", "#e2463b", rough=0.42, sss=0.25, coat=0.25, sheen=0.15)
nt = red.node_tree
p_ = nt.nodes["Principled BSDF"]
vor = nt.nodes.new("ShaderNodeTexVoronoi")
vor.inputs["Scale"].default_value = 22
bmp = nt.nodes.new("ShaderNodeBump")
bmp.inputs["Strength"].default_value = 0.12
nt.links.new(vor.outputs["Distance"], bmp.inputs["Height"])
nt.links.new(bmp.outputs["Normal"], p_.inputs["Normal"])
cream = mat("belly", "#ffe2b0", rough=0.5, sss=0.3)
mane_m = mat("mane", "#f7c948", rough=0.55, sss=0.3, sheen=0.5)

root = ctrl(empty("PoRoot", (0, 0, 0)))
hips = ctrl(empty("PoHips", (0, 0, 0.45), root))
chest = ctrl(empty("PoChest", (0, 0, 0.85), hips))

# legs (planted on root so they stay on the floor while the body squashes)
for s in (-1, 1):
    attach(tube(f"Leg{s}", [(0.3 * s, -0.05, 0.42), (0.33 * s, -0.12, 0.15)], [0.16, 0.15], red), root)
    attach(sphere(f"Foot{s}", 0.2, (0.33 * s, -0.22, 0.1), cream, (1.0, 1.3, 0.55)), root)
    for k in range(3):
        attach(sphere(f"Claw{s}{k}", 0.04, (0.33 * s + (k - 1) * 0.09, -0.46, 0.08), GOLD, sub=1), root)

attach(sphere("Body", 0.62, (0, 0.05, 0.78), red, (1.0, 0.92, 1.05)), chest)
for i, (z, s_) in enumerate(((0.55, 0.36), (0.78, 0.4), (1.0, 0.36))):
    attach(sphere(f"Belly{i}", s_, (0, -0.42, z), cream, (1.05, 0.35, 0.6)), chest)
lan_pts = [(-0.33, -0.3, 1.38), (-0.2, -0.52, 1.18), (0.0, -0.6, 1.08), (0.2, -0.52, 1.18), (0.33, -0.3, 1.38)]
badge(lan_pts, (0.0, -0.64, 0.95))
for n in ("Lanyard", "Badge", "BadgeTop", "BadgeTxt", "BadgeLed"):
    attach(bpy.data.objects[n], chest)
for i, z in enumerate((1.2, 0.95, 0.7)):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.1, radius2=0.0, depth=0.22, location=(0, 0.66 - i * 0.02, z), rotation=(math.radians(-70), 0, 0))
    attach(put(smooth(bpy.context.active_object, 1), GOLD), chest)

# head
hz = 1.86
head = ctrl(empty("PoHead", (0, 0, 1.4), chest))
attach(sphere("Head", 0.82, (0, 0, hz), red, (1.08, 0.95, 0.9)), head)
attach(sphere("Snout", 0.4, (0, -0.72, hz - 0.24), cream, (1.15, 0.85, 0.66)), head)
for s in (-1, 1):
    attach(sphere(f"Nostril{s}", 0.045, (0.13 * s, -1.02, hz - 0.1), DARK, (1, 0.6, 0.7)), head)
mouth = ctrl(empty("PoMouth", (0, -1.04, hz - 0.33), head))
smile("Grin", (0, -1.04, hz - 0.33), 0.2)
for n in ("Grin_m", "Grin_t"):
    attach(bpy.data.objects[n], mouth)
for s in (-1, 1):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.035, radius2=0.0, depth=0.08, location=(0.09 * s, -1.07, hz - 0.36), rotation=(math.radians(180), 0, 0))
    attach(put(smooth(bpy.context.active_object, 1), CARD), mouth)
eyes = []
for s in (-1, 1):
    e = ctrl(empty(f"PoEye{s}", (0.36 * s, -0.66, hz + 0.18), head))
    cartoon_eye(f"Eye{s}", (0.36 * s, -0.66, hz + 0.18), 0.19, iris="#e0a21b")
    for n in ("_ball", "_iris", "_g1", "_g2"):
        attach(bpy.data.objects[f"Eye{s}{n}"], e)
    eyes.append(e)
    attach(sphere(f"Cheek{s}", 0.11, (0.62 * s, -0.55, hz - 0.12), CHEEK, (1.2, 0.4, 0.7)), head)
brows = []
for s in (-1, 1):
    b = ctrl(empty(f"PoBrow{s}", (0.38 * s, -0.7, hz + 0.5), head))
    attach(tube(f"Brow{s}", [(0.22 * s, -0.72, hz + 0.45), (0.38 * s, -0.7, hz + 0.52), (0.52 * s, -0.62, hz + 0.47)], [0.035, 0.03, 0.012], GOLD), b)
    brows.append(b)
    attach(tube(f"Horn{s}", [(0.32 * s, -0.05, hz + 0.62), (0.42 * s, 0.05, hz + 0.95), (0.36 * s, 0.32, hz + 1.12)], [0.11, 0.07, 0.02], GOLD), head)
    attach(tube(f"Antler{s}", [(0.41 * s, 0.02, hz + 0.88), (0.6 * s, -0.02, hz + 1.0), (0.66 * s, 0.05, hz + 1.12)], [0.05, 0.035, 0.015], GOLD), head)
    attach(sphere(f"Ear{s}", 0.16, (0.78 * s, 0.05, hz + 0.32), red, (0.5, 0.9, 1.3), rot=(0, math.radians(-30 * s), 0)), head)
for i, (x, y, z) in enumerate(((0, 0.55, hz + 0.55), (0.25, 0.65, hz + 0.3), (-0.25, 0.65, hz + 0.3), (0, 0.78, hz + 0.05), (0, 0.7, hz - 0.3))):
    attach(sphere(f"Mane{i}", 0.2, (x, y, z), mane_m, (0.8, 0.8, 1.2)), head)
attach(torus("HeadBand", 0.9, 0.04, (0, 0.05, hz + 0.05), GUNMETAL, rot=(0, math.radians(90), 0), arc=(-10, 190)), head)
for s in (-1, 1):
    attach(cyl(f"EarCup{s}", 0.17, 0.1, (0.9 * s, 0.05, hz + 0.02), GUNMETAL, rot=(0, math.radians(90), 0), bevel=0.02), head)
    attach(torus(f"EarRing{s}", 0.13, 0.015, (0.96 * s, 0.05, hz + 0.02), CYAN, rot=(0, math.radians(90), 0)), head)
attach(tube("Boom", [(-0.95, -0.05, hz - 0.05), (-0.85, -0.55, hz - 0.3), (-0.55, -0.85, hz - 0.42)], [0.02, 0.018, 0.015], GUNMETAL), head)
attach(sphere("BoomMic", 0.05, (-0.55, -0.87, hz - 0.42), mat("micfoam", "#2b2f45", rough=0.8)), head)

# whiskers: head → w1 → w2 chains, tips glow
whisk = []
for s in (-1, 1):
    pts = [(0.4 * s, -0.95, hz - 0.12), (0.85 * s, -0.95, hz - 0.05), (1.15 * s, -0.7, hz + 0.25), (1.2 * s, -0.5, hz + 0.05)]
    w1 = ctrl(empty(f"Whisk{s}a", pts[1], head))
    w2 = ctrl(empty(f"Whisk{s}b", pts[2], w1))
    w3 = ctrl(empty(f"Whisk{s}c", pts[3], w2))
    hook_tube(f"Whisker{s}", pts, [0.025, 0.018, 0.012, 0.008], GOLD, [head, w1, w2, w3])
    attach(sphere(f"WhiskTip{s}", 0.04, pts[3], CYAN, sub=1), w3)
    whisk.append((w1, w2, w3, s))

# arms: shoulder → elbow → hand, tube hooked to all three
arms = {}
for side, s in (("L", -1), ("R", 1)):
    sh_p = Vector((0.55 * s, -0.1, 1.15))
    el_p = sh_p + Vector((0.22 * s, -0.08, -0.22))
    ha_p = el_p + Vector((0.12 * s, -0.08, -0.24))
    sh = ctrl(empty(f"Sh{side}", sh_p, chest))
    el = ctrl(empty(f"El{side}", el_p, sh))
    ha = ctrl(empty(f"Ha{side}", ha_p, el))
    hook_tube(f"Arm{side}", [tuple(sh_p), tuple(el_p), tuple(ha_p)], [0.13, 0.11, 0.1], red, [sh, el, ha])
    attach(sphere(f"Hand{side}", 0.14, tuple(ha_p), cream), ha)
    for i in range(3):
        attach(sphere(f"Finger{side}{i}", 0.05, tuple(ha_p + Vector(((i - 1) * 0.06, -0.08, -0.1))), cream, sub=1), ha)
    arms[side] = (sh, el, ha, sh_p, el_p, ha_p)
mega = megaphone(tuple(arms["R"][5] + Vector((0.02, -0.05, 0.05))), (0, math.radians(-10), math.radians(-60)), 1.0)
attach(mega, arms["R"][2])

# tail chain
tail_pts = [(0.2, 0.55, 0.55), (0.9, 0.9, 0.45), (1.45, 0.5, 0.7), (1.5, -0.1, 1.15), (1.25, -0.2, 1.55)]
tails = []
prev = hips
for i, p in enumerate(tail_pts):
    t_ = ctrl(empty(f"Tail{i}", p, prev))
    tails.append(t_)
    prev = t_
hook_tube("Tail", tail_pts, [0.24, 0.18, 0.13, 0.09, 0.05], red, tails)
for i, (k, r) in enumerate(((1, 0.19), (2, 0.14), (3, 0.1))):
    o = torus(f"TailRing{i}", r, 0.02, tail_pts[k], CYAN if i != 1 else PINK)
    o.rotation_euler = (math.radians(70), math.radians(30 * i), math.radians(40 + 40 * i))
    attach(o, tails[k])
for i in range(3):
    attach(sphere(f"TailFlame{i}", 0.12 - i * 0.025, (1.22 - i * 0.05, -0.22, 1.62 + i * 0.12),
                  mat("flame", "#f7c948", rough=0.5, sss=0.4, emit="#ffb43a", emit_k=1.2), (0.8, 0.8, 1.3)), tails[4])

# ================================================================== ฟูฟู (sidekick, ~half size)
FU = Vector((-1.3, -0.15, 2.55))
fu_root = ctrl(empty("FuRoot", tuple(FU)))
fu_body = ctrl(empty("FuBody", tuple(FU), fu_root))
fluff = mat("fluff", "#f1ecff", rough=0.75, sss=0.6, sheen=0.8)
fluff.node_tree.nodes["Principled BSDF"].inputs["Subsurface Radius"].default_value = (0.8, 0.8, 1.0)
k = 0.46
mb = bpy.data.metaballs.new("FuMB")
mb.resolution = 0.03
mb.render_resolution = 0.02
for x, y, z, r in ((0, 0, 0, 0.95), (-0.75, 0.05, -0.25, 0.62), (0.75, 0.05, -0.25, 0.62), (-0.45, 0.1, 0.6, 0.6), (0.45, 0.1, 0.65, 0.62),
                   (0, 0.15, 0.9, 0.55), (-1.05, 0.15, 0.25, 0.45), (1.05, 0.15, 0.3, 0.45), (0, -0.2, -0.45, 0.6)):
    el_ = mb.elements.new()
    el_.co = (x * k, y * k, z * k)
    el_.radius = r * k
    el_.stiffness = 2.2
fu = bpy.data.objects.new("Fufu", mb)
link(fu)
fu.location = FU
fu.data.materials.append(fluff)
attach(fu, fu_body)
fu_face = ctrl(empty("FuFace", tuple(FU + Vector((0, -0.4, 0.05))), fu_body))
for s in (-1, 1):
    cartoon_eye(f"FuEye{s}", tuple(FU + Vector((0.16 * s, -0.4, 0.12))), 0.095, iris="#5aa8f0")
    for n in ("_ball", "_iris", "_g1", "_g2"):
        attach(bpy.data.objects[f"FuEye{s}{n}"], fu_face)
    attach(sphere(f"FuCheek{s}", 0.06, tuple(FU + Vector((0.31 * s, -0.36, -0.03))), CHEEK, (1.2, 0.4, 0.7)), fu_face)
smile("FuGrin", tuple(FU + Vector((0, -0.46, -0.07))), 0.09)
for n in ("FuGrin_m", "FuGrin_t"):
    attach(bpy.data.objects[n], fu_face)
fu_arms = {}
for side, s in (("L", -1), ("R", 1)):
    ha = ctrl(empty(f"FuHa{side}", tuple(FU + Vector((0.55 * s, -0.18, -0.12))), fu_body))
    attach(sphere(f"FuArm{side}", 0.11, tuple(FU + Vector((0.55 * s, -0.18, -0.12))), fluff), ha)
    fu_arms[side] = ha
mic = mic_prop(tuple(FU + Vector((0.58, -0.25, -0.02))), (math.radians(-20), math.radians(25), 0), 0.6)
attach(mic, fu_arms["R"])
flames = []
for s in (-1, 1):
    attach(cyl(f"FuJet{s}", 0.08, 0.15, tuple(FU + Vector((0.18 * s, 0, -0.36))), STEEL, bevel=0.015), fu_body)
    attach(torus(f"FuJetRing{s}", 0.08, 0.01, tuple(FU + Vector((0.18 * s, 0, -0.41))), CYAN), fu_body)
    fl = ctrl(empty(f"FuFlame{s}", tuple(FU + Vector((0.18 * s, 0, -0.44))), fu_body))
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.06, radius2=0.0, depth=0.22, location=tuple(FU + Vector((0.18 * s, 0, -0.55))), rotation=(math.radians(180), 0, 0))
    attach(put(smooth(bpy.context.active_object, 1), glow(f"fuex{s}", "#8ff0ff", 4.0)), fl)
    flames.append(fl)
attach(tube("FuAntenna", [tuple(FU + Vector((0.05, 0.05, 0.5))), tuple(FU + Vector((0.09, 0.02, 0.66)))], [0.012, 0.008], STEEL), fu_body)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.045, location=tuple(FU + Vector((0.095, 0.02, 0.69))))
attach(put(bpy.context.active_object, glow("fustar", "#fff2a8", 8)), fu_body)

# ================================================================== effects
rings = []
for i in range(3):
    m_ = glow(f"sound{i}", "#9ff0ff", 0.0)
    r = torus(f"Sound{i}", 0.3, 0.02, (0, 0, 0), m_, rot=(0, math.radians(90), 0))
    r.parent = mega  # megaphone-local: +x is the way it points
    r.location = (0.75, 0, 0)
    r.hide_render = a.pose != "announce"
    rings.append((r, m_))
confetti = []
cols = ["#ff8fd0", "#7ff3ff", "#f7c948", "#b8a2ff", "#7fdcc4"]
import random as _r
_r.seed(3)
for i in range(26):
    m_ = mat(f"conf{i}", cols[i % 5], rough=0.4, emit=cols[i % 5], emit_k=0.8)
    c = box(f"Conf{i}", (0.07, 0.012, 0.04), (0, 0, -10), m_, bevel=0.0)
    c.rotation_mode = "XYZ"
    confetti.append((c, _r.uniform(-2.2, 2.2), _r.uniform(-0.6, 0.6), _r.random(), _r.uniform(0.7, 1.3), _r.random() * TAU))

# diorama + studio
diorama(top_dock)
for o in list(bpy.data.objects):  # the left lantern sits where FuFu floats
    if o.name.endswith("-1.4"):
        bpy.data.objects.remove(o)
studio()
cam = sc.camera
cam.data.lens = 44
camT = bpy.data.objects["CamT"]

# ================================================================== animation
REST = {e.name: (e.location.copy(), e.rotation_quaternion.copy(), e.scale.copy()) for e in S}


def reset():
    for e in S:
        l, q, s = REST[e.name]
        e.location = l.copy()
        e.rotation_quaternion = q.copy()
        e.scale = s.copy()


def rotE(e, x=0, y=0, z=0):
    e.rotation_quaternion = REST[e.name][1] @ Euler((x, y, z)).to_quaternion()


def arm_to(side, upper, fore):
    sh, el, ha, sp, ep, hp = arms[side]
    q1 = aim(ep - sp, upper)
    sh.rotation_quaternion = q1
    el.rotation_quaternion = aim(hp - ep, q1.inverted() @ Vector(fore))


def sn(t, f=1.0, ph=0.0):
    return math.sin(TAU * (f * t + ph))


def ease_jump(t):
    """0..1 loop → (height, squash): crouch, launch, air, land, settle."""
    if t < 0.15:
        u = t / 0.15
        return 0.0, -0.18 * math.sin(math.pi * u * 0.5)
    if t < 0.6:
        u = (t - 0.15) / 0.45
        return 0.6 * math.sin(math.pi * u), 0.12 * math.cos(math.pi * u)
    if t < 0.75:
        u = (t - 0.6) / 0.15
        return 0.0, -0.2 * math.sin(math.pi * u)
    return 0.0, 0.0


def pose(t, P):
    reset()
    blink = 1.0
    for bt in ((0.42,) if P != "celebrate" else ()):
        d = abs(t - bt)
        if d < 0.03:
            blink = 0.12 + 0.88 * (d / 0.03)
    breath = sn(t, 2 if P == "idle" else 3)
    mouth_open = 1.0
    squash = 0.025 * breath
    head_tilt = (0, 0, 0)
    up_L, fo_L = Vector((-0.6, -0.15, -0.7)), Vector((-0.2, -0.3, -0.9))
    up_R, fo_R = Vector((0.6, -0.3, -0.5)), Vector((0.3, -0.8, -0.2))
    tail_amp, tail_f = 0.12, 1
    whisk_amp = 0.12
    brow = 0.0
    lean = (0, 0, 0)
    fu_off = Vector((0, 0, 0.08 * sn(t, 2)))
    fu_rot = (0, 0, 0.1 * sn(t))
    fu_arm = {"L": Vector((0, 0, 0.03 * sn(t, 2, 0.2))), "R": Vector((0, 0, 0.03 * sn(t, 2, 0.5)))}
    fu_squash = 0.04 * sn(t, 2, 0.25)
    fu_look = 0.0

    if P == "idle":
        head_tilt = (0.04 * sn(t, 1, 0.1), 0.06 * sn(t, 1), 0.12 * sn(t, 1, 0.3))
        fu_look = 0.3 * sn(t, 1, 0.5)
    elif P == "wave":
        w = sn(t, 3)
        up_L = Vector((-0.75, -0.25, 0.55))
        fo_L = Vector((-0.35 + 0.45 * w, -0.2, 0.9))
        head_tilt = (0.05, 0.12 * sn(t, 3, 0.1), -0.1)
        brow = 0.03
        tail_amp, tail_f = 0.25, 3
        fu_rot = (0, 0, 0.35 * sn(t, 3, 0.15))
        fu_arm["L"] = Vector((-0.08, 0, 0.18 + 0.12 * sn(t, 3, 0.2)))
        fu_off = Vector((0, 0, 0.1 * abs(sn(t, 1.5))))
    elif P == "announce":
        pump = 0.5 + 0.5 * sn(t, 2)
        up_R = Vector((0.6, -0.5, 0.45 + 0.1 * pump))
        fo_R = Vector((-0.1, -0.9, 0.3))
        up_L = Vector((-0.75, -0.2, 0.25 + 0.3 * pump))
        fo_L = Vector((-0.4, -0.3, 0.8))
        mouth_open = 1.3 + 0.5 * pump
        head_tilt = (-0.12 - 0.06 * pump, 0.08, 0.15)
        brow = -0.02
        squash = 0.05 * pump
        tail_amp, tail_f = 0.2, 2
        whisk_amp = 0.25
        # FuFu holds the mic towards PoPo, bouncing on the beat
        fu_off = Vector((0.25, -0.1, 0.06 * pump))
        fu_arm["R"] = Vector((0.15, -0.05, 0.12))
        fu_rot = (0, 0, -0.35)
    elif P == "point":
        sway = sn(t, 2)
        up_L = Vector((-1.0, -0.25, 0.12))
        fo_L = Vector((-1.0, -0.35, 0.08 + 0.05 * sway))
        lean = (0, 0.08, -0.28)
        head_tilt = (0.05, 0.1, -0.3 + 0.05 * sway)
        brow = 0.04
        fu_off = Vector((-0.15 + 0.1 * sway, 0, 0.05))
        fu_arm["L"] = Vector((-0.15, -0.05, 0.05 + 0.05 * sway))
        fu_rot = (0, 0, 0.45)
        fu_look = 0.5
    elif P == "celebrate":
        hgt, sq = ease_jump(t)
        root.location = REST[root.name][0] + Vector((0, 0, hgt))
        squash = sq
        air = hgt / 0.6
        up_L = Vector((-0.9, -0.3, 0.3 + 0.4 * air))
        fo_L = Vector((-0.5, -0.4, 0.8))
        up_R = Vector((0.9, -0.3, 0.3 + 0.4 * air))
        fo_R = Vector((0.5, -0.4, 0.8))
        mouth_open = 1.2 + 0.6 * air
        head_tilt = (-0.15 * air, 0, 0)
        brow = 0.05 * air
        blink = 0.55  # happy squint
        tail_amp, tail_f = 0.3, 2
        fu_rot = (0, 0, TAU * t)  # a full spin each loop
        fu_off = Vector((0, 0, 0.25 * abs(sn(t, 2))))
        fu_arm["L"] = Vector((-0.05, 0, 0.2))
        fu_arm["R"] = Vector((0.05, 0, 0.2))
        for c, x, y, ph, sp, rp in confetti:
            u = (t * sp + ph) % 1.0
            c.location = (x + 0.15 * math.sin(TAU * (u * 2 + ph)), y, 4.2 - 4.4 * u)
            c.rotation_euler = (rp + TAU * u * 3, rp * 0.5 + TAU * u * 2, rp)

    if P != "celebrate":
        for c, *_ in confetti:
            c.location = (0, 0, -10)
    # body squash & stretch (volume-preserving-ish)
    hips.scale = Vector((1 - 0.5 * squash, 1 - 0.5 * squash, 1 + squash))
    rotE(hips, *lean)
    rotE(head, *head_tilt)
    mouth.scale = Vector((1, 1, mouth_open))
    for e in eyes:
        e.scale = Vector((1, 1, blink))
    for b in brows:
        b.location = REST[b.name][0] + Vector((0, 0, brow))
    arm_to("L", up_L, fo_L)
    arm_to("R", up_R, fo_R)
    # tail: each link lags the previous one (follow-through)
    for i, tl in enumerate(tails):
        rotE(tl, 0.05 * sn(t, tail_f, -0.08 * i), 0, tail_amp * sn(t, tail_f, -0.1 * i))
    for w1, w2, w3, s in whisk:
        for j, w in enumerate((w1, w2, w3)):
            rotE(w, whisk_amp * sn(t, 2, -0.12 * j + (0.25 if s > 0 else 0)), 0, 0.5 * whisk_amp * sn(t, 1, -0.1 * j))
    # FuFu
    fu_root.location = REST[fu_root.name][0] + fu_off
    rotE(fu_body, *fu_rot)
    fu_body.scale = Vector((1 + 0.5 * fu_squash, 1 + 0.5 * fu_squash, 1 - fu_squash))
    rotE(fu_face, 0, 0, fu_look)
    for side, off in fu_arm.items():
        fu_arms[side].location = REST[fu_arms[side].name][0] + off
    for i, fl in enumerate(flames):
        fl.scale = Vector((1, 1, 0.85 + 0.3 * abs(sn(t, 7, 0.3 * i))))
    # megaphone sound rings while announcing
    for i, (r, m_) in enumerate(rings):
        u = (t * 2 + i / 3) % 1.0
        on = P == "announce"
        r.scale = Vector((1, 0.6 + 2.2 * u, 0.6 + 2.2 * u))
        r.location = (0.75 + 0.9 * u, 0, 0)
        m_.node_tree.nodes["Emission"].inputs["Strength"].default_value = (6.0 * (1 - u)) if on else 0.0
    # megaphone: aimed in world space, whatever the arm is doing
    mega_dir = {"announce": (1.0, -0.45, 0.15 + 0.05 * sn(t, 2)), "celebrate": (0.35, -0.35, 1.0)}.get(P, (0.35, -0.55, -0.75))
    bpy.context.view_layer.update()
    hq = arms["R"][2].matrix_world.to_quaternion()
    qd = Vector((1, 0, 0)).rotation_difference(Vector(mega_dir).normalized())
    mega.rotation_mode = "QUATERNION"
    mega.rotation_quaternion = hq.inverted() @ qd
    # camera: a slow, looping drift
    cam.location = Vector((-2.2 + 0.45 * sn(t), -9.4 + 0.25 * sn(t, 1, 0.25), 3.0 + 0.12 * sn(t, 2)))
    camT.location = Vector((-0.15, 0, 1.55))


def key_all(frame):
    for e in S:
        e.keyframe_insert("location", frame=frame)
        e.keyframe_insert("rotation_quaternion", frame=frame)
        e.keyframe_insert("scale", frame=frame)
    cam.keyframe_insert("location", frame=frame)
    mega.keyframe_insert("rotation_quaternion", frame=frame)
    for c, *_ in confetti:
        c.keyframe_insert("location", frame=frame)
        c.keyframe_insert("rotation_euler", frame=frame)
    for r, m_ in rings:
        r.keyframe_insert("location", frame=frame)
        r.keyframe_insert("scale", frame=frame)
        m_.node_tree.nodes["Emission"].inputs["Strength"].keyframe_insert("default_value", frame=frame)


if a.still >= 0:
    pose(a.still, a.pose)
    bpy.context.view_layer.update()
    sc.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
else:
    N = a.frames
    for f in range(N):
        pose(f / N, a.pose)
        key_all(f)
    sc.frame_start, sc.frame_end = 0, N - 1
    os.makedirs(a.out, exist_ok=True)
    sc.render.filepath = os.path.join(a.out, "")
    # Resume: frames already on disk are skipped, so a killed render picks up where it stopped.
    sc.render.use_overwrite = False
    sc.render.use_placeholder = False
    bpy.ops.render.render(animation=True)
print("DONE")
