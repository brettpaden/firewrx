#!/usr/bin/env bash
#
# make_bundle.sh  -  Build a self-contained deploy bundle for the Raspberry Pi.
#
#     ./scripts/make_bundle.sh            # -> dist/firewrx-pi.tar.gz
#     ./scripts/make_bundle.sh --rebuild  # regenerate cues first
#
# The bundle contains everything the Pi needs to fire shows: prebuilt cues,
# the firing scripts, the tone-generation scripts, the installer, and a README.
# Deploy with:
#
#     scp dist/firewrx-pi.tar.gz pi@raspberrypi.local:~
#     ssh pi@raspberrypi.local
#     tar xzf firewrx-pi.tar.gz && cd firewrx-pi && ./install.sh
set -euo pipefail

SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPTS/.." && pwd)"
cd "$ROOT"

NAME="firewrx-pi"
STAGE="dist/$NAME"
TARBALL="dist/$NAME.tar.gz"

PY="${PYTHON:-.venv/bin/python}"
[ -x "$PY" ] || PY="python3"

if [ "${1:-}" = "--rebuild" ]; then
  echo "==> regenerating cues"
  "$PY" scripts/build_cues.py -f -q
fi

if [ ! -d cues ] || [ -z "$(ls -A cues 2>/dev/null)" ]; then
  echo "==> cues/ empty; generating"
  "$PY" scripts/build_cues.py -q
fi

echo "==> staging $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE"

# Scripts + tone generation + installer.
for f in cues.py cue_gen.py build_cues.py test_cues.py run_show.py \
         install.sh requirements.txt BUNDLE_README.md; do
  cp "scripts/$f" "$STAGE/$f"
done
mv "$STAGE/BUNDLE_README.md" "$STAGE/README.md"

# Prebuilt cue WAVs.
cp -R cues "$STAGE/cues"

chmod +x "$STAGE"/install.sh "$STAGE"/*.py

echo "==> creating $TARBALL"
tar -C dist -czf "$TARBALL" "$NAME"

CUE_COUNT="$(ls "$STAGE/cues" | wc -l | tr -d ' ')"
SIZE="$(du -h "$TARBALL" | cut -f1)"
echo "==> done: $TARBALL  ($SIZE, $CUE_COUNT cues)"
