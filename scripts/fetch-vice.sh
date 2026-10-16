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

note() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::notice title=VICE::$*"; else echo "$*"; fi; }
warn() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::warning title=VICE::$*"; else echo "!! $*"; fi; }

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
    dl "$BASE/windows/$FILE/download" "$TMP/$FILE" || { warn "download of $FILE failed"; exit 1; }
    note "downloaded $FILE ($(wc -c < "$TMP/$FILE") bytes)"
    if command -v unzip >/dev/null 2>&1; then unzip -q "$TMP/$FILE" -d "$TMP/x";
    else powershell -NoProfile -Command "Expand-Archive -Path '$(cygpath -w "$TMP/$FILE" 2>/dev/null || echo "$TMP/$FILE")' -DestinationPath '$(cygpath -w "$TMP/x" 2>/dev/null || echo "$TMP/x")'"; fi
    SUB=$(ls "$TMP/x" | head -1)
    cp -R "$TMP/x/$SUB/." "$OUT/"
    ;;
  mac)
    FILE="vice-arm64-gtk3-$VICE_VERSION.dmg"
    dl "$BASE/macosx/$FILE/download" "$TMP/$FILE" || { warn "download of $FILE failed"; exit 1; }
    note "downloaded $FILE ($(wc -c < "$TMP/$FILE") bytes, $(file -b "$TMP/$FILE" | cut -c1-60))"
    MNT="$TMP/mnt"; mkdir -p "$MNT"
    yes | hdiutil attach "$TMP/$FILE" -nobrowse -readonly -mountpoint "$MNT" || warn "hdiutil attach failed"
    note "dmg contents: $(ls "$MNT" | tr '\n' ' ')"
    # copy with ditto (keeps symlinks, permissions and app bundles intact)
    for item in "$MNT"/*; do
      case "$(basename "$item")" in Applications) continue ;; esac
      ditto "$item" "$OUT/$(basename "$item")" || cp -R "$item" "$OUT/" || true
    done
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
X=$(find "$OUT" -maxdepth 8 \( -name 'x64sc' -o -name 'x64sc.exe' \) -print | head -3)
echo "$X"
if [ -z "$X" ]; then warn "x64sc not found in the package: $(find "$OUT" -maxdepth 4 | head -30 | tr '\n' ' ')"; exit 1; fi
note "x64sc: $X"
