# ตัวการ์ตูนเต็มตัว "ผู้กำกับกองถ่าย" (12 Nov 2026) for a team member without a
# Blender cast yet. Two bodies to compare:
#   A  the team's blocky body (recoloured: dark dotted top, black trousers) + the drawn head
#   B  a fully drawn soft-3D chibi body
# Both hold a director's megaphone. No AI service.
#   python3 scripts/looks/director.py <head.png> <outdir> [pose ...]
import sys, colorsys, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HEAD = Image.open(sys.argv[1]).convert('RGBA')
OUT = sys.argv[2]
BODY_SRC = 'scripts/looks/src/00000000-0000-0000-0000-000000000504/'   # the team's plain grey body
HAND = {'stand': (169, 276), 'wave': (192, 166), 'up': (181, 161), 'walkA': (171, 268), 'walkB': (176, 274),
        'runA': (173, 262), 'runB': (185, 259), 'sit': (185, 271)}

def megaphone(size, cx, cy, s=1.0, ang=-20):
    """Director's megaphone held at (cx, cy): handle at the hand, bell pointing up-right."""
    W, H = size
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a); px, py = -uy, ux
    def pt(t, w): return (cx + ux * t * s + px * w * s, cy + uy * t * s + py * w * s)
    body = [pt(-6, -6), pt(46, -20), pt(46, 20), pt(-6, 6)]
    d.polygon(body, fill=(250, 250, 250, 255), outline=(60, 60, 70, 255))
    d.polygon([pt(14, -10), pt(26, -14), pt(26, 14), pt(14, 10)], fill=(226, 56, 60, 255))
    bx, by = pt(46, 0); r = 20 * s
    d.ellipse([bx - 5 * s, by - r, bx + 5 * s, by + r], fill=(255, 211, 107, 255), outline=(60, 60, 70, 255))
    d.line([pt(4, 6), pt(8, 16)], fill=(40, 40, 50, 255), width=max(2, int(4 * s)))
    return L

def outline(im, w=4):
    a = im.split()[3].point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(w * 2 + 1))
    o = Image.new('RGBA', im.size, (255, 255, 255, 0)); o.putalpha(a)
    o.alpha_composite(im); return o

