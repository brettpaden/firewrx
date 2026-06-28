import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { TYPE_COLORS } from '../constants.js'
import { countPlaced, inventoryNoteKey, remainingQty } from '../inventory.js'
import { useShowStore } from '../store/useShowStore.js'
import InventoryNoteModal from './InventoryNoteModal.jsx'

export default function InventoryItem({ firework, onDelete, onTrim }) {
  const [expanded, setExpanded] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const clips = useShowStore((s) => s.clips)
  const noteKey = inventoryNoteKey(firework)
  const note = useShowStore((s) => s.inventoryNotes[noteKey] ?? '')
  const setInventoryNote = useShowStore((s) => s.setInventoryNote)
  const placed = countPlaced(clips, firework.id)
  const remaining = remainingQty(firework, clips)
  const total = Math.max(1, firework.quantity ?? 1)
  const hasVideo = !!firework.video_url
  const depleted = remaining <= 0
  const draggable = remaining > 0

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inv-${firework.id}`,
    data: { kind: 'inventory', firework },
    disabled: !draggable,
  })

  const typeLabel = firework.type

  const toggleExpand = (e) => {
    if (e.target.closest('button')) return
    setExpanded((v) => !v)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        onClick={toggleExpand}
        className="inventory-item"
        title={
          expanded
            ? 'Click to collapse'
            : depleted
              ? 'All units placed on timeline'
              : placed > 0
                ? `${remaining} of ${total} remaining`
                : 'Click to expand name'
        }
        style={{
          background: depleted ? 'var(--panel)' : undefined,
          opacity: depleted ? 0.45 : isDragging ? 0.4 : 1,
        }}
      >
        <span
          className="inventory-type-dot"
          style={{
            background: depleted ? 'var(--muted)' : (TYPE_COLORS[firework.type] ?? '#888'),
          }}
        />
        <div
          {...(draggable ? listeners : {})}
          {...(draggable ? attributes : {})}
          style={{
            flex: 1,
            minWidth: 0,
            cursor: draggable ? 'grab' : 'pointer',
            display: 'flex',
            flexDirection: expanded ? 'column' : 'row',
            alignItems: expanded ? 'stretch' : 'center',
            gap: expanded ? 6 : 8,
          }}
        >
          <span
            style={{
              flex: expanded ? undefined : 1,
              fontSize: 13,
              lineHeight: 1.4,
              overflow: expanded ? 'visible' : 'hidden',
              textOverflow: expanded ? undefined : 'ellipsis',
              whiteSpace: expanded ? 'normal' : 'nowrap',
              wordBreak: expanded ? 'break-word' : undefined,
            }}
          >
            {firework.name}
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              alignSelf: expanded ? 'flex-start' : undefined,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {typeLabel} · {firework.duration_sec}s
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: depleted ? 'var(--muted)' : 'var(--text, #ddd)',
                minWidth: 28,
                textAlign: 'right',
              }}
            >
              ×{remaining}
            </span>
          </span>
        </div>
        <div className="inventory-item-actions">
          {hasVideo && firework.source === 'inventory' && onTrim && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTrim(firework)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Trim video"
              aria-label={`Trim ${firework.name}`}
              className="inventory-icon-btn"
            >
              ✂
            </button>
          )}
          {onDelete && firework.source !== 'inventory' && (
            <button
              onClick={() => onDelete(firework.id)}
              onPointerDown={(e) => e.stopPropagation()}
              title="Remove from inventory"
              aria-label={`Remove ${firework.name}`}
              className="inventory-icon-btn"
              style={{ fontSize: 13 }}
            >
              ×
            </button>
          )}
          <button
            type="button"
            className="inventory-icon-btn inventory-note-btn"
            onClick={(e) => {
              e.stopPropagation()
              setNoteOpen(true)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Note"
            aria-label={`Note for ${firework.name}`}
          >
            ✎
          </button>
        </div>
      </div>

      {noteOpen && (
        <InventoryNoteModal
          firework={firework}
          initialNote={note}
          onClose={() => setNoteOpen(false)}
          onSave={(text) => setInventoryNote(noteKey, text)}
        />
      )}
    </>
  )
}
