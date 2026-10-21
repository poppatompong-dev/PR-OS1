# PR-OS mascot v3 — the speech-bubble character with the megaphone, rebuilt in
# Blender for a film-like finish. Run headless:
#   blender -b --python mascot.py -- --style pixar --pose wave --out /path/a.png [--res 900] [--samples 64]
#   blender -b --python mascot.py -- --style pixar --pose idle --anim --frames 48 --out /path/frames/
# Styles: pixar (soft subsurface), clay (matte stop-motion), vinyl (glossy toy)
# Poses:  idle, wave, announce (megaphone up), point, celebrate
import bpy, bmesh, math, sys, argparse
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--style", default="pixar")
ap.add_argument("--pose", default="wave")
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=900)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--anim", action="store_true")
ap.add_argument("--frames", type=int, default=48)
ap.add_argument("--glb", default="")
# --stage: a finished TV panel (navy backdrop, glossy podium with a cyan ring,
# reflective floor) instead of a transparent cut-out. --w/--h set its size.
ap.add_argument("--stage", action="store_true")
ap.add_argument("--w", type=int, default=0)
ap.add_argument("--h", type=int, default=0)
a = ap.parse_args(argv)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = True
sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.max_bounces = 6
sc.render.film_transparent = not a.stage
sc.render.resolution_x = a.res
sc.render.resolution_y = a.res
if a.w and a.h:
    sc.render.resolution_x = a.w
    sc.render.resolution_y = a.h
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast" if a.style != "clay" else "AgX - Base Contrast"

def hexrgb(h, a_=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # sRGB -> linear
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*c, a_)

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.45, sss=0.0, coat=0.0, metal=0.0, spec=0.5, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hexrgb(color)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Specular IOR Level"].default_value = spec
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
        p.inputs["Subsurface Radius"].default_value = (0.9, 0.6, 0.45)
        p.inputs["Subsurface Scale"].default_value = 0.12
    if coat:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = 0.06
    if sheen:
        p.inputs["Sheen Weight"].default_value = sheen
    return m

S = a.style
if S == "clay":
    body_m = mat("body", "#a6d9c6", rough=0.92, sss=0.04, spec=0.2, sheen=0.25)
    gloss = 0.7
elif S == "vinyl":
    body_m = mat("body", "#86dcc3", rough=0.1, coat=1.0, spec=0.7)
    gloss = 0.08
else:  # pixar
    body_m = mat("body", "#b4e8d8", rough=0.42, sss=0.5, coat=0.12, spec=0.45, sheen=0.3)
    gloss = 0.2

def clay_texture(m, strength=0.35, scale=9.0):
    """Thumb-pressed clay: noise bump + slight colour mottling."""
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 6
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = scale * 0.6
    mix = nt.nodes.new("ShaderNodeMath"); mix.operation = "ADD"
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = strength; bump.inputs["Distance"].default_value = 0.02
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], mix.inputs[0])
    nt.links.new(vor.outputs["Distance"], mix.inputs[1])
    nt.links.new(mix.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    # mottled colour
    base = p.inputs["Base Color"].default_value[:]
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(x * 0.9 for x in base[:3]) + (1,)
    ramp.color_ramp.elements[1].color = tuple(min(1, x * 1.06) for x in base[:3]) + (1,)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])

eye_m = mat("eye", "#24164a", rough=0.55 if S == "clay" else 0.08, coat=0.0 if S == "clay" else 1.0)
white_m = mat("white", "#ffffff", rough=0.2)
cheek_m = mat("cheek", "#ff9db0", rough=0.6, sss=0.2)
gold_m = mat("gold", "#f2b632", rough=0.25, metal=1.0)
foot_m = mat("foot", "#9b5bd1", rough=gloss + 0.1, coat=0.6 if S != "clay" else 0)
cone_m = mat("cone", "#f4a3b5", rough=gloss + 0.15, coat=0.5 if S != "clay" else 0, sss=0.1)
rim_m = mat("rim", "#ffffff", rough=gloss + 0.1)
grip_m = mat("grip", "#8a4fc4", rough=0.4)
mouth_m = mat("mouth", "#3a1f5c", rough=0.3)
tongue_m = mat("tongue", "#ff7f98", rough=0.5, sss=0.2)
brow_m = mat("brow", "#3a2a5c", rough=0.5)
if S == "clay":
    for m_ in (body_m, foot_m, cone_m, grip_m, cheek_m):
        clay_texture(m_, 0.3 if m_ is body_m else 0.2)