# ---- A: team body ---------------------------------------------------------------
def body_a(pose):
    im = Image.open(BODY_SRC + pose + '.webp').convert('RGBA')
    px = im.load(); w, h = im.size
    # the old head: everything above the collar inside the head box that is not grey sleeve / glove
    heads = []
    for y in range(0, 232):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 30: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            sleeve = s < 0.14 and 0.22 < l < 0.78
            glove = r > 225 and g > 210 and b > 185 and y > 120 and not (40 < x < 190 and y < 200)
            if not sleeve and not glove and 28 < x < 202:
                heads.append((x, y)); px[x, y] = (0, 0, 0, 0)
    xs = [p[0] for p in heads] or [115]; ys = [p[1] for p in heads] or [160]
    hx = (min(xs) + max(xs)) / 2
    # the face oval never holds an arm in any pose: clear old outline bits there too
    oval = Image.new('L', im.size, 0); ImageDraw.Draw(oval).ellipse([hx - 74, 86, hx + 74, 216], fill=255)
    im.putalpha(ImageChops.subtract(im.split()[3], oval)); px = im.load()
    for y in range(150, 232):                      # the old microphone left of the chin
        for x in range(0, int(hx - 30)):
            r, g, b, a = px[x, y]
            if a > 30 and max(r, g, b) < 80: px[x, y] = (0, 0, 0, 0)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 30: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s < 0.14 and 0.18 < l < 0.8:
                if y < 292 or pose in ('up', 'wave') and y < 300:   # top + sleeves → dark navy, keep shading
                    nr, ng, nb = colorsys.hls_to_rgb(0.63, 0.1 + l * 0.32, 0.32)
                    if (x // 9 + y // 9) % 2 == 0 and x % 9 in (3, 4) and y % 9 in (3, 4): nr, ng, nb = 0.42, 0.45, 0.55
                else:                                                # trousers → near black
                    nr, ng, nb = colorsys.hls_to_rgb(0.66, 0.06 + l * 0.2, 0.12)
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
            elif y >= 318 and 0.02 < hh < 0.14 and l < 0.6:          # brown shoes → black
                px[x, y] = (int(30 + l * 40), int(30 + l * 40), int(36 + l * 44), a)
    head = HEAD.resize((int(HEAD.width * 0.25), int(HEAD.height * 0.25)), Image.LANCZOS)
    hl = Image.new('RGBA', im.size, (0, 0, 0, 0))
    hl.alpha_composite(head, (int(hx - head.width / 2), 84))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.alpha_composite(hl); out.alpha_composite(im)            # long hair behind the body…
    face_top = Image.new('RGBA', im.size, (0, 0, 0, 0)); face_top.alpha_composite(hl.crop((0, 0, w, 214)))
    out.alpha_composite(face_top)                                # …face/hair in front above the collar
    arms = Image.new('RGBA', im.size, (0, 0, 0, 0)); arms.alpha_composite(im.crop((0, 0, w, 214)))
    ax = arms.split()[3].point(lambda v: v)
    keep = Image.new('L', im.size, 0); ImageDraw.Draw(keep).rectangle([0, 0, w, 214], fill=255)
    out.paste(arms, (0, 0), ImageChops.multiply(ax, keep))       # raised arms stay in front of the hair
    hx2, hy2 = HAND[pose]
    out.alpha_composite(megaphone(im.size, hx2, hy2 - 6, 1.0, -35 if pose in ('wave', 'up') else -15))
    return outline(out, 2)

# ---- B: drawn chibi body ------------------------------------------------------------
def body_b():
    S = 4; W, H = 230 * S, 410 * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    def m(fn):
        k = Image.new('L', (W, H), 0); fn(ImageDraw.Draw(k)); return k
    def put(c, k, blur=0, f=1.0):
        if blur: k = k.filter(ImageFilter.GaussianBlur(blur))
        if f != 1: k = k.point(lambda v: int(v * f))
        im.paste(Image.new('RGBA', (W, H), c + (255,)), (0, 0), k)
    cx = 115 * S
    legs = m(lambda d: (d.rounded_rectangle([cx - 46 * S, 300 * S, cx - 6 * S, 380 * S], radius=16 * S, fill=255),
                        d.rounded_rectangle([cx + 6 * S, 300 * S, cx + 46 * S, 380 * S], radius=16 * S, fill=255)))
    put((34, 34, 42), legs)
    put((70, 70, 84), ImageChops.multiply(m(lambda d: d.rectangle([cx - 40 * S, 300 * S, cx - 24 * S, 380 * S], fill=255)), legs), blur=6 * S, f=0.6)
    shoes = m(lambda d: (d.rounded_rectangle([cx - 52 * S, 372 * S, cx - 2 * S, 392 * S], radius=10 * S, fill=255),
                         d.rounded_rectangle([cx + 2 * S, 372 * S, cx + 52 * S, 392 * S], radius=10 * S, fill=255)))
    put((20, 20, 26), shoes)
    torso = m(lambda d: d.rounded_rectangle([cx - 62 * S, 205 * S, cx + 62 * S, 312 * S], radius=34 * S, fill=255))
    put((38, 42, 58), torso)
    put((78, 86, 110), ImageChops.multiply(m(lambda d: d.ellipse([cx - 80 * S, 190 * S, cx + 10 * S, 290 * S], fill=170)), torso), blur=18 * S)
    dots = Image.new('L', (W, H), 0); dd = ImageDraw.Draw(dots)
    for y in range(210, 312, 11):
        for x in range(-60 + (5 if (y // 11) % 2 else 0), 62, 11):
            dd.ellipse([cx + (x - 1.6) * S, (y - 1.6) * S, cx + (x + 1.6) * S, (y + 1.6) * S], fill=255)
    put((108, 114, 134), ImageChops.multiply(dots, torso))
    put((28, 31, 42), m(lambda d: (d.polygon([(cx - 34 * S, 206 * S), (cx, 236 * S), (cx - 6 * S, 248 * S), (cx - 46 * S, 224 * S)], fill=255),
                                     d.polygon([(cx + 34 * S, 206 * S), (cx, 236 * S), (cx + 6 * S, 248 * S), (cx + 46 * S, 224 * S)], fill=255))))
    # arms: left relaxed, right raised holding the megaphone
    put((38, 42, 58), m(lambda d: d.rounded_rectangle([cx - 86 * S, 214 * S, cx - 56 * S, 290 * S], radius=14 * S, fill=255)))
    put((250, 216, 194), m(lambda d: d.ellipse([cx - 88 * S, 280 * S, cx - 56 * S, 306 * S], fill=255)))
    arm = m(lambda d: d.line([(cx + 66 * S, 222 * S), (cx + 88 * S, 190 * S)], fill=255, width=28 * S))
    put((38, 42, 58), arm)
    put((250, 216, 194), m(lambda d: d.ellipse([cx + 74 * S, 168 * S, cx + 104 * S, 196 * S], fill=255)))
    head = HEAD.resize((int(HEAD.width * 0.30 * S), int(HEAD.height * 0.30 * S)), Image.LANCZOS)
    hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); hl.alpha_composite(head, (int(cx - head.width / 2), 40 * S))
    back = hl.copy(); im2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); im2.alpha_composite(back); im2.alpha_composite(im)
    im2.alpha_composite(hl.crop((0, 0, W, 214 * S)), (0, 0))
    im2 = im2.resize((230, 410), Image.LANCZOS)
    im2.alpha_composite(megaphone((230, 410), 202, 178, 0.9, -40))
    return outline(im2, 2)

if __name__ == '__main__':
    poses = sys.argv[3:] or ['stand']
    for p in poses: body_a(p).save(f'{OUT}/A-{p}.png')
    body_b().save(f'{OUT}/B-stand.png')
