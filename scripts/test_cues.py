#!/usr/bin/env python3
"""
test_cues.py  -  Fire one, many, or all cues for bench testing.

Cues are transmitted one at a time (the Pi has a single radio) with an
optional pause between each.  The default pause is 0 ms.

Selecting cues
--------------
Positional selectors are  device:area:cue  where area/cue may be '*':

    python scripts/test_cues.py 1:1:1              # single cue
    python scripts/test_cues.py 1:1:1 2:5:3        # a few specific cues
    python scripts/test_cues.py 1:2:*              # every cue in dev1 area2
    python scripts/test_cues.py 2:*:*              # every cue on device 2
    python scripts/test_cues.py --all              # the entire system
    python scripts/test_cues.py --all --pause 500  # 500 ms between each
    python scripts/test_cues.py 1:1:1 --dry-run    # print, don't transmit

Use --dry-run to validate selection/paths without keying the radio.
"""
import argparse
import os
import sys
from time import monotonic, sleep

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cues as cuelib


def _pct(sorted_vals, p):
    """Nearest-rank percentile (no numpy dep needed to fire cues)."""
    if not sorted_vals:
        return 0.0
    k = max(0, min(len(sorted_vals) - 1, round((p / 100.0) * len(sorted_vals) + 0.5) - 1))
    return sorted_vals[k]


def report_timing(durations, expected_ms=0.0, failed=0):
    """Print real per-fire wall-time so W (SLOT_MS) can be set from data."""
    if failed:
        print(f"WARNING: {failed} fire(s) exited non-zero - sendiq FAILED "
              f"(run as root? is sendiq installed and set up?). Nothing was "
              f"transmitted for those.")
    if not durations:
        return
    s = sorted(durations)
    lo, med, p95, hi = s[0], _pct(s, 50), _pct(s, 95), s[-1]
    print(f"timing (ms): min={lo:.0f} median={med:.0f} p95={p95:.0f} max={hi:.0f}"
          f"  over {len(s)} fire(s)")
    # A real transmission must take at least the cue's airtime.  If fires came
    # back much faster, sendiq is not truly transmitting (failing, or exiting
    # before its DMA finishes) - the slot verdict below would be meaningless.
    if expected_ms and med < 0.7 * expected_ms:
        print(f"WARNING: fires ({med:.0f}ms median) are faster than a cue's "
              f"~{expected_ms:.0f}ms airtime - sendiq is NOT blocking for the "
              f"real transmission. Confirm a cue actually triggers a receiver "
              f"before trusting these timings or the slot below.")
    slot = cuelib.SLOT_MS
    verdict = "fits" if p95 <= slot else "OVER"
    print(f"  slot W={slot}ms: p95 {verdict} "
          f"({slot - p95:+.0f}ms headroom) -> 6 cues ~= {6 * p95 / 1000:.1f}s")


def parse_selector(sel: str):
    """Expand 'device:area:cue' (area/cue may be '*') into (d, a, c) tuples."""
    parts = sel.split(":")
    if len(parts) != 3:
        raise ValueError(f"selector must be device:area:cue, got '{sel}'")
    dev_s, area_s, cue_s = parts
    try:
        device = int(dev_s)
    except ValueError:
        raise ValueError(f"device must be a number in '{sel}'")
    if device not in cuelib.LAYOUT:
        raise ValueError(f"unknown device {device} in '{sel}'")

    areas = cuelib.areas_for(device) if area_s == "*" else [int(area_s)]
    out = []
    for area in areas:
        if area not in cuelib.areas_for(device):
            raise ValueError(f"area {area} out of range for device {device}")
        cue_list = cuelib.cues_for(device, area) if cue_s == "*" else [int(cue_s)]
        for cue in cue_list:
            if cue not in cuelib.cues_for(device, area):
                raise ValueError(f"cue {cue} out of range")
            out.append((device, area, cue))
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("selectors", nargs="*",
                   help="device:area:cue selectors ('*' = all)")
    p.add_argument("--all", action="store_true", help="fire every cue in the system")
    p.add_argument("--pause", type=float, default=0.0,
                   help="pause between cues in milliseconds (default: 0)")
    p.add_argument("--cues-dir", default=cuelib.DEFAULT_CUES_DIR,
                   help="directory holding the cue WAVs (default: cues)")
    p.add_argument("-n", "--dry-run", action="store_true",
                   help="print what would fire without transmitting")
    args = p.parse_args()

    if args.all:
        targets = list(cuelib.all_cues())
    else:
        targets = []
        seen = set()
        try:
            for sel in args.selectors:
                for t in parse_selector(sel):
                    if t not in seen:  # de-dupe overlapping selectors, keep order
                        seen.add(t)
                        targets.append(t)
        except ValueError as e:
            p.error(str(e))

    if not targets:
        p.error("no cues selected: pass selectors like 1:1:1, or --all")

    cuelib.warn_if_not_root(args.dry_run)

    pause_s = args.pause / 1000.0
    print(f"firing {len(targets)} cue(s), pause={args.pause:g}ms"
          f"{' [dry-run]' if args.dry_run else ''}")

    fired = 0
    failed = 0
    durations = []
    expected_ms = 0.0
    for i, (device, area, cue) in enumerate(targets):
        path = cuelib.cue_path(device, area, cue, args.cues_dir)
        label = cuelib.cue_name(device, area, cue)
        try:
            print(f"  [{i + 1}/{len(targets)}] FIRE {label}", flush=True)
            expected_ms = expected_ms or cuelib.wav_airtime_ms(path)
            t0 = monotonic()
            rc = cuelib.fire(path, dry_run=args.dry_run)
            durations.append((monotonic() - t0) * 1000.0)
            if rc:
                failed += 1
                print(f"    ! sendiq exited {rc} (not transmitted)",
                      file=sys.stderr)
            else:
                fired += 1
        except FileNotFoundError as e:
            print(f"    ! missing: {e}  (run build_cues.py)", file=sys.stderr)
        except KeyboardInterrupt:
            print("\naborted", file=sys.stderr)
            break
        if pause_s and i < len(targets) - 1:
            sleep(pause_s)

    print(f"done: fired {fired}/{len(targets)}"
          + (f", {failed} FAILED" if failed else ""))
    if not args.dry_run:
        report_timing(durations, expected_ms, failed)


if __name__ == "__main__":
    main()
