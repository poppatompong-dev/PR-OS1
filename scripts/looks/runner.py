# ลุคนักวิ่งของแข (10 Nov 2026): recolours her own sprite (shirt / pants / shoes,
# keeping the 3D shading) and draws race bits on top. Run from the repo root:
#   python3 scripts/looks/runner.py <outdir>   → lookA/B/C.png (stand pose)
# Served set (public/cast/<id>/) = look D (แข picked 3, then asked for a เก๊กฮวย glass, 11 Nov 2026).
import sys, colorsys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = 'scripts/looks/src/00000000-0000-0000-0000-000000000506/'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
LOOKS = {
    'A': dict(name='มาราธอน', shirt=(0.07, 0.95), pants=(0.0, 0.0, 0.18), shoes=(0.25, 0.95)),
    'B': dict(name='เหรียญทอง', shirt=(0.60, 0.80), pants=(0.62, 0.45, 0.30), shoes=(0.0, 0.0)),
    'C': dict(name='สปอร์ตชมพู', shirt=(0.93, 0.85), pants=(0.0, 0.0, 0.92), shoes=(0.93, 0.85)),
}

def recolor(im, look):
    px = im.load(); w, h = im.size
    for y in range(90, h):   # 90: a raised sleeve (up / wave) sits above the shoulders
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            new = None
            if y < 300 and 0.66 < hh < 0.86 and s > 0.2 and (y >= 195 or s > 0.25):            # lavender shirt + sleeves
                H, S = look['shirt']; new = colorsys.hls_to_rgb(H, min(0.85, l * 0.95), S)
            elif 288 <= y < 356 and s < 0.15 and 0.2 < l < 0.8:      # grey pants
                H, S, L = look['pants']; new = colorsys.hls_to_rgb(H, max(0.05, min(0.95, L + (l - 0.5) * 0.5)), S)
            elif y >= 318 and 0.02 < hh < 0.14 and l < 0.6:           # brown shoes (a lifted back foot sits higher)
                H, S = look['shoes']; new = colorsys.hls_to_rgb(H, 0.5 + (l - 0.35) * 0.6 if S else min(0.97, l + 0.45), S)
            if new: px[x, y] = (int(new[0] * 255), int(new[1] * 255), int(new[2] * 255), a)
    return im

def extras(im, key):
    d = ImageDraw.Draw(im)
    if key == 'A':   # race bib
        d.rounded_rectangle([97, 228, 143, 262], 4, fill=(255, 255, 255, 255), outline=(40, 40, 40, 255), width=2)
        f = ImageFont.truetype(FONT, 13); d.text((120, 248), '2569', font=f, fill=(20, 20, 20, 255), anchor='mm')
        d.line([(100, 234), (140, 234)], fill=(230, 60, 40, 255), width=3)
    if key == 'B':   # gold medal on a ribbon
        d.line([(104, 205), (120, 244)], fill=(220, 30, 40, 255), width=6); d.line([(136, 205), (120, 244)], fill=(30, 80, 200, 255), width=6)
        d.ellipse([106, 238, 134, 266], fill=(250, 200, 50, 255), outline=(190, 130, 20, 255), width=3)
        f = ImageFont.truetype(FONT, 14); d.text((120, 252), '1', font=f, fill=(150, 90, 0, 255), anchor='mm')
    if key == 'C':   # headband + trophy
        d.rounded_rectangle([96, 138, 160, 146], 4, fill=(40, 210, 220, 235))
        cup = [(44, 236), (76, 236), (72, 258), (64, 266), (56, 266), (48, 258)]
        d.polygon(cup, fill=(250, 200, 50, 255), outline=(190, 130, 20, 255))
        d.arc([34, 238, 50, 254], 90, 270, fill=(190, 130, 20, 255), width=3); d.arc([70, 238, 86, 254], 270, 90, fill=(190, 130, 20, 255), width=3)
        d.rectangle([57, 266, 63, 276], fill=(220, 160, 30, 255)); d.rounded_rectangle([48, 276, 72, 284], 2, fill=(120, 80, 40, 255))
    return im

# แข 11 Nov 2026: "แบบ 3 แต่เพิ่มถือแก้วน้ำเก๊กฮวยสีเหลือง" → look D = C + a glass in the right hand.
LOOKS['D'] = dict(LOOKS['C'], name='สปอร์ตชมพู + เก๊กฮวย')
HAND = {'stand': (169, 276), 'wave': (192, 166), 'up': (181, 161), 'walkA': (171, 268), 'walkB': (176, 274),
        'runA': (173, 262), 'runB': (185, 259), 'sit': (185, 271)}

def glass(im, cx, cy):
    """A tumbler of golden chrysanthemum tea with a straw and a little flower, held at (cx, cy)."""
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    top, bot = cy - 34, cy + 4
    body = [(cx - 11, top), (cx + 11, top), (cx + 8, bot), (cx - 8, bot)]
    d.polygon(body, fill=(230, 245, 255, 150), outline=(255, 255, 255, 255))
    lvl = top + 8
    d.polygon([(cx - 10, lvl), (cx + 10, lvl), (cx + 8, bot - 2), (cx - 8, bot - 2)], fill=(246, 196, 40, 255))
    d.line([(cx - 9, lvl + 1), (cx + 9, lvl + 1)], fill=(255, 228, 120, 255), width=2)
    d.line([(cx - 6, lvl + 4), (cx - 5, bot - 5)], fill=(255, 245, 200, 200), width=2)          # shine
    d.line([(cx + 3, top + 12), (cx + 9, top - 12)], fill=(60, 170, 90, 255), width=3)         # straw
    for k in range(8):                                                                       # flower on the rim
        a = k * 3.14159 / 4; x, y = cx - 9 + 5 * __import__('math').cos(a), top + 1 + 5 * __import__('math').sin(a)
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 220, 60, 255))
    d.ellipse([cx - 12, top - 2, cx - 6, top + 4], fill=(230, 140, 20, 255))
    halo = g.split()[3].point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(5))
    ring = Image.new('RGBA', im.size, (255, 255, 255, 255)); ring.putalpha(halo)
    im.alpha_composite(ring); im.alpha_composite(g)
    return im

def draw_look(key, pose='stand'):
    im = Image.open(SRC + pose + '.webp').convert('RGBA')
    im = extras(recolor(im, LOOKS[key]), 'C' if key == 'D' else key)
    if key == 'D':
        im = glass(im, *HAND[pose.split('-')[0]])
    return im

if __name__ == '__main__':
    for k in LOOKS: draw_look(k).save(f'{sys.argv[1]}/runner{k}.png')