# cheek blush: emission-free soft gradient via alpha
def soft_cheek(m):
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Alpha"].default_value = 0.75
    m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
soft_cheek(cheek_m)

def shade_smooth(o, sub=2):
    for poly in o.data.polygons:
        poly.use_smooth = True
    if sub:
        md = o.modifiers.new("sub", "SUBSURF")
        md.levels = sub
        md.render_levels = sub + 1

def assign(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)

root = bpy.data.objects.new("Mascot", None)
sc.collection.objects.link(root)

def parent(o, p=root):
    o.parent = p
    return o

# ---------------------------------------------------------------- body (speech bubble)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.0, location=(0, 0, 1.25))
body = bpy.context.active_object
body.name = "Body"
body.scale = (1.18, 0.82, 0.98)
shade_smooth(body, 1)
assign(body, body_m)
parent(body)
# bubble tail (cone pointing down-left), merged visually
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.36, radius2=0.02, depth=0.5, location=(-0.7, -0.28, 0.5))
tail = bpy.context.active_object
tail.rotation_euler = Euler((math.radians(170), math.radians(-38), 0))
shade_smooth(tail, 0)
assign(tail, body_m)
parent(tail)

# ---------------------------------------------------------------- face
def sphere(name, r, loc, m, scale=(1, 1, 1), seg=32, sub=1, par=root):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    shade_smooth(o, sub)
    assign(o, m)
    parent(o, par)
    return o

face_y = -0.79
eyes = []
for side in (-1, 1):
    e = sphere(f"Eye{side}", 0.15, (0.34 * side, face_y + 0.05, 1.42), eye_m, (1, 0.55, 1.25))
    eyes.append(e)
    sphere(f"Glint{side}", 0.045, (0.34 * side + 0.05, face_y - 0.03, 1.52), white_m, (1, 0.6, 1))
    sphere(f"Glint2{side}", 0.02, (0.34 * side - 0.04, face_y - 0.03, 1.36), white_m, (1, 0.6, 1))
    sphere(f"Cheek{side}", 0.13, (0.62 * side, face_y + 0.12, 1.16), cheek_m, (1.2, 0.35, 0.7))

# smile: a torus segment
bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.035, major_segments=48, minor_segments=12,
                                 location=(0, face_y - 0.02, 1.2), rotation=(math.radians(90), 0, 0))
mouth = bpy.context.active_object
mouth.name = "Mouth"
bm = bmesh.new(); bm.from_mesh(mouth.data)
for v in [v for v in bm.verts if v.co.y > 0.02]:  # keep lower half (local y after rotation = up)
    bm.verts.remove(v)
bm.to_mesh(mouth.data); bm.free()
shade_smooth(mouth, 1)
assign(mouth, mouth_m)
parent(mouth)

# eyebrows: small capsules, tilted per pose (set_pose)
brows = []
for side in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.032, depth=0.17, location=(0.34 * side, face_y + 0.04, 1.66),
                                        rotation=(0, math.radians(90), 0))
    b = bpy.context.active_object
    b.name = f"Brow{side}"
    md = b.modifiers.new("bev", "BEVEL"); md.width = 0.03; md.segments = 4; md.limit_method = "NONE"
    shade_smooth(b, 1)
    assign(b, brow_m)
    parent(b)
    brows.append(b)

# open mouth (announce / celebrate): dark oval + tongue, smile hidden
mouth_open = sphere("MouthOpen", 0.16, (0, face_y - 0.005, 1.2), mouth_m, (1.0, 0.3, 0.68))
tongue = sphere("Tongue", 0.09, (0, face_y - 0.04, 1.14), tongue_m, (1.1, 0.3, 0.5))

# three gold dots (typing indicator) on the forehead
for i, x in enumerate((-0.2, 0, 0.2)):
    sphere(f"Dot{i}", 0.075, (x, face_y + 0.08, 1.86), gold_m)

# ---------------------------------------------------------------- limbs
def capsule(name, r, length, m, par):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=length)
    c = bpy.context.active_object
    c.name = name
    md = c.modifiers.new("bev", "BEVEL"); md.width = r * 0.95; md.segments = 6; md.limit_method = "NONE"
    shade_smooth(c, 1)
    assign(c, m)
    c.parent = par
    return c

