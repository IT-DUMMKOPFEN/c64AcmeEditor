#!/usr/bin/env python3
"""Build the C64 ACME EDITOR apps for Windows, macOS (Apple Silicon) and Linux
on a Linux machine - without electron-builder, Wine or a Mac.

    python3 scripts/package/build.py --downloads DIR --tools DIR [--out dist-local] [win mac linux]

DIR (--downloads) must contain the official Electron release zips:
    electron-v<ELECTRON>-win32-x64.zip, electron-v<ELECTRON>-darwin-arm64.zip,
    electron-v<ELECTRON>-linux-x64.zip
DIR (--tools) contains the packaging helpers (all from GitHub releases):
    rcodesign                      (apple-platform-rs, ad-hoc signing for macOS)
    nsis/                          (electron-builder-binaries nsis-3.0.4.1, linux/makensis)
    appimagetool/                  (extracted appimagetool AppImage: AppRun ...)
    runtime-x86_64                 (AppImage type2 runtime)

The editor's own tools (ACME, Exomizer, sidreloc) come from prebuilt/<platform>.

Results in --out:
    C64-ACME-EDITOR-<v>-Windows-Setup.exe     NSIS installer (per user)
    C64-ACME-EDITOR-<v>-win-x64.zip           portable
    C64-ACME-EDITOR-<v>-macOS-AppleSilicon.zip  ad-hoc signed .app
    C64-ACME-EDITOR-<v>-linux-x86_64.AppImage
    C64-ACME-EDITOR-<v>-linux-amd64.deb
"""
import argparse
import json
import os
import plistlib
import re
import shutil
import stat
import subprocess
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
import winres  # noqa: E402

PKG = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))
PRODUCT = PKG['productName']                       # C64 ACME EDITOR
EXE_NAME = PKG['name']                             # c64-acme-editor (Linux)
VERSION = PKG['version']                           # 0.2.0-beta
SHORT = re.search(r"APP_VERSION = '([^']+)'", open(os.path.join(ROOT, 'src/main/main.js'), encoding='utf-8').read()).group(1)  # 0.2b
NUMERIC = re.match(r'(\d+)\.(\d+)\.(\d+)', VERSION).groups()
ELECTRON = PKG['devDependencies']['electron'].lstrip('^~')
APP_ID = PKG['build']['appId']
AUTHOR = PKG['author']
DESCRIPTION = PKG['description']
ICON_PNG = os.path.join(ROOT, 'build', 'icon.png')
FILE_EXTS = PKG['build']['fileAssociations'][0]['ext']


def log(*a):
    print('  •', *a, flush=True)


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def rmtree(p):
    if os.path.lexists(p):
        shutil.rmtree(p) if os.path.isdir(p) and not os.path.islink(p) else os.remove(p)


def unzip(zip_path, dest):
    """unzip that keeps symlinks and permissions (needed for the macOS bundle)"""
    rmtree(dest)
    os.makedirs(dest)
    run(['unzip', '-q', zip_path, '-d', dest])


# ------------------------------------------------------------------ app content
def stage_app(dest):
    """the Electron app itself: resources/app (no asar needed)"""
    os.makedirs(dest)
    pkg = {k: PKG[k] for k in ('name', 'productName', 'version', 'description', 'author', 'license', 'homepage', 'main')}
    with open(os.path.join(dest, 'package.json'), 'w', encoding='utf-8') as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
    shutil.copytree(os.path.join(ROOT, 'src'), os.path.join(dest, 'src'), ignore=shutil.ignore_patterns('*.map'))
    os.makedirs(os.path.join(dest, 'build'))
    shutil.copy2(ICON_PNG, os.path.join(dest, 'build', 'icon.png'))


def stage_resources(resdir, platform):
    """extraResources of package.json: examples, tools, licenses"""
    rmtree(os.path.join(resdir, 'default_app.asar'))
    stage_app(os.path.join(resdir, 'app'))
    shutil.copytree(os.path.join(ROOT, 'examples'), os.path.join(resdir, 'examples'))
    tools = os.path.join(resdir, 'tools')
    shutil.copytree(os.path.join(ROOT, 'prebuilt', platform), tools)
    for f in os.listdir(tools):
        p = os.path.join(tools, f)
        if os.path.isfile(p) and platform != 'win-x64':
            os.chmod(p, 0o755)
    shutil.copy2(os.path.join(ROOT, 'LICENSE'), os.path.join(resdir, 'LICENSE.txt'))
    shutil.copy2(os.path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), os.path.join(resdir, 'THIRD_PARTY_NOTICES.md'))


