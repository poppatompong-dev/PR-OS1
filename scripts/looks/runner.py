# ลุคนักวิ่งของแข (10 Nov 2026): recolours her own sprite (shirt / pants / shoes,
# keeping the 3D shading) and draws race bits on top. Run from the repo root:
#   python3 scripts/looks/runner.py <outdir>   → lookA/B/C.png (stand pose)
import sys, colorsys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = 'public/cast/00000000-0000-0000-0000-000000000506/'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
LOOKS = {
    'A': dict(name='มาราธอน', shirt=(0.07, 0.95), pants=(0.0, 0.0, 0.18), shoes=(0.25, 0.95)),
    'B': dict(name='เหรียญทอง', shirt=(0.60, 0.80), pants=(0.62, 0.45, 0.30), shoes=(0.0, 0.0)),
    'C': dict(name='สปอร์ตชมพู', shirt=(0.93, 0.85), pants=(0.0, 0.0, 0.92), shoes=(0.93, 0.85)),
}

def recolor(im, look):
    px = im.load(); w, h = im.size
    for y in range(195, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40: continue
            hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            new = None
            if y < 300 and 0.66 < hh < 0.86 and s > 0.2:            # lavender shirt + sleeves
                H, S = look['shirt']; new = colorsys.hls_to_rgb(H, min(0.85, l * 0.95), S)
            elif 288 <= y < 356 and s < 0.15 and 0.2 < l < 0.8:      # grey pants
                H, S, L = look['pants']; new = colorsys.hls_to_rgb(H, max(0.05, min(0.95, L + (l - 0.5) * 0.5)), S)
            elif y >= 350 and 0.02 < hh < 0.14 and l < 0.6:           # brown shoes
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

def draw_look(key, pose='stand'):
    im = Image.open(SRC + pose + '.webp').convert('RGBA')
    return extras(recolor(im, LOOKS[key]), key)

if __name__ == '__main__':
    for k in LOOKS: draw_look(k).save(f'{sys.argv[1]}/runner{k}.png')
