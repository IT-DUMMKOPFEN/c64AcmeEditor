#!/usr/bin/env bash
# Downloads the official VICE binaries into vendor/tools/vice.
# Usage: scripts/fetch-vice.sh <win|mac|linux> [OUTDIR]
#   win:   GTK3 VICE for Windows (64 bit) from SourceForge
#   mac:   GTK3 VICE for Apple Silicon (arm64) from SourceForge
#   linux: no official binary exists - the editor uses the VICE of the
#          system (e.g. "sudo apt install vice" or the Flatpak net.sf.VICE)
set -u
TARGET="${1:?target win|mac|linux}"
OUT="${2:-vendor/tools}/vice"
VICE_VERSION="${VICE_VERSION:-3.10}"
BASE="https://sourceforge.net/projects/vice-emu/files/releases/binaries"
mkdir -p "$OUT"
TMP="$(mktemp -d 2>/dev/null || echo /tmp/vicedl)"
mkdir -p "$TMP"

dl() { # url file
  for i in 1 2 3 4; do
    curl -fL --retry 3 --connect-timeout 30 -A "Mozilla/5.0" -o "$2" "$1" && [ -s "$2" ] && return 0
    echo "   download failed, retry $i"; sleep 5
  done
  return 1
}

case "$TARGET" in
  win)
    FILE="GTK3VICE-$VICE_VERSION-win64.zip"
    dl "$BASE/windows/$FILE/download" "$TMP/$FILE" || { echo "!! VICE download failed"; exit 1; }
    if command -v unzip >/dev/null 2>&1; then unzip -q "$TMP/$FILE" -d "$TMP/x";
    else powershell -NoProfile -Command "Expand-Archive -Path '$(cygpath -w "$TMP/$FILE" 2>/dev/null || echo "$TMP/$FILE")' -DestinationPath '$(cygpath -w "$TMP/x" 2>/dev/null || echo "$TMP/x")'"; fi
    SUB=$(ls "$TMP/x" | head -1)
    cp -R "$TMP/x/$SUB/." "$OUT/"
    ;;
  mac)
    FILE="vice-arm64-gtk3-$VICE_VERSION.dmg"
    dl "$BASE/macosx/$FILE/download" "$TMP/$FILE" || { echo "!! VICE download failed"; exit 1; }
    MNT="$TMP/mnt"; mkdir -p "$MNT"
    yes | hdiutil attach "$TMP/$FILE" -nobrowse -readonly -mountpoint "$MNT" >/dev/null
    cp -R "$MNT/." "$OUT/" || true
    hdiutil detach "$MNT" >/dev/null || true
    ;;
  linux)
    echo "No official VICE binary for Linux - the editor uses the system VICE (x64sc)."
    rmdir "$OUT" 2>/dev/null || true
    exit 0
    ;;
esac
rm -rf "$TMP"
echo "== VICE files:"
find "$OUT" -maxdepth 6 \( -name 'x64sc' -o -name 'x64sc.exe' \) -print
[ -n "$(find "$OUT" -maxdepth 6 \( -name 'x64sc' -o -name 'x64sc.exe' \) -print | head -1)" ] || { echo "!! x64sc not found in the package"; exit 1; }