def arm(side):
    sh = bpy.data.objects.new(f"Shoulder{side}", None)
    sc.collection.objects.link(sh)
    sh.parent = root
    sh.location = (1.12 * side, -0.05, 1.05)
    up = capsule(f"Arm{side}", 0.1, 0.5, body_m, sh)
    up.location = (0.22 * side, 0, 0)
    up.rotation_euler = (0, math.radians(90), 0)
    hand = sphere(f"Hand{side}", 0.13, (0.5 * side, 0, 0), body_m, par=sh)
    return sh, hand

shL, handL = arm(-1)
shR, handR = arm(1)

for side in (-1, 1):
    sphere(f"Foot{side}", 0.2, (0.38 * side, -0.1, 0.12), foot_m, (1.25, 1.5, 0.55))

# ---------------------------------------------------------------- megaphone (in right hand)
mega = bpy.data.objects.new("Megaphone", None)
sc.collection.objects.link(mega)
mega.parent = shR
mega.location = (0.62, -0.02, 0.05)
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.34, radius2=0.1, depth=0.75, end_fill_type="NOTHING")
cone = bpy.context.active_object
cone.name = "Cone"
sol = cone.modifiers.new("solid", "SOLIDIFY"); sol.thickness = 0.03
shade_smooth(cone, 1)
assign(cone, cone_m)
cone.parent = mega
cone.rotation_euler = (0, math.radians(-90), 0)
cone.location = (0.42, 0, 0.12)
bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.04, major_segments=48, minor_segments=12)
rim = bpy.context.active_object
rim.name = "Rim"
shade_smooth(rim, 1)
assign(rim, rim_m)
rim.parent = mega
rim.rotation_euler = (0, math.radians(90), 0)
rim.location = (0.8, 0, 0.12)
grip = capsule("Grip", 0.06, 0.28, grip_m, mega)
grip.location = (0.12, 0, -0.05)

# ---------------------------------------------------------------- poses
def set_pose(pose, t=0.0):
    """t in [0,1) for loops."""
    w = math.sin(t * 2 * math.pi)
    bob = 0.04 * math.sin(t * 2 * math.pi)
    root.location = (0, 0, bob)
    root.rotation_euler = (0, 0, math.radians(14))
    open_mouth = pose in ("announce", "celebrate")
    for o in (mouth_open, tongue):
        o.hide_render = not open_mouth
    mouth.hide_render = open_mouth
    lift = {"celebrate": 0.07, "wave": 0.03, "announce": -0.01, "point": 0.02}.get(pose, 0.0)
    for side, b in zip((-1, 1), brows):
        b.location.z = 1.66 + lift + 0.01 * w
        tilt = {"announce": 14, "celebrate": -10}.get(pose, -4)
        b.rotation_euler = (0, math.radians(90 + tilt * side), 0)
    # Rotation about Y: + raises the left arm, - raises the right arm.
    shL.rotation_euler = (0, math.radians(-40), 0)  # left arm relaxed, down
    shR.rotation_euler = (0, math.radians(38), math.radians(-25))   # right hand holds the megaphone low
    mega_rest = (0, math.radians(-30), 0)
    mega.rotation_euler = mega_rest
    for d in bpy.data.objects:
        if d.name.startswith("Dot"):
            i = int(d.name[-1])
            d.location.z = 1.86 + 0.04 * max(0, math.sin((t * 3 - i * 0.18) * 2 * math.pi))
    if pose == "wave":
        shL.rotation_euler = (0, math.radians(48 + 14 * w), math.radians(28))
    elif pose == "announce":
        shR.rotation_euler = (0, math.radians(-40 - 6 * w), math.radians(-25))
        mega.rotation_euler = (0, math.radians(25), 0)
        shL.rotation_euler = (0, math.radians(-30), 0)
    elif pose == "point":
        # arm straight out to the left: towards the job list on the TV
        shL.rotation_euler = (0, math.radians(4 + 3 * w), math.radians(12))
        root.rotation_euler = (0, math.radians(-5), math.radians(22))
    elif pose == "celebrate":
        shL.rotation_euler = (0, math.radians(60 + 10 * w), math.radians(25))
        shR.rotation_euler = (0, math.radians(-55 - 10 * w), math.radians(-25))
        mega.rotation_euler = (0, math.radians(35), 0)
        root.location = (0, 0, abs(0.18 * math.sin(t * 2 * math.pi)))
    # blink near the end of the loop
    blink = 0.12 if 0.86 < t < 0.92 else 1.0
    for e in eyes:
        e.scale = (1, 0.55, 1.25 * blink)

