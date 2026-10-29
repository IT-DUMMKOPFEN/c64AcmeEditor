#!/usr/bin/env python3
"""Create the sample pictures for the snippet library from examples/gfx/picture.kla

    python3 scripts/make_snippet_data.py

Writes snippets/data/:
    picture.kla   Koala Painter (multicolour)           load $6000, 10003 bytes
    picture.ocp   Advanced Art Studio (multicolour)     load $2000, 10018 bytes
    picture.art   Art Studio (hires)                    load $2000,  9011 bytes
    picture.dd    Doodle (hires)                        load $5c00,  9218 bytes
    bitmap.bin / screen.bin / colors.bin   raw multicolour data without load address
    demo_tune.sid copy of the example tune

The hires versions are converted from the multicolour picture: every 8x8 cell
gets its two most used colours.
"""
import os
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'snippets', 'data')

# Pepto palette, only used to decide which of two colours is closer
PAL = [(0, 0, 0), (255, 255, 255), (104, 55, 43), (112, 164, 178), (111, 61, 134), (88, 141, 67), (53, 40, 121), (184, 199, 111),
       (111, 79, 37), (67, 57, 0), (154, 103, 89), (68, 68, 68), (108, 108, 108), (154, 210, 132), (108, 94, 181), (149, 149, 149)]


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(PAL[a], PAL[b]))


def main():
    os.makedirs(OUT, exist_ok=True)
    kla = open(os.path.join(ROOT, 'examples', 'gfx', 'picture.kla'), 'rb').read()
    bitmap, screen, color, bg = kla[2:8002], kla[8002:9002], kla[9002:10002], kla[10002]
    border = 0

    shutil.copy2(os.path.join(ROOT, 'examples', 'gfx', 'picture.kla'), os.path.join(OUT, 'picture.kla'))
    shutil.copy2(os.path.join(ROOT, 'examples', 'music', 'demo_tune.sid'), os.path.join(OUT, 'demo_tune.sid'))

    # raw parts
    open(os.path.join(OUT, 'bitmap.bin'), 'wb').write(bitmap)
    open(os.path.join(OUT, 'screen.bin'), 'wb').write(screen)
    open(os.path.join(OUT, 'colors.bin'), 'wb').write(color + bytes([bg]))

    # Advanced Art Studio: bitmap $2000, screen $3f40, border $4328, background $4329, colours $4338
    ocp = bytearray([0x00, 0x20]) + bitmap + screen + bytes([border, bg]) + bytes(14) + color
    assert len(ocp) == 2 + 0x4720 - 0x2000
    open(os.path.join(OUT, 'picture.ocp'), 'wb').write(ocp)

    # hires conversion
    hbm = bytearray(8000)
    hscr = bytearray(1000)
    for cell in range(1000):
        sc, cr = screen[cell], color[cell]
        cols = []
        for row in range(8):
            byte = bitmap[cell * 8 + row]
            line = []
            for p in range(4):
                pair = (byte >> (6 - p * 2)) & 3
                c = [bg, sc >> 4, sc & 15, cr & 15][pair]
                line += [c, c]
            cols.append(line)
        count = {}
        for line in cols:
            for c in line:
                count[c] = count.get(c, 0) + 1
        top = sorted(count, key=lambda c: -count[c])
        fg = top[0]
        bk = top[1] if len(top) > 1 else top[0]
        for row in range(8):
            v = 0
            for x in range(8):
                c = cols[row][x]
                if dist(c, fg) <= dist(c, bk):
                    v |= 0x80 >> x
            hbm[cell * 8 + row] = v
        hscr[cell] = (fg << 4) | bk

    # Art Studio: load $2000, bitmap, screen, border + padding (9009 bytes of data)
    art = bytearray([0x00, 0x20]) + hbm + hscr + bytes([border]) + bytes(8)
    assert len(art) == 9011
    open(os.path.join(OUT, 'picture.art'), 'wb').write(art)

    # Doodle: load $5c00, screen ($5c00, 1000 + 24 unused bytes), bitmap $6000
    dd = bytearray([0x00, 0x5c]) + hscr + bytes(24) + hbm + bytes(192)
    assert len(dd) == 9218
    open(os.path.join(OUT, 'picture.dd'), 'wb').write(dd)
    print('written to', OUT)


if __name__ == '__main__':
    main()
