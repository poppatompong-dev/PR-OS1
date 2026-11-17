# ลุคชุดไทยห่มสไบ (17 Nov 2026 — ภัส: "ลุคชุดไทย ใส่สไบสีชมพู", แข: "ห่มสไบแล้วถือกระทง").
# Works on a team sprite (230x410, any pose/mood): the shirt becomes a plain blouse,
# a sabai is draped diagonally over the torso (clipped to the shirt, so raised arms
# stay clean), the trousers become a patterned โจงกระเบน, plus a gold belt; optional
# krathong in the hand and a flower over the ear.
#   python3 thai.py <srcdir> <person> <look> <outdir> [pose ...]
import sys, os, math, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HAND = {'stand': (169, 276), 'wave': (192, 166), 'up': (181, 161), 'walkA': (171, 268), 'walkB': (176, 274),
        'runA': (173, 262), 'runB': (185, 259), 'sit': (185, 271)}

# shirt hue band per person (blue for ภัส, lavender for แข)
MID = {'pat': 0.62, 'kae': 0.62, 'nat': 0.40}  # the shirt's usual lightness, so the blouse keeps its colour
SHIRT = {'pat': (0.53, 0.68), 'kae': (0.66, 0.86), 'nat': None}  # None = grey shirt (นัท)

LOOKS = {
    'pat': {
        '1': dict(name='ชมพูทอง', blouse=(250, 240, 228), sabai=(236, 92, 150), sabai2=(255, 170, 205), trim=(232, 180, 60), pants=(120, 70, 160), krathong=False, flower=False),
        '2': dict(name='ชมพูหวาน', blouse=(255, 222, 232), sabai=(214, 40, 120), sabai2=(250, 130, 180), trim=(240, 196, 70), pants=(200, 150, 50), krathong=False, flower=False),
        '3': dict(name='ชมพูทัดดอกไม้', blouse=(250, 240, 228), sabai=(245, 130, 175), sabai2=(255, 200, 220), trim=(232, 180, 60), pants=(30, 130, 120), krathong=False, flower=True),
    },
    'nat': {
        '1': dict(name='ชมพูบานเย็น', blouse=(255, 236, 244), sabai=(220, 50, 130), sabai2=(250, 140, 190), trim=(236, 190, 60), pants=(120, 60, 150), krathong=True, flower=False),
        '2': dict(name='ชมพูพาสเทล', blouse=(250, 240, 228), sabai=(245, 150, 190), sabai2=(255, 210, 230), trim=(232, 180, 60), pants=(60, 120, 170), krathong=True, flower=True),
        '3': dict(name='ชมพูทอง', blouse=(255, 228, 238), sabai=(236, 92, 150), sabai2=(255, 170, 205), trim=(240, 196, 70), pants=(200, 150, 50), krathong=True, flower=False),
    },
    'kae': {
        '1': dict(name='สไบเขียวทอง', blouse=(250, 240, 228), sabai=(40, 140, 90), sabai2=(120, 200, 150), trim=(236, 190, 60), pants=(170, 40, 50), krathong=True, flower=False),
        '2': dict(name='สไบแดงทอง', blouse=(250, 240, 228), sabai=(196, 30, 50), sabai2=(240, 110, 110), trim=(240, 196, 70), pants=(200, 150, 50), krathong=True, flower=False),
        '3': dict(name='สไบชมพู', blouse=(255, 246, 250), sabai=(236, 92, 150), sabai2=(255, 170, 205), trim=(232, 180, 60), pants=(110, 60, 150), krathong=True, flower=True),
    },
}

def shade(base, l, mid=0.62):
    """Keep the 3D shading: scale a base colour by the pixel's lightness."""
    k = max(0.45, min(1.25, 0.55 + (l - mid) * 1.1 + 0.45))
    return tuple(int(max(0, min(255, c * k))) for c in base)