# ---------------------------------------------------------------- lights + camera
def area(name, loc, energy, size, color="#ffffff", rot=None):
    l = bpy.data.lights.new(name, "AREA")
    l.energy = energy; l.size = size; l.color = hexrgb(color)[:3]
    o = bpy.data.objects.new(name, l)
    sc.collection.objects.link(o)
    o.location = loc
    tc = o.constraints.new("TRACK_TO"); tc.target = body; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
    return o

if S == "clay":
    # one big window light + bounce: soft stop-motion look
    area("Key", (-3, -3.5, 7), 1500, 6, "#ffe9cf")
    area("Bounce", (4, -2, 0.5), 260, 6, "#fff6ea")
    area("Rim", (1, 4, 4), 350, 4, "#fff2dd")
elif S == "vinyl":
    # crisp studio strips: sharp highlights on the gloss
    k = area("Key", (-3, -3, 7), 800, 1.0, "#ffffff")
    k.data.shape = "RECTANGLE"; k.data.size = 0.35; k.data.size_y = 3.0
    area("Fill", (4, -3, 1.5), 240, 2, "#d9e8ff")
    r = area("Rim", (2.5, 4, 3.5), 1000, 1.0, "#f0c8ff")
    r.data.shape = "RECTANGLE"; r.data.size = 0.3; r.data.size_y = 3.2
    area("Kicker", (-4, 2.5, 1), 520, 0.8, "#9ff0ff")
else:
    # film: warm key, cool fill, strong lavender rim for the silhouette
    area("Key", (-2.5, -3.5, 7), 1050, 3, "#ffe8cc")
    area("Fill", (4, -3, 2), 240, 4, "#d6e4ff")
    area("Rim", (1.5, 4, 4), 1500, 2.2, "#dcbcff")
    area("Rim2", (-3, 3.5, 2.5), 600, 2, "#a6f0ff")

world = bpy.data.worlds.new("w"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = hexrgb("#3a2350")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

# Only the key light casts a shadow, so the catcher gets one soft shadow under
# the feet instead of a wide grey patch (which showed as a box on the TV mockups).
for o in sc.objects:
    if o.type == "LIGHT" and o.name != "Key":
        try:
            o.data.use_shadow = False
        except AttributeError:
            pass
        try:
            o.data.cycles.cast_shadow = False
        except AttributeError:
            pass
if not a.stage:
    # soft contact shadow catcher: a disc, so its edge never shows
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=6.0, fill_type="NGON", location=(0.4, 0, 0))
    floor = bpy.context.active_object
    floor.is_shadow_catcher = True
