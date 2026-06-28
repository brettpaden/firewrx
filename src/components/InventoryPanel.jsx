import { useEffect, useRef, useState } from 'react'
import { getFireworks, uploadFirework, deleteFirework, readVideoDuration } from '../api.js'
import InventoryItem from './InventoryItem.jsx'
import VideoTrimModal from './VideoTrimModal.jsx'
import { useShowStore } from '../store/useShowStore.js'

export default function InventoryPanel() {
  const [fireworks, setFireworks] = useState([])
  const [error, setError] = useState(null)
  const [trimTarget, setTrimTarget] = useState(null)
  const patchClipsForFirework = useShowStore((s) => s.patchClipsForFirework)
  const syncClipFireworks = useShowStore((s) => s.syncClipFireworks)

  // Pending upload (a file has been picked and is awaiting a name/confirmation).
  const [pending, setPending] = useState(null) // { file, name, durationSec }
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getFireworks()
      .then((list) => {
        setFireworks(list)
        syncClipFireworks(list)
      })
      .catch((e) => setError(e.message))
  }, [syncClipFireworks])

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    setError(null)
    const durationSec = await readVideoDuration(file)
    setPending({ file, name: file.name.replace(/\.[^.]+$/, ''), durationSec })
  }

  const confirmUpload = async () => {
    if (!pending || !pending.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await uploadFirework({
        file: pending.file,
        name: pending.name.trim(),
        durationSec: pending.durationSec || 10,
      })
      const list = await getFireworks()
      setFireworks(list)
      setPending(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id) => {
    const prev = fireworks
    setFireworks((list) => list.filter((fw) => fw.id !== id)) // optimistic
    try {
      await deleteFirework(id)
    } catch (err) {
      setError(err.message)
      setFireworks(prev) // roll back
    }
  }

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--panel)',
        padding: 12,
        overflowY: 'auto',
      }}
    >
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>
        Inventory
      </h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,.mp4"
        onChange={onPickFile}
        style={{ display: 'none' }}
      />

      {!pending && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: 10,
            borderRadius: 6,
            border: '1px dashed var(--border)',
            background: 'var(--panel-2)',
            color: 'var(--text, #ddd)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + Upload MP4
        </button>
      )}

      {pending && (
        <div
          style={{
            padding: 10,
            marginBottom: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--panel-2)',
          }}
        >
          <label style={{ fontSize: 11, color: 'var(--muted)' }}>Name</label>
          <input
            type="text"
            value={pending.name}
            autoFocus
            onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && confirmUpload()}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              margin: '4px 0 8px',
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text, #eee)',
              fontSize: 13,
            }}
          />
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px' }}>
            {pending.file.name} · {pending.durationSec || '?'}s
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={confirmUpload}
              disabled={busy || !pending.name.trim()}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: '#2ecc71',
                color: '#06281a',
                fontWeight: 600,
                fontSize: 12,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy || !pending.name.trim() ? 0.6 : 1,
              }}
            >
              {busy ? 'Uploading…' : 'Add'}
            </button>
            <button
              onClick={() => setPending(null)}
              disabled={busy}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text, #ddd)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</p>}

      {trimTarget && (
        <VideoTrimModal
          firework={trimTarget}
          onClose={() => setTrimTarget(null)}
          onSaved={async (result) => {
            const list = await getFireworks()
            setFireworks(list)
            patchClipsForFirework(trimTarget.id, {
              trim_start: result.trim_start,
              trim_end: result.trim_end,
              duration_sec: result.duration_sec,
            })
          }}
        />
      )}

      {fireworks.map((fw) => (
        <InventoryItem
          key={fw.id}
          firework={fw}
          onDelete={onDelete}
          onTrim={setTrimTarget}
        />
      ))}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
        Drag an item onto the timeline →
      </p>
    </aside>
  )
}
