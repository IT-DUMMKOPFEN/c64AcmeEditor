#!/usr/bin/env python3
"""
Generates examples/gfx/picture.kla - the demo picture for the Koala viewer
example (a retro sunset with a grid floor and the editor's name).

Koala Painter format (10003 bytes):
  2 bytes   load address ($6000)
  8000      bitmap      (40 x 25 cells x 8 bytes)
  1000      screen RAM  (colours for pixel values %01 / %10)
  1000      colour RAM  (colour for pixel value %11)
  1         background  (pixel value %00)

Every 4x8 cell may use the background colour plus 3 own colours. This script
draws the picture directly with C64 colours and then picks the 3 most used
colours per cell.

(c) 2026 IT-Dummköpfe - MIT License. Requires Pillow.
"""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 160, 200                     # multicolour: 160 "fat" pixels
BG = 0                              # black background

# C64 palette (for nearest colour decisions)
PAL = [(0, 0, 0), (255, 255, 255), (129, 51, 56), (117, 206, 200), (142, 60, 151), (86, 172, 77),
       (46, 44, 155), (237, 241, 113), (142, 80, 41), (85, 56, 0), (196, 108, 113), (74, 74, 74),
       (123, 123, 123), (169, 255, 159), (112, 109, 235), (178, 178, 178)]

BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dither(a, b, t, x, y):
    """mix colour a -> b with ratio t (0..1) using ordered dithering"""
    return b if BAYER4[y & 3][x & 3] < t * 16 else a


def draw():
    img = [[BG] * W for _ in range(H)]
    horizon = 128
    # --- sky: dark blue -> purple -> red -> orange, dithered bands
    sky = [(0, 6, 0, 40), (6, 4, 40, 80), (4, 2, 80, 104), (2, 10, 104, 128)]
    for y in range(horizon):
        for (ca, cb, y0, y1) in sky:
            if y0 <= y < y1:
                t = (y - y0) / (y1 - y0)
                for x in range(W):
                    img[y][x] = dither(ca, cb, t, x, y)
    # --- stars
    for i in range(40):
        x = (i * 37 + 11) % W
        y = (i * 23 + 5) % 60
        img[y][x] = 1 if i % 3 else 15
    # --- sun with stripes (fat pixels: x distance counts double)
    cx, cy, r = 80, 110, 40
    for y in range(cy - r, horizon):
        for x in range(W):
            dx, dy = 2 * (x - cx), y - cy
            if dx * dx + dy * dy <= r * r:
                if y > cy - 8 and (y // 3) % 3 == 0:
                    continue                # stripes in the lower half
                t = (y - (cy - r)) / (2 * r)
                img[y][x] = dither(7, 8, min(1.0, t * 1.6), x, y)
    # --- mountains (silhouettes)
    for x in range(W):
        h1 = 18 + 10 * math.sin(x * 0.07) + 6 * math.sin(x * 0.19 + 1)
        h2 = 10 + 6 * math.sin(x * 0.11 + 2) + 4 * math.sin(x * 0.31)
        for y in range(int(horizon - h1), horizon):
            img[y][x] = 11 if y < horizon - h2 else 9
    # --- floor with a perspective grid
    for y in range(horizon, H):
        for x in range(W):
            img[y][x] = 0
    vp = 80                                  # vanishing point x
    for i in range(-12, 13):                 # lines towards the horizon
        for y in range(horizon, H):
            t = (y - horizon) / (H - horizon)
            x = int(vp + i * 6 + i * t * 40)
            if 0 <= x < W:
                img[y][x] = 4 if y < horizon + 20 else 14
    z = 1.0
    while z < 30:                            # horizontal lines
        y = horizon + int(70 / z)
        if horizon < y < H:
            for x in range(W):
                img[y][x] = 4 if y < horizon + 20 else 14
        z *= 1.35
    # --- title text (rendered with Pillow's built-in font, scaled)
    font = ImageFont.load_default()
    text = "C64 ACME EDITOR"
    tmp = Image.new('L', (200, 20), 0)
    ImageDraw.Draw(tmp).text((0, 0), text, fill=255, font=font)
    bbox = tmp.getbbox()
    tmp = tmp.crop(bbox)
    tw, th = tmp.size
    tmp = tmp.resize((tw, th * 2), Image.NEAREST)   # double height
    ox, oy = (W - tw) // 2, 152
    for y in range(tmp.size[1]):
        for x in range(tmp.size[0]):
            if tmp.getpixel((x, y)) > 100:
                if oy + y + 1 < H and x + 1 < W:
                    img[oy + y + 1][ox + x + 1] = 6          # shadow
    for y in range(tmp.size[1]):
        for x in range(tmp.size[0]):
            if tmp.getpixel((x, y)) > 100:
                img[oy + y][ox + x] = 1 if y < th else 13
    return img


def to_koala(img):
    bitmap = bytearray(8000)
    screen = bytearray(1000)
    color = bytearray(1000)
    for cy in range(25):
        for cx in range(40):
            counts = {}
            for y in range(8):
                for x in range(4):
                    c = img[cy * 8 + y][cx * 4 + x]
                    if c != BG:
                        counts[c] = counts.get(c, 0) + 1
            top = sorted(counts, key=lambda c: -counts[c])[:3]
            while len(top) < 3:
                top.append(BG)
            c1, c2, c3 = top
            cell = cy * 40 + cx
            screen[cell] = (c1 << 4) | c2
            color[cell] = c3
            choices = [(BG, 0), (c1, 1), (c2, 2), (c3, 3)]
            for y in range(8):
                byte = 0
                for x in range(4):
                    c = img[cy * 8 + y][cx * 4 + x]
                    best = min(choices, key=lambda ch: sum((PAL[c][i] - PAL[ch[0]][i]) ** 2 for i in range(3)))
                    byte |= best[1] << (6 - 2 * x)
                bitmap[cell * 8 + y] = byte
    return bytes([0x00, 0x60]) + bytes(bitmap) + bytes(screen) + bytes(color) + bytes([BG])


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'examples', 'gfx', 'picture.kla')
    data = to_koala(draw())
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(data)
    print('wrote', out, len(data), 'bytes')


if __name__ == '__main__':
    main()
