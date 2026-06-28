import { FILMSTRIP_THUMB_W } from '../constants.js'
import { useFilmstrip } from '../filmstrip.js'

// Renders a row of video thumbnails that fills `width`. The number of frames is
// width / FILMSTRIP_THUMB_W, so zooming the timeline (which widens the clip) shows
// progressively more frames — the iMovie filmstrip effect.
export default function Filmstrip({ firework, width }) {
  const numFrames = Math.max(1, Math.round(width / FILMSTRIP_THUMB_W))
  const frames = useFilmstrip(firework.video_url, numFrames, { firework })

  const cells = Array.from({ length: numFrames }, (_, i) => {
    const src = frames[i]
    return (
      <div
        key={i}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          backgroundColor: '#0c0f14',
          backgroundImage: src ? `url(${src})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRight: i < numFrames - 1 ? '1px solid rgba(0,0,0,0.35)' : 'none',
        }}
      />
    )
  })

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      {cells}
    </div>
  )
}
