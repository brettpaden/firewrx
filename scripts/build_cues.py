#!/usr/bin/env python3
"""
build_cues.py  -  Generate every cue WAV for the whole system into cues/.

    device 1 -> areas 1-4,  12 cues each  =  48 files
    device 2 -> areas 1-10, 12 cues each  = 120 files
                                            ---------
                                            168 files

Usage:
    python scripts/build_cues.py                 # write missing cues to ./cues
    python scripts/build_cues.py -o cues -f       # force-rebuild all
    python scripts/build_cues.py --repeats 20     # frames per transmission
"""
import argparse
import os
import sys

# Make sibling modules importable no matter the working directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cue_gen
import cues as cuelib


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("-o", "--outdir", default=cuelib.DEFAULT_CUES_DIR,
                   help="output directory (default: cues)")
    p.add_argument("--repeats", type=int, default=cuelib.DEFAULT_REPEATS,
                   help=f"frame repeats per transmission "
                        f"(default: {cuelib.DEFAULT_REPEATS}, sized to fit "
                        f"the {cuelib.SLOT_MS} ms slot)")
    p.add_argument("-f", "--force", action="store_true",
                   help="regenerate files that already exist")
    p.add_argument("-q", "--quiet", action="store_true",
                   help="only print the summary line")
    args = p.parse_args()

    outdir = args.outdir
    os.makedirs(outdir, exist_ok=True)

    written = skipped = 0
    for device, area, cue in cuelib.all_cues():
        path = cuelib.cue_path(device, area, cue, outdir)
        if path.exists() and not args.force:
            skipped += 1
            continue
        bits, iq = cue_gen.generate(device, area, cue, args.repeats)
        cue_gen.write_wav(str(path), iq)
        written += 1
        if not args.quiet:
            secs = iq.shape[0] / cue_gen.FS
            print(f"  {path.name}  codeword={bits}  {secs:0.2f}s")

    print(f"cues: wrote {written}, skipped {skipped} existing "
          f"-> {outdir}/ ({written + skipped} total)")


if __name__ == "__main__":
    main()