def zip_dir(src_dir, out, root_name=None, symlinks=False):
    """zip a folder; with root_name the content is placed in that folder"""
    rmtree(out)
    if symlinks:
        # Info-ZIP keeps symlinks (-y) - required for macOS frameworks
        cwd = os.path.dirname(src_dir)
        run(['zip', '-q', '-r', '-y', '-X', '-9', out, os.path.basename(src_dir)], cwd=cwd)
        return
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, files in os.walk(src_dir):
            dirs.sort()
            for f in sorted(files):
                p = os.path.join(base, f)
                rel = os.path.relpath(p, src_dir)
                if root_name:
                    rel = os.path.join(root_name, rel)
                z.write(p, rel)


# ---------------------------------------------------------------------- Windows
def build_win(a):
    log('Windows x64')
    work = os.path.join(a.out, 'win-unpacked')
    unzip(os.path.join(a.downloads, f'electron-v{ELECTRON}-win32-x64.zip'), work)
    exe = os.path.join(work, PRODUCT + '.exe')
    os.rename(os.path.join(work, 'electron.exe'), exe)
    info = winres.patch_exe(exe, ICON_PNG, {
        'CompanyName': AUTHOR, 'FileDescription': PRODUCT, 'FileVersion': '.'.join(NUMERIC),
        'InternalName': PRODUCT, 'LegalCopyright': f'Copyright (C) 2026 {AUTHOR}',
        'OriginalFilename': PRODUCT + '.exe', 'ProductName': PRODUCT, 'ProductVersion': SHORT}, '.'.join(NUMERIC))
    log('exe patched:', info)
    stage_resources(os.path.join(work, 'resources'), 'win-x64')

    zip_out = os.path.join(a.out, f'C64-ACME-EDITOR-{SHORT}-win-x64.zip')
    zip_dir(work, zip_out, root_name=PRODUCT)
    log('portable zip:', os.path.basename(zip_out))

    # installer
    from PIL import Image
    ico = os.path.join(a.out, 'icon.ico')
    Image.open(ICON_PNG).convert('RGBA').save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    nsis = os.path.join(a.tools, 'nsis')
    makensis = os.path.join(nsis, 'linux', 'makensis')
    os.chmod(makensis, 0o755)
    setup = os.path.join(a.out, f'C64-ACME-EDITOR-{SHORT}-Windows-Setup.exe')
    env = dict(os.environ, NSISDIR=nsis)
    run([makensis, '-V2', '-INPUTCHARSET', 'UTF8',
         f'-DSRCDIR={work}', f'-DOUTFILE={setup}', f'-DICON={ico}',
         f'-DVERSION={SHORT}', f'-DVERSION4={".".join(NUMERIC)}.0',
         os.path.join(ROOT, 'scripts', 'package', 'installer.nsi')], env=env)
    log('installer:', os.path.basename(setup))


