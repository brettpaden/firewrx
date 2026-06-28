import { useEffect, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { TYPE_COLORS, TRACK_HEIGHT } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'
import Filmstrip from './Filmstrip.jsx'

const stopDrag = (e) => e.stopPropagation()

// A placed firework. Width encodes duration (duration × pxPerSec); left encodes
// start time. Horizontally draggable to reposition (see App's onDragEnd).
export default function Clip({ clip }) {
  const { firework, startSec } = clip
  const pxPerSec = useShowStore((s) => s.pxPerSec)
  const flashTick = useShowStore((s) => s.clipFlashCounters[clip.id] ?? 0)
  const removeClip = useShowStore((s) => s.removeClip)
  const selectClip = useShowStore((s) => s.selectClip)
  const selected = useShowStore((s) => s.selectedClipId === clip.id)
  const inventoryDragging = useShowStore((s) => s.dragKind === 'inventory')
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `clip-${clip.id}`,
    data: { kind: 'clip', clipId: clip.id, startSec },
    disabled: inventoryDragging,
  })

  const width = firework.duration_sec * pxPerSec
  const color = TYPE_COLORS[firework.type] ?? '#888'
  const isVideo = !!firework.video_url

  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (!flashTick) return undefined
    setFlashing(true)
    const timer = setTimeout(() => setFlashing(false), 150)
    return () => clearTimeout(timer)
  }, [flashTick])

  return (
    <div
      ref={setNodeRef}
      data-clip
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        selectClip(clip.id)
      }}
      style={{
        position: 'absolute',
        left: startSec * pxPerSec,
        top: 4,
        height: TRACK_HEIGHT - 8,
        width,
        transform: transform ? `translateX(${transform.x}px)` : undefined,
        background: isVideo ? '#0c0f14' : `${color}33`,
        border: selected ? `2px solid ${color}` : `1px solid ${color}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: isVideo ? 0 : '8px 10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: isDragging || selected ? 10 : 1,
        boxShadow: isDragging
          ? '0 4px 12px rgba(0,0,0,0.4)'
          : selected
            ? `0 0 0 1px ${color}55`
            : 'none',
      }}
    >
      {flashing && <div className="clip-cue-flash" aria-hidden />}
      {isVideo ? (
        <>
          <Filmstrip firework={firework} width={width} />
          <span
            className="clip-label-name"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '8px 10px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {firework.name}
          </span>
        </>
      ) : (
        <>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: color,
              flexShrink: 0,
            }}
          />
          <span className="clip-label-name">{firework.name}</span>
        </>
      )}

      <button
        onPointerDown={stopDrag}
        onClick={(e) => {
          e.stopPropagation()
          removeClip(clip.id)
        }}
        title="Remove clip from timeline"
        aria-label={`Remove ${firework.name} from timeline`}
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 20,
          height: 20,
          lineHeight: '18px',
          padding: 0,
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 13,
          zIndex: 5,
        }}
      >
        ×
      </button>
    </div>
  )
}
