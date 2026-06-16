# 434 MHz Area/Cue Remote — Protocol & Generator

Reverse-engineered protocol for the 434.004 MHz transceivers that send **area**
(1–99) and **cue** (1–16) commands to receiver pucks, plus `cue_gen.py`, a tool
that synthesizes rpitx-ready I/Q WAV files for any area/cue on either transceiver.

Everything below was derived purely from recorded RF captures — no datasheet, no
device teardown — and the generator is validated bit-for-bit against real captures.

---

## 1. How we broke it down

The captures arrived as `.wav` files recorded off-air and cleaned up. Here's the
path from "mystery audio file" to "fully specified protocol," because the method
matters as much as the answer.

### Step 1 — It's not audio, it's I/Q
Each file is a **48 kHz, 16-bit, stereo** WAV. For rpitx that combination means
the two channels aren't left/right audio — they're the **I (in-phase)** and
**Q (quadrature)** components of a complex baseband signal. So we treat
`left + j·right` as a stream of complex samples, not sound.

### Step 2 — The modulation is On-Off Keying (OOK)
Taking the magnitude of each complex sample, `√(I² + Q²)`, gives the signal's
*envelope* — how much carrier is present at each instant. A histogram of the
envelope was sharply **bimodal**: samples sat either near zero or near full-scale,
with almost nothing in between. That's the fingerprint of OOK — the carrier is
simply switched **on** or **off**. (Amplitude levels in between would have meant
ASK or something more complex; there were none.)

### Step 3 — The bits are PWM-encoded
Thresholding the envelope and run-length-encoding the on/off durations revealed
just **two pulse widths** for "on" and two for "off," in a strict pattern. This is
classic **PWM bit encoding**, the scheme used by the EV1527/PT2262 remote-control
chip family:

```
bit 0  =  short HIGH  +  long  LOW
bit 1  =  long  HIGH  +  short LOW
```

Each transmission is a fixed-length burst of these bits, followed by a long "off"
**sync gap**, and the whole frame **repeats ~20 times** (remotes blast the code
many times so the receiver catches one cleanly).

### Step 4 — The frame is 24 bits, and the cue is in plain sight
Every frame decoded to the **same 24-bit codeword**, repeated identically. For the
very first file (labeled *area 1, cue 12*) the last four bits were `1100` — binary
for **12**. The cue number was sitting in plain binary in the low nibble. First
field located.

### Step 5 — Locating the area field
Comparing captures that differed only in **area** (area 2 vs area 3, same cue)
isolated the area bits: only **two bits** moved. That looked like a tidy 2-bit
area field at first — which turned out to be only the *bottom* of a larger field
(see Step 7).

### Step 6 — The curveball: a second transceiver revealed the device ID
A capture of the **same** area/cue from a **different physical transceiver**
decoded to a different codeword. Lining the two up — same area, same cue, so any
difference *must* be device identity — exposed a **transceiver ID**: a block of
bits that changes per unit while the area/cue payload stays put. Crucially, this
corrected an earlier wrong assumption: bits we'd called "constant framing" were
actually that *one unit's* ID holding still. The ID isn't one contiguous block;
it sits in **two pieces that wrap around** the area field.

### Step 7 — Mapping the full area field with a powers-of-two sweep
To see the whole area field we recorded **area = 1, 2, 4, 8, 16, 32, 64, 99** at a
fixed cue. Powers of two are the right probe: each one forces a carry into the
next-higher bit, lighting up exactly one previously-frozen bit so you can watch
where it lands. The result was decisive — the area field is **7 bits**, and its
value is always:

```
field value = area + OFFSET
```

a clean linear encoding with a constant per-device offset. On the second unit the
offset was **12**; every one of the eight captures matched `area + 12` exactly,
including the full binary rollover at each power of two.

### Step 8 — Confirming on the first transceiver
Repeating the sweep on the original unit gave **offset = 28**, again exact across
all points, with **area 99 → `1111111`** — the 7-bit field completely full. So
that unit's offset is sized such that its panel maximum of 99 exactly saturates
the field. Same logical protocol, different ID block and offset.

### Step 9 — Build and validate
With the structure pinned, we built `cue_gen.py`, regenerated several real
captures from scratch, and decoded the output with the same pipeline used on the
originals. All **matched bit-for-bit** — the proof that the model is complete and
correct.

---

## 2. The signal, part by part

### Physical layer
| Property        | Value |
|-----------------|-------|
| Carrier         | 434.004 MHz |
| Modulation      | OOK (on-off keying) |
| File format     | 48 kHz, 16-bit, stereo I/Q WAV (L = I, R = Q) |
| Bit encoding    | PWM — `0` = short-high/long-low, `1` = long-high/short-low |
| Frame           | 24 data bits + 1 sync pulse |
| Repeats         | ~20 identical frames per press |

### The 24-bit frame

```
 bit index:  0         8 9              15 16    19 20     23
             ┌─────────┐┌────────────────┐┌───────┐┌────────┐
             │  ID-A   ││  area + OFFSET ││ ID-B  ││  cue   │
             │ 9 bits  ││    7 bits      ││4 bits ││ 4 bits │
             └─────────┘└────────────────┘└───────┘└────────┘
              └───── transceiver ID ─────┘ (ID-A + ID-B)
```

