"""Patch the icon and the version information of a Windows .exe in place.

Used by scripts/package/build.py to turn electron.exe into
"C64 ACME EDITOR.exe" without Wine/rcedit:

  * the images of the first RT_GROUP_ICON are replaced by PNG images of our
    icon (PNG frames are much smaller than the original bitmaps, so they fit
    into the existing resource data - the file layout does not change)
  * the VS_VERSIONINFO resource is rebuilt with our names and written into
    the space of the original one (it must not be larger)
  * an Authenticode signature (if any) is removed, it would be invalid anyway

Only the Python standard library and Pillow are needed.
"""
import io
import struct

RT_ICON, RT_GROUP_ICON, RT_VERSION = 3, 14, 16


class PE:
    def __init__(self, data):
        self.d = bytearray(data)
        d = self.d
        if d[:2] != b'MZ':
            raise ValueError('not an MZ file')
        self.pe = struct.unpack_from('<I', d, 0x3c)[0]
        if d[self.pe:self.pe + 4] != b'PE\0\0':
            raise ValueError('not a PE file')
        coff = self.pe + 4
        self.nsec = struct.unpack_from('<H', d, coff + 2)[0]
        opt_size = struct.unpack_from('<H', d, coff + 16)[0]
        self.opt = coff + 20
        magic = struct.unpack_from('<H', d, self.opt)[0]
        self.dd = self.opt + (112 if magic == 0x20b else 96)   # data directories
        self.sec = self.opt + opt_size
        self.sections = []
        for i in range(self.nsec):
            o = self.sec + i * 40
            vsize, va, rawsize, rawptr = struct.unpack_from('<IIII', d, o + 8)
            self.sections.append((va, max(vsize, rawsize), rawptr))

    def dir(self, i):
        return struct.unpack_from('<II', self.d, self.dd + i * 8)

    def off(self, rva):
        for va, size, raw in self.sections:
            if va <= rva < va + size:
                return rva - va + raw
        raise ValueError('rva %x not in a section' % rva)

    # ---- resource tree -----------------------------------------------------------
    def resources(self):
        """returns {type: {name/id: [(lang, data_entry_file_offset)]}}"""
        rva, size = self.dir(2)
        base = self.off(rva)
        d = self.d

        def entries(o):
            named, ids = struct.unpack_from('<HH', d, o + 12)
            for i in range(named + ids):
                name, target = struct.unpack_from('<II', d, o + 16 + i * 8)
                yield name, target

        out = {}
        for t, t1 in entries(base):
            if not (t1 & 0x80000000):
                continue
            out[t] = {}
            for n, t2 in entries(base + (t1 & 0x7fffffff)):
                if not (t2 & 0x80000000):
                    continue
                out[t][n] = []
                for lang, t3 in entries(base + (t2 & 0x7fffffff)):
                    out[t][n].append((lang, base + (t3 & 0x7fffffff)))
        return out

    def entry(self, deo):
        rva, size = struct.unpack_from('<II', self.d, deo)
        return self.off(rva), size

    def set_entry_size(self, deo, size):
        struct.pack_into('<I', self.d, deo + 4, size)

    def strip_signature(self):
        off, size = self.dir(4)        # security directory: file offset, not RVA
        if off and size:
            if off + size >= len(self.d) - 8:
                del self.d[off:]
            struct.pack_into('<II', self.d, self.dd + 4 * 8, 0, 0)
            return True
        return False


