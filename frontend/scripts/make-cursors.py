from PIL import Image, ImageDraw
import sys
out=sys.argv[1]
SS=4
def canvas(px):
    s=px*SS; return Image.new("RGBA",(s,s),(0,0,0,0)), s/24
def rline(d,k,x1,y1,x2,y2,w,col):
    W=w*k; d.line([(x1*k,y1*k),(x2*k,y2*k)],fill=col,width=round(W))
    r=W/2
    for (x,y) in [(x1,y1),(x2,y2)]:
        d.ellipse([x*k-r,y*k-r,x*k+r,y*k+r],fill=col)
def rrect(d,k,x,y,w,h,r,fill):
    d.rounded_rectangle([x*k,y*k,(x+w)*k,(y+h)*k],radius=r*k,fill=fill)
BLACK=(0,0,0,255); WHITE=(255,255,255,255)
def hand(px,palm,fingers,thumb,inner):
    im,k=canvas(px); d=ImageDraw.Draw(im)
    W=3.6; O=1.61
    x,y,w,h,r=palm
    rrect(d,k,x-O/2,y-O/2,w+O,h+O,r+O/2,BLACK)
    rrect(d,k,x+O/2,y+O/2,w-O,h-O,max(r-O/2,0),WHITE)
    for f in [thumb]+fingers:
        rline(d,k,*f,W+2*O,BLACK); rline(d,k,*f,W,WHITE)
    ix,iy,iw,ih,ir=inner
    rrect(d,k,ix,iy,iw,ih,ir,WHITE)
    return im.resize((px,px),Image.LANCZOS)
def arrow(px):
    im,k=canvas(px); d=ImageDraw.Draw(im)
    pts=[(4.5,2.5),(4.5,19),(8.7,15),(11.5,21.2),(14.3,20),(11.5,13.9),(17.3,13.9)]
    P=[(x*k,y*k) for x,y in pts]
    d.line(P+[P[0]],fill=WHITE,width=round(3.0*k),joint="curve")
    for x,y in P:
        r=1.5*k; d.ellipse([x-r,y-r,x+r,y+r],fill=WHITE)
    d.polygon(P,fill=BLACK)
    return im.resize((px,px),Image.LANCZOS)
open_palm=(6.2,11,13.3,11.2,4.2); open_inner=(7.0,13.2,11.7,8.2,3.4)
shapes={
 "arrow": arrow,
 "pointer": lambda px: hand(px,open_palm,[(8.6,12,8.6,2.8),(11.9,12,11.9,9.2),(15.1,12,15.1,9.6),(18.2,12.5,18.2,10.4)],(4.1,13.6,7.4,17.4),open_inner),
 "grab": lambda px: hand(px,open_palm,[(7.9,13,7.9,8.6),(11.1,12,11.1,4.2),(14.3,12,14.3,3.4),(17.5,12.5,17.5,5.6)],(4.1,13.6,7.4,17.4),open_inner),
 "grabbing": lambda px: hand(px,(5.6,10.2,14.4,11.3,4.6),[(8,12,8,9.4),(11.2,11.5,11.2,8.4),(14.4,11.5,14.4,8.4),(17.6,12,17.6,9.4)],(4.2,13,7,15.6),(6.4,12.4,12.8,8.3,3.8)),
}
for name,f in shapes.items():
    f(48).save(f"{out}/{name}.png"); f(96).save(f"{out}/{name}@2x.png")
print("ok")
