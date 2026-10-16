#!/usr/bin/env bash
# Builds ACME, Exomizer and sidreloc from the sources fetched by
# fetch-sources.sh and copies the programs to vendor/tools.
# Usage: scripts/build-tools.sh <win|mac|linux> [SRCDIR] [OUTDIR]
# On Windows run it in an MSYS2 MINGW64 shell.
set -u
TARGET="${1:?target win|mac|linux}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "${2:-tool-src}" && pwd)"
OUT="${3:-vendor/tools}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
EXT=""
LDSTATIC=""
if [ "$TARGET" = "win" ]; then EXT=".exe"; LDSTATIC="-static"; fi
CC="${CC:-gcc}"
if [ "$TARGET" = "mac" ]; then CC="${CC:-clang}"; fi
STATUS=0
LOG="$(mktemp 2>/dev/null || echo /tmp/buildtools.log)"
fail() { # name
  local msg; msg=$( (grep -i -m6 -B1 'error' "$LOG"; echo ' ... '; tail -c 300 "$LOG") 2>/dev/null | tr '\r\n' '  ' | cut -c1-1500)
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::warning title=$1 build failed ($TARGET)::$msg"; fi
  echo "!! $1 build failed"; echo "$msg"; STATUS=1
}

echo "== ACME"
if [ -d "$SRC/acme/src" ]; then
  (
    cd "$SRC/acme/src"
    OBJS=$(sed -n 's/^OBJS[[:space:]]*=[[:space:]]*//p' Makefile | head -1)
    FILES=""
    for o in $OBJS; do FILES="$FILES ${o%.o}.c"; done
    echo "   $CC -O2 -o acme$EXT $FILES -lm"
    $CC -O2 -w $LDSTATIC -o "$OUT/acme$EXT" $FILES -lm >"$LOG" 2>&1
  ) || fail ACME
else
  echo "!! ACME sources missing"; STATUS=1
fi

echo "== Exomizer"
EXOMK=$(find "$SRC/exomizer" -path '*/src/Makefile' 2>/dev/null | head -1)
EXOSRC=""
[ -n "$EXOMK" ] && EXOSRC=$(dirname "$EXOMK")
if [ -n "$EXOSRC" ] && [ -d "$EXOSRC" ]; then
  (
    cd "$EXOSRC"
    make clean >/dev/null 2>&1 || true
    : > "$LOG"
    # -std=gnu99: newer compilers default to C23, where "bool" is a keyword
    make CC="$CC" CFLAGS="-O2 -w -fcommon -std=gnu99" LDFLAGS="-s $LDSTATIC" exomizer >>"$LOG" 2>&1 || \
    make CC="$CC" CFLAGS="-O2 -w -fcommon -std=gnu99" LDFLAGS="$LDSTATIC" >>"$LOG" 2>&1 || \
    make CC="$CC" CFLAGS="-O2 -w -fcommon" LDFLAGS="$LDSTATIC" exomizer >>"$LOG" 2>&1
    ls >>"$LOG" 2>&1
    if [ -f "exomizer$EXT" ]; then cp "exomizer$EXT" "$OUT/"; elif [ -f exomizer ]; then cp exomizer "$OUT/exomizer$EXT"; else exit 1; fi
  ) || {
    PRE=$(find "$SRC/exomizer" -iname 'exomizer.exe' -path '*win32*' | head -1)
    if [ "$TARGET" = "win" ] && [ -n "$PRE" ]; then echo "   using the prebuilt win32 exomizer.exe"; cp "$PRE" "$OUT/exomizer.exe";
    else fail Exomizer; fi
  }
else
  echo "!! Exomizer sources missing"; STATUS=1
fi

echo "== sidreloc"
if [ -d "$SRC/sidreloc" ]; then
  (
    cd "$SRC/sidreloc"
    make clean >/dev/null 2>&1 || true
    : > "$LOG"
    SHIM=""
    if [ "$TARGET" = "win" ]; then SHIM="-I$SCRIPT_DIR/win-shim"; fi
    if [ -n "$SHIM" ]; then
      $CC -std=gnu99 -O2 -w -DNDEBUG $SHIM $LDSTATIC -o sidreloc$EXT *.c -lm >>"$LOG" 2>&1
    else
      make CC="$CC" >>"$LOG" 2>&1 || $CC -std=gnu99 -O2 -w -DNDEBUG -o sidreloc$EXT *.c -lm >>"$LOG" 2>&1
    fi
    ls >>"$LOG" 2>&1
    if [ -f "sidreloc$EXT" ]; then cp "sidreloc$EXT" "$OUT/"; elif [ -f sidreloc ]; then cp sidreloc "$OUT/sidreloc$EXT"; else exit 1; fi
  ) || fail sidreloc
else
  echo "!! sidreloc sources missing"; STATUS=1
fi

# licenses of the bundled tools
mkdir -p "$OUT/licenses"
[ -f "$SRC/acme/docs/COPYING" ] && cp "$SRC/acme/docs/COPYING" "$OUT/licenses/ACME-COPYING.txt"
for f in $(find "$SRC/exomizer" -maxdepth 2 -iname 'exo*.txt' 2>/dev/null | head -3); do cp "$f" "$OUT/licenses/"; done
for f in $(find "$SRC/sidreloc" -maxdepth 1 -iname 'LICENSE*' -o -maxdepth 1 -iname 'README*' 2>/dev/null); do cp "$f" "$OUT/licenses/sidreloc-$(basename "$f").txt"; done

chmod +x "$OUT"/acme* "$OUT"/exomizer* "$OUT"/sidreloc* 2>/dev/null || true
echo "== result"
ls -la "$OUT"
"$OUT/acme$EXT" -V 2>&1 | head -3 || true
exit $STATUS
