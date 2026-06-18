export async function getFireworks() {
  const res = await fetch('/api/fireworks')
  if (!res.ok) throw new Error(`GET /api/fireworks failed: ${res.status}`)
  return res.json()
}
