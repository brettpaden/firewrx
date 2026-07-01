#!/usr/bin/env python3
"""
run_show.py  -  Play an exported show, firing each cue at its scheduled time.

    sudo python scripts/run_show.py show.json          # run as root to transmit
    sudo python scripts/run_show.py show.json --cues-dir cues
    python scripts/run_show.py show.json --dry-run     # rehearse without radio
    python scripts/run_show.py show.json --plain       # no colors / live UI

Cues fire in start-time order.  Each transmission is blocking (see cues.fire),
so sendiq children are reaped immediately - no zombie processes and no pile-up
of forked processes, which is important for a long show with many cues.
Because the Pi drives a single shared 434 MHz channel, blocking also serializes
the RF: if two cues are scheduled closer than one fire-time, the second fires
as soon as the first finishes (reported as "late" below).  The monotonic clock
is the anchor, so this never drifts - a busy radio only makes a cue late, it
never desyncs the show.  Placing cues on the SLOT_MS grid keeps lateness at 0.

Ctrl-C stops the show immediately: the live display never blocks the interrupt,
the transmitting child is killed mid-burst, and the terminal is always restored.
"""
import argparse
import json
import os
import shutil
import sys
from time import monotonic, sleep

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cues as cuelib

# ---- Tiny dependency-free ANSI toolkit --------------------------------------
def _detect_fancy():
    if os.environ.get("NO_COLOR") is not None:     # standard: opt out
        return False
    if os.environ.get("FORCE_COLOR") not in (None, "", "0"):  # standard: opt in
        return True
    return (sys.stdout.isatty()
            and os.environ.get("TERM") not in (None, "", "dumb"))


FANCY = _detect_fancy()

# Palette (24-bit truecolor).
AMBER = (255, 176, 0)
DEV_COLORS = {1: (90, 200, 250), 2: (255, 110, 170)}   # dev1 cyan, dev2 pink
DIM = (128, 132, 140)
GREEN = (90, 220, 130)
RED = (255, 90, 90)
WHITE = (235, 238, 242)

SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"


def paint(text, rgb=WHITE, bold=False, inv=False):
    if not FANCY:
        return text
    codes = []
    if bold:
        codes.append("1")
    if inv:
        codes.append("7")
    codes.append("38;2;{};{};{}".format(*rgb))
    return f"\033[{';'.join(codes)}m{text}\033[0m"


def _w(s):
    sys.stdout.write(s)
    sys.stdout.flush()


def clear_line():
    if FANCY:
        _w("\r\033[K")


def hide_cursor():
    if FANCY:
        _w("\033[?25l")


def show_cursor():
    if FANCY:
        _w("\033[?25h")


def term_width():
    return shutil.get_terminal_size((80, 24)).columns


def fmt_clock(seconds):
    seconds = max(0.0, seconds)
    m, s = divmod(seconds, 60)
    return f"{int(m)}:{s:04.1f}"


def bar(fraction, width=14):
    fraction = 0.0 if fraction < 0 else 1.0 if fraction > 1 else fraction
    filled = int(round(fraction * width))
    return paint("█" * filled, AMBER) + paint("░" * (width - filled), DIM)


def dev_color(device):
    return DEV_COLORS.get(device, WHITE)


# ---- Show loading -----------------------------------------------------------
def load_show(show_file):
    with open(show_file, "r") as f:
        show = json.load(f)
    clips = sorted(show.get("clips", []), key=lambda c: c["startSec"])
    total = show.get("duration") or (clips[-1]["startSec"] if clips else 0.0)
    return clips, float(total)


# ---- Rendering --------------------------------------------------------------
def print_header(show_file, n, total, dry_run):
    if not FANCY:
        print(f"loaded {n} cue(s) from {show_file}"
              f"{' [dry-run]' if dry_run else ''}")
        return
    title = paint("⬢ firewrx", AMBER, bold=True) + paint("  show runner", WHITE)
    tag = paint(" [dry-run]", DIM) if dry_run else ""
    meta = paint(
        f"{os.path.basename(show_file)}  ·  {n} cues  ·  {fmt_clock(total)}"
        f"  ·  slot {cuelib.SLOT_MS}ms", DIM)
    print()
    print("  " + title + tag)
    print("  " + meta)
    print("  " + paint("─" * min(46, term_width() - 4), DIM))


def render_countdown(frame, remaining, clip, now, total):
    if not FANCY:
        return
    device = clip["device"]
    label = cuelib.cue_name(device, clip["area"], clip["cue"])
    name = clip.get("firework", {}).get("name", "")
    spin = paint(SPINNER[frame % len(SPINNER)], AMBER)
    parts = [
        "  " + spin,
        paint(f"next in {remaining:4.1f}s", WHITE),
        paint("●", dev_color(device)) + " " + paint(label, dev_color(device), bold=True),
        paint(name, DIM),
        bar(now / total if total else 1.0),
        paint(f"{fmt_clock(now)}/{fmt_clock(total)}", DIM),
    ]
    line = "  ".join(p for p in parts if p)
    # Truncate to the terminal width so \r rewriting never wraps.
    _w("\r\033[K" + line[:_visible_budget()])


def _visible_budget():
    # Generous cap: ANSI codes are invisible, so allow extra room over columns.
    return term_width() + 512


