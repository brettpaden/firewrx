import { useEffect, useState } from 'react'
import { TRACK_HEIGHT, CUES_PER_AREA } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'

const stopBubble = (e) => e.stopPropagation()

export default function TrackControls({ clip }) {
  const { device, area, cue } = clip
  const showSettings = useShowStore((s) => s.showSettings)
  const updateClipAssignment = useShowStore((s) => s.updateClipAssignment)
  const selectClip = useShowStore((s) => s.selectClip)
  const selected = useShowStore((s) => s.selectedClipId === clip.id)
  const maxArea = showSettings.areasPerDevice[device - 1] ?? 99

  const [draft, setDraft] = useState({
    device: String(device),
    area: String(area),
    cue: String(cue),
  })

  useEffect(() => {
    setDraft({ device: String(device), area: String(area), cue: String(cue) })
  }, [device, area, cue])

  const rows = [
    { label: 'Device', field: 'device', min: 1, max: showSettings.deviceCount },
    { label: 'Area', field: 'area', min: 1, max: maxArea },
    { label: 'Cue', field: 'cue', min: 1, max: CUES_PER_AREA },
  ]

  const commit = (field) => {
    updateClipAssignment(clip.id, { [field]: Number(draft[field]) })
  }

  return (
    <div
      className="track-controls"
      style={{
        height: TRACK_HEIGHT,
        background: clip.trackIndex % 2 ? 'var(--panel)' : 'var(--panel-2)',
        outline: selected ? '2px solid var(--accent)' : undefined,
        outlineOffset: -2,
      }}
      onPointerDown={stopBubble}
      onClick={(e) => {
        stopBubble(e)
        selectClip(clip.id)
      }}
    >
      {rows.map(({ label, field, min, max }) => (
        <label key={field} className="track-control-row">
          <span className="track-control-label">{label}</span>
          <input
            type="number"
            className="track-control-input"
            min={min}
            max={max}
            value={draft[field]}
            onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
            onBlur={() => commit(field)}
            onKeyDown={(e) => e.key === 'Enter' && commit(field)}
          />
        </label>
      ))}
    </div>
  )
}
