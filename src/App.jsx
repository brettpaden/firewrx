import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { PX_PER_SEC, TYPE_COLORS } from './constants.js'
import { useShowStore } from './store/useShowStore.js'
import InventoryPanel from './components/InventoryPanel.jsx'
import Timeline from './components/Timeline.jsx'
import Transport from './components/Transport.jsx'

export default function App() {
  const wsRef = useRef(null) // the shared wavesurfer instance
  const [activeDrag, setActiveDrag] = useState(null)
  const addClip = useShowStore((s) => s.addClip)
  const moveClip = useShowStore((s) => s.moveClip)

  // A few px of movement before a drag starts, so plain clicks still seek.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragStart = ({ active }) => setActiveDrag(active.data.current)

  const onDragEnd = ({ active, over, delta }) => {
    const data = active.data.current
    setActiveDrag(null)

    if (data?.kind === 'inventory' && over?.id === 'timeline') {
      // Drop position → start time: left edge of the dragged chip relative to the
      // tracks area's left edge (both in client coords, so scroll is accounted for).
      const dropLeft = active.rect.current.translated?.left ?? 0
      const startSec = (dropLeft - over.rect.left) / PX_PER_SEC
      addClip({ firework: data.firework, startSec })
    } else if (data?.kind === 'clip') {
      moveClip(data.clipId, data.startSec + delta.x / PX_PER_SEC)
    }
  }

  // Constrain clip drags to horizontal; inventory drags move freely onto the timeline.
  const modifiers = activeDrag?.kind === 'clip' ? [restrictToHorizontalAxis] : []

  return (
    <DndContext
      sensors={sensors}
      modifiers={modifiers}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel)',
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          🎆 Firewrx <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— Show Creator (POC)</span>
        </header>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <InventoryPanel />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <Transport wsRef={wsRef} />
            <Timeline wsRef={wsRef} />
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrag?.kind === 'inventory' ? (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: `1px solid ${TYPE_COLORS[activeDrag.firework.type] ?? '#888'}`,
              background: 'var(--panel-2)',
              fontSize: 13,
            }}
          >
            {activeDrag.firework.name} · {activeDrag.firework.duration_sec}s
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
