import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_PX_PER_SEC,
  MIN_PX_PER_SEC,
  MAX_PX_PER_SEC,
  ZOOM_STEP,
  DEFAULT_DEVICE_COUNT,
  DEFAULT_AREAS_PER_DEVICE,
  CUES_PER_AREA,
  MIN_DEVICE_COUNT,
  MAX_DEVICE_COUNT,
  MIN_AREAS_PER_DEVICE,
  MAX_AREAS_PER_DEVICE,
} from '../constants.js'

const clampZoom = (v) => Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, v))

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || min)))

// areasPerDevice may be a legacy single number or a per-device array.
const normalizeAreasPerDevice = (areasPerDevice, deviceCount) => {
  if (typeof areasPerDevice === 'number') {
    const n = clampInt(areasPerDevice, MIN_AREAS_PER_DEVICE, MAX_AREAS_PER_DEVICE)
    return Array.from({ length: deviceCount }, () => n)
  }
  const source = Array.isArray(areasPerDevice) ? areasPerDevice : []
  const out = []
  for (let i = 0; i < deviceCount; i++) {
    out.push(clampInt(source[i] ?? DEFAULT_AREAS_PER_DEVICE, MIN_AREAS_PER_DEVICE, MAX_AREAS_PER_DEVICE))
  }
  return out
}

const clampSettings = ({ deviceCount, areasPerDevice }) => {
  const count = clampInt(deviceCount, MIN_DEVICE_COUNT, MAX_DEVICE_COUNT)
  return {
    deviceCount: count,
    areasPerDevice: normalizeAreasPerDevice(areasPerDevice, count),
  }
}

const maxAreasForDevice = (settings, device) =>
  settings.areasPerDevice[clampInt(device, 1, settings.deviceCount) - 1] ?? DEFAULT_AREAS_PER_DEVICE

// Next device/area/cue for a newly placed clip: increment cue from the last track,
// rolling area then device when cue or area overflows show limits.
const computeNextAssignment = (clips, settings) => {
  if (clips.length === 0) return { device: 1, area: 1, cue: 1 }

  const last = clips[clips.length - 1]
  let device = last.device ?? 1
  let area = last.area ?? 1
  let cue = (last.cue ?? 1) + 1

  if (cue > CUES_PER_AREA) {
    cue = 1
    area += 1
    const maxArea = maxAreasForDevice(settings, device)
    if (area > maxArea) {
      area = 1
      device += 1
      if (device > settings.deviceCount) return null
    }
  }

  return { device, area, cue }
}

const clampAssignment = (clip, settings) => {
  const device = clampInt(clip.device ?? 1, 1, settings.deviceCount)
  return {
    device,
    area: clampInt(clip.area ?? 1, 1, maxAreasForDevice(settings, device)),
    cue: clampInt(clip.cue ?? 1, 1, CUES_PER_AREA),
  }
}

const defaultShowSettings = () => ({
  deviceCount: DEFAULT_DEVICE_COUNT,
  areasPerDevice: normalizeAreasPerDevice(null, DEFAULT_DEVICE_COUNT),
})

const persistableAudioUrl = (url) =>
  typeof url === 'string' && url.startsWith('/uploads/show-audio.') ? url : null

let clipSeq = 0

const syncClipSeq = (clips) => {
  clipSeq = clips.reduce((max, c) => Math.max(max, c.id ?? 0), 0)
}

const normalizeClips = (clips, showSettings) =>
  (clips ?? []).map((clip, i) => {
    const base = {
      id: clip.id ?? ++clipSeq,
      firework: clip.firework,
      startSec: Math.max(0, Number(clip.startSec) || 0),
      trackIndex: Number.isFinite(clip.trackIndex) ? clip.trackIndex : i,
      device: clip.device,
      area: clip.area,
      cue: clip.cue,
    }
    return { ...base, ...clampAssignment(base, showSettings) }
  })

