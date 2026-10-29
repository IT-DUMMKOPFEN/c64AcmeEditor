#!/usr/bin/env python3
"""Build snippets/index.json from the header comments of the snippet files.

    python3 scripts/make_snippet_index.py

Every snippet starts with a header like
    ;  SNIPPET: Title
    ;  Category: Text                        Type: routine (insert into your code)
    ;------------------------------------------------------------------------------
    ;  First paragraph = short description ...
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIR = os.path.join(ROOT, 'snippets')

CATEGORIES = ['Templates', 'Basics', 'Interrupts', 'Input', 'Text', 'Graphics', 'Sprites', 'Sound', 'Effects', 'Maths & Tools', 'Disk']
FOLDERS = ['templates', 'basics', 'interrupts', 'input', 'text', 'graphics', 'sprites', 'sound', 'effects', 'maths', 'disk']

# templates that are complete example programs (opened like examples)
EXAMPLE_TEMPLATES = [
    {'id': 'intro_template', 'title': 'Intro: Koala picture + SID music + sprite scroller in the open border',
     'category': 'Templates', 'kind': 'example', 'file': '21_intro_template.asm',
     'description': 'A complete intro to start your own: BASIC start line, Koala picture, SID music and a sprite scroller with the normal C64 font in the opened lower border. Replace picture, tune and text.'},
]


def parse(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    title = category = kind = None
    desc = []
    in_desc = False
    for ln in lines[:40]:
        m = re.match(r';\s+SNIPPET:\s*(.+)', ln)
        if m:
            title = m.group(1).strip()
            continue
        m = re.match(r';\s+Category:\s*(.+?)\s{2,}Type:\s*(\w+)', ln)
        if m:
            category, kind = m.group(1).strip(), m.group(2)
            continue
        if ln.startswith(';---') and title and not in_desc:
            in_desc = True
            continue
        if in_desc:
            t = ln.lstrip(';').strip()
            if not t:
                if desc:
                    break
                continue
            desc.append(t)
    if not (title and category and kind):
        raise SystemExit('bad header: ' + path)
    return title, category, kind, ' '.join(desc)


def main():
    out = list(EXAMPLE_TEMPLATES)
    for folder, cat in zip(FOLDERS, CATEGORIES):
        d = os.path.join(DIR, folder)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.asm'):
                continue
            title, category, kind, desc = parse(os.path.join(d, f))
            if category != cat:
                raise SystemExit(f'{folder}/{f}: category {category!r} should be {cat!r}')
            out.append({'id': f[:-4], 'title': title, 'category': category, 'kind': kind,
                        'file': f'{folder}/{f}', 'description': desc})
    data = {'categories': CATEGORIES, 'snippets': out}
    with open(os.path.join(DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(len(out), 'snippets')


if __name__ == '__main__':
    main()