# ------------------------------------------------------------------------ macOS
def build_mac(a):
    log('macOS arm64')
    work = os.path.join(a.out, 'mac-arm64')
    unzip(os.path.join(a.downloads, f'electron-v{ELECTRON}-darwin-arm64.zip'), work)
    app = os.path.join(work, PRODUCT + '.app')
    os.rename(os.path.join(work, 'Electron.app'), app)
    contents = os.path.join(app, 'Contents')

    # main executable + Info.plist
    os.rename(os.path.join(contents, 'MacOS', 'Electron'), os.path.join(contents, 'MacOS', PRODUCT))
    plist_path = os.path.join(contents, 'Info.plist')
    with open(plist_path, 'rb') as f:
        pl = plistlib.load(f)
    pl.update({
        'CFBundleDisplayName': PRODUCT, 'CFBundleName': PRODUCT, 'CFBundleExecutable': PRODUCT,
        'CFBundleIdentifier': APP_ID, 'CFBundleIconFile': 'icon.icns',
        'CFBundleShortVersionString': VERSION, 'CFBundleVersion': VERSION,
        'LSApplicationCategoryType': 'public.app-category.developer-tools',
        'NSHumanReadableCopyright': f'Copyright © 2026 {AUTHOR}',
        'CFBundleDocumentTypes': [{'CFBundleTypeExtensions': FILE_EXTS, 'CFBundleTypeIconFile': 'icon.icns',
                                   'CFBundleTypeName': 'ACME source', 'CFBundleTypeRole': 'Editor'}],
    })
    pl.pop('ElectronAsarIntegrity', None)
    with open(plist_path, 'wb') as f:
        plistlib.dump(pl, f)

    # helper apps: "Electron Helper (GPU).app" -> "C64 ACME EDITOR Helper (GPU).app"
    fw = os.path.join(contents, 'Frameworks')
    for d in sorted(os.listdir(fw)):
        m = re.match(r'^Electron Helper(.*)\.app$', d)
        if not m:
            continue
        suffix = m.group(1)                                   # '', ' (GPU)', ...
        new = os.path.join(fw, f'{PRODUCT} Helper{suffix}.app')
        os.rename(os.path.join(fw, d), new)
        macos = os.path.join(new, 'Contents', 'MacOS')
        old_exe = os.listdir(macos)[0]
        os.rename(os.path.join(macos, old_exe), os.path.join(macos, f'{PRODUCT} Helper{suffix}'))
        hp = os.path.join(new, 'Contents', 'Info.plist')
        with open(hp, 'rb') as f:
            h = plistlib.load(f)
        kind = suffix.strip(' ()')
        h.update({'CFBundleExecutable': f'{PRODUCT} Helper{suffix}', 'CFBundleDisplayName': f'{PRODUCT} Helper{suffix}',
                  'CFBundleIdentifier': f'{APP_ID}.helper' + (f'.{kind}' if kind else ''), 'CFBundleVersion': VERSION})
        with open(hp, 'wb') as f:
            plistlib.dump(h, f)

    # icon
    from PIL import Image
    res = os.path.join(contents, 'Resources')
    rmtree(os.path.join(res, 'electron.icns'))
    Image.open(ICON_PNG).convert('RGBA').save(os.path.join(res, 'icon.icns'))
    stage_resources(res, 'mac-arm64')

    # ad-hoc signature (Apple Silicon only runs signed code)
    rcodesign = os.path.join(a.tools, 'rcodesign')
    run([rcodesign, 'sign', app], stdout=subprocess.DEVNULL)
    # check: main program and helpers carry an ad-hoc signature
    for exe in [os.path.join(contents, 'MacOS', PRODUCT)] + [
            os.path.join(fw, d, 'Contents', 'MacOS', d[:-4]) for d in os.listdir(fw) if d.endswith('.app')]:
        info = subprocess.run([rcodesign, 'print-signature-info', exe], capture_output=True, text=True).stdout
        if 'ADHOC' not in info:
            raise SystemExit('not signed: ' + exe)
    log('signed (ad-hoc)')

    out = os.path.join(a.out, f'C64-ACME-EDITOR-{SHORT}-macOS-AppleSilicon.zip')
    zip_dir(app, os.path.abspath(out), symlinks=True)
    log('zip:', os.path.basename(out))


# ------------------------------------------------------------------------ Linux
DESKTOP = f"""[Desktop Entry]
Name={PRODUCT}
Exec={{exec}} %U
Terminal=false
Type=Application
Icon={EXE_NAME}
StartupWMClass={PRODUCT}
Comment={DESCRIPTION}
Categories=Development;
MimeType=text/x-asm;
"""

APPRUN = f"""#!/bin/sh
# AppImage start script. Ubuntu 24.04+ blocks the user namespaces that the
# Chromium sandbox needs inside an AppImage - then start without it.
HERE="$(dirname "$(readlink -f "$0")")"
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ]; then
  set -- --no-sandbox "$@"
fi
exec "$HERE/{EXE_NAME}" "$@"
"""


def linux_tree(a):
    work = os.path.join(a.out, 'linux-unpacked')
    unzip(os.path.join(a.downloads, f'electron-v{ELECTRON}-linux-x64.zip'), work)
    os.rename(os.path.join(work, 'electron'), os.path.join(work, EXE_NAME))
    stage_resources(os.path.join(work, 'resources'), 'linux-x64')
    shutil.copy2(os.path.join(ROOT, 'build', 'linux', 'apparmor-profile'), os.path.join(work, 'resources', 'apparmor-profile'))
    return work