else:
    def emit_mat(name, ramp_cols, strength=1.0):
        m = bpy.data.materials.new(name); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = strength
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        els = ramp.color_ramp.elements
        els[0].position = 0.0; els[0].color = hexrgb(ramp_cols[0])
        els[1].position = 1.0; els[1].color = hexrgb(ramp_cols[-1])
        if len(ramp_cols) == 3:
            mid = els.new(0.3); mid.color = hexrgb(ramp_cols[1])
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])  # plane is stood up: local Y = height
        nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
        nt.links.new(em.outputs[0], out.inputs[0])
        return m
    # backdrop: tall plane behind, navy at the floor to violet at the top
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.6, 5.5, 6))
    back = bpy.context.active_object
    back.scale = (30, 16, 1); back.rotation_euler = (math.radians(90), 0, 0)
    back.data.materials.append(emit_mat("backdrop", ["#140c38", "#24155c", "#0d0a2a"], 1.0))
    # a soft cyan halo on the backdrop behind the mascot
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=3.2, fill_type="NGON", location=(0.6, 5.4, 1.6), rotation=(math.radians(90), 0, 0))
    halo = bpy.context.active_object
    hm = bpy.data.materials.new("halo"); hm.use_nodes = True
    hnt = hm.node_tree; hnt.nodes.clear()
    hout = hnt.nodes.new("ShaderNodeOutputMaterial")
    hmix = hnt.nodes.new("ShaderNodeMixShader")
    htr = hnt.nodes.new("ShaderNodeBsdfTransparent")
    hem = hnt.nodes.new("ShaderNodeEmission"); hem.inputs["Color"].default_value = hexrgb("#5aa8f0"); hem.inputs["Strength"].default_value = 0.4
    hgr = hnt.nodes.new("ShaderNodeTexGradient"); hgr.gradient_type = "SPHERICAL"
    htc = hnt.nodes.new("ShaderNodeTexCoord")
    hmap = hnt.nodes.new("ShaderNodeMapping"); hmap.inputs["Scale"].default_value = (1 / 3.2, 1 / 3.2, 1 / 3.2)
    hnt.links.new(htc.outputs["Object"], hmap.inputs[0]); hnt.links.new(hmap.outputs[0], hgr.inputs[0])
    hpow = hnt.nodes.new("ShaderNodeMath"); hpow.operation = "POWER"; hpow.inputs[1].default_value = 2.2
    hnt.links.new(hgr.outputs["Fac"], hpow.inputs[0])
    hnt.links.new(hpow.outputs[0], hmix.inputs["Fac"])
    hnt.links.new(htr.outputs[0], hmix.inputs[1]); hnt.links.new(hem.outputs[0], hmix.inputs[2])
    hnt.links.new(hmix.outputs[0], hout.inputs[0])
    halo.data.materials.append(hm)
    # glossy dark floor: reflects the mascot and the podium ring
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 10, -0.22))
    fl = bpy.context.active_object
    fl.data.materials.append(mat("floor", "#0a0722", rough=0.5, spec=0.5))
    # podium: dark glossy drum with a glowing cyan ring at the top edge
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.75, depth=0.22, location=(0.35, 0.1, -0.11))
    pod = bpy.context.active_object
    md = pod.modifiers.new("bev", "BEVEL"); md.width = 0.04; md.segments = 4; md.limit_method = "NONE"
    shade_smooth(pod, 0)
    pod.data.materials.append(mat("podium", "#241a52", rough=0.15, coat=1.0, spec=0.7))
    bpy.ops.mesh.primitive_torus_add(major_radius=1.76, minor_radius=0.018, major_segments=128, minor_segments=8, location=(0.35, 0.1, 0.0))
    ring = bpy.context.active_object
    rm = bpy.data.materials.new("ring"); rm.use_nodes = True
    rnt = rm.node_tree; rnt.nodes.clear()
    rout = rnt.nodes.new("ShaderNodeOutputMaterial"); rem = rnt.nodes.new("ShaderNodeEmission")
    rem.inputs["Color"].default_value = hexrgb("#9ff0ff"); rem.inputs["Strength"].default_value = 6.0
    rnt.links.new(rem.outputs[0], rout.inputs[0])
    ring.data.materials.append(rm)
    # a little pink accent light from the side, like the C mockup
    acc = area("Accent", (4.5, -1.5, 1.2), 260, 1.2, "#ff9ad5")
    acc.visible_glossy = False
    world.node_tree.nodes["Background"].inputs["Color"].default_value = hexrgb("#1a1040")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.25
    # Light linking: the studio lights only light the mascot and the podium, so
    # the floor stays dark and only picks up the ring glow and reflections.
    lit = bpy.data.collections.new("Lit")
    sc.collection.children.link(lit)
    skip = {back.name, halo.name, fl.name, ring.name}
    for o in list(sc.objects):
        if o.type == "MESH" and o.name not in skip:
            lit.objects.link(o)
    for o in sc.objects:
        if o.type == "LIGHT":
            o.light_linking.receiver_collection = lit

cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 78
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
cam.location = (0.75, -11.0, 2.5)
tgt = bpy.data.objects.new("Tgt", None); sc.collection.objects.link(tgt); tgt.location = (0.7, 0, 1.2)
if a.stage:
    cam_d.lens = 52
    cam.location = (0.75, -10.5, 2.6)
    tgt.location = (0.75, 0, 1.0)
tc = cam.constraints.new("TRACK_TO"); tc.target = tgt; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
sc.camera = cam

# ---------------------------------------------------------------- render
if a.glb:
    set_pose(a.pose, 0)
    bpy.ops.export_scene.gltf(filepath=a.glb, export_format="GLB", use_selection=False)
if a.anim:
    import os
    os.makedirs(a.out, exist_ok=True)
    for f in range(a.frames):
        set_pose(a.pose, f / a.frames)
        sc.render.filepath = os.path.join(a.out, f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
else:
    set_pose(a.pose, 0.25)
    sc.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
print("DONE", a.out)