def fire_line(clip, now, late_ms, dry_run):
    """Flash a cue as it transmits, then settle it into the scroll log."""
    device = clip["device"]
    label = cuelib.cue_name(device, clip["area"], clip["cue"])
    name = clip.get("firework", {}).get("name", "?")

    path = cuelib.cue_path(device, clip["area"], clip["cue"])

    if not FANCY:
        flag = f"  (late {late_ms:.0f}ms)" if late_ms >= cuelib.SLOT_MS else ""
        print(f"  t={now:7.3f}s  FIRE {label}  ({name}){flag}", flush=True)
        rc = cuelib.fire(path, dry_run=dry_run)
        if rc:
            print(f"    ! sendiq exited {rc} (not transmitted)", file=sys.stderr)
        return rc

    # 1) Light the line the instant we key the radio (inverse = the "flash").
    flash = ("  " + paint(" ⚡ FIRE ", AMBER, bold=True, inv=True)
             + "  " + paint(label, dev_color(device), bold=True)
             + "  " + paint(name, WHITE))
    _w("\r\033[K" + flash)

    # 2) Transmit.  The flash stays lit for exactly the real airtime.
    rc = cuelib.fire(path, dry_run=dry_run)

    # 3) Settle the same line into the permanent log.
    if rc:
        tail = paint(f"sendiq exit {rc}", RED, bold=True)
    else:
        tail = paint(f"late {late_ms:.0f}ms", RED) if late_ms >= cuelib.SLOT_MS \
            else paint("on time", GREEN)
    mark = paint("✗", RED, bold=True) if rc else paint("✔", GREEN)
    settled = ("  " + mark
               + " " + paint(fmt_clock(now), DIM)
               + "  " + paint("●", dev_color(device))
               + " " + paint(label, dev_color(device), bold=True)
               + "  " + paint(name, WHITE)
               + "  " + tail)
    _w("\r\033[K" + settled + "\n")
    return rc


def print_summary(stopped, fired, total_cues, failed, worst_late, elapsed):
    clear_line()
    fail_txt = f", {failed} FAILED" if failed else ""
    if not FANCY:
        state = "SHOW STOPPED" if stopped else "show complete"
        print(f"{state}: fired {fired}/{total_cues}{fail_txt}, "
              f"worst lateness {worst_late:.0f}ms, elapsed {fmt_clock(elapsed)}")
        return
    if stopped:
        head = paint("■ SHOW STOPPED", RED, bold=True)
    else:
        head = paint("✔ show complete", GREEN, bold=True)
    fail_seg = paint(f"   ·   {failed} FAILED", RED, bold=True) if failed else ""
    print("  " + paint("─" * min(46, term_width() - 4), DIM))
    print("  " + head
          + paint(f"   fired {fired}/{total_cues}", WHITE) + fail_seg
          + paint(f"   ·   worst late {worst_late:.0f}ms", DIM)
          + paint(f"   ·   elapsed {fmt_clock(elapsed)}", DIM))
    print()


# ---- Main loop --------------------------------------------------------------
def run_show(show_file, cues_dir=cuelib.DEFAULT_CUES_DIR, dry_run=False):
    cuelib.DEFAULT_CUES_DIR = cues_dir  # so cue_path uses the chosen dir
    clips, total = load_show(show_file)
    if not clips:
        print("no clips in show; nothing to fire")
        return

    print_header(show_file, len(clips), total, dry_run)
    cuelib.warn_if_not_root(dry_run)

    fired = 0
    failed = 0
    worst_late = 0.0
    stopped = False
    frame = 0
    hide_cursor()
    show_start = monotonic()
    try:
        for clip in clips:
            target = clip["startSec"]
            # Wait for this cue's moment.  Short sleeps keep Ctrl-C instant and
            # keep the spinner smooth; if the radio ran long, we fall right
            # through and fire late.
            while True:
                now = monotonic() - show_start
                remaining = target - now
                if remaining <= 0:
                    break
                render_countdown(frame, remaining, clip, now, total)
                frame += 1
                sleep(min(0.05, remaining))

            late_ms = max(0.0, now - target) * 1000.0
            worst_late = max(worst_late, late_ms)
            try:
                rc = fire_line(clip, now, late_ms, dry_run)
                if rc:
                    failed += 1
                else:
                    fired += 1
            except FileNotFoundError as e:
                clear_line()
                print(paint(f"    ! missing: {e}  (run build_cues.py)", RED),
                      file=sys.stderr)
    except KeyboardInterrupt:
        stopped = True
    finally:
        show_cursor()

    print_summary(stopped, fired, len(clips), failed,
                  worst_late, monotonic() - show_start)
    return 130 if stopped else 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("show", help="exported show JSON file")
    p.add_argument("--cues-dir", default=cuelib.DEFAULT_CUES_DIR,
                   help="directory holding the cue WAVs (default: cues)")
    p.add_argument("-n", "--dry-run", action="store_true",
                   help="run the schedule without transmitting")
    p.add_argument("--plain", action="store_true",
                   help="disable colors and the live display")
    args = p.parse_args()

    if args.plain:
        global FANCY
        FANCY = False

    code = run_show(args.show, args.cues_dir, args.dry_run)
    sys.exit(code or 0)


if __name__ == "__main__":
    main()
