# ลุคคริสต์มาส (27 Nov 2026 — แข: "เสื้อ กระโปรง ถุงเท้า รองเท้าสีแดง").
# Red top with a white fluffy hem, red A-line skirt, striped socks, red shoes,
# plus one festive accessory per option (Santa-style cap / antler headband / holly clip).
#   python3 xmas.py <srcdir> <person> <look> <outdir> [pose ...]
import sys, os, math, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from thai import shade, outline, MID, SHIRT
from princess import head

RED = (206, 32, 44)
LOOKS = {
    'kae': {
        '1': dict(name='หมวกซานต้า', top=RED, skirt=(196, 28, 40), hem=(255, 255, 255), sock=((255, 255, 255), (206, 32, 44)), shoe=(190, 20, 30), acc='cap'),
        '2': dict(name='ที่คาดเขากวาง', top=RED, skirt=(196, 28, 40), hem=(240, 196, 70), sock=((255, 255, 255), (40, 140, 80)), shoe=(190, 20, 30), acc='antler'),
        '3': dict(name='กิ๊บฮอลลี่', top=RED, skirt=(196, 28, 40), hem=(255, 255, 255), sock=((206, 32, 44), (206, 32, 44)), shoe=(190, 20, 30), acc='holly', belt=(30, 120, 70)),
    },
}
HEAD = {'kae': (125, 105), 'nat': (120, 103)}

