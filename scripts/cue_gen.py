#!/usr/bin/env python3
"""
cue_gen.py  -  Synthesize area/cue command frames for the 434 MHz transceivers
and write rpitx-ready I/Q WAV files (48 kHz, 16-bit stereo: L=I, R=Q).

Frame format (24-bit OOK / PWM, reverse-engineered):

    [ ID part A (9b) ][ area + OFFSET (7b) ][ ID part B (4b) ][ cue (4b) ]

PWM bit encoding (durations are per-device, in microseconds):
    bit 0 = short HIGH + long  LOW
    bit 1 = long  HIGH + short LOW
Each frame is followed by a long LOW "sync" gap, then the whole frame repeats.

Transmit with e.g.:   sudo ./sendiq -i area5_cue3.wav -s 48000 -f 434004000 -t i16
(adjust to your rpitx invocation / the one you already use for these files)
"""
import argparse
import numpy as np
from scipy.io import wavfile

FS = 48000            # sample rate (Hz) - matches all captures
AMP = 30000           # I/Q "on" amplitude (peak of real captures ~30-32k)

# ---- Per-device profiles (all reverse-engineered & verified) ----------------
DEVICES = {
    1: dict(id_a="000110001", offset=28, id_b="0001",
            # PWM timing in microseconds, measured from device-1 captures
            short_high=376, long_high=905, short_low=564, long_low=1108,
            sync_low=11375),
    2: dict(id_a="001100000", offset=12, id_b="1010",
            short_high=261, long_high=860, short_low=468, long_low=1081,
            sync_low=10104),
}

AREA_BITS = 7         # bits 9-15
CUE_BITS  = 4         # bits 20-23


def build_codeword(device: int, area: int, cue: int) -> str:
    d = DEVICES[device]
    field = area + d["offset"]
    if not (0 <= field < (1 << AREA_BITS)):
        raise ValueError(f"area {area} out of range for device {device} "
                         f"(field={field}, max {(1<<AREA_BITS)-1})")
    if not (0 <= cue < (1 << CUE_BITS)):
        raise ValueError(f"cue {cue} out of range (0-{(1<<CUE_BITS)-1})")
    return (d["id_a"]
            + format(field, f"0{AREA_BITS}b")
            + d["id_b"]
            + format(cue,  f"0{CUE_BITS}b"))


def _us(microseconds: float) -> int:
    return int(round(microseconds * FS / 1e6))


def frame_envelope(device: int, bits: str) -> np.ndarray:
    """Return the on/off amplitude envelope for one frame (incl. trailing sync)."""
    d = DEVICES[device]
    parts = []
    for b in bits:
        if b == "1":
            parts.append(np.ones(_us(d["long_high"])))
            parts.append(np.zeros(_us(d["short_low"])))
        else:
            parts.append(np.ones(_us(d["short_high"])))
            parts.append(np.zeros(_us(d["long_low"])))
    # trailing sync symbol: a short HIGH pulse then the long inter-frame gap
    # (matches the 25th symbol the real encoders emit)
    parts.append(np.ones(_us(d["short_high"])))
    parts.append(np.zeros(_us(d["sync_low"])))
    return np.concatenate(parts)


def generate(device: int, area: int, cue: int, repeats: int = 20,
             lead_ms: float = 5.0) -> tuple[str, np.ndarray]:
    bits = build_codeword(device, area, cue)
    one = frame_envelope(device, bits)
    env = np.concatenate([np.zeros(_us(lead_ms * 1000))] +
                         [one] * repeats)
    # OOK: constant-phase carrier keyed on/off -> I = env*amp, Q = 0.
    # rpitx upconverts to the tuned frequency, so emitted RF is clean OOK.
    I = (env * AMP).astype(np.int16)
    Q = np.zeros_like(I)
    iq = np.stack([I, Q], axis=1)
    return bits, iq


def write_wav(path: str, iq: np.ndarray):
    wavfile.write(path, FS, iq)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Generate rpitx I/Q for area/cue commands")
    p.add_argument("--device", type=int, choices=[1, 2], required=True)
    p.add_argument("--area", type=int, required=True)
    p.add_argument("--cue",  type=int, required=True)
    p.add_argument("--repeats", type=int, default=20)
    p.add_argument("-o", "--out", default=None)
    a = p.parse_args()
    bits, iq = generate(a.device, a.area, a.cue, a.repeats)
    out = a.out or f"device{a.device}_area{a.area}_cue{a.cue}.wav"
    write_wav(out, iq)
    print(f"device {a.device}  area {a.area}  cue {a.cue}")
    print(f"  codeword : {bits}")
    print(f"  written  : {out}  ({iq.shape[0]} samples, {iq.shape[0]/FS:.2f}s)")
