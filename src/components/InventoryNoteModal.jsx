import { useEffect, useState } from 'react'

export default function InventoryNoteModal({ firework, initialNote, onClose, onSave }) {
  const [text, setText] = useState(initialNote ?? '')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    onSave(text)
    onClose()
  }

  return (
    <div
      className="inventory-note-backdrop"
      onClick={onClose}
    >
      <div
        className="inventory-note-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="inventory-note-title"
      >
        <h3 id="inventory-note-title" className="inventory-note-title">
          Note
        </h3>
        <p className="inventory-note-subtitle">{firework.name}</p>
        <textarea
          className="inventory-note-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note…"
          rows={6}
          autoFocus
        />
        <div className="inventory-note-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
