#!/usr/bin/env bash
# Downloads the sources of ACME, Exomizer and sidreloc into one folder.
# Usage: scripts/fetch-sources.sh [OUTDIR]        (default: tool-src)
# Used by the GitHub Actions build; works on Linux and macOS.
set -u
OUT="${1:-tool-src}"
mkdir -p "$OUT"
cd "$OUT"

EXO_VERSION="${EXO_VERSION:-3.1.2}"
SIDRELOC_VERSION="${SIDRELOC_VERSION:-1.0}"

echo "== ACME (official SVN trunk on SourceForge)"
rm -rf acme
if command -v svn >/dev/null 2>&1; then
  svn export --quiet --force https://svn.code.sf.net/p/acme-crossass/code-0/trunk acme || true
fi
if [ ! -f acme/src/acme.c ]; then
  echo "   SVN not available - using the GitHub mirror of ACME 0.96.4"
  rm -rf acme
  git clone --depth 1 https://github.com/meonwax/acme.git acme
fi
grep -h 'define RELEASE' acme/src/version.h || true

echo "== Exomizer $EXO_VERSION"
rm -rf exomizer exo.zip
if curl -fsSL --retry 3 -o exo.zip "https://bitbucket.org/magli143/exomizer/wiki/downloads/exomizer-$EXO_VERSION.zip"; then
  mkdir -p exomizer && unzip -q exo.zip -d exomizer
fi
if [ -z "$(find exomizer -path '*/src/Makefile' 2>/dev/null | head -1)" ]; then
  echo "   zip not available - cloning the Exomizer repository"
  rm -rf exomizer
  git clone --depth 1 https://bitbucket.org/magli143/exomizer.git exomizer || {
    echo "   using the archived Exomizer 2 sources from GitHub"
    git clone --depth 1 https://github.com/bitshifters/exomizer.git exomizer-old && mv exomizer-old/exomizer2 exomizer && rm -rf exomizer-old
  }
fi
rm -f exo.zip

echo "== sidreloc $SIDRELOC_VERSION"
rm -rf sidreloc sidreloc.tgz
if curl -fsSL --retry 3 -o sidreloc.tgz "https://hd0.linusakesson.net/files/sidreloc-$SIDRELOC_VERSION.tgz"; then
  mkdir -p sidreloc && tar xzf sidreloc.tgz -C sidreloc --strip-components=1 && rm -f sidreloc.tgz
fi

echo "== done"
ls -la
