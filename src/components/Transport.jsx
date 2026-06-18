import { useShowStore } from '../store/useShowStore.js'

const fmt = (t) => {
  const m = Math.floor(t / 60)
  const s = String(Math.floor(t % 60)).padStart(2, '0')
  return `${m}:${s}`
}

export default function Transport({ wsRef }) {
  const isPlaying = useShowStore((s) => s.isPlaying)
  const currentTime = useShowStore((s) => s.currentTime)
  const duration = useShowStore((s) => s.duration)
  const audioUrl = useShowStore((s) => s.audioUrl)
  const setAudioUrl = useShowStore((s) => s.setAudioUrl)

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (file) setAudioUrl(URL.createObjectURL(file))
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)',
      }}
    >
      <button onClick={() => wsRef.current?.playPause()} disabled={!audioUrl} style={{ minWidth: 72 }}>
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          cursor: 'pointer',
          border: '1px solid var(--border)',
          background: 'var(--panel-2)',
          borderRadius: 6,
          padding: '6px 12px',
        }}
      >
        ⤓ {audioUrl ? 'Replace MP3' : 'Upload MP3'}
        <input type="file" accept="audio/*,.mp3" onChange={onPick} style={{ display: 'none' }} />
      </label>

      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--muted)' }}>
        {fmt(currentTime)} / {fmt(duration)}
      </span>
      {!audioUrl && (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          (upload an MP3 to enable playback)
        </span>
      )}
    </div>
  )
}
