import { create } from 'zustand'

let clipSeq = 0

// In-memory show state (POC: not persisted). Inventory comes from SQLite via the
// API; everything below — placed clips, the loaded MP3, and playback state — lives
// only here and resets on reload.
export const useShowStore = create((set) => ({
  clips: [], // { id, firework, startSec, trackIndex }

  // Each dropped firework gets its own track (trackIndex = current clip count).
  addClip: ({ firework, startSec }) =>
    set((s) => ({
      clips: [
        ...s.clips,
        {
          id: ++clipSeq,
          firework,
          startSec: Math.max(0, startSec),
          trackIndex: s.clips.length,
        },
      ],
    })),

  moveClip: (id, startSec) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, startSec: Math.max(0, startSec) } : c,
      ),
    })),

  // Audio / playback (wavesurfer is the source of truth; these mirror it for the UI).
  audioUrl: null,
  setAudioUrl: (audioUrl) => set({ audioUrl }),

  duration: 0,
  setDuration: (duration) => set({ duration }),

  currentTime: 0,
  setCurrentTime: (currentTime) => set({ currentTime }),

  isPlaying: false,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
}))
