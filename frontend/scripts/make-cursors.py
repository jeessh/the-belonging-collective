"""Draws card view's big cursor: the ordinary arrow (black, white edge),
48px plus a 96px copy for Retina screens. Run: python3 scripts/make-cursors.py public/cursors"""
from PIL import Image, ImageDraw
import sys

out = sys.argv[1]
SS = 8  # drawn 8x larger, then scaled down, for clean edges
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
# The standard arrow, on a 24-unit grid.
PTS = [(4.5, 2.5), (4.5, 19), (8.7, 15), (11.5, 21.2), (14.3, 20), (11.5, 13.9), (17.3, 13.9)]

def arrow(px):
    s = px * SS
    k = s / 24
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = [(x * k, y * k) for x, y in PTS]
    d.line(P + [P[0]], fill=WHITE, width=round(2.6 * k), joint="curve")
    r = 1.3 * k
    for x, y in P:
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    d.polygon(P, fill=BLACK)
    return im.resize((px, px), Image.LANCZOS)

arrow(48).save(f"{out}/arrow.png")
arrow(96).save(f"{out}/arrow@2x.png")
print("ok")
