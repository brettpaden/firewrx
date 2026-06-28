import { useState } from 'react'
import { useShowStore } from '../store/useShowStore.js'
import { CUES_PER_AREA, DEFAULT_AREAS_PER_DEVICE } from '../constants.js'

const resizeAreas = (areas, deviceCount) => {
  const next = [...areas]
  while (next.length < deviceCount) next.push(DEFAULT_AREAS_PER_DEVICE)
  return next.slice(0, deviceCount)
}

export default function SettingsModal({ onClose }) {
  const showSettings = useShowStore((s) => s.showSettings)
  const setShowSettings = useShowStore((s) => s.setShowSettings)

  const [deviceCount, setDeviceCount] = useState(String(showSettings.deviceCount))
  const [areasPerDevice, setAreasPerDevice] = useState([...showSettings.areasPerDevice])

  const parsedDeviceCount = Math.max(1, Math.round(Number(deviceCount) || 1))

  const onDeviceCountChange = (value) => {
    setDeviceCount(value)
    const count = Math.max(1, Math.round(Number(value) || 1))
    setAreasPerDevice((prev) => resizeAreas(prev, count))
  }

  const setAreasForDevice = (index, value) => {
    setAreasPerDevice((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const save = () => {
    setShowSettings({
      deviceCount: Number(deviceCount),
      areasPerDevice: areasPerDevice.map((v) => Number(v)),
    })
    onClose()
  }

  const field = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--panel-2)',
    color: 'var(--text, #eee)',
    fontSize: 13,
  }

  const smallField = {
    ...field,
    width: 72,
    padding: '6px 8px',
  }

  return (
    <div
      onClick={onClose}
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
          width: 400,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 18,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Show Settings</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--muted)' }}>
          Each device has its own area count; every area supports {CUES_PER_AREA} cues.
        </p>

        <label style={{ fontSize: 12, color: 'var(--muted)' }}>Number of devices</label>
        <input
          type="number"
          min={1}
          value={deviceCount}
          onChange={(e) => onDeviceCountChange(e.target.value)}
          style={{ ...field, margin: '4px 0 16px' }}
        />

        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
          Areas per device
        </label>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {resizeAreas(areasPerDevice, parsedDeviceCount).map((areas, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13 }}>Device {i + 1}</span>
              <input
                type="number"
                min={1}
                max={127}
                value={areas}
                onChange={(e) => setAreasForDevice(i, e.target.value)}
                style={smallField}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
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
            onClick={save}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: '#2ecc71',
              color: '#06281a',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