def _png(img, size, limit):
    """PNG of the icon in the given size; if it is larger than the slot, use
    fewer colours (palette PNG with alpha) until it fits"""
    from PIL import Image
    im = img.resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    data = b.getvalue()
    for colors in (256, 128, 64, 32):
        if len(data) <= limit:
            break
        q = im.quantize(colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        b = io.BytesIO()
        q.save(b, 'PNG', optimize=True)
        data = b.getvalue()
    return data


def replace_icon(pe, png_path):
    from PIL import Image
    src = Image.open(png_path).convert('RGBA')
    res = pe.resources()
    groups = res.get(RT_GROUP_ICON)
    icons = res.get(RT_ICON, {})
    if not groups:
        raise ValueError('no icon group in the exe')
    gname = sorted(groups)[0]
    gdeo = groups[gname][0][1]
    goff, gsize = pe.entry(gdeo)
    d = pe.d
    count = struct.unpack_from('<H', d, goff + 4)[0]
    # all icon slots that belong to the group, largest first
    slots = []
    for i in range(count):
        e = goff + 6 + i * 14
        w, h = d[e], d[e + 1]
        nid = struct.unpack_from('<H', d, e + 12)[0]
        deo = icons[nid][0][1]
        off, size = pe.entry(deo)
        slots.append({'e': e, 'w': w or 256, 'nid': nid, 'deo': deo, 'off': off, 'cap': size})
    for s in slots:
        px = s['w']
        data = _png(src, px, s['cap'])
        if len(data) > s['cap']:
            raise ValueError('icon %dpx: %d bytes do not fit into %d' % (px, len(data), s['cap']))
        d[s['off']:s['off'] + len(data)] = data
        d[s['off'] + len(data):s['off'] + s['cap']] = bytes(s['cap'] - len(data))
        pe.set_entry_size(s['deo'], len(data))
        e = s['e']
        d[e] = px if px < 256 else 0
        d[e + 1] = px if px < 256 else 0
        d[e + 2] = 0
        d[e + 3] = 0
        struct.pack_into('<HHI', d, e + 4, 1, 32, len(data))
    return [s['w'] for s in slots]


# ---- VS_VERSIONINFO -------------------------------------------------------------
def _block(key, value=b'', vtype=1, children=b'', value_len=None):
    k = (key + '\0').encode('utf-16-le')
    head = 6 + len(k)
    pad1 = (4 - head % 4) % 4
    body = k + bytes(pad1) + value
    pad2 = (4 - (6 + len(body)) % 4) % 4 if children else 0
    body += bytes(pad2) + children
    total = 6 + len(body)
    if value_len is None:
        value_len = len(value) // 2 if vtype == 1 else len(value)
    blk = struct.pack('<HHH', total, value_len, vtype) + body
    return blk + bytes((4 - len(blk) % 4) % 4)


def _string(key, val):
    v = (val + '\0').encode('utf-16-le')
    return _block(key, v, 1)


def build_version(strings, version):
    parts = [int(x) for x in (version.split('-')[0].split('.') + ['0', '0', '0', '0'])[:4]]
    ms = (parts[0] << 16) | parts[1]
    ls = (parts[2] << 16) | parts[3]
    ffi = struct.pack('<13I', 0xFEEF04BD, 0x00010000, ms, ls, ms, ls, 0x3f, 0, 0x40004, 1, 0, 0, 0)
    st = b''.join(_string(k, v) for k, v in strings.items())
    table = _block('040904b0', b'', 1, st, 0)
    sfi = _block('StringFileInfo', b'', 1, table, 0)
    var = _block('Translation', struct.pack('<HH', 0x0409, 0x04b0), 0)
    vfi = _block('VarFileInfo', b'', 1, var, 0)
    return _block('VS_VERSION_INFO', ffi, 0, sfi + vfi)


def replace_version(pe, strings, version):
    res = pe.resources()
    v = res.get(RT_VERSION)
    if not v:
        return False
    deo = v[sorted(v)[0]][0][1]
    off, size = pe.entry(deo)
    data = build_version(strings, version)
    if len(data) > size:
        raise ValueError('version info too large (%d > %d)' % (len(data), size))
    pe.d[off:off + size] = data + bytes(size - len(data))
    pe.set_entry_size(deo, len(data))
    return True


def patch_exe(path, icon_png, strings, version):
    with open(path, 'rb') as f:
        pe = PE(f.read())
    sizes = replace_icon(pe, icon_png)
    ver = replace_version(pe, strings, version)
    signed = pe.strip_signature()
    with open(path, 'wb') as f:
        f.write(pe.d)
    return {'icon_sizes': sizes, 'version': ver, 'signature_removed': signed}


if __name__ == '__main__':
    import sys, json
    print(json.dumps(patch_exe(sys.argv[1], sys.argv[2], {
        'CompanyName': 'IT-Dummköpfe', 'FileDescription': 'C64 ACME EDITOR', 'FileVersion': '0.2.0',
        'InternalName': 'C64 ACME EDITOR', 'LegalCopyright': 'Copyright (C) 2026 IT-Dummköpfe',
        'OriginalFilename': 'C64 ACME EDITOR.exe', 'ProductName': 'C64 ACME EDITOR', 'ProductVersion': '0.2.0'}, '0.2.0')))
