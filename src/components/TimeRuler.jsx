import { PX_PER_SEC } from '../constants.js'

// A tick every `step` seconds, labelled m:ss. Width matches the shared scale so it
// aligns column-for-column with the waveform and track lanes below it.
export default function TimeRuler({ totalSeconds }) {
  const step = 10
  const ticks = []
  for (let t = 0; t <= totalSeconds; t += step) {
    const m = Math.floor(t / 60)
    const s = String(t % 60).padStart(2, '0')
    ticks.push(
      <div
        key={t}
        style={{
          position: 'absolute',
          left: t * PX_PER_SEC,
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
        width: totalSeconds * PX_PER_SEC,
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {ticks}
    </div>
  )
}
