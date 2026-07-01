# firewrx show runner (Raspberry Pi bundle)

Everything needed to fire cues from a Raspberry Pi: prebuilt cue WAVs, the
firing scripts, the tone/IQ generation scripts, and an installer.

## Contents

| File              | Purpose                                                     |
|-------------------|-------------------------------------------------------------|
| `cues/`           | 168 prebuilt cue WAVs (dev1 areas 1-4, dev2 areas 1-10 × 12)|
| `run_show.py`     | Play an exported show JSON, firing cues on schedule         |
| `test_cues.py`    | Fire one / many / all cues, with a configurable pause       |
| `build_cues.py`   | (Re)generate every cue WAV into `cues/`                     |
| `cue_gen.py`      | Tone/IQ synthesis — builds the rpitx-ready I/Q WAVs         |
| `cues.py`         | Shared layout, file naming, and transmit helper             |
| `install.sh`      | Install Python deps and create a local venv                 |
| `requirements.txt`| numpy/scipy (only needed to regenerate cues)                |

## Setup (once)

```bash
./install.sh
```

You also need `sendiq` (from rpitx) on `PATH`. If it lives elsewhere:

```bash
export SENDIQ=/opt/rpitx/sendiq
```

Transmitting drives GPIO, so run the whole script as **root** with `sudo`.
Running the script (not each cue) as root means every fire is a bare `sendiq`
with no per-cue sudo cost — that's what keeps a fire inside the 200 ms slot.

## Timing model

The Pi drives a single shared 434 MHz OOK channel, so cues fire **one at a
time** — true simultaneous RF is physically impossible on one channel. The
timeline is quantized into **200 ms slots** (`SLOT_MS` in `cues.py`), one cue
per slot. Each transmission is ~140 ms of airtime, so a fire fits inside its
slot: every cue lands on time with no collision and no drift. Cues authored
tighter than a slot ripple out at ~200 ms each (6 "simultaneous" cues ≈ 1.2 s).

## Fire cues on the bench

Selectors are `device:area:cue`; `*` means "all". Default pause is 0 ms.
Every real run prints per-fire wall-time, so `--all` doubles as a bench to
verify a fire stays under the 200 ms slot on your Pi.

```bash
sudo ./.venv/bin/python test_cues.py 1:1:1                 # one cue
sudo ./.venv/bin/python test_cues.py 1:1:1 2:5:3           # a few
sudo ./.venv/bin/python test_cues.py '1:2:*'               # all cues in dev1 area2
sudo ./.venv/bin/python test_cues.py '2:*:*'               # all of device 2
sudo ./.venv/bin/python test_cues.py --all                 # all + timing report
sudo ./.venv/bin/python test_cues.py --all --pause 500     # all, 500 ms apart
./.venv/bin/python test_cues.py --all --dry-run            # print, don't transmit
```

(Quote selectors containing `*` so the shell doesn't expand them.)

## Run a show

Export the show JSON from the firewrx app, copy it to the Pi, then:

```bash
sudo ./.venv/bin/python run_show.py show.json
sudo ./.venv/bin/python run_show.py show.json --dry-run    # rehearse timing
```

## Regenerate cues

Only needed if you change `cue_gen.py` (timings, ID bits, repeats):

```bash
./.venv/bin/python build_cues.py -f
```

## Notes

- Cues fire one at a time. The Pi has a single radio on a shared channel, so
  transmissions are serialized and each `sendiq` child is waited on — no zombie
  or runaway forked processes even across a long show.
- The monotonic clock is the anchor: a busy radio only makes a cue *late*, it
  never desyncs the show. `run_show.py` reports worst-case lateness.
- The `.show` JSON format is unchanged — existing shows run as-is.
- File naming is stable and human friendly: `device2_area10_cue12.wav`.
