"""Reads make-cursors.html's --dump-dom output on stdin and writes the PNGs."""
import base64, re, sys
out = sys.argv[1]
for name, data in re.findall(r"([a-z]+(?:@2x)?) ([A-Za-z0-9+/=]{100,})", sys.stdin.read()):
    open(f"{out}/{name}.png", "wb").write(base64.b64decode(data))
    print(name)
