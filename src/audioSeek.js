import { seekToTime } from './audioClock.js'
import { useShowStore } from './store/useShowStore.js'

// Convert a viewport X coordinate into timeline seconds using a lane element's box.
export function timeAtClientX(clientX, laneEl, pxPerSec) {
  if (!laneEl) return 0
  const rect = laneEl.getBoundingClientRect()
  return Math.max(0, (clientX - rect.left) / pxPerSec)
}

export function seekTimeline(wsRef, clientX, laneEl) {
  const { pxPerSec } = useShowStore.getState()
  const t = timeAtClientX(clientX, laneEl, pxPerSec)
  return seekToTime(wsRef.current, t)
}