def recolor(im, person, lk, hem_y):
    px = im.load(); w, h = im.size
    band = SHIRT[person]; lo, hi = band or (0.0, 1.0)
    hls = {}
    cand = np.zeros((h, w), bool)
    for y in range(90, 300):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 160: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            hls[(x, y)] = l
            is_shirt = (lo - 0.03 < hh < hi + 0.03 and s > 0.12 and l < 0.9) if band else (s < 0.18 and 0.15 < l < 0.78 and y < 294 and not head(x, y, l, a))
            if is_shirt: cand[y, x] = True
    # drop specks on the outline: keep only solid shirt areas
    m = Image.fromarray((cand * 255).astype('uint8')).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
    shirt = cand & (np.array(m) > 0)
    for y, x in zip(*np.nonzero(shirt)):
        r, g, b, a = px[int(x), int(y)]
        px[int(x), int(y)] = shade(lk['top'], hls[(int(x), int(y))], MID[person]) + (a,)
    for y in range(296, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            shoe = hh < 0.13 and s > 0.12 and y >= 346
            if shoe and a > 200:
                px[x, y] = shade(lk['shoe'], l, 0.45) + (a,)
            elif y < 358 and not shoe and s < 0.35 and 0.12 < l < 0.86 and not (hh < 0.12 and s > 0.3):
                c1, c2 = lk['sock']
                px[x, y] = shade(c1 if (y // 5) % 2 == 0 else c2, l, 0.5) + (a,)
    return im

def skirt(dst, lk, ref):
    a = np.array(ref.split()[3])
    rows = np.where((a > 200).sum(1) > 8)[0]; bottom = rows[-1]
    top = 286; hem = min(328, bottom - 30)
    if hem - top < 14: hem = top + 18
    xs = np.where(a[top:top + 6].max(0) > 200)[0]
    cx = 118 if xs.size == 0 else (max(xs.min(), 62) + min(xs.max(), 172)) / 2
    ht, hh = 40, 40 + (hem - top) * 0.5
    g = Image.new('RGBA', dst.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    d.polygon([(cx - ht, top), (cx + ht, top), (cx + hh, hem), (cx - hh, hem)], fill=lk['skirt'] + (255,))
    for k in range(1, 6):
        t = k / 6
        d.line([(cx - ht + 2 * ht * t, top + 6), (cx - hh + 2 * hh * t, hem - 2)], fill=tuple(int(c * 0.8) for c in lk['skirt']) + (150,), width=2)
    # fluffy hem: a row of soft circles
    n = 9
    for k in range(n + 1):
        x = cx - hh + k * 2 * hh / n
        d.ellipse([x - 6, hem - 6, x + 6, hem + 5], fill=lk['hem'] + (255,))
    # waistband (white fur, or a green belt with a gold buckle)
    if lk.get('belt'):
        d.rectangle([cx - ht - 2, top - 4, cx + ht + 2, top + 5], fill=lk['belt'] + (255,))
        d.rectangle([cx - 7, top - 5, cx + 7, top + 6], outline=(240, 196, 70, 255), width=3)
    else:
        for k in range(9):
            x = cx - ht + k * 2 * ht / 8
            d.ellipse([x - 6, top - 6, x + 6, top + 5], fill=(255, 255, 255, 255))
    outline(g, dst, 5)

def cap(im, cx, top):
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    y0 = top + 12
    d.polygon([(cx - 36, y0), (cx + 34, y0), (cx + 18, top - 22), (cx + 50, top - 6)], fill=RED + (255,))
    d.polygon([(cx - 36, y0), (cx + 34, y0), (cx + 10, top - 26)], fill=RED + (255,))
    d.rounded_rectangle([cx - 42, y0 - 6, cx + 40, y0 + 8], radius=7, fill=(255, 255, 255, 255))
    d.ellipse([cx + 42, top - 14, cx + 60, top + 4], fill=(255, 255, 255, 255))
    outline(g, im, 3)

def antler(im, cx, top):
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    br = (130, 80, 40)
    d.arc([cx - 40, top - 2, cx + 40, top + 40], 200, 340, fill=(60, 60, 60, 255), width=4)  # headband
    for s in (-1, 1):
        bx = cx + s * 24; by = top + 2
        d.line([(bx, by), (bx + s * 8, by - 26)], fill=br + (255,), width=6)
        d.line([(bx + s * 4, by - 12), (bx + s * 18, by - 20)], fill=br + (255,), width=5)
        d.line([(bx + s * 7, by - 22), (bx - s * 2, by - 34)], fill=br + (255,), width=5)
        d.ellipse([bx + s * 14 - 7, by + 2, bx + s * 14 + 7, by + 12], fill=(160, 100, 60, 255))  # ear
    outline(g, im, 3)

def holly(im, cx, top):
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    x, y = cx + 30, top + 18
    for ang in (-35, 35, 0):
        a = math.radians(ang - 90)
        tx, ty = x + 16 * math.cos(a), y + 16 * math.sin(a)
        nx, ny = -math.sin(a) * 6, math.cos(a) * 6
        d.polygon([(x, y), (x + (tx - x) / 2 + nx, y + (ty - y) / 2 + ny), (tx, ty), (x + (tx - x) / 2 - nx, y + (ty - y) / 2 - ny)], fill=(30, 130, 60, 255), outline=(15, 80, 35, 255))
    for dx, dy in [(-4, 2), (4, 2), (0, -3)]:
        d.ellipse([x + dx - 4, y + dy - 4, x + dx + 4, y + dy + 4], fill=(214, 30, 40, 255), outline=(150, 10, 20, 255))
    outline(g, im, 3)

def draw(srcdir, person, key, pose='stand'):
    lk = LOOKS[person][key]
    im = Image.open(os.path.join(srcdir, pose + '.webp')).convert('RGBA')
    base = recolor(im, person, lk, 328)
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); skirt(layer, lk, base)
    out = base.copy(); out.alpha_composite(layer)
    arr = np.array(base); arr[302:, :, 3] = 0; arr[278:302, 72:164, 3] = 0; out.alpha_composite(Image.fromarray(arr))  # arms/hands back on top
    cx, top = HEAD[person]
    {'cap': cap, 'antler': antler, 'holly': holly}[lk['acc']](out, cx, top)
    return out

if __name__ == '__main__':
    srcdir, person, key, out = sys.argv[1:5]
    poses = sys.argv[5:] or ['stand']
    os.makedirs(out, exist_ok=True)
    for p in poses:
        draw(srcdir, person, key, p).save(os.path.join(out, p + ('.webp' if len(poses) > 1 else '.png')), **({'quality': 90} if len(poses) > 1 else {}))