def recolor(im, person, lk):
    px = im.load(); w, h = im.size
    band = SHIRT[person]
    lo, hi = band or (0.0, 1.0)
    shirt = np.zeros((h, w), bool)
    for y in range(90, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            is_shirt = (lo < hh < hi and s > 0.25) if band else (s < 0.18 and 0.15 < l < 0.78 and y < 294)
            if y < 300 and is_shirt and not (y < 212 and 70 <= x <= 150):
                px[x, y] = shade(lk['blouse'], l, MID[person]) + (a,); shirt[y, x] = True
            elif 296 <= y < 356 and s < 0.35 and 0.12 < l < 0.86 and not (hh < 0.12 and s > 0.3):
                # โจงกระเบน: base colour with soft vertical folds and a fine gold check
                base = shade(lk['pants'], l, 0.5)
                if (x // 6 + y // 6) % 2 == 0: base = tuple(int(c * 0.9) for c in base)
                if y % 12 == 0 or x % 12 == 0: base = tuple(int(c * 0.6 + t * 0.4) for c, t in zip(base, lk['trim']))
                px[x, y] = base + (a,)
    # soft edges of the shirt (anti-aliased, less saturated) next to it take the blouse too
    near = np.array(Image.fromarray((shirt * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
    for y, x in zip(*np.nonzero(near & ~shirt)):
        r, g, b, a = px[int(x), int(y)]
        if a < 20: continue
        hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if (lo - 0.04 < hh < hi + 0.04 and s > 0.08 and l < 0.9) if band else (s < 0.22 and 0.12 < l < 0.85 and y < 296):
            px[int(x), int(y)] = shade(lk['blouse'], l, MID[person]) + (a,)
    return im, shirt

def sabai(im, shirt, lk):
    """Diagonal band from the left shoulder (viewer's left) to the right hip, gold edges, small pattern."""
    w, h = im.size
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    band = [(62, 214), (116, 212), (192, 300), (132, 302)]
    d.polygon(band, fill=lk['sabai'] + (255,))
    # pleats
    for k in range(1, 5):
        t = k / 5
        x0, y0 = 62 + (116 - 62) * t, 214 + (212 - 214) * t
        x1, y1 = 132 + (192 - 132) * t, 302 + (300 - 302) * t
        d.line([(x0, y0), (x1, y1)], fill=lk['sabai2'] + (150,), width=2)
    # gold edges
    d.line([(62, 214), (132, 302)], fill=lk['trim'] + (255,), width=4)
    d.line([(116, 212), (192, 300)], fill=lk['trim'] + (255,), width=4)
    # little gold flowers along the band
    for k in range(6):
        t = (k + 0.5) / 6
        cx = 89 + (162 - 89) * t; cy = 213 + (301 - 213) * t
        for a in range(4):
            ang = a * math.pi / 2 + math.pi / 4
            d.ellipse([cx + 3 * math.cos(ang) - 2, cy + 3 * math.sin(ang) - 2, cx + 3 * math.cos(ang) + 2, cy + 3 * math.sin(ang) + 2], fill=lk['trim'] + (255,))
    # only where the blouse is (torso + sleeves), so it never floats off the body
    mask = Image.fromarray((shirt * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
    a = np.array(layer.split()[3]) * (np.array(mask) > 0)
    layer.putalpha(Image.fromarray(a.astype('uint8')))
    im.alpha_composite(layer)
    # gold belt at the waist (torso only)
    belt = Image.new('RGBA', (w, h), (0, 0, 0, 0)); bd = ImageDraw.Draw(belt)
    bd.rectangle([60, 290, 190, 297], fill=lk['trim'] + (255,))
    for x in range(64, 190, 10): bd.ellipse([x - 2, 291, x + 3, 296], fill=(255, 236, 150, 255))
    ba = np.array(belt.split()[3]) * (np.array(mask) > 0)
    belt.putalpha(Image.fromarray(ba.astype('uint8')))
    im.alpha_composite(belt)
    return im

def outline(g, im, width=5):
    halo = g.split()[3].point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(width))
    ring = Image.new('RGBA', im.size, (255, 255, 255, 255)); ring.putalpha(halo)
    im.alpha_composite(ring); im.alpha_composite(g)

def krathong(im, cx, cy):
    """A banana-leaf krathong with lotus petals, a candle and incense, held at (cx, cy)."""
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    base = cy + 2
    d.ellipse([cx - 22, base - 8, cx + 22, base + 8], fill=(70, 140, 60, 255), outline=(40, 100, 40, 255))
    for k in range(7):  # leaf folds
        x = cx - 18 + k * 6
        d.polygon([(x - 4, base - 4), (x + 4, base - 4), (x, base - 14)], fill=(90, 170, 70, 255), outline=(50, 120, 50, 255))
    for k in range(5):  # lotus petals
        x = cx - 12 + k * 6
        d.polygon([(x - 4, base - 10), (x + 4, base - 10), (x, base - 22)], fill=(255, 170, 200, 255), outline=(220, 100, 150, 255))
    d.rectangle([cx - 2, base - 34, cx + 2, base - 16], fill=(255, 245, 220, 255))           # candle
    d.ellipse([cx - 3, base - 42, cx + 3, base - 33], fill=(255, 190, 40, 255))              # flame
    d.line([(cx + 7, base - 14), (cx + 12, base - 38)], fill=(160, 60, 40, 255), width=2)     # incense
    d.line([(cx + 10, base - 14), (cx + 16, base - 36)], fill=(160, 60, 40, 255), width=2)
    d.ellipse([cx - 5, base - 14, cx + 1, base - 9], fill=(255, 230, 90, 255))                # marigold
    outline(g, im)

def ear_flower(im):
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    cx, cy = 150, 150
    for k in range(6):
        ang = k * math.pi / 3
        d.ellipse([cx + 6 * math.cos(ang) - 5, cy + 6 * math.sin(ang) - 5, cx + 6 * math.cos(ang) + 5, cy + 6 * math.sin(ang) + 5], fill=(255, 120, 170, 255), outline=(220, 70, 130, 255))
    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 220, 80, 255))
    d.ellipse([cx + 8, cy + 6, cx + 18, cy + 12], fill=(80, 170, 80, 255))
    outline(g, im, 3)

def draw(srcdir, person, key, pose='stand'):
    lk = LOOKS[person][key]
    im = Image.open(os.path.join(srcdir, pose + '.webp')).convert('RGBA')
    im, shirt = recolor(im, person, lk)
    im = sabai(im, shirt, lk)
    if lk['flower']: ear_flower(im)
    if lk['krathong']: krathong(im, *HAND[pose.split('-')[0]])
    return im

if __name__ == '__main__':
    srcdir, person, key, out = sys.argv[1:5]
    poses = sys.argv[5:] or ['stand']
    os.makedirs(out, exist_ok=True)
    for p in poses:
        draw(srcdir, person, key, p).save(os.path.join(out, p + ('.webp' if len(poses) > 1 else '.png')), **({'quality': 90} if len(poses) > 1 else {}))
