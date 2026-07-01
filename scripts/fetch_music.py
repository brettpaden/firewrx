#!/usr/bin/env python3
"""
fetch_music.py  -  Pull a clean, loudness-normalized MP3 from a single YouTube
(or other yt-dlp-supported) URL into music/.

Usage:
    .venv/bin/python scripts/fetch_music.py "<url>"
    .venv/bin/python scripts/fetch_music.py "<url>" --name "anchors aweigh"
    .venv/bin/python scripts/fetch_music.py "<url>" --no-normalize

Requires yt-dlp (pip install -U yt-dlp) and ffmpeg on PATH.
"""
import argparse
import os
import subprocess
import sys
from typing import Optional

# Repo root is the parent of scripts/; default output lives in music/.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_DIR = os.path.join(ROOT, "music")

# EBU R128 loudness target: keeps every track at a consistent perceived level
# so "loud original" and "better pacing" sources don't fight each other.
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"


def fetch(url: str, name: Optional[str], normalize: bool) -> int:
    os.makedirs(MUSIC_DIR, exist_ok=True)
    # %(title)s by default; a fixed stem if --name was given.
    stem = name if name else "%(title)s"
    out_tmpl = os.path.join(MUSIC_DIR, f"{stem}.%(ext)s")

    cmd = [
        sys.executable, "-m", "yt_dlp",  # run yt-dlp via this interpreter
        "-x",                       # audio only
        "--audio-format", "mp3",
        "--audio-quality", "0",     # best VBR (~245 kbps)
        "--no-playlist",            # ignore &list=RD... radio autoplay
        # The default web client is currently starved of download URLs by
        # YouTube's SABR rollout (HTTP 403); the android client still serves
        # plain progressive formats. Revisit if this regresses.
        "--extractor-args", "youtube:player_client=android",
        "--embed-metadata",         # title/artist tags into the mp3
        "-o", out_tmpl,
    ]
    if normalize:
        # Scope the filter to the audio-extraction (transcode) pass only.
        # A bare "ffmpeg:" scope would also hit the metadata pass, which
        # stream-copies and can't apply an -af filter.
        cmd += ["--postprocessor-args", f"ExtractAudio:-af {LOUDNORM}"]
    cmd.append(url)

    return subprocess.run(cmd).returncode


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Fetch a clean MP3 from a single URL")
    p.add_argument("url", help="YouTube (or other) video URL")
    p.add_argument("--name", default=None,
                   help="output filename stem (default: the video title)")
    p.add_argument("--no-normalize", dest="normalize", action="store_false",
                   help="skip EBU R128 loudness normalization")
    a = p.parse_args()
    sys.exit(fetch(a.url, a.name, a.normalize))