| Field   | Bits  | Width | Meaning |
|---------|-------|-------|---------|
| ID-A    | 0–8   | 9     | First part of the transceiver's identity |
| Area    | 9–15  | 7     | `area + OFFSET`, plain binary (MSB at bit 9) |
| ID-B    | 16–19 | 4     | Second part of the transceiver's identity |
| Cue     | 20–23 | 4     | Cue number, plain binary (MSB at bit 20) |

The transceiver ID is the two ID blocks together; it wraps **around** the area
field rather than being one run of bits.

### Per-device profiles

| Device | ID-A        | OFFSET | ID-B   | Notes |
|--------|-------------|--------|--------|-------|
| 1      | `000110001` | 28     | `0001` | area 99 fills the 7-bit field (`1111111`) |
| 2      | `001100000` | 12     | `1010` | area range has headroom to 115 |

The **offset** is the single per-unit constant. It does not map obviously to the
ID bits, so it's treated as a calibration/serial-derived value: capture one
known-area frame from a new unit and the offset falls out as `field − area`.

### PWM timing (microseconds)

| Device | short HIGH | long HIGH | short LOW | long LOW | sync gap |
|--------|-----------:|----------:|----------:|---------:|---------:|
| 1      | 376        | 905       | 564       | 1108     | 11375    |
| 2      | 261        | 860       | 468       | 1081     | 10104    |

The two units use different encoder clocks (hence different pulse widths) but the
**same 24-bit logical frame** — which is why the same receiver pucks respond to
both.

### Worked example
Device 2, area 5, cue 3:

```
area field = 5 + 12 = 17 = 0010001  (7 bits)
cue        = 3        =    0011      (4 bits)

ID-A      area      ID-B   cue
001100000 0010001   1010   0011   →  001100000001000110100011
```

---

## 3. How `cue_gen.py` works

The script turns an `(area, cue)` pair into the exact I/Q waveform the hardware
emits. Pipeline:

1. **Build the codeword.** Look up the device profile, compute `area + OFFSET`,
   format it as 7 bits, and concatenate `ID-A + areafield + ID-B + cue` into the
   24-bit string. Out-of-range area/cue values raise an error.

2. **PWM-encode to an envelope.** Walk the 24 bits; for each, append an "on" run
   then an "off" run of the right durations for that device (`1` → long-high +
   short-low, `0` → short-high + long-low). After the data bits, append the
   **sync pulse** (a short high) and the long sync gap — this 25th symbol matches
   what the real encoders emit.

3. **Repeat and add lead-in.** Concatenate ~20 copies of the frame behind a short
   silent lead-in, exactly like a real button press.

4. **Render to I/Q.** Produce clean baseband OOK: `I = envelope × amplitude`,
   `Q = 0`. A constant-phase carrier keyed on and off *is* OOK, and rpitx
   upconverts it to the tuned frequency, so the emitted RF lands exactly on
   434.004 MHz.

5. **Write the WAV.** 48 kHz, 16-bit stereo, ready for rpitx.

The device profiles (ID blocks, offset, timing) live in the `DEVICES` dictionary
at the top of the file, so adding a unit is a one-line edit.

---

## 4. How to use it

### Requirements
- Python 3 with `numpy` and `scipy`
- A Raspberry Pi running [rpitx](https://github.com/F5OEO/rpitx) for transmission
- Legal authority to transmit on 434 MHz in your region (this band and its rules
  vary by country — make sure you're licensed/permitted for what you're doing)

### Generate a file
```bash
python3 cue_gen.py --device 2 --area 5 --cue 3
# writes device2_area5_cue3.wav and prints the codeword
```

Options:

| Flag         | Meaning                              | Default |
|--------------|--------------------------------------|---------|
| `--device`   | Transceiver profile (`1` or `2`)     | required |
| `--area`     | Area number                          | required |
| `--cue`      | Cue number                           | required |
| `--repeats`  | How many times the frame repeats     | 20 |
| `-o`/`--out` | Output filename                      | `device{D}_area{A}_cue{C}.wav` |

### Transmit with rpitx
Use whatever rpitx invocation you already use for these I/Q files, e.g.:

```bash
sudo sendiq -i device2_area5_cue3.wav -s 48000 -f 434004000 -t i16
```

`-s 48000` matches the sample rate, `-f 434004000` is the carrier, `-t i16` says
the samples are 16-bit. Adjust to your setup.

### Adding a new transceiver
1. Record one frame at a **known** area (any cue) from the new unit.
2. Decode the 24 bits. Bits 0–8 are its **ID-A**, bits 16–19 its **ID-B**.
3. Read bits 9–15 as a number; **OFFSET = that value − the known area**.
4. Measure the four PWM pulse widths and the sync gap from the capture.
5. Add an entry to the `DEVICES` dict with those values.

### Field limits and sanity checks
- **Cue**: 4 bits → 0–15. Receiver pucks here go to 10, well within range.
- **Area**: 7-bit field → max `area = 127 − OFFSET`. Device 1 (offset 28) tops out
  at area 99; device 2 (offset 12) has room to 115. The script rejects anything
  that would overflow the field.

### One caveat on the carrier
The generator emits OOK centered exactly on the tuned frequency (`Q = 0`). The
*received* captures you recorded carried a small incidental frequency offset from
RX tuning; the transmitted files deliberately do **not**. If a receiver is fussy
or you observe a DC/LO spur on transmit, add a small IF offset to the I/Q — a
one-line change in the render step.

---

## Files
- `cue_gen.py` — the generator (device profiles in the `DEVICES` dict up top)
- `README.md` — this document
