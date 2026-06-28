// Resolve the in/out range for a firework's source video (seconds on the full MP4).
export function getFireworkTrimRange(firework) {
  const durationSec = Math.max(0.01, Number(firework?.duration_sec) || 1)
  const trimStart = firework?.trim_start != null ? Math.max(0, Number(firework.trim_start)) : 0
  const trimEnd =
    firework?.trim_end != null
      ? Math.max(trimStart + 0.01, Number(firework.trim_end))
      : trimStart + durationSec

  return {
    trimStart,
    trimEnd,
    durationSec: Math.max(0.01, trimEnd - trimStart),
  }
}

// Timeline time → source-file currentTime (null when the clip is inactive).
export function clipSourceTime(clip, timelineTime) {
  const { trimStart, trimEnd, durationSec } = getFireworkTrimRange(clip.firework)
  const rel = timelineTime - clip.startSec
  if (rel < 0 || rel >= durationSec) return null
  return Math.min(trimEnd - 0.04, trimStart + rel)
}

export function isClipActiveAt(clip, timelineTime) {
  return clipSourceTime(clip, timelineTime) != null
}
