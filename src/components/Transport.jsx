import { useRef, useState, useEffect } from 'react'
import { useShowStore } from '../store/useShowStore.js'
import { MIN_PX_PER_SEC, MAX_PX_PER_SEC } from '../constants.js'
import { seekToTime } from '../audioClock.js'
import { getShowAudio, isPersistedAudioUrl, uploadShowAudio } from '../api.js'
import ShowPreview from './ShowPreview.jsx'

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
  const pxPerSec = useShowStore((s) => s.pxPerSec)
  const setPxPerSec = useShowStore((s) => s.setPxPerSec)
  const zoomIn = useShowStore((s) => s.zoomIn)
  const zoomOut = useShowStore((s) => s.zoomOut)
  const exportShow = useShowStore((s) => s.exportShow)
  const importShow = useShowStore((s) => s.importShow)
  const clips = useShowStore((s) => s.clips)
  const assignmentError = useShowStore((s) => s.assignmentError)
  const clearAssignmentError = useShowStore((s) => s.clearAssignmentError)

  const showInputRef = useRef(null)
  const [showDialog, setShowDialog] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fileName, setFileName] = useState('my-show')
  const [importError, setImportError] = useState(null)
  const [audioError, setAudioError] = useState(null)

  const videoClipCount = clips.filter((c) => c.firework.video_url).length
  const canPreview = !!audioUrl && videoClipCount > 0

  const setCurrentTime = useShowStore((s) => s.setCurrentTime)
  const setIsPlaying = useShowStore((s) => s.setIsPlaying)

  // Restore show audio from server when localStorage has no persisted path.
  useEffect(() => {
    const current = useShowStore.getState().audioUrl
    if (current && isPersistedAudioUrl(current)) return
    getShowAudio()
      .then((data) => {
        if (data?.url) useShowStore.getState().setAudioUrl(data.url)
      })
      .catch(() => {})
  }, [])

  const onStop = () => {
    const ws = wsRef.current
    if (ws) {
      ws.pause()
      seekToTime(ws, 0)
    } else {
      setCurrentTime(0)
      setIsPlaying(false)
    }
  }

  const onPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAudioError(null)
    try {
      const { url } = await uploadShowAudio(file)
      setAudioUrl(url)
    } catch (err) {
      setAudioError(err.message || 'Failed to upload audio')
    }
  }

  const downloadShow = () => {
    const base = (fileName.trim() || 'my-show').replace(/\.show$/i, '')
    const blob = new Blob([exportShow()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${base}.show`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setShowDialog(false)
  }

  const onPickShow = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    try {
      const text = await file.text()
      importShow(text)
    } catch (err) {
      setImportError(err.message || 'Failed to import show')
    }
  }

  const fileBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--panel-2)',
    borderRadius: 6,
    padding: '6px 12px',
  }

  const zoomBtn = {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--panel-2)',
    color: 'var(--text, #ddd)',
    cursor: 'pointer',
    fontSize: 15,
    lineHeight: '24px',
    padding: 0,
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

      <button onClick={onStop} title="Stop and return to start" style={{ minWidth: 72 }}>
        ⏹ Stop
      </button>

      <button
        onClick={() => setPreviewOpen(true)}
        disabled={!canPreview}
        title={
          !audioUrl
            ? 'Upload an MP3 first'
            : videoClipCount === 0
              ? 'Add video clips to the timeline'
              : 'Preview composited show'
        }
        style={{ minWidth: 108 }}
      >
        ▶ Preview Show
      </button>

      {previewOpen && <ShowPreview wsRef={wsRef} onClose={() => setPreviewOpen(false)} />}

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
      {importError && (
        <span style={{ fontSize: 12, color: '#ff6b6b' }}>{importError}</span>
      )}
      {audioError && (
        <span style={{ fontSize: 12, color: '#ff6b6b' }}>{audioError}</span>
      )}
      {assignmentError && (
        <span style={{ fontSize: 12, color: '#ff6b6b' }}>
          {assignmentError}
          <button
            onClick={clearAssignmentError}
            style={{
              marginLeft: 8,
              padding: '0 6px',
              fontSize: 11,
              lineHeight: '18px',
              verticalAlign: 'middle',
            }}
          >
            ×
          </button>
        </span>
      )}

      <input
        ref={showInputRef}
        type="file"
        accept=".show,application/json"
        onChange={onPickShow}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => showInputRef.current?.click()}
        style={{ ...fileBtn, marginLeft: 'auto' }}
      >
        ⤒ Upload Show
      </button>

      <button
        onClick={() => setShowDialog(true)}
        style={fileBtn}
      >
        ⤓ Download Show
      </button>

      {showDialog && (
        <DownloadDialog
          fileName={fileName}
          setFileName={setFileName}
          onConfirm={downloadShow}
          onCancel={() => setShowDialog(false)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Zoom</span>
        <button onClick={zoomOut} title="Zoom out" style={zoomBtn}>−</button>
        <input
          type="range"
          min={MIN_PX_PER_SEC}
          max={MAX_PX_PER_SEC}
          step={1}
          value={pxPerSec}
          onChange={(e) => setPxPerSec(Number(e.target.value))}
          style={{ width: 140 }}
        />
        <button onClick={zoomIn} title="Zoom in" style={zoomBtn}>+</button>
      </div>
    </div>
  )
}

// Modal asking the user to name the show before it downloads as `<name>.show`.
function DownloadDialog({ fileName, setFileName, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 18,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Download Show</h3>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>File name</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 16px' }}>
          <input
            type="text"
            value={fileName}
            autoFocus
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm()
              if (e.key === 'Escape') onCancel()
            }}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--panel-2)',
              color: 'var(--text, #eee)',
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>.show</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--panel-2)',
              color: 'var(--text, #ddd)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!fileName.trim()}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: '#2ecc71',
              color: '#06281a',
              fontWeight: 600,
              cursor: fileName.trim() ? 'pointer' : 'default',
              opacity: fileName.trim() ? 1 : 0.6,
              fontSize: 13,
            }}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )
}
