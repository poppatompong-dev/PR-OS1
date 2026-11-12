# Soft "3D" cartoon portrait drawn with code (12 Nov 2026) — for a new team member
# when no team-made 3D avatar exists yet. No AI service: shapes + blurred light layers.
#   python3 scripts/looks/soft3d_portrait.py <out.png> [size]
import sys, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024
HAIR_D, HAIR_M, HAIR_L = (58, 34, 24), (104, 62, 38), (184, 126, 72)
SKIN, SKIN_SH, SKIN_HI = (250, 216, 194), (226, 170, 146), (255, 238, 226)
TOP, TOP_HI, TOP_DOT = (36, 40, 54), (70, 76, 96), (108, 114, 134)

def mask(fn):
    m = Image.new('L', (S, S), 0); fn(ImageDraw.Draw(m)); return m
def solid(c): return Image.new('RGB', (S, S), c)
def vgrad(stops):
    g = Image.new('RGB', (S, S)); d = ImageDraw.Draw(g)
    for y in range(S):
        t = y / S
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= t <= b:
                u = (t - a) / (b - a); d.line([(0, y), (S, y)], fill=tuple(int(ca[i] + (cb[i] - ca[i]) * u) for i in range(3))); break
    return g
def put(img, layer, m, blur=0, k=1.0):
    if blur: m = m.filter(ImageFilter.GaussianBlur(blur))
    if k != 1.0: m = m.point(lambda v: int(v * k))
    img.paste(layer if isinstance(layer, Image.Image) else solid(layer), (0, 0), m)

# geometry (head-and-shoulders, head fills the frame like the team set)
fx, fy, fw, fh = 512, 470, 400, 470
l, t, r, b = fx - fw / 2, fy - fh / 2, fx + fw / 2, fy + fh / 2

img = vgrad([(0, (208, 226, 244)), (1, (150, 186, 226))])
bok = Image.new('RGB', (S, S), (0, 0, 0)); bd = ImageDraw.Draw(bok); random.seed(7)
for _ in range(14):
    x, y, rr = random.randint(0, S), random.randint(0, 600), random.randint(40, 110)
    bd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255))
put(img, (240, 248, 255), bok.convert('L'), blur=26, k=0.35)

face = mask(lambda d: d.ellipse([l, t, r, b], fill=255))
back = mask(lambda d: d.rounded_rectangle([l - 70, t - 40, r + 70, b + 300], radius=240, fill=255))
body = mask(lambda d: d.rounded_rectangle([fx - 330, b - 10, fx + 330, S + 260], radius=260, fill=255))
neck = mask(lambda d: d.rounded_rectangle([fx - 62, b - 80, fx + 62, b + 70], radius=30, fill=255))
def cap(d):
    d.ellipse([l - 48, t - 70, r + 48, b + 40], fill=255)
    pts = []
    for i in range(61):
        x = l + 18 + (r - l - 36) * i / 60
        u = abs(x - fx) / ((r - l - 36) / 2)
        pts.append((x, t + 26 + (u ** 1.7) * (fy - t - 30)))
    pts += [(r - 26, fy + 40), (r - 10, b), (l + 10, b), (l + 26, fy + 40)]
    d.polygon(pts, fill=0); d.rectangle([l - 80, b - 70, r + 80, b + 120], fill=0)
front = mask(cap)

