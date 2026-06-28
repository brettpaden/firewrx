// Default time<->pixel scale (px per second). This is the *starting* zoom; the live
// value lives in the store as `pxPerSec` so the timeline can zoom in/out. Every
// column-aligned element (ruler, waveform, track lanes, playhead, clips) derives
// its geometry from the store's pxPerSec.
export const DEFAULT_PX_PER_SEC = 12

// Zoom bounds (px per second) and the multiplicative step for the +/- buttons.
export const MIN_PX_PER_SEC = 3
export const MAX_PX_PER_SEC = 240
export const ZOOM_STEP = 1.5

// Minimum timeline span (seconds) before any audio/clips push it wider.
export const DEFAULT_SECONDS = 180

export const FIREWORK_TYPES = ['cake', 'shell', 'finale', 'flare']

export const TYPE_COLORS = {
  cake: '#2ecc71',
  shell: '#3aa0ff',
  finale: '#c850ff',
  flare: '#ffd23a',
  video: '#2ecc71',
}

export const TRACK_HEIGHT = 88
export const TRACK_CONTROLS_WIDTH = 112
export const RULER_HEIGHT = 22
export const WAVEFORM_HEIGHT = 64
export const TIMELINE_HEADER_HEIGHT = RULER_HEIGHT + WAVEFORM_HEIGHT
// Invisible drop target below placed tracks (no extra visible rows).
export const DROP_PAD_TRACKS = 3

// Show hardware layout defaults (configurable via Settings).
export const DEFAULT_DEVICE_COUNT = 2
export const DEFAULT_AREAS_PER_DEVICE = 99
export const CUES_PER_AREA = 12
export const MIN_DEVICE_COUNT = 1
export const MAX_DEVICE_COUNT = 16
export const MIN_AREAS_PER_DEVICE = 1
export const MAX_AREAS_PER_DEVICE = 127

// Target on-screen width (px) of a single filmstrip thumbnail.
export const FILMSTRIP_THUMB_W = 84
