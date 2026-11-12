"""ป้าจิตร new look (owner, 12 Nov 2026, from a photo): dark shoulder-length hair,
sunglasses pushed up on the head, yellow top, black trousers, white sneakers.
Recolours the Blender sprites in scripts/looks/src/jit/ → public/cast/jit/ (local only).
Usage: python3 scripts/looks/jit_update.py [outdir]"""
import sys, glob, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = "scripts/looks/src/jit"
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/cast/jit"
HAIR_DARK, HAIR_LIGHT = np.array([28, 22, 24]), np.array([110, 86, 78])
TOP = np.array([236, 200, 96])        # soft yellow
PANTS_DARK, PANTS_LIGHT = np.array([18, 18, 22]), np.array([78, 78, 88])
SHOE = np.array([246, 246, 248])

def tint(rgb, L, lo, hi, l0=150, l1=255):
    t = np.clip((L - l0) / (l1 - l0), 0, 1)[..., None]
    return lo + (hi - lo) * t

def process(path, out):
    im = np.array(Image.open(path).convert("RGBA")).astype(float)
    rgb, A = im[..., :3], im[..., 3]
    solid = A > 0
    dist = ndimage.distance_transform_edt(solid)
    inner = dist > 5.2                      # keep the white sticker outline
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    neutral = inner & (sat < 22) & (L > 120)
    blue = inner & (B > R + 25) & (B > G + 8)
    brown = inner & (R > G + 12) & (G > B) & (L < 150) & (sat > 25)
    dark = inner & (L < 70)
    H, W = A.shape
    ys = np.arange(H)[:, None].repeat(W, 1)
    out_rgb = rgb.copy()
    face = os.path.basename(path).startswith("face")
    # eyes: the dark blobs in the top part → chin line splits hair from top
    eyeish = inner & (L < 115) & (sat < 40)
    top_half = eyeish & (ys < (np.argmax(solid.any(1)) + (H - np.argmax(solid.any(1))) * (0.62 if face else 0.36)))
    if top_half.any():
        eye_y = int(np.median(np.nonzero(top_half)[0]))
    else:
        eye_y = int(H * 0.55)
    chin = eye_y + (int(H * 0.34) if face else 34)
    # face: an ellipse round the two eyes (skin and its white highlights stay as they are)
    lab, n = ndimage.label(top_half)
    face_m = np.zeros_like(solid)
    blobs = [ndimage.center_of_mass(lab == k) for k in range(1, n + 1) if (lab == k).sum() >= 6]
    pairs = [(a_, b_) for i, a_ in enumerate(blobs) for b_ in blobs[i + 1:] if abs(a_[0] - b_[0]) < 8 and (0.10 * W) < abs(a_[1] - b_[1]) < (0.45 * W)]
    if pairs:
        (ey1, ex1), (ey2, ex2) = min(pairs, key=lambda pr: pr[0][0] + pr[1][0])
        dx = abs(ex2 - ex1)
        cx, cy = (ex1 + ex2) / 2, (ey1 + ey2) / 2 + dx * 0.12
        rx, ry = dx * 1.15, dx * 0.85
        xs = np.arange(W)[None, :].repeat(H, 0)
        eye_y = int(cy)
        chin = eye_y + (int(H * 0.34) if face else 34)
        ell = ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 <= 1
        ell_in = ((xs - cx) / (rx * 0.8)) ** 2 + ((ys - cy) / (ry * 0.85)) ** 2 <= 1
        face_m = ((ell & (sat >= 6)) | (ell_in & (L >= 247))) & (ys >= cy - dx * 0.55)  # skin + its highlights, below the fringe
        collar = (np.abs(xs - cx) < dx * 0.95) & (ys >= cy + dx * 0.62)
    else:
        collar = np.zeros_like(solid)
    hair = inner & (sat < 9) & (L > 120) & (ys < chin) & ~face_m & ~collar
    out_rgb[hair] = tint(rgb, L, HAIR_DARK, HAIR_LIGHT, 170, 250)[hair]
    y0 = y1 = H
    if blue.any():
        by = np.nonzero(blue)[0]
        y0, y1 = by.min(), by.max()
    top = inner & (sat < 24) & (L > 120) & (ys < y0) & ((ys >= chin) | (collar & (sat < 9) & ~face_m))
    lab, n = ndimage.label(top)
    if n:  # drop specks (highlights on the hands)
        sizes = ndimage.sum(top, lab, range(1, n + 1))
        top = np.isin(lab, 1 + np.nonzero(sizes >= 40)[0])
    out_rgb[top] = (TOP * np.clip(L / 248, 0.55, 1.03)[..., None])[top]
    if blue.any():
        # skirt + hem → trousers; legs below → trousers; brown shoes → white sneakers
        hem = inner & (ys >= y0 - 3) & (ys <= y1 + 3) & ~blue & (((sat > 30) & (R > B)) | ((sat < 24) & ndimage.binary_dilation(blue, iterations=4)))
        shoes = brown & (ys > y1)
        shoes_d = ndimage.binary_dilation(shoes, iterations=1)
        legs = blue | hem | (inner & (ys > y1 - 2) & ~shoes_d & ~dark)
        out_rgb[legs] = tint(rgb, L, PANTS_DARK, PANTS_LIGHT, 60, 250)[legs]
        out_rgb[shoes] = (SHOE * np.clip(L / 120, 0.72, 1.0)[..., None])[shoes]
    img = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), A]).astype(np.uint8), "RGBA")
    # sunglasses pushed up on the head
    if hair.any():
        hy, hx = np.nonzero(hair)
        x0, x1, ytop = hx.min(), hx.max(), hy.min()
        w = x1 - x0
        cx, cy = (x0 + x1) / 2, ytop + w * 0.20
        S = 4
        big = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        lw, lh, gap = w * 0.30, w * 0.17, w * 0.06
        for sx in (-1, 1):
            lx = cx + sx * (gap / 2 + lw / 2)
            box = [(lx - lw / 2) * S, (cy - lh / 2) * S, (lx + lw / 2) * S, (cy + lh / 2) * S]
            d.rounded_rectangle(box, radius=lh * 0.45 * S, fill=(20, 20, 26, 255), outline=(250, 250, 250, 255), width=max(2, int(w * 0.018 * S)))
            d.ellipse([(lx - lw * 0.30) * S, (cy - lh * 0.32) * S, (lx - lw * 0.08) * S, (cy - lh * 0.10) * S], fill=(255, 255, 255, 120))
        d.line([((cx - gap / 2) * S, cy * S), ((cx + gap / 2) * S, cy * S)], fill=(20, 20, 26, 255), width=max(3, int(w * 0.03 * S)))
        img.alpha_composite(big.resize((W, H), Image.LANCZOS))
    img.save(out, "WEBP", quality=92, method=6)

os.makedirs(OUT, exist_ok=True)
for p in sorted(glob.glob(f"{SRC}/*.webp")):
    if os.path.basename(p).startswith("tiffin"):
        continue  # the lunch box prop: unchanged
    process(p, os.path.join(OUT, os.path.basename(p)))
    print("ok", os.path.basename(p))
