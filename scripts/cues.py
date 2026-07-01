#!/usr/bin/env python3
"""
cues.py  -  Single source of truth for the firewrx cue layout, file naming,
and RF transmission.  build_cues.py, test_cues.py and run_show.py all import
from here so the naming scheme can never drift between generation and firing.

System layout
-------------
    device 1 -> areas 1-4,  each area has 12 cues
    device 2 -> areas 1-10, each area has 12 cues

File naming (human friendly, zero-padded so they sort naturally)
----------------------------------------------------------------
    device1_area01_cue01.wav
    device2_area10_cue12.wav
"""
import os
import subprocess
import sys
import time
from pathlib import Path

# ---- System layout ----------------------------------------------------------
# device -> areas.  Keep areas as an inclusive (start, end) pair for clarity.
LAYOUT = {
    1: (1, 4),    # device 1: areas 1-4
    2: (1, 10),   # device 2: areas 1-10
}
CUES_PER_AREA = 12
FIRST_CUE = 1     # cues are 1-based and human friendly (1..12)

# ---- Timing model -----------------------------------------------------------
# The Pi drives a single 434 MHz OOK channel, so cues fire one at a time.
# SLOT_MS is the timeline quantum: the front end places cues on a SLOT_MS grid
# (one cue per slot) and the runner fires serially.  As long as one fire's
# wall-clock time stays under SLOT_MS, every cue lands on its mark with no
# collision and no drift.  Cues authored closer than a fire-time simply ripple
# out at ~SLOT_MS each (6 "simultaneous" cues => ~1.2 s, which is tolerable).
SLOT_MS = 300
# Frames per transmission.  ~40-47 ms/frame, so 3 frames (~140 ms airtime)
# leaves headroom under SLOT_MS for process spawn + margin.  Measure real
# per-fire wall-time on the Pi (test_cues.py prints it) and tune if needed.
DEFAULT_REPEATS = 6 
# rpitx sendiq queues the whole file to the DMA and EXITS before the RF has
# finished playing (verified on a Pi 4: a 146 ms cue's process returns in
# ~33 ms).  If we let the next cue start then, its GPIO/DMA re-init clobbers
# the still-playing transmission.  So after sendiq exits we wait out the cue's
# real airtime plus this guard, letting the DMA fully drain before the next
# cue.  This is what actually enforces one-cue-at-a-time on the shared channel.
AIRTIME_GUARD_MS = 25

# ---- Transmit parameters (match the sendiq invocation used for captures) ----
SAMPLE_RATE = 48000
FREQ_HZ = 434004000
# Allow overriding the binary/path without editing code (e.g. SENDIQ=./sendiq).
# The runner is expected to run as root (sudo python run_show.py ...), so the
# per-cue command is bare sendiq - no per-fire sudo auth/spawn cost.
SENDIQ = os.environ.get("SENDIQ", "sendiq")
DEFAULT_CUES_DIR = os.environ.get("CUES_DIR", "cues")


def areas_for(device: int):
    lo, hi = LAYOUT[device]
    return range(lo, hi + 1)


def cues_for(_device: int, _area: int):
    return range(FIRST_CUE, FIRST_CUE + CUES_PER_AREA)


def all_cues():
    """Yield (device, area, cue) for every cue in the whole system."""
    for device in sorted(LAYOUT):
        for area in areas_for(device):
            for cue in cues_for(device, area):
                yield device, area, cue


def cue_name(device: int, area: int, cue: int) -> str:
    return f"device{int(device)}_area{int(area):02d}_cue{int(cue):02d}"


def cue_filename(device: int, area: int, cue: int) -> str:
    return cue_name(device, area, cue) + ".wav"


def cue_path(device: int, area: int, cue: int, cues_dir=DEFAULT_CUES_DIR) -> Path:
    return Path(cues_dir) / cue_filename(device, area, cue)


def wav_airtime_ms(path) -> float:
    """Physical transmission time of a cue WAV, from its byte size.

    Standard PCM WAV: 44-byte header, then stereo int16 = 4 bytes/frame at
    SAMPLE_RATE.  A real (blocking) transmission cannot take LESS than this -
    if a fire returns faster, sendiq is not actually transmitting the file.
    """
    try:
        frames = max(0, os.path.getsize(path) - 44) / 4.0
        return frames / SAMPLE_RATE * 1000.0
    except OSError:
        return 0.0


def transmit_cmd(path) -> list:
    # No leading "sudo": run the whole script as root so each fire skips the
    # per-cue sudo auth + fork cost (keeps a fire comfortably under SLOT_MS).
    return [SENDIQ, "-i", str(path), "-s", str(SAMPLE_RATE),
            "-f", str(FREQ_HZ), "-t", "i16"]


def is_root() -> bool:
    return not hasattr(os, "geteuid") or os.geteuid() == 0


def warn_if_not_root(dry_run: bool = False):
    if not dry_run and not is_root():
        print("warning: transmitting needs root (GPIO). Re-run with sudo or "
              "as root, or pass --dry-run.", file=sys.stderr)


def _kill(proc):
    """Terminate a transmitting child promptly (TERM, then KILL)."""
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=1.0)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def fire(path, dry_run: bool = False, timeout: float = 30.0) -> int:
    """Transmit one cue WAV, BLOCKING until sendiq exits.

    Blocking is intentional and is what keeps run_show / test_cues clean:
      * The Pi drives a single 434 MHz radio on one shared OOK channel, so
        transmissions MUST be serialized - two overlapping sendiq processes
        collide on the air and both cues are lost.
      * We wait for and reap the child, so no zombie processes and no
        unbounded pile-up of forked sendiq processes.

    sendiq exits as soon as it has queued the file to the DMA, before the RF
    has finished playing, so on success we wait out the remaining airtime to
    guarantee the transmission fully drains before the next cue fires (see
    AIRTIME_GUARD_MS).  fire() therefore blocks for the true on-air time.

    On KeyboardInterrupt (Ctrl-C) the child is killed immediately and the
    interrupt re-raised, so a show stops the instant you ask it to - the radio
    goes quiet mid-transmission rather than finishing the burst first.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"cue WAV not found: {path}")
    if dry_run:
        return 0
    drain_by = time.monotonic() + (wav_airtime_ms(path) + AIRTIME_GUARD_MS) / 1000.0
    proc = subprocess.Popen(transmit_cmd(path))
    try:
        rc = proc.wait(timeout=timeout)
    except (KeyboardInterrupt, subprocess.TimeoutExpired):
        _kill(proc)
        raise
    if rc == 0:
        remaining = drain_by - time.monotonic()   # let the DMA finish playing
        if remaining > 0:
            time.sleep(remaining)
    return rc
