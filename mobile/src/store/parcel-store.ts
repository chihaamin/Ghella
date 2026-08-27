import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import { kvStateStorage } from "@/services/storage"
import type {
  AnalysisProgress,
  LandAnalysis,
  LatLng,
  Parcel,
  SalinityId,
  TextureClass,
  WaterSourceId,
} from "@/types/land"

/**
 * The farmer's parcels, persisted to device storage so mapped land survives a
 * restart. Analyses are cached inside each parcel; the services layer keeps its
 * own HTTP cache underneath, so re-running an analysis after a reload is cheap
 * even when this store was cleared.
 *
 * Kept separate from `app-store` deliberately: app-store is throwaway demo
 * state (which screen, which toggle), this is the farmer's actual data.
 */

export const PARCEL_PALETTE = [
  "#4c8a3a",
  "#1f7fb8",
  "#7a5aa8",
  "#d9a441",
  "#b3402f",
] as const

interface ParcelState {
  parcels: Parcel[]
  selectedParcelId: string | null
  /** Progress of the analysis currently running, keyed by parcel id. */
  analysisProgress: Record<string, AnalysisProgress | undefined>
}

interface ParcelActions {
  addParcel: (input: {
    points: LatLng[]
    areaHa: number
    name?: string
    color?: string
    demo?: boolean
  }) => Parcel
  removeParcel: (id: string) => void
  renameParcel: (id: string, name: string) => void
  recolorParcel: (id: string, color: string) => void
  selectParcel: (id: string | null) => void

  /** Farmer-entered facts — these outrank anything the model inferred. */
  setSoilTexture: (id: string, texture: TextureClass | null) => void
  setWaterSource: (id: string, source: WaterSourceId | null) => void
  setSalinity: (id: string, salinity: SalinityId | null) => void
  setPlannedVariety: (id: string, varietyId: string | null) => void

  analysisStarted: (id: string) => void
  analysisProgressed: (id: string, progress: AnalysisProgress) => void
  analysisFinished: (id: string, analysis: LandAnalysis) => void
  analysisFailed: (id: string, message: string) => void
  /** Owner unmounted mid-flight: back to "idle" so any autorun re-picks it. */
  analysisAborted: (id: string) => void

  clearDemoParcels: () => void
  /** Wipe EVERYTHING — the prototype panel's "Reset demo" full reset. */
  clearAllParcels: () => void
}

let counter = 0
/** Ids must survive reloads uniquely; time + counter is enough offline. */
function newId() {
  return `p_${Date.now().toString(36)}_${(counter++).toString(36)}`
}

export const useParcels = create<ParcelState & ParcelActions>()(
  persist(
    (set, get) => ({
      parcels: [],
      selectedParcelId: null,
      analysisProgress: {},

      addParcel: ({ points, areaHa, name, color, demo = false }) => {
        const existing = get().parcels
        const parcel: Parcel = {
          id: newId(),
          name: name ?? `Parcel ${existing.length + 1}`,
          color: color ?? PARCEL_PALETTE[existing.length % PARCEL_PALETTE.length],
          points,
          areaHa,
          soilTexture: null,
          waterSource: null,
          salinity: null,
          plannedVarietyId: null,
          demo,
          createdAt: new Date().toISOString(),
          analysis: null,
          analysisState: "idle",
          analysisError: null,
        }
        set({ parcels: [...existing, parcel], selectedParcelId: parcel.id })
        return parcel
      },

      removeParcel: (id) =>
        set((s) => ({
          parcels: s.parcels.filter((p) => p.id !== id),
          selectedParcelId:
            s.selectedParcelId === id ? null : s.selectedParcelId,
        })),

      renameParcel: (id, name) => patch(set, id, { name }),
      recolorParcel: (id, color) => patch(set, id, { color }),
      selectParcel: (id) => set({ selectedParcelId: id }),

      setSoilTexture: (id, soilTexture) => patch(set, id, { soilTexture }),
      setWaterSource: (id, waterSource) => patch(set, id, { waterSource }),
      setSalinity: (id, salinity) => patch(set, id, { salinity }),
      setPlannedVariety: (id, plannedVarietyId) =>
        patch(set, id, { plannedVarietyId }),

      analysisStarted: (id) =>
        set((s) => ({
          parcels: s.parcels.map((p) =>
            p.id === id
              ? { ...p, analysisState: "loading" as const, analysisError: null }
              : p
          ),
          analysisProgress: {
            ...s.analysisProgress,
            [id]: { stage: "geometry", progress: 0, label: "" },
          },
        })),

      analysisProgressed: (id, progress) =>
        set((s) => ({
          analysisProgress: { ...s.analysisProgress, [id]: progress },
        })),

      analysisFinished: (id, analysis) =>
        set((s) => ({
          parcels: s.parcels.map((p) =>
            p.id === id
              ? { ...p, analysis, analysisState: "ready" as const }
              : p
          ),
          analysisProgress: { ...s.analysisProgress, [id]: undefined },
        })),

      analysisFailed: (id, message) =>
        set((s) => ({
          parcels: s.parcels.map((p) =>
            p.id === id
              ? { ...p, analysisState: "error" as const, analysisError: message }
              : p
          ),
          analysisProgress: { ...s.analysisProgress, [id]: undefined },
        })),

      analysisAborted: (id) =>
        set((s) => ({
          parcels: s.parcels.map((p) =>
            p.id === id && p.analysisState === "loading"
              ? { ...p, analysisState: "idle" as const }
              : p
          ),
          analysisProgress: { ...s.analysisProgress, [id]: undefined },
        })),

      clearDemoParcels: () =>
        set((s) => ({
          parcels: s.parcels.filter((p) => !p.demo),
          selectedParcelId: null,
        })),

      // Real parcels included: "Reset demo" promises a clean slate, and a
      // reviewer's half-drawn test land lingering after it reads as a bug.
      clearAllParcels: () =>
        set({ parcels: [], selectedParcelId: null, analysisProgress: {} }),
    }),
    {
      name: "ghella:parcels:v1",
      storage: createJSONStorage(() => kvStateStorage),
      // The kv facade is empty until hydrateStorage() finishes at boot;
      // App.tsx calls useParcels.persist.rehydrate() right after it.
      skipHydration: true,
      // Progress is transient; persisting it would resurrect dead spinners.
      partialize: (s) => ({
        parcels: s.parcels.map((p) =>
          // A reload mid-analysis must reopen as "idle", not a stuck "loading".
          p.analysisState === "loading"
            ? { ...p, analysisState: "idle" as const }
            : p
        ),
        selectedParcelId: s.selectedParcelId,
      }),
    }
  )
)

function patch(
  set: (fn: (s: ParcelState) => Partial<ParcelState>) => void,
  id: string,
  fields: Partial<Parcel>
) {
  set((s) => ({
    parcels: s.parcels.map((p) => (p.id === id ? { ...p, ...fields } : p)),
  }))
}

/** The selected parcel, or the first one — what "My land" focuses on. */
export function selectFocusParcel(s: ParcelState): Parcel | null {
  return (
    s.parcels.find((p) => p.id === s.selectedParcelId) ?? s.parcels[0] ?? null
  )
}