def build_linux(a):
    log('Linux x64')
    from PIL import Image
    work = linux_tree(a)
    icon = Image.open(ICON_PNG).convert('RGBA')

    # ---- .deb
    deb = os.path.join(a.out, 'deb-root')
    rmtree(deb)
    opt = os.path.join(deb, 'opt', PRODUCT)
    shutil.copytree(work, opt, symlinks=True)
    apps = os.path.join(deb, 'usr', 'share', 'applications')
    os.makedirs(apps)
    with open(os.path.join(apps, EXE_NAME + '.desktop'), 'w', encoding='utf-8') as f:
        f.write(DESKTOP.replace('{exec}', f'"/opt/{PRODUCT}/{EXE_NAME}"'))
    for px in (16, 32, 48, 64, 128, 256, 512):
        d = os.path.join(deb, 'usr', 'share', 'icons', 'hicolor', f'{px}x{px}', 'apps')
        os.makedirs(d)
        icon.resize((px, px), Image.LANCZOS).save(os.path.join(d, EXE_NAME + '.png'))
    ctl = os.path.join(deb, 'DEBIAN')
    os.makedirs(ctl)
    size_kb = sum(os.path.getsize(os.path.join(b, f)) for b, _, fs in os.walk(deb) for f in fs) // 1024
    with open(os.path.join(ctl, 'control'), 'w', encoding='utf-8') as f:
        f.write(f"""Package: {EXE_NAME}
Version: {VERSION.replace('-', '~')}
Architecture: amd64
Maintainer: {PKG['build']['linux']['maintainer']}
Installed-Size: {size_kb}
Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0 | libatspi2.0-0t64, libuuid1, libsecret-1-0
Recommends: vice
Section: devel
Priority: optional
Homepage: {PKG['homepage']}
Description: {PKG['build']['linux']['synopsis']}
 {DESCRIPTION}
""")
    for s in ('postinst', 'postrm'):
        shutil.copy2(os.path.join(ROOT, 'build', 'linux', s), os.path.join(ctl, s))
        os.chmod(os.path.join(ctl, s), 0o755)
    for b, ds, fs in os.walk(deb):
        for x in ds:
            os.chmod(os.path.join(b, x), 0o755)
    deb_out = os.path.join(a.out, f'C64-ACME-EDITOR-{SHORT}-linux-amd64.deb')
    run(['dpkg-deb', '--root-owner-group', '-Zxz', '--build', deb, deb_out], stdout=subprocess.DEVNULL)
    log('deb:', os.path.basename(deb_out))

    # ---- AppImage
    appdir = os.path.join(a.out, 'AppDir')
    rmtree(appdir)
    shutil.copytree(work, appdir, symlinks=True)
    with open(os.path.join(appdir, 'AppRun'), 'w') as f:
        f.write(APPRUN)
    os.chmod(os.path.join(appdir, 'AppRun'), 0o755)
    with open(os.path.join(appdir, EXE_NAME + '.desktop'), 'w', encoding='utf-8') as f:
        f.write(DESKTOP.replace('{exec}', 'AppRun'))
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(appdir, EXE_NAME + '.png'))
    shutil.copy2(os.path.join(appdir, EXE_NAME + '.png'), os.path.join(appdir, '.DirIcon'))
    img_out = os.path.join(a.out, f'C64-ACME-EDITOR-{SHORT}-linux-x86_64.AppImage')
    rmtree(img_out)
    env = dict(os.environ, ARCH='x86_64')
    run([os.path.join(a.tools, 'appimagetool', 'AppRun'), '--no-appstream',
         '--runtime-file', os.path.join(a.tools, 'runtime-x86_64'), appdir, img_out],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.chmod(img_out, 0o755)
    log('AppImage:', os.path.basename(img_out))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--downloads', required=True)
    ap.add_argument('--tools', required=True)
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist-local'))
    ap.add_argument('targets', nargs='*', default=['win', 'mac', 'linux'])
    a = ap.parse_args()
    a.out = os.path.abspath(a.out)
    os.makedirs(a.out, exist_ok=True)
    print(f'{PRODUCT} {SHORT} ({VERSION}), Electron {ELECTRON}')
    for t in a.targets:
        {'win': build_win, 'mac': build_mac, 'linux': build_linux}[t](a)


if __name__ == '__main__':
    main()
