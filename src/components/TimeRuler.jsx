import { useShowStore } from '../store/useShowStore.js'

// Candidate label intervals (seconds). We pick the smallest one whose on-screen
// spacing is at least MIN_LABEL_PX, so labels stay readable at every zoom level.
const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
const MIN_LABEL_PX = 64

// A tick every `step` seconds, labelled m:ss. Width matches the shared scale so it
// aligns column-for-column with the waveform and track lanes below it.
export default function TimeRuler({ totalSeconds }) {
  const pxPerSec = useShowStore((s) => s.pxPerSec)
  const step = STEPS.find((s) => s * pxPerSec >= MIN_LABEL_PX) ?? STEPS[STEPS.length - 1]

  const ticks = []
  for (let t = 0; t <= totalSeconds; t += step) {
    const m = Math.floor(t / 60)
    const s = String(t % 60).padStart(2, '0')
    ticks.push(
      <div
        key={t}
        style={{
          position: 'absolute',
          left: t * pxPerSec,
          top: 0,
          bottom: 0,
          borderLeft: '1px solid var(--border)',
          paddingLeft: 4,
          fontSize: 10,
          color: 'var(--muted)',
        }}
      >
        {m}:{s}
      </div>,
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 22,
        width: totalSeconds * pxPerSec,
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {ticks}
    </div>
  )
}
