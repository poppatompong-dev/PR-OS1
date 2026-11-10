# ลุคนางเงือกของนัท (10 Nov 2026): 2D overlay on her own sprite — keeps head/torso,
# tints the shirt, draws a scaled tail + fin. Run from the repo root:
#   python3 scripts/looks/mermaid.py <outdir>   → lookA/B/C.png (stand pose)
import sys, math, colorsys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
SRC='public/cast/00000000-0000-0000-0000-000000000504/'
LOOKS={
 'A':dict(name='ทะเลคราม', tail=((40,190,200),(20,90,160)), fin=(120,230,235), shirt=0.50),
 'B':dict(name='ปะการังชมพู', tail=((255,140,170),(200,60,120)), fin=(255,200,215), shirt=0.95),
 'C':dict(name='มุกลาเวนเดอร์', tail=((190,160,240),(110,80,190)), fin=(235,215,255), shirt=0.75),
}
WAIST=292
def tint_shirt(im, hue):
    px=im.load(); w,h=im.size
    for y in range(195, WAIST+4):
        for x in range(w):
            r,g,b,a=px[x,y]
            if a<40: continue
            hh,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
            if s<0.18 and 0.15<l<0.75:   # the grey shirt + arms, keeps its shading
                nr,ng,nb=colorsys.hls_to_rgb(hue, min(0.82,l*1.15+0.08), 0.55)
                px[x,y]=(int(nr*255),int(ng*255),int(nb*255),a)
    return im
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def tail_shape(pose_dx=0):
    # left/right edges from the waist down, curving to one side, then the fin
    L=[];R=[]
    for i in range(0,101):
        t=i/100; y=WAIST+t*92
        half=42*(1-t)**0.8+7
        cx=115+math.sin(t*math.pi*0.9)*14+pose_dx*t
        L.append((cx-half,y)); R.append((cx+half,y))
    return L,R
def draw_look(key, pose='stand'):
    lk=LOOKS[key]
    base=Image.open(SRC+pose+'.webp').convert('RGBA')
    top=base.crop((0,0,230,WAIST+6))
    hue=colorsys.rgb_to_hls(*[c/255 for c in lk['tail'][0]])[0]
    top=tint_shirt(top.copy(), hue)
    W,H=230,410
    layer=Image.new('RGBA',(W,H),(0,0,0,0))
    L,R=tail_shape()
    poly=L+R[::-1]
    # gradient fill via mask
    mask=Image.new('L',(W,H),0); ImageDraw.Draw(mask).polygon(poly,fill=255)
    grad=Image.new('RGBA',(W,H))
    gd=ImageDraw.Draw(grad)
    for y in range(H):
        t=max(0,min(1,(y-WAIST)/95)); gd.line([(0,y),(W,y)],fill=lerp(lk['tail'][0],lk['tail'][1],t)+(255,))
    # side shading
    shade=Image.new('L',(W,H),0); sd=ImageDraw.Draw(shade)
    for i,(l,r) in enumerate(zip(L,R)):
        y=l[1]; wdt=r[0]-l[0]
        sd.line([(l[0],y),(l[0]+wdt*0.25,y)],fill=70); sd.line([(r[0]-wdt*0.3,y),(r[0],y)],fill=95)
    shade=shade.filter(ImageFilter.GaussianBlur(5))
    dark=Image.new('RGBA',(W,H),(0,0,40,255)); dark.putalpha(shade)
    grad.alpha_composite(dark)
    # scales: rows of arcs
    sc=Image.new('RGBA',(W,H),(0,0,0,0)); scd=ImageDraw.Draw(sc)
    for row,y in enumerate(range(WAIST+6,WAIST+92,9)):
        off=0 if row%2 else 6
        for x in range(30+off,200,12):
            scd.arc([x-6,y-6,x+6,y+6],200,340,fill=(255,255,255,90),width=2)
    grad.alpha_composite(sc)
    # highlight stripe
    hl=Image.new('L',(W,H),0); hd=ImageDraw.Draw(hl)
    for l,r in zip(L,R):
        y=l[1]; wdt=r[0]-l[0]; hd.line([(l[0]+wdt*0.35,y),(l[0]+wdt*0.48,y)],fill=80)
    hl=hl.filter(ImageFilter.GaussianBlur(4)); white=Image.new('RGBA',(W,H),(255,255,255,255)); white.putalpha(hl); grad.alpha_composite(white)
    grad.putalpha(ImageChops.multiply(mask, grad.split()[3]))
    layer.alpha_composite(grad)
    # fin
    tipx,tipy=L[-1][0]+(R[-1][0]-L[-1][0])/2, L[-1][1]
    fin=Image.new('RGBA',(W,H),(0,0,0,0)); fd=ImageDraw.Draw(fin)
    for side in (-1,1):
        pts=[(tipx,tipy-8),(tipx+side*22,tipy-2),(tipx+side*50,tipy+6),(tipx+side*58,tipy+16),(tipx+side*44,tipy+24),(tipx+side*26,tipy+20),(tipx+side*8,tipy+12),(tipx,tipy+8)]
        fd.polygon(pts,fill=lk['fin']+(255,))
        for k in range(1,5):
            fd.line([(tipx+side*3,tipy),(tipx+side*(12*k+4),tipy+8+3*k)],fill=lerp(lk['fin'],lk['tail'][1],0.5)+(210,),width=2)
    layer.alpha_composite(fin)
    out=Image.new('RGBA',(W,H),(0,0,0,0))
    out.alpha_composite(layer); out.alpha_composite(top,(0,0))
    # sticker outline like the other sprites
    a=out.split()[3].point(lambda v:255 if v>60 else 0)
    ring=a.filter(ImageFilter.MaxFilter(7))
    border=Image.new('RGBA',(W,H),(255,255,255,255)); border.putalpha(ring)
    final=Image.new('RGBA',(W,H),(0,0,0,0)); final.alpha_composite(border); final.alpha_composite(out)
    # starfish clip + pearls
    d=ImageDraw.Draw(final)
    cx,cy,rr=150,118,11
    pts=[]
    for k in range(10):
        ang=-math.pi/2+k*math.pi/5; rad=rr if k%2==0 else rr*0.45
        pts.append((cx+rad*math.cos(ang), cy+rad*math.sin(ang)))
    d.polygon(pts,fill=(255,200,90,255),outline=(230,140,40,255))
    for k,x in enumerate(range(92,152,9)):
        d.ellipse([x-3,206-3,x+3,206+3],fill=(255,250,245,255),outline=(220,210,220,255))
    return final
if __name__=='__main__':
    out=sys.argv[1]
    for k in LOOKS: draw_look(k).save(f'{out}/look{k}.png')
