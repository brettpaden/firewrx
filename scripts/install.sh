#!/usr/bin/env bash
#
# install.sh  -  Set up firewrx cue-firing dependencies on a Raspberry Pi.
#
# Run once after copying/unpacking the bundle:
#
#     ./install.sh
#
# Installs:
#   * Python 3 + numpy/scipy (only needed if you regenerate cues on the Pi;
#     the bundle already ships prebuilt cues, so firing works without them).
#   * A local Python venv at ./.venv with the same packages, so the exact
#     interpreter used to build cues is reproducible.
#
# It does NOT install rpitx/sendiq - that lives outside this project.  The
# scripts call `sudo sendiq`, so make sure sendiq is on PATH (or point the
# SENDIQ env var at its full path, e.g. `export SENDIQ=/opt/rpitx/sendiq`).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "==> firewrx install (dir: $HERE)"

if command -v apt-get >/dev/null 2>&1; then
  echo "==> installing system packages (python3, venv, pip)"
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-venv python3-pip
else
  echo "!! apt-get not found; skipping system package install"
fi

echo "==> creating Python venv at ./.venv"
python3 -m venv .venv
# shellcheck disable=SC1091
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

echo "==> checking for sendiq"
if command -v sendiq >/dev/null 2>&1; then
  echo "   found: $(command -v sendiq)"
else
  echo "!! sendiq not on PATH. Install rpitx or set SENDIQ=/path/to/sendiq"
fi

cat <<'EOF'

==> done.

Quick start (from this directory).  Transmitting drives GPIO, so run the
whole script as root with sudo - each cue then fires as bare `sendiq` with
no per-fire sudo cost, which is what keeps a fire under the 200 ms slot:

  # fire a single cue on the bench:
  sudo ./.venv/bin/python test_cues.py 1:1:1

  # fire everything back-to-back and print real per-fire timing:
  sudo ./.venv/bin/python test_cues.py --all

  # run an exported show:
  sudo ./.venv/bin/python run_show.py show.json

  # rehearse timing without keying the radio (no root needed):
  ./.venv/bin/python run_show.py show.json --dry-run

  # regenerate cues (only if you changed cue_gen.py):
  ./.venv/bin/python build_cues.py -f
EOF
