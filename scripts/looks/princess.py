# ลุคเจ้าหญิง (26 Nov 2026 — นัท). Our own princess look, not any film character:
# the shirt becomes a gown bodice, a flared bell skirt with pleats and a gold hem
# covers the legs, a tiara sits on the hair and a bow on one side.
#   python3 princess.py <srcdir> <person> <look> <outdir> [pose ...]
import sys, os, math, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from thai import shade, outline, MID, SHIRT

LOOKS = {
    'nat': {
        '1': dict(name='ชมพูกุหลาบ โบว์แดง', bodice=(232, 96, 150), skirt=(255, 180, 210), skirt2=(255, 222, 236), trim=(240, 196, 70), tiara=(244, 200, 70), gem=(220, 40, 110), bow=(214, 30, 50)),
        '2': dict(name='ม่วงลาเวนเดอร์ โบว์ขาว', bodice=(150, 110, 210), skirt=(206, 180, 245), skirt2=(236, 224, 255), trim=(220, 220, 235), tiara=(225, 228, 240), gem=(150, 90, 220), bow=(255, 255, 255)),
        '3': dict(name='เขียวมิ้นต์ โบว์ชมพู', bodice=(60, 170, 150), skirt=(170, 228, 210), skirt2=(226, 248, 240), trim=(240, 196, 70), tiara=(244, 200, 70), gem=(60, 170, 150), bow=(245, 130, 175)),
    },
}

def head(x, y, l, a):
    """Hair/face/outline around the head stay as they are (raised arms beside it still recolour)."""
    if 60 <= x <= 152 and y < 205: return True
    return y < 214 and 60 <= x <= 168 and (l > 0.58 or a < 235)

def recolor(im, person, lk):
    px = im.load(); w, h = im.size
    band = SHIRT[person]; lo, hi = band or (0.0, 1.0)
    shirt = np.zeros((h, w), bool)
    for y in range(90, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            is_shirt = (lo < hh < hi and s > 0.25) if band else (s < 0.18 and 0.15 < l < 0.78 and y < 294)
            if y < 300 and is_shirt and not head(x, y, l, a):
                px[x, y] = shade(lk['bodice'], l, MID[person]) + (a,); shirt[y, x] = True
            elif 296 <= y < 356 and s < 0.35 and 0.12 < l < 0.86 and not (hh < 0.12 and s > 0.3):
                px[x, y] = shade(lk['skirt'], l, 0.5) + (a,)
    near = np.array(Image.fromarray((shirt * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
    for y, x in zip(*np.nonzero(near & ~shirt)):
        r, g, b, a = px[int(x), int(y)]
        if a < 20: continue
        hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if head(x, y, l, a): continue
        if (lo - 0.04 < hh < hi + 0.04 and s > 0.08 and l < 0.9) if band else (s < 0.22 and 0.12 < l < 0.85 and y < 296):
            px[int(x), int(y)] = shade(lk['bodice'], l, MID[person]) + (a,)
    return im, shirt

def skirt(im, lk, ref):
    a = np.array(ref.split()[3])
    rows = np.where((a > 200).sum(1) > 8)[0]; bottom = rows[-1]
    hem = min(354, bottom - 20); top = 288
    if hem - top < 14: hem = top + 18  # sitting: a short skirt over the lap
    xs = np.where(a[top:top + 6].max(0) > 200)[0]
    cx = 115 if xs.size == 0 else (max(xs.min(), 62) + min(xs.max(), 168)) / 2
    half_top, half_hem = 38, 38 + (hem - top) * 0.45
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    poly = [(cx - half_top, top), (cx + half_top, top), (cx + half_hem, hem), (cx - half_hem, hem)]
    d.polygon(poly, fill=lk['skirt'] + (255,))
    # soft side shading + pleats
    for k in range(1, 7):
        t = k / 7
        x0 = cx - half_top + 2 * half_top * t; x1 = cx - half_hem + 2 * half_hem * t
        d.line([(x0, top + 4), (x1, hem - 2)], fill=lk['skirt2'] + (170,), width=3)
        d.line([(x0 + 3, top + 4), (x1 + 4, hem - 2)], fill=tuple(int(c * 0.85) for c in lk['skirt']) + (140,), width=2)
    # scalloped hem + gold trim
    d.line([(cx - half_hem, hem), (cx + half_hem, hem)], fill=lk['trim'] + (255,), width=4)
    n = 7
    for k in range(n):
        x = cx - half_hem + (k + 0.5) * 2 * half_hem / n
        d.ellipse([x - 5, hem - 3, x + 5, hem + 5], fill=lk['skirt2'] + (255,), outline=lk['trim'] + (255,))
    # waist band
    d.rectangle([cx - half_top - 2, top - 3, cx + half_top + 2, top + 4], fill=lk['trim'] + (255,))
    outline(g, im, 5)

def tiara(im, lk):
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    cx, base = 120, 116
    pts = [(cx - 30, base), (cx - 26, base - 9), (cx - 15, base - 4), (cx - 8, base - 15), (cx, base - 6), (cx + 8, base - 15),
           (cx + 15, base - 4), (cx + 26, base - 9), (cx + 30, base), (cx, base + 4)]
    d.polygon(pts, fill=lk['tiara'] + (255,), outline=tuple(int(c * 0.7) for c in lk['tiara']) + (255,))
    for x, y in [(cx - 26, base - 9), (cx - 8, base - 15), (cx + 8, base - 15), (cx + 26, base - 9)]:
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 255, 255))
    d.ellipse([cx - 5, base - 8, cx + 5, base + 1], fill=lk['gem'] + (255,), outline=(255, 255, 255, 255))
    outline(g, im, 3)

def bow(im, lk):
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    cx, cy = 152, 122
    dark = tuple(int(c * 0.75) for c in lk['bow'])
    d.polygon([(cx, cy), (cx - 16, cy - 11), (cx - 16, cy + 9)], fill=lk['bow'] + (255,), outline=dark + (255,))
    d.polygon([(cx, cy), (cx + 16, cy - 11), (cx + 16, cy + 9)], fill=lk['bow'] + (255,), outline=dark + (255,))
    d.polygon([(cx - 2, cy + 2), (cx - 8, cy + 16), (cx - 3, cy + 15)], fill=lk['bow'] + (255,), outline=dark + (255,))
    d.polygon([(cx + 2, cy + 2), (cx + 8, cy + 16), (cx + 3, cy + 15)], fill=lk['bow'] + (255,), outline=dark + (255,))
    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=dark + (255,))
    outline(g, im, 3)

def draw(srcdir, person, key, pose='stand'):
    lk = LOOKS[person][key]
    im = Image.open(os.path.join(srcdir, pose + '.webp')).convert('RGBA')
    im, _ = recolor(im, person, lk)
    base = im.copy()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    skirt(out, lk, base)
    im2 = base.copy(); im2.alpha_composite(out)
    # put the hands/arms (bodice + skin above the waist) back on top of the skirt
    top = base.copy(); arr = np.array(top); arr[294:, :, 3] = 0
    im2.alpha_composite(Image.fromarray(arr))
    tiara(im2, lk); bow(im2, lk)
    return im2

if __name__ == '__main__':
    srcdir, person, key, out = sys.argv[1:5]
    poses = sys.argv[5:] or ['stand']
    os.makedirs(out, exist_ok=True)
    for p in poses:
        draw(srcdir, person, key, p).save(os.path.join(out, p + ('.webp' if len(poses) > 1 else '.png')), **({'quality': 90} if len(poses) > 1 else {}))