hair = vgrad([(0, HAIR_D), (0.42, HAIR_M), (0.85, HAIR_L), (1, HAIR_L)])
# back hair + volume shading at the edges
put(img, hair, back)
edge = ImageChops.subtract(back, back.filter(ImageFilter.MinFilter(61)))
put(img, HAIR_D, ImageChops.multiply(edge.filter(ImageFilter.GaussianBlur(30)), back), k=0.6)
# body: dark knit top, lit from the upper left, dotted texture, collar
put(img, TOP, body)
put(img, TOP_HI, ImageChops.multiply(mask(lambda d: d.ellipse([fx - 360, b + 40, fx + 120, S + 300], fill=150)).filter(ImageFilter.GaussianBlur(80)), body))
dots = Image.new('L', (S, S), 0); dd = ImageDraw.Draw(dots)
for yy in range(int(b) + 30, S, 34):
    for xx in range(fx - 340 + (17 if (yy // 34) % 2 else 0), fx + 340, 34):
        dd.ellipse([xx - 5, yy - 5, xx + 5, yy + 5], fill=255)
put(img, TOP_DOT, ImageChops.multiply(dots.filter(ImageFilter.GaussianBlur(1.2)), body))
collar = mask(lambda d: (d.polygon([(fx - 110, b + 20), (fx, b + 110), (fx - 18, b + 150), (fx - 150, b + 80)], fill=255),
                          d.polygon([(fx + 110, b + 20), (fx, b + 110), (fx + 18, b + 150), (fx + 150, b + 80)], fill=255)))
put(img, (28, 31, 42), collar)
put(img, (84, 90, 110), ImageChops.multiply(mask(lambda d: d.line([(fx - 140, b + 76), (fx - 100, b + 26)], fill=255, width=8)), collar), blur=3)
# long hair falling in front of the shoulders
locks = mask(lambda d: (d.polygon([(l - 66, fy - 40), (l + 30, fy + 40), (l + 52, b + 60), (l + 40, b + 250), (l - 20, b + 290), (l - 78, b + 150)], fill=255),
                         d.polygon([(r + 66, fy - 40), (r - 30, fy + 40), (r - 52, b + 60), (r - 40, b + 250), (r + 20, b + 290), (r + 78, b + 150)], fill=255)))
locks = locks.filter(ImageFilter.GaussianBlur(3)).point(lambda v: 255 if v > 128 else 0)
put(img, (20, 22, 30), locks.filter(ImageFilter.MaxFilter(9)), blur=10, k=0.45)   # soft contact shadow on the top
put(img, hair, locks)
put(img, HAIR_D, ImageChops.multiply(ImageChops.subtract(locks, locks.filter(ImageFilter.MinFilter(25))), locks), blur=8, k=0.6)
put(img, (214, 160, 100), ImageChops.multiply(mask(lambda d: (d.line([(l - 30, b + 20), (l, b + 230)], fill=255, width=10), d.line([(r + 30, b + 20), (r, b + 230)], fill=255, width=10))), locks), blur=6, k=0.6)
# neck with the jaw's shadow
put(img, SKIN_SH, neck)
put(img, (196, 140, 118), ImageChops.multiply(mask(lambda d: d.ellipse([fx - 120, b - 120, fx + 120, b + 30], fill=200)), neck), blur=18)
# face: base, edge shading, highlight
put(img, SKIN, face)
inner = face.filter(ImageFilter.MinFilter(41)).filter(ImageFilter.GaussianBlur(40))
put(img, SKIN_SH, ImageChops.subtract(face, inner), k=0.85)
put(img, SKIN_HI, ImageChops.multiply(mask(lambda d: d.ellipse([l + 70, t + 70, fx + 20, fy + 40], fill=170)), face), blur=50)
# hair shadow on the forehead, then the front hair with gloss and strands
put(img, (210, 150, 126), ImageChops.multiply(front.filter(ImageFilter.MaxFilter(25)), face), blur=14, k=0.55)
put(img, hair, front)
put(img, HAIR_D, ImageChops.multiply(ImageChops.subtract(front, front.filter(ImageFilter.MinFilter(41))), front), blur=16, k=0.7)
gloss = mask(lambda d: (d.arc([l - 30, t - 52, r + 30, b - 40], 200, 250, fill=255, width=22), d.arc([l - 30, t - 52, r + 30, b - 40], 290, 330, fill=255, width=16)))
put(img, (226, 176, 120), ImageChops.multiply(gloss, ImageChops.lighter(front, back)), blur=8, k=0.8)
# features
d = ImageDraw.Draw(img)
ey, ex, er = fy + 18, 88, 40
for sx in (-1, 1):
    cx = fx + sx * ex
    d.line([(cx - 52, ey - 72 - (6 if sx < 0 else 0)), (cx + 44 * (1 if sx > 0 else 0.9), ey - 80)], fill=(70, 42, 30), width=14)   # brows (strong, straight)
    eye = mask(lambda dd: dd.ellipse([cx - er * 1.15, ey - er * 0.85, cx + er * 1.15, ey + er * 0.95], fill=255))
    put(img, (255, 255, 255), eye)
    iris = Image.new('RGB', (S, S), (0, 0, 0)); idr = ImageDraw.Draw(iris)
    for k in range(20, 0, -1):
        c = tuple(int(a + (bb - a) * k / 20) for a, bb in zip((132, 86, 52), (40, 24, 16)))
        idr.ellipse([cx - er * 0.75 * k / 20, ey + 4 - er * 0.8 * k / 20, cx + er * 0.75 * k / 20, ey + 4 + er * 0.8 * k / 20], fill=c)
    put(img, iris, ImageChops.multiply(mask(lambda dd: dd.ellipse([cx - er * .75, ey + 4 - er * .8, cx + er * .75, ey + 4 + er * .8], fill=255)), eye))
    put(img, (20, 12, 10), ImageChops.multiply(mask(lambda dd: dd.ellipse([cx - er * .36, ey - er * .3, cx + er * .36, ey + er * .42], fill=255)), eye))
    d.ellipse([cx - er * .55, ey - er * .55, cx - er * .12, ey - er * .12], fill=(255, 255, 255))
    d.ellipse([cx + er * .2, ey + er * .25, cx + er * .4, ey + er * .45], fill=(255, 255, 255))
    d.arc([cx - er * 1.25, ey - er * 1.0, cx + er * 1.25, ey + er * 0.95], 195, 345, fill=(34, 20, 16), width=9)    # upper lid
    d.arc([cx - er * 1.2, ey - er * 1.25, cx + er * 1.2, ey + er * 0.7], 210, 330, fill=(196, 140, 120), width=4)   # double lid
    put(img, (246, 156, 150), mask(lambda dd: dd.ellipse([cx - 64 + sx * 16, ey + 62, cx + 50 + sx * 16, ey + 104], fill=255)), blur=16, k=0.75)
put(img, SKIN_SH, mask(lambda dd: dd.ellipse([fx - 18, ey + 66, fx + 14, ey + 98], fill=255)), blur=7, k=0.8)                  # nose shadow
put(img, SKIN_HI, mask(lambda dd: dd.ellipse([fx - 8, ey + 30, fx + 4, ey + 74], fill=255)), blur=5, k=0.7)                     # nose highlight
my = ey + 132
lips = mask(lambda dd: dd.chord([fx - 38, my - 30, fx + 38, my + 22], 15, 165, fill=255))
put(img, (214, 96, 100), lips, blur=1)
put(img, (236, 136, 134), ImageChops.multiply(mask(lambda dd: dd.ellipse([fx - 18, my + 4, fx + 18, my + 18], fill=255)), lips), blur=3, k=0.8)
d.arc([fx - 40, my - 30, fx + 40, my + 20], 18, 162, fill=(150, 54, 62), width=4)
put(img, SKIN_SH, mask(lambda dd: dd.arc([fx - 52, my - 34, fx + 52, my + 22], 5, 30, fill=255, width=5)), blur=3, k=0.6)
put(img, SKIN_SH, mask(lambda dd: dd.arc([fx - 52, my - 34, fx + 52, my + 22], 150, 175, fill=255, width=5)), blur=3, k=0.6)

size = int(sys.argv[2]) if len(sys.argv) > 2 else 320
if len(sys.argv) > 3 and sys.argv[3] == 'head':
    # head only (hair + face + neck), transparent — for a full-body character
    a = ImageChops.lighter(ImageChops.lighter(back, face), ImageChops.lighter(front, ImageChops.lighter(locks, neck)))
    a = ImageChops.multiply(a, mask(lambda d: d.rounded_rectangle([0, -200, S, b + 150], radius=90, fill=255)).filter(ImageFilter.GaussianBlur(5)))
    rgba = img.convert('RGBA'); rgba.putalpha(a)
    rgba.crop(rgba.getbbox()).save(sys.argv[1])
else:
    img.resize((size, size), Image.LANCZOS).save(sys.argv[1], quality=92)