// Show state persists to localStorage across refreshes. Show MP3 is stored on the
// server under uploads/show-audio.*; inventory stays in SQLite.
export const useShowStore = create(
  persist(
    (set, get) => ({
      clips: [], // { id, firework, startSec, trackIndex, device, area, cue }

      assignmentError: null,
      clearAssignmentError: () => set({ assignmentError: null }),

      selectedClipId: null,
      selectClip: (id) => set({ selectedClipId: id }),
      clearSelection: () => set({ selectedClipId: null }),

      dragKind: null, // 'inventory' | 'clip' — active dnd source
      setDragKind: (dragKind) => set({ dragKind }),

      clipFlashCounters: {},
      flashClip: (id) =>
        set((s) => ({
          clipFlashCounters: {
            ...s.clipFlashCounters,
            [id]: (s.clipFlashCounters[id] ?? 0) + 1,
          },
        })),

      showSettings: defaultShowSettings(),

      setShowSettings: (next) =>
        set((s) => {
          const showSettings = clampSettings({ ...s.showSettings, ...next })
          return {
            showSettings,
            clips: s.clips.map((c) => ({ ...c, ...clampAssignment(c, showSettings) })),
          }
        }),

      addClip: ({ firework, startSec, insertIndex }) => {
        const s = get()
        const assignment = computeNextAssignment(s.clips, s.showSettings)
        if (!assignment) {
          set({
            assignmentError:
              'Not enough cues available. Add more devices or areas in Settings.',
          })
          return false
        }
        const idx = Math.max(0, Math.min(insertIndex ?? s.clips.length, s.clips.length))
        const clips = [...s.clips]
        clips.splice(idx, 0, {
          id: ++clipSeq,
          firework,
          startSec: Math.max(0, startSec),
          ...assignment,
        })
        set({
          assignmentError: null,
          clips: clips.map((c, i) => ({ ...c, trackIndex: i })),
        })
        return true
      },

      moveClip: (id, startSec) =>
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === id ? { ...c, startSec: Math.max(0, startSec) } : c,
          ),
        })),

      updateClipAssignment: (id, fields) =>
        set((s) => {
          const settings = s.showSettings
          const clip = s.clips.find((c) => c.id === id)
          if (!clip) return s
          const merged = { ...clip, ...fields }
          return {
            clips: s.clips.map((c) =>
              c.id === id ? { ...c, ...clampAssignment(merged, settings) } : c,
            ),
          }
        }),

      removeClip: (id) =>
        set((s) => ({
          clips: s.clips
            .filter((c) => c.id !== id)
            .map((c, i) => ({ ...c, trackIndex: i })),
          selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
        })),

      patchClipsForFirework: (fireworkId, fields) =>
        set((s) => ({
          clips: s.clips.map((c) =>
            c.firework.id === fireworkId
              ? { ...c, firework: { ...c.firework, ...fields } }
              : c,
          ),
        })),

      syncClipFireworks: (fireworks) => {
        const byId = new Map(fireworks.map((fw) => [fw.id, fw]))
        set((s) => ({
          clips: s.clips.map((c) => {
            const latest = byId.get(c.firework.id)
            if (!latest?.video_url) return c
            return {
              ...c,
              firework: {
                ...c.firework,
                type: latest.type,
                trim_start: latest.trim_start,
                trim_end: latest.trim_end,
                duration_sec: latest.duration_sec,
                video_url: latest.video_url,
              },
            }
          }),
        }))
      },

      exportShow: () => {
        const { clips, audioUrl, duration, showSettings } = get()
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            showSettings,
            audioUrl,
            duration,
            clips: clips.map(({ id, firework, startSec, trackIndex, device, area, cue }) => ({
              firework,
              startSec,
              trackIndex,
              device,
              area,
              cue,
            })),
          },
          null,
          2,
        )
      },

      importShow: (json) => {
        let data
        try {
          data = typeof json === 'string' ? JSON.parse(json) : json
        } catch {
          throw new Error('Invalid show file')
        }
        if (!data || !Array.isArray(data.clips)) {
          throw new Error('Invalid show file: missing clips')
        }

        const raw = data.showSettings ?? {}
        const showSettings = clampSettings({
          deviceCount: raw.deviceCount ?? DEFAULT_DEVICE_COUNT,
          areasPerDevice: raw.areasPerDevice ?? DEFAULT_AREAS_PER_DEVICE,
        })

        clipSeq = 0
        const clips = normalizeClips(data.clips, showSettings)
        syncClipSeq(clips)

        set({
          clips,
          showSettings,
          audioUrl: persistableAudioUrl(data.audioUrl) ?? null,
          duration: Number(data.duration) || 0,
          currentTime: 0,
          isPlaying: false,
        })
      },

      audioUrl: null,
      setAudioUrl: (audioUrl) => set({ audioUrl }),

      duration: 0,
      setDuration: (duration) => set({ duration }),

      currentTime: 0,
      setCurrentTime: (currentTime) => set({ currentTime }),

      isPlaying: false,
      setIsPlaying: (isPlaying) => set({ isPlaying }),

      pxPerSec: DEFAULT_PX_PER_SEC,
      setPxPerSec: (pxPerSec) => set({ pxPerSec: clampZoom(pxPerSec) }),
      zoomIn: () => set((s) => ({ pxPerSec: clampZoom(s.pxPerSec * ZOOM_STEP) })),
      zoomOut: () => set((s) => ({ pxPerSec: clampZoom(s.pxPerSec / ZOOM_STEP) })),

      inventoryNotes: {},

      setInventoryNote: (key, note) =>
        set((s) => {
          const trimmed = note.trim()
          if (!trimmed) {
            const { [key]: _removed, ...rest } = s.inventoryNotes
            return { inventoryNotes: rest }
          }
          return { inventoryNotes: { ...s.inventoryNotes, [key]: trimmed } }
        }),
    }),
    {
      name: 'firewrx-show',
      partialize: (state) => ({
        clips: state.clips,
        showSettings: state.showSettings,
        pxPerSec: state.pxPerSec,
        audioUrl: persistableAudioUrl(state.audioUrl),
        inventoryNotes: state.inventoryNotes,
      }),
      merge: (persisted, current) => {
        const saved = persisted ?? {}
        const showSettings = clampSettings(saved.showSettings ?? current.showSettings)
        const clips = normalizeClips(saved.clips, showSettings)
        syncClipSeq(clips)
        return {
          ...current,
          showSettings,
          clips,
          pxPerSec: clampZoom(saved.pxPerSec ?? current.pxPerSec),
          audioUrl: persistableAudioUrl(saved.audioUrl) ?? current.audioUrl,
          inventoryNotes: saved.inventoryNotes ?? current.inventoryNotes ?? {},
        }
      },
    },
  ),
)
