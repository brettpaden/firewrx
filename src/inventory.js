export function countPlaced(clips, fireworkId) {
  return clips.filter((c) => c.firework.id === fireworkId).length
}

export function remainingQty(firework, clips) {
  const total = Math.max(1, firework.quantity ?? 1)
  return Math.max(0, total - countPlaced(clips, firework.id))
}

export function inventoryNoteKey(firework) {
  return `${firework.source ?? 'inventory'}:${firework.id}`
}
