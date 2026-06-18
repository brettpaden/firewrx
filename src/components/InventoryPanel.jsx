import { useEffect, useState } from 'react'
import { getFireworks } from '../api.js'
import InventoryItem from './InventoryItem.jsx'

export default function InventoryPanel() {
  const [fireworks, setFireworks] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    getFireworks().then(setFireworks).catch((e) => setError(e.message))
  }, [])

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
      {error && <p style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</p>}
      {fireworks.map((fw) => (
        <InventoryItem key={fw.id} firework={fw} />
      ))}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
        Drag an item onto the timeline →
      </p>
    </aside>
  )
}
