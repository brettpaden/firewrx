import { useRef, useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { TYPE_COLORS, TRACK_HEIGHT, TRACK_CONTROLS_WIDTH } from './constants.js'
import { remainingQty } from './inventory.js'
import { useShowStore } from './store/useShowStore.js'
import { useClipCueFlashes } from './useClipCueFlashes.js'
import InventoryPanel from './components/InventoryPanel.jsx'
import Timeline from './components/Timeline.jsx'
import Transport from './components/Transport.jsx'
import SettingsModal from './components/SettingsModal.jsx'

export default function App() {
  const wsRef = useRef(null) // the shared wavesurfer instance
  const [activeDrag, setActiveDrag] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const addClip = useShowStore((s) => s.addClip)
  const moveClip = useShowStore((s) => s.moveClip)
  const removeClip = useShowStore((s) => s.removeClip)
  const selectedClipId = useShowStore((s) => s.selectedClipId)
  const clearSelection = useShowStore((s) => s.clearSelection)
  const pxPerSec = useShowStore((s) => s.pxPerSec)

  useClipCueFlashes()

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return
      if (document.activeElement?.isContentEditable) return

      if (e.code === 'Space') {
        if (!useShowStore.getState().audioUrl || settingsOpen) return
        e.preventDefault()
        wsRef.current?.playPause()
        return
      }

      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (selectedClipId == null) return
      e.preventDefault()
      removeClip(selectedClipId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedClipId, removeClip, settingsOpen])

  // A few px of movement before a drag starts, so plain clicks still seek.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragStart = ({ active }) => {
    const data = active.data.current
    setActiveDrag(data)
    useShowStore.getState().setDragKind(data?.kind ?? null)
  }

  const onDragEnd = ({ active, over, delta }) => {
    const data = active.data.current
    setActiveDrag(null)
    useShowStore.getState().setDragKind(null)

    if (data?.kind === 'inventory' && over?.id === 'timeline') {
      const { clips } = useShowStore.getState()
      if (remainingQty(data.firework, clips) <= 0) return

      const dropLeft = active.rect.current.translated?.left ?? 0
      const dropTop = active.rect.current.translated?.top ?? 0
      const dropHeight = active.rect.current.translated?.height ?? 0
      const startSec = (dropLeft - over.rect.left - TRACK_CONTROLS_WIDTH) / pxPerSec
      const relativeY = dropTop + dropHeight / 2 - over.rect.top
      const row = relativeY / TRACK_HEIGHT
      let insertIndex = Math.floor(row)
      // Lower half of a row → insert below that track (don't push existing clip down).
      if (insertIndex < clips.length && row - insertIndex > 0.5) insertIndex += 1
      insertIndex = Math.max(0, Math.min(insertIndex, clips.length))
      addClip({ firework: data.firework, startSec, insertIndex })
    } else if (data?.kind === 'clip') {
      moveClip(data.clipId, data.startSec + delta.x / pxPerSec)
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel)',
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          <span>
            🎆 Firewrx <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— Show Creator (POC)</span>
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--panel-2)',
              borderRadius: 6,
              padding: '6px 12px',
              color: 'var(--text, #ddd)',
            }}
          >
            ⚙ Settings
          </button>
        </header>

        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <InventoryPanel />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <Transport wsRef={wsRef} />
            <Timeline wsRef={wsRef} onBackgroundClick={clearSelection} />
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
