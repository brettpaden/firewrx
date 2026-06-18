// Shared time<->pixel scale. Every column-aligned element (ruler, waveform,
// track lanes, playhead) derives its geometry from this single constant.
export const PX_PER_SEC = 12

// Minimum timeline span (seconds) before any audio/clips push it wider.
export const DEFAULT_SECONDS = 180

export const FIREWORK_TYPES = ['cake', 'shell', 'finale', 'flare']

export const TYPE_COLORS = {
  cake: '#ff7a18',
  shell: '#3aa0ff',
  finale: '#c850ff',
  flare: '#ffd23a',
}

export const TRACK_HEIGHT = 44
